-- =============================================================================
-- Artemis · 16 — endurecimento da auditoria de segurança
--   1. Exclusão de conteúdo pela moderação sempre registrada no banco (`delete_content`).
--      Antes, só o painel (/admin) gravava o registro — e depois da exclusão, fora da transação.
--      Uma moderadora apagando direto no fórum, na Vitrine ou pela API não deixava rastro.
--      Agora um trigger em forum_threads, forum_posts, papers e paper_comments grava a linha
--      quando quem apaga é moderadora/admin e NÃO é a autora. O painel passa motivo e denúncia
--      pela RPC moderate_delete_content, que apaga e deixa o trigger registrar (uma linha só).
--   2. profiles.avatar_url só aceita NULL ou o avatar público da PRÓPRIA pasta no Storage
--      (/storage/v1/object/public/avatars/<id do perfil>/<arquivo>). Antes, qualquer http(s)
--      gravado pela API seria uma URL de terceiros carregada pelo navegador de quem vê o perfil.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Auditoria de exclusões feitas pela moderação
--
-- Por que BEFORE DELETE (e não AFTER): a autoria de conteúdo anônimo fica em
-- forum_anonymous_authorship, ligada ao tópico/resposta por uma FK ON DELETE CASCADE. A cascata
-- roda num trigger interno (RI_ConstraintTrigger_*) que dispara ANTES de qualquer trigger AFTER
-- nosso, então num AFTER DELETE a linha de autoria já sumiu e não daria para saber se quem apagou
-- é a própria autora anônima. No BEFORE DELETE tudo ainda existe; o RLS já filtrou as linhas que
-- a pessoa pode apagar e nenhum outro trigger BEFORE DELETE pode cancelar a exclusão — se algo
-- falhar depois, a transação inteira (inclusive o registro) é desfeita.
--
-- Não registra:
--   * a autora apagando o próprio conteúdo (inclusive anônimo — comparação com a autoria
--     registrada, sem nunca gravar quem é a autora);
--   * contexto confiável (service_role, seed, exclusão de conta — sem auth.uid());
--   * o que some em cascata (respostas de um tópico, comentários de um paper): o pai apagado já
--     tem a sua linha.
-- -----------------------------------------------------------------------------
create function private.audit_moderator_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_old jsonb := to_jsonb(old);
  v_target_type text;
  v_is_author boolean;
  v_parent_gone boolean := false;
  v_reason text;
  v_report_text text;
  v_report uuid;
begin
  if v_uid is null or not private.is_moderator() then
    return old;
  end if;

  case tg_table_name
    when 'forum_threads' then
      v_target_type := 'thread';
      v_is_author := (v_old ->> 'author_id')::uuid is not distinct from v_uid
        or ((v_old ->> 'is_anonymous')::boolean and private.is_anonymous_thread_author(old.id));
    when 'forum_posts' then
      v_target_type := 'post';
      v_is_author := (v_old ->> 'author_id')::uuid is not distinct from v_uid
        or ((v_old ->> 'is_anonymous')::boolean and private.is_anonymous_post_author(old.id));
      v_parent_gone := not exists (
        select 1 from public.forum_threads t where t.id = (v_old ->> 'thread_id')::uuid
      );
    when 'papers' then
      v_target_type := 'paper';
      v_is_author := (v_old ->> 'submitted_by')::uuid is not distinct from v_uid;
    when 'paper_comments' then
      v_target_type := 'paper_comment';
      v_is_author := (v_old ->> 'author_id')::uuid is not distinct from v_uid;
      v_parent_gone := not exists (
        select 1 from public.papers p where p.id = (v_old ->> 'paper_id')::uuid
      );
    else
      return old;
  end case;

  if v_is_author or v_parent_gone then
    return old;
  end if;

  -- Motivo e denúncia informados pelo painel (RPC moderate_delete_content), só para este alvo.
  if current_setting('artemis.moderation_target', true) = old.id::text then
    v_reason := nullif(current_setting('artemis.moderation_reason', true), '');
    v_report_text := nullif(current_setting('artemis.moderation_report', true), '');
    if v_report_text ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      select r.id into v_report from public.reports r where r.id = v_report_text::uuid;
    end if;
  end if;

  perform private.log_moderation('delete_content', v_target_type, old.id, v_report, v_reason);
  return old;
end;
$$;
revoke all on function private.audit_moderator_delete() from public, anon, authenticated;

create trigger forum_threads_audit_moderator_delete
  before delete on public.forum_threads
  for each row execute function private.audit_moderator_delete();

create trigger forum_posts_audit_moderator_delete
  before delete on public.forum_posts
  for each row execute function private.audit_moderator_delete();

create trigger papers_audit_moderator_delete
  before delete on public.papers
  for each row execute function private.audit_moderator_delete();

create trigger paper_comments_audit_moderator_delete
  before delete on public.paper_comments
  for each row execute function private.audit_moderator_delete();

