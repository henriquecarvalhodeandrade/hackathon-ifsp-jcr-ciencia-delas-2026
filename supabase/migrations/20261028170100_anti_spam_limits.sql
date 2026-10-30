-- =============================================================================
-- Artemis · 15 — limites anti-spam no banco (valem também para quem usa a API direto)
--
--   Por pessoa (auth.uid()), em janela móvel. Moderação/admin e contextos confiáveis
--   (service_role, seed, migrations — sem auth.uid()) não têm limite.
--
--   | Tabela              | Limite         | Código | Como conta                                        |
--   | ------------------- | -------------- | ------ | ------------------------------------------------- |
--   | forum_threads       | 5 por hora     | CD021  | private.rate_limit_events (registro de envios)    |
--   | forum_posts         | 30 por hora    | CD022  | private.rate_limit_events                         |
--   | paper_comments      | 20 por hora    | CD023  | private.rate_limit_events                         |
--   | papers              | 5 em 24 h      | CD024  | private.rate_limit_events                         |
--   | paper_votes         | 60 por hora    | CD025  | private.rate_limit_events                         |
--   | reports             | 10 em 24 h     | CD019  | linhas de public.reports (antes: 20 por hora)     |
--   | mentorship_requests | 5 em 24 h      | CD020  | linhas de public.mentorship_requests (antes: 10)  |
--
--   Por que um registro à parte (private.rate_limit_events) para conteúdo que a própria autora
--   pode apagar: contando só as linhas que existem, publicar-e-apagar em laço nunca bateria no
--   limite — e cada resposta/comentário novo gera um aviso para outra pessoa (spam de
--   notificações). O registro fica fora da API (a usuária não lê, não altera nem apaga), guarda só
--   (pessoa, ação, quando) — nunca qual conteúdo, então não revela autoria anônima — e cada envio
--   apaga os eventos da mesma pessoa/ação que já saíram da janela. Denúncias e pedidos de
--   mentoria não podem ser apagados pela usuária, então continuam contando as próprias linhas
--   (e as limpezas de teste feitas com a service role liberam a cota de novo).
--
--   Um envio recusado (por este limite ou por qualquer outro erro) desfaz a transação inteira,
--   inclusive o evento registrado: só o que foi de fato gravado conta.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Registro de envios (fora da API)
-- -----------------------------------------------------------------------------
create table private.rate_limit_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  action text not null
    check (action in ('forum_thread', 'forum_post', 'paper_comment', 'paper', 'paper_vote')),
  created_at timestamptz not null default now()
);
comment on table private.rate_limit_events is
  'Envios recentes por pessoa (limites anti-spam). Só (pessoa, ação, quando); escrita apenas por private.enforce_rate_limit().';

create index rate_limit_events_user_action_created_idx
  on private.rate_limit_events (user_id, action, created_at desc);

alter table private.rate_limit_events enable row level security;
revoke all on table private.rate_limit_events from public, anon, authenticated;
grant all on table private.rate_limit_events to service_role;

