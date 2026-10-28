-- =============================================================================
-- Artemis · 13 — correções da auditoria de segurança
--   1. Autoria anônima: a moderação NÃO lê mais forum_anonymous_authorship direto pela API.
--      Antes, um simples `select` devolvia a autora de todo conteúdo anônimo sem motivo nem
--      registro — contornando a auditoria obrigatória de reveal_anonymous_author. Agora cada
--      pessoa só vê a PRÓPRIA autoria; a moderação revela só pela RPC (motivo + auditoria).
--   2. Denúncias: o banco recusa denúncia repetida (mesma pessoa, mesmo alvo, ainda aberta),
--      alvo inexistente/invisível e rajadas (mais de 20 por hora). Antes, só a Server Action
--      evitava repetição — pela API dava para encher a fila da moderação.
--   3. Pedidos de mentoria: no máximo 3 pedidos para a mesma mentora a cada 7 dias e 10 pedidos
--      a cada 24 h. Antes, pedir e cancelar em laço gerava avisos sem fim para a mentora.
--   4. Matching com IA: cota guardada no banco (claim_ai_matching_slot), que a usuária não
--      consegue zerar. A espera de 60 s antiga dependia de mentor_suggestions.created_at —
--      bastava apagar as próprias sugestões (ou pedir várias vezes em paralelo) para chamar
--      a IA sem limite e esgotar a cota gratuita compartilhada.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. forum_anonymous_authorship: só a própria autora lê
-- -----------------------------------------------------------------------------
drop policy "Autora e moderação veem a autoria anônima" on public.forum_anonymous_authorship;

create policy "Autora vê a própria autoria anônima"
  on public.forum_anonymous_authorship for select
  to authenticated
  using (user_id = (select auth.uid()));

comment on table public.forum_anonymous_authorship is
  'Autoria real de tópicos/respostas anônimos. Pela API, cada pessoa lê só a própria autoria; a moderação revela só pela RPC reveal_anonymous_author (motivo obrigatório + registro de auditoria). Escrita apenas por triggers.';

-- -----------------------------------------------------------------------------
-- 2. reports: repetição, alvo inexistente e rajadas
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

      if (
        select count(*) from public.reports r
        where r.reporter_id = new.reporter_id and r.created_at > now() - interval '1 hour'
      ) >= 20 then
        raise exception using
          errcode = 'CD019',
          message = 'Você enviou muitas denúncias em pouco tempo. Aguarde um pouco: a moderação já está analisando as anteriores.';
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
-- 3. mentorship_requests: limites de pedidos
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

    if (
      select count(*) from public.mentorship_requests r
      where r.mentee_id = new.mentee_id and r.created_at > now() - interval '24 hours'
    ) >= 10 then
      raise exception using
        errcode = 'CD020',
        message = 'Você enviou muitos pedidos de mentoria nas últimas 24 horas. Tente de novo amanhã.';
    end if;
  end if;

  return new;
end;
$$;
revoke all on function private.mentorship_requests_before_insert() from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 4. Cota do matching com IA (60 s entre gerações e no máximo 20 a cada 24 h)
--    Tabela no schema private (fora da API): a usuária não lê, não altera nem apaga.
-- -----------------------------------------------------------------------------
create table private.ai_matching_usage (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  last_claimed_at timestamptz not null,
  window_started_at timestamptz not null,
  window_count integer not null default 0 check (window_count >= 0)
);
comment on table private.ai_matching_usage is
  'Uso do matching com IA por pessoa (cota da API gratuita). Escrita só por public.claim_ai_matching_slot().';

alter table private.ai_matching_usage enable row level security;
revoke all on table private.ai_matching_usage from public, anon, authenticated;
grant all on table private.ai_matching_usage to service_role;

-- Reserva (atomicamente) uma geração de sugestões com IA para a usuária atual.
-- true = pode chamar a IA agora; false = espere (60 s desde a última ou 20 nas últimas 24 h).
-- Chamar por conta própria só gasta a cota de quem chama.
create function public.claim_ai_matching_slot()
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_now timestamptz := now();
  v_usage private.ai_matching_usage%rowtype;
  v_in_window boolean;
begin
  if v_uid is null then
    raise exception using
      errcode = '42501',
      message = 'Entre na sua conta para ver sugestões de mentoras.';
  end if;

  insert into private.ai_matching_usage (profile_id, last_claimed_at, window_started_at, window_count)
  values (v_uid, '-infinity', v_now, 0)
  on conflict (profile_id) do nothing;

  select * into v_usage from private.ai_matching_usage where profile_id = v_uid for update;

  if v_usage.last_claimed_at > v_now - interval '60 seconds' then
    return false;
  end if;
  v_in_window := v_usage.window_started_at > v_now - interval '24 hours';
  if v_in_window and v_usage.window_count >= 20 then
    return false;
  end if;

  update private.ai_matching_usage
  set last_claimed_at = v_now,
      window_count = case when v_in_window then v_usage.window_count + 1 else 1 end,
      window_started_at = case when v_in_window then v_usage.window_started_at else v_now end
  where profile_id = v_uid;
  return true;
end;
$$;

revoke all on function public.claim_ai_matching_slot() from public, anon, authenticated;
grant execute on function public.claim_ai_matching_slot() to authenticated, service_role;
