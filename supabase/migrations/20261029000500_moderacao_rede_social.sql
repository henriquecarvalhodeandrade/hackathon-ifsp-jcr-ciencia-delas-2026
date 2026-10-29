-- =============================================================================
-- Artemis · 31 — rede social, parte 6: moderação (docs/18-rede-social.md §2.7)
--
--   Publicações do feed, comentários do feed e vagas de IC entram no fluxo de denúncias:
--     * report_target ganha 'feed_post', 'feed_comment' e 'opportunity';
--     * reports_before_write confere que o alvo existe (e é visível para quem denuncia);
--     * reports_after_status_change descreve os alvos novos no aviso para quem denunciou;
--     * a moderação apaga esses conteúdos (RLS de DELETE) e moderate_delete_content os aceita;
--     * apagar conteúdo de outra pessoa sendo moderadora fica no Registro (trigger
--       *_audit_moderator_delete), como no fórum e na Vitrine.
--   Funções redefinidas inteiras (create or replace): o corpo é o da migration indicada em cada
--   uma, com os casos novos acrescentados.
--   Conversas diretas continuam fora do alcance da moderação: denuncia-se o perfil.
-- =============================================================================

alter type public.report_target add value if not exists 'feed_post';
alter type public.report_target add value if not exists 'feed_comment';
alter type public.report_target add value if not exists 'opportunity';

-- Registro de moderação: alvos novos (lista COMPLETA repetida de propósito).
alter table public.moderation_audit_log
  drop constraint moderation_audit_log_target_type_check,
  add constraint moderation_audit_log_target_type_check check (target_type in (
    'thread', 'post', 'paper', 'paper_comment', 'profile', 'report',
    'public_question', 'public_answer',
    'feed_post', 'feed_comment', 'opportunity'
  ));

-- -----------------------------------------------------------------------------
-- 1. Denúncia: o alvo precisa existir (corpo de 20261028170100_anti_spam_limits.sql + 3 alvos)
-- -----------------------------------------------------------------------------
create or replace function private.reports_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_target_exists boolean;
begin
  new.details := nullif(btrim(new.details), '');
  new.resolution_note := nullif(btrim(new.resolution_note), '');

  if tg_op = 'INSERT' then
    if not private.is_trusted_context() then
      new.status := 'open';
      new.resolved_by := null;
      new.resolved_at := null;
      new.resolution_note := null;

      -- Serializa as denúncias da mesma pessoa (as contagens abaixo valem mesmo em paralelo).
      perform pg_advisory_xact_lock(hashtextextended('reports:' || coalesce(v_uid::text, ''), 0));

      -- O alvo precisa existir e estar visível para quem denuncia (função SECURITY INVOKER:
      -- vale o RLS dela — paper oculto de outra pessoa conta como inexistente).
      v_target_exists := case new.target_type
        when 'thread' then exists (select 1 from public.forum_threads t where t.id = new.target_id)
        when 'post' then exists (select 1 from public.forum_posts p where p.id = new.target_id)
        when 'paper' then exists (select 1 from public.papers p where p.id = new.target_id)
        when 'paper_comment' then exists (select 1 from public.paper_comments c where c.id = new.target_id)
        when 'profile' then exists (select 1 from public.profiles p where p.id = new.target_id)
        when 'feed_post' then exists (select 1 from public.posts p where p.id = new.target_id)
        when 'feed_comment' then exists (select 1 from public.post_comments c where c.id = new.target_id)
        when 'opportunity' then exists (select 1 from public.research_opportunities o where o.id = new.target_id)
        else false
      end;
      if not v_target_exists then
        raise exception using
          errcode = 'CD015',
          message = 'Não encontramos esse conteúdo. Talvez ele já tenha sido removido.';
      end if;

      if exists (
        select 1 from public.reports r
        where r.reporter_id = new.reporter_id
          and r.target_type = new.target_type
          and r.target_id = new.target_id
          and r.status = 'open'
      ) then
        raise exception using
          errcode = 'CD018',
          message = 'Você já denunciou este conteúdo e a moderação está analisando. Obrigada por avisar.';
      end if;

      if not private.is_moderator() and (
        select count(*) from public.reports r
        where r.reporter_id = new.reporter_id and r.created_at > now() - interval '24 hours'
      ) >= 10 then
        raise exception using
          errcode = 'CD019',
          message = 'Você já enviou 10 denúncias nas últimas 24 horas. A moderação está analisando as anteriores; tente de novo amanhã.';
      end if;
    end if;
    return new;
  end if;

  -- UPDATE (somente moderação, garantido pelo RLS)
  if new.reporter_id is distinct from old.reporter_id
     or new.target_type is distinct from old.target_type
     or new.target_id is distinct from old.target_id
     or new.reason is distinct from old.reason then
    raise exception using errcode = 'CD002', message = 'Os dados da denúncia não podem ser alterados.';
  end if;

  if new.status = 'open' then
    new.resolved_at := null;
    new.resolved_by := null;
  elsif new.status is distinct from old.status then
    new.resolved_at := now();
    new.resolved_by := coalesce((select auth.uid()), new.resolved_by);
  elsif (select auth.uid()) is not null then
    -- Mesmo status: não deixa trocar quem resolveu por outra pessoa.
    new.resolved_at := old.resolved_at;
    -- Exceção: a FK `resolved_by ... on delete set null` (conta da moderadora
    -- excluída). Se o perfil antigo não existe mais, aceita o NULL; senão a
    -- exclusão da conta falharia com violação de FK sempre que rodasse numa
    -- sessão com JWT de usuária (ex.: "excluir minha conta").
    if new.resolved_by is not null
       or exists (select 1 from public.profiles p where p.id = old.resolved_by) then
      new.resolved_by := old.resolved_by;
    end if;
  end if;
  return new;