-- Confere e registra um envio da usuária atual. Erro p_errcode/p_message quando ela já fez
-- p_max envios da ação dentro de p_window.
create function private.enforce_rate_limit(
  p_action text,
  p_max integer,
  p_window interval,
  p_errcode text,
  p_message text
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  -- service_role/seed/migrations (sem usuária) e moderação não têm limite.
  if v_uid is null or private.is_moderator() then
    return;
  end if;

  -- Serializa os envios da mesma pessoa para a mesma ação: a contagem vale mesmo em paralelo.
  perform pg_advisory_xact_lock(hashtextextended('rate_limit:' || p_action || ':' || v_uid::text, 0));

  if (
    select count(*) from private.rate_limit_events e
    where e.user_id = v_uid and e.action = p_action and e.created_at > now() - p_window
  ) >= p_max then
    raise exception using errcode = p_errcode, message = p_message;
  end if;

  delete from private.rate_limit_events e
  where e.user_id = v_uid and e.action = p_action and e.created_at <= now() - p_window;

  insert into private.rate_limit_events (user_id, action) values (v_uid, p_action);
end;
$$;

-- Trigger BEFORE INSERT único: o limite de cada tabela fica num lugar só.
create function private.rate_limit_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  case tg_table_name
    when 'forum_threads' then
      perform private.enforce_rate_limit('forum_thread', 5, interval '1 hour', 'CD021',
        'Você publicou muitos tópicos na última hora. Respire e tente de novo em alguns minutos.');
    when 'forum_posts' then
      perform private.enforce_rate_limit('forum_post', 30, interval '1 hour', 'CD022',
        'Você enviou muitas respostas na última hora. Respire e tente de novo em alguns minutos.');
    when 'paper_comments' then
      perform private.enforce_rate_limit('paper_comment', 20, interval '1 hour', 'CD023',
        'Você comentou muitas vezes na última hora. Respire e tente de novo em alguns minutos.');
    when 'papers' then
      perform private.enforce_rate_limit('paper', 5, interval '24 hours', 'CD024',
        'Você já divulgou 5 papers nas últimas 24 horas. Obrigada por movimentar a Vitrine! Tente de novo amanhã.');
    when 'paper_votes' then
      perform private.enforce_rate_limit('paper_vote', 60, interval '1 hour', 'CD025',
        'Você destacou muitos papers na última hora. Respire e tente de novo em alguns minutos.');
    else
      raise exception 'rate_limit_before_insert: tabela sem limite configurado (%)', tg_table_name;
  end case;
  return new;
end;
$$;

revoke all on function private.enforce_rate_limit(text, integer, interval, text, text) from public, anon, authenticated;
revoke all on function private.rate_limit_before_insert() from public, anon, authenticated;

create trigger forum_threads_rate_limit
  before insert on public.forum_threads
  for each row execute function private.rate_limit_before_insert();

create trigger forum_posts_rate_limit
  before insert on public.forum_posts
  for each row execute function private.rate_limit_before_insert();

create trigger paper_comments_rate_limit
  before insert on public.paper_comments
  for each row execute function private.rate_limit_before_insert();

create trigger papers_rate_limit
  before insert on public.papers
  for each row execute function private.rate_limit_before_insert();

create trigger paper_votes_rate_limit
  before insert on public.paper_votes
  for each row execute function private.rate_limit_before_insert();

-- -----------------------------------------------------------------------------
-- reports: 10 denúncias em 24 h por pessoa (CD019; antes eram 20 por hora). Moderação não tem
-- limite. O resto da função é igual ao da migration 20261028150000_security_audit.sql.
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

-- A contagem por denunciante e data usa este índice (substitui o de reporter_id sozinho, que
-- continua coberto pela primeira coluna — inclusive para a FK).
create index reports_reporter_created_idx on public.reports (reporter_id, created_at desc);
drop index public.reports_reporter_id_idx;

-- -----------------------------------------------------------------------------
-- mentorship_requests: 5 pedidos em 24 h (CD020; antes eram 10). Moderação não tem o limite
-- diário; o de 3 pedidos para a mesma mentora em 7 dias continua valendo para todas (é contra
-- pedir-e-cancelar em laço para uma pessoa só). O resto é igual ao da migration 20261028150000.
-- A contagem usa o índice mentorship_requests_mentee_id_idx (mentee_id, created_at desc).
-- -----------------------------------------------------------------------------
create or replace function private.mentorship_requests_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_mentor public.profiles%rowtype;
begin
  new.message := btrim(new.message);

  if new.mentee_id = new.mentor_id then
    raise exception using
      errcode = 'CD003',
      message = 'Você não pode pedir mentoria para si mesma.';
  end if;

  select * into v_mentor from public.profiles where id = new.mentor_id;
  if not found or not v_mentor.is_mentor or v_mentor.onboarded_at is null then
    raise exception using
      errcode = 'CD003',
      message = 'Esta pesquisadora não oferece mentoria pela plataforma.';
  end if;
  if not v_mentor.mentor_available then
    raise exception using
      errcode = 'CD003',
      message = 'Esta mentora não está recebendo novos pedidos no momento.';
  end if;

  if exists (
    select 1 from public.mentorship_requests r
    where r.mentee_id = new.mentee_id and r.mentor_id = new.mentor_id
      and r.status in ('pending', 'accepted')
  ) then
    raise exception using
      errcode = 'CD004',
      message = 'Você já tem um pedido em aberto ou uma mentoria ativa com esta mentora.';
  end if;

  -- Limites contra pedir-e-cancelar em laço (cada pedido e cada cancelamento avisam a mentora).
  if not private.is_trusted_context() then
    perform pg_advisory_xact_lock(hashtextextended('mentorship_requests:' || new.mentee_id::text, 0));

    if (
      select count(*) from public.mentorship_requests r
      where r.mentee_id = new.mentee_id and r.mentor_id = new.mentor_id
        and r.created_at > now() - interval '7 days'
    ) >= 3 then
      raise exception using
        errcode = 'CD020',
        message = 'Você já fez 3 pedidos para esta mentora nos últimos 7 dias. Espere alguns dias ou escolha outra mentora.';
    end if;

    if not private.is_moderator() and (
      select count(*) from public.mentorship_requests r
      where r.mentee_id = new.mentee_id and r.created_at > now() - interval '24 hours'
    ) >= 5 then
      raise exception using
        errcode = 'CD020',
        message = 'Você já enviou 5 pedidos de mentoria nas últimas 24 horas. Espere as respostas e tente de novo amanhã.';
    end if;
  end if;

  return new;
end;
$$;
revoke all on function private.mentorship_requests_before_insert() from public, anon, authenticated;