-- Exclusão pela moderação com motivo e denúncia (painel /admin). SECURITY INVOKER: o RLS de
-- quem chama decide o que pode ser apagado; o trigger acima grava o registro na mesma transação.
-- Devolve true se apagou agora e false se o conteúdo já não existia.
create function public.moderate_delete_content(
  p_target_type public.report_target,
  p_target_id uuid,
  p_reason text default null,
  p_report_id uuid default null
)
returns boolean
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_count integer;
begin
  if not private.is_moderator() then
    raise exception using
      errcode = '42501',
      message = 'Apenas a moderação pode excluir conteúdo pelo painel.';
  end if;
  if p_target_type is null or p_target_type = 'profile' or p_target_id is null then
    raise exception using
      errcode = '22023',
      message = 'Informe um tópico, resposta, paper ou comentário.';
  end if;
  if p_report_id is not null and not exists (
    select 1 from public.reports r
    where r.id = p_report_id and r.target_type = p_target_type and r.target_id = p_target_id
  ) then
    raise exception using
      errcode = 'CD017',
      message = 'A denúncia informada não é sobre este conteúdo.';
  end if;

  perform set_config('artemis.moderation_target', p_target_id::text, true);
  perform set_config('artemis.moderation_reason', coalesce(left(btrim(p_reason), 500), ''), true);
  perform set_config('artemis.moderation_report', coalesce(p_report_id::text, ''), true);

  case p_target_type
    when 'thread' then delete from public.forum_threads t where t.id = p_target_id;
    when 'post' then delete from public.forum_posts p where p.id = p_target_id;
    when 'paper' then delete from public.papers p where p.id = p_target_id;
    when 'paper_comment' then delete from public.paper_comments c where c.id = p_target_id;
  end case;
  get diagnostics v_count = row_count;

  perform set_config('artemis.moderation_target', '', true);
  perform set_config('artemis.moderation_reason', '', true);
  perform set_config('artemis.moderation_report', '', true);
  return v_count > 0;
end;
$$;

revoke all on function public.moderate_delete_content(public.report_target, uuid, text, uuid)
  from public, anon, authenticated;
grant execute on function public.moderate_delete_content(public.report_target, uuid, text, uuid)
  to authenticated, service_role;

comment on column public.moderation_audit_log.action is
  'delete_content é gravado pelo trigger *_audit_moderator_delete (moderação apagando conteúdo de outra pessoa, em qualquer tela); as demais ações, pelas RPCs de moderação, pelo trigger de denúncias e pelo painel (change_role).';

-- -----------------------------------------------------------------------------
-- 2. profiles.avatar_url: NULL ou o avatar público da própria pasta no Storage
--    O servidor do Storage não é conhecido pelo banco (muda entre local, preview e Cloud): a
--    regra fixa o caminho público do bucket `avatars`, exige que a pasta seja o id do próprio
--    perfil e um nome de arquivo simples (sem subpastas, `..`, query ou fragmento), e recusa
--    usuário/senha na URL (https://projeto.supabase.co@outro-servidor/...). O app ainda confere a
--    origem exata (NEXT_PUBLIC_SUPABASE_URL) ao gravar e ao exibir (src/lib/profile/avatar.ts).
-- -----------------------------------------------------------------------------
create function private.is_own_avatar_url(p_profile_id uuid, p_url text)
returns boolean
language sql
immutable
parallel safe
set search_path = ''
return p_url is null
  or p_url ~ (
    '^https?://[A-Za-z0-9.-]+(:[0-9]{1,5})?/storage/v1/object/public/avatars/'
    || p_profile_id::text
    || '/[A-Za-z0-9][A-Za-z0-9._-]{0,199}$'
  );

comment on function private.is_own_avatar_url(uuid, text) is
  'true se a URL for NULL ou o avatar público do próprio perfil (bucket avatars, pasta = id do perfil).';

revoke all on function private.is_own_avatar_url(uuid, text) from public, anon, authenticated;
grant execute on function private.is_own_avatar_url(uuid, text) to authenticated, service_role;

-- Fotos externas gravadas antes desta regra (ex.: login social, PATCH direto pela API) saem do
-- perfil: as iniciais aparecem no lugar até a pessoa enviar uma foto.
update public.profiles
set avatar_url = null
where not private.is_own_avatar_url(id, avatar_url);

alter table public.profiles
  add constraint profiles_avatar_url_own_storage
  check (private.is_own_avatar_url(id, avatar_url));

-- Cadastro: a foto do provedor (Google: `picture`) é de outro servidor e não passaria na regra —
-- descartada para não impedir o cadastro. Igual à migration 20261027120100, salvo o avatar.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_name text;
  v_avatar text;
begin
  v_name := left(btrim(coalesce(
    nullif(btrim(v_meta ->> 'full_name'), ''),
    nullif(btrim(v_meta ->> 'name'), ''),
    ''
  )), 120);

  v_avatar := coalesce(nullif(btrim(v_meta ->> 'avatar_url'), ''), nullif(btrim(v_meta ->> 'picture'), ''));
  -- Só fica o avatar do próprio perfil no Storage do projeto (na prática, nunca no cadastro).
  if v_avatar is not null
     and (char_length(v_avatar) > 500 or not private.is_own_avatar_url(new.id, v_avatar)) then
    v_avatar := null;
  end if;

  insert into public.profiles (id, full_name, avatar_url)
  values (new.id, v_name, v_avatar)
  on conflict (id) do nothing;

  return new;
end;
$$;
revoke all on function private.handle_new_user() from public, anon, authenticated;