end;
$$;
revoke all on function private.reports_before_write() from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 2. Aviso para quem denunciou (corpo de 20261028090000_integration.sql + 3 alvos)
-- -----------------------------------------------------------------------------
create or replace function private.reports_after_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target text := case new.target_type
    when 'thread' then 'um tópico do fórum'
    when 'post' then 'uma resposta no fórum'
    when 'paper' then 'um paper da Vitrine'
    when 'paper_comment' then 'um comentário em paper'
    when 'feed_post' then 'uma publicação do feed'
    when 'feed_comment' then 'um comentário no feed'
    when 'opportunity' then 'uma vaga de IC'
    else 'um perfil'
  end;
  v_body text;
begin
  perform private.log_moderation(
    case when new.status = 'resolved' then 'resolve_report' else 'dismiss_report' end,
    new.target_type::text, new.target_id, new.id, null
  );

  if new.reporter_id is not distinct from (select auth.uid()) then
    return null;
  end if;

  v_body := case when new.status = 'resolved'
    then format('A moderação analisou sua denúncia sobre %s e tomou as providências necessárias. Obrigada por ajudar a cuidar da comunidade.', v_target)
    else format('A moderação analisou sua denúncia sobre %s e não encontrou violação do código de conduta. Obrigada por avisar: se algo continuar incomodando, você pode denunciar de novo.', v_target)
  end;
  if new.resolution_note is not null then
    v_body := v_body || ' Nota da moderação: ' || new.resolution_note;
  end if;

  perform private.notify(
    new.reporter_id,
    'report_resolved',
    case when new.status = 'resolved' then 'Sua denúncia foi resolvida' else 'Sua denúncia foi analisada' end,
    v_body,
    '/notificacoes'
  );
  return null;
end;
$$;
revoke all on function private.reports_after_status_change() from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 3. Registro de exclusões da moderação (corpo de 20261028170500_panel_delete_audit_null_fix.sql
--    + publicações, comentários do feed e vagas)
-- -----------------------------------------------------------------------------
create or replace function private.audit_moderator_delete()
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
  v_via_panel boolean;
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
    when 'posts' then
      v_target_type := 'feed_post';
      v_is_author := (v_old ->> 'author_id')::uuid is not distinct from v_uid;
    when 'post_comments' then
      v_target_type := 'feed_comment';
      v_is_author := (v_old ->> 'author_id')::uuid is not distinct from v_uid;
      v_parent_gone := not exists (
        select 1 from public.posts p where p.id = (v_old ->> 'post_id')::uuid
      );
    when 'research_opportunities' then
      v_target_type := 'opportunity';
      v_is_author := (v_old ->> 'owner_id')::uuid is not distinct from v_uid;
    else
      return old;
  end case;

  -- Alvo da RPC do painel (moderate_delete_content): sempre registrado, mesmo da própria autora.
  -- coalesce: sem a RPC a configuração não existe (NULL) e a comparação daria NULL.
  v_via_panel := coalesce(current_setting('artemis.moderation_target', true) = old.id::text, false);

  if v_parent_gone or (v_is_author and not v_via_panel) then
    return old;
  end if;

  -- Motivo e denúncia informados pelo painel, só para este alvo.
  if v_via_panel then
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

create trigger posts_audit_moderator_delete
  before delete on public.posts
  for each row execute function private.audit_moderator_delete();

create trigger post_comments_audit_moderator_delete
  before delete on public.post_comments
  for each row execute function private.audit_moderator_delete();

create trigger research_opportunities_audit_moderator_delete
  before delete on public.research_opportunities
  for each row execute function private.audit_moderator_delete();

-- -----------------------------------------------------------------------------
-- 4. A moderação também apaga (RLS de DELETE)
-- -----------------------------------------------------------------------------
drop policy "Autora apaga a própria publicação" on public.posts;
create policy "Autora ou moderação apagam a publicação"
  on public.posts for delete
  to authenticated
  using (author_id = (select auth.uid()) or (select private.is_moderator()));

drop policy "Autora do comentário ou da publicação apaga" on public.post_comments;
create policy "Autora do comentário, da publicação ou moderação apagam"
  on public.post_comments for delete
  to authenticated
  using (
    author_id = (select auth.uid())
    or private.owns_post(post_id)
    or (select private.is_moderator())
  );

drop policy "Dona apaga a própria oportunidade" on public.research_opportunities;
create policy "Dona ou moderação apagam a oportunidade"
  on public.research_opportunities for delete
  to authenticated
  using (owner_id = (select auth.uid()) or (select private.is_moderator()));

-- -----------------------------------------------------------------------------
-- 5. Exclusão pelo painel (corpo de 20261028170200_moderation_audit_avatar_hardening.sql + 3 alvos)
-- -----------------------------------------------------------------------------
create or replace function public.moderate_delete_content(
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
      message = 'Informe um tópico, resposta, paper, comentário, publicação do feed ou vaga.';
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
    when 'feed_post' then delete from public.posts p where p.id = p_target_id;
    when 'feed_comment' then delete from public.post_comments c where c.id = p_target_id;
    when 'opportunity' then delete from public.research_opportunities o where o.id = p_target_id;
  end case;
  get diagnostics v_count = row_count;

  perform set_config('artemis.moderation_target', '', true);
  perform set_config('artemis.moderation_reason', '', true);
  perform set_config('artemis.moderation_report', '', true);
  return v_count > 0;
end;
$$;
