-- =============================================================================
-- Artemis · 03 — mentoria: sugestões (IA/heurística) e pedidos
-- =============================================================================

-- -----------------------------------------------------------------------------
-- mentor_suggestions — sugestões geradas para a mentoranda (só ela vê)
-- -----------------------------------------------------------------------------
create table public.mentor_suggestions (
  mentee_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  mentor_id uuid not null references public.profiles (id) on delete cascade,
  rank smallint not null check (rank between 1 and 100),
  score smallint not null check (score between 0 and 100),
  reason text not null default '' check (char_length(reason) <= 1500),
  conversation_starters text[] not null default '{}'
    check (private.text_array_ok(conversation_starters, 10, 500)),
  source text not null check (source in ('ai', 'heuristic')),
  model text check (char_length(model) <= 100),
  created_at timestamptz not null default now(),
  primary key (mentee_id, mentor_id),
  constraint mentor_suggestions_not_self check (mentee_id <> mentor_id)
);
create index mentor_suggestions_mentor_id_idx on public.mentor_suggestions (mentor_id);

alter table public.mentor_suggestions enable row level security;

create policy "Mentoranda vê as próprias sugestões"
  on public.mentor_suggestions for select
  to authenticated
  using (mentee_id = (select auth.uid()));

create policy "Mentoranda grava as próprias sugestões"
  on public.mentor_suggestions for insert
  to authenticated
  with check (mentee_id = (select auth.uid()));

-- Permite upsert (ON CONFLICT DO UPDATE) das próprias sugestões.
create policy "Mentoranda atualiza as próprias sugestões"
  on public.mentor_suggestions for update
  to authenticated
  using (mentee_id = (select auth.uid()))
  with check (mentee_id = (select auth.uid()));

create policy "Mentoranda apaga as próprias sugestões"
  on public.mentor_suggestions for delete
  to authenticated
  using (mentee_id = (select auth.uid()));

revoke all on table public.mentor_suggestions from anon, authenticated;
grant select, delete on table public.mentor_suggestions to authenticated;
grant insert (mentee_id, mentor_id, rank, score, reason, conversation_starters, source, model)
  on table public.mentor_suggestions to authenticated;
grant update (mentee_id, mentor_id, rank, score, reason, conversation_starters, source, model)
  on table public.mentor_suggestions to authenticated;
grant all on table public.mentor_suggestions to service_role;

-- -----------------------------------------------------------------------------
-- mentorship_requests — pedidos de mentoria e seu ciclo de vida
-- -----------------------------------------------------------------------------
create table public.mentorship_requests (
  id uuid primary key default gen_random_uuid(),
  mentee_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  mentor_id uuid not null references public.profiles (id) on delete cascade,
  message text not null check (char_length(message) between 20 and 1500),
  status public.mentorship_status not null default 'pending',
  match_score smallint check (match_score between 0 and 100),
  match_reason text check (char_length(match_reason) <= 1500),
  response_message text check (char_length(response_message) <= 1000),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint mentorship_requests_not_self check (mentee_id <> mentor_id)
);
comment on table public.mentorship_requests is
  'Pedidos de mentoria. Transições de status e capacidade da mentora são garantidas por trigger.';

create index mentorship_requests_mentee_id_idx on public.mentorship_requests (mentee_id, created_at desc);
create index mentorship_requests_mentor_id_idx on public.mentorship_requests (mentor_id, status);
create unique index mentorship_requests_open_pair_idx on public.mentorship_requests (mentee_id, mentor_id)
  where status in ('pending', 'accepted');

-- Antes de inserir: mensagens de erro amigáveis (o RLS também barra).
create function private.mentorship_requests_before_insert()
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

  return new;
end;
$$;

create trigger mentorship_requests_before_insert
  before insert on public.mentorship_requests
  for each row execute function private.mentorship_requests_before_insert();

-- Antes de atualizar: máquina de estados + capacidade da mentora.
--   mentora:    pending → accepted | declined ; accepted → completed
--   mentoranda: pending → cancelled ; accepted → cancelled | completed
create function private.mentorship_requests_before_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_trusted boolean := private.is_trusted_context();
  v_capacity smallint;
  v_accepted integer;
begin
  -- Campos imutáveis (defesa em profundidade: os GRANTs já impedem).
  if new.mentee_id <> old.mentee_id or new.mentor_id <> old.mentor_id
     or new.message <> old.message or new.created_at <> old.created_at then
    raise exception using
      errcode = 'CD002',
      message = 'Só é possível alterar o status e a resposta de um pedido de mentoria.';
  end if;

  if not v_trusted then
    if v_actor is null or v_actor not in (old.mentee_id, old.mentor_id) then
      raise exception using
        errcode = 'CD003',
        message = 'Apenas as participantes podem alterar este pedido de mentoria.';
    end if;

    if new.response_message is distinct from old.response_message and v_actor <> old.mentor_id then
      raise exception using
        errcode = 'CD002',
        message = 'Somente a mentora pode escrever a resposta do pedido.';
    end if;

    if new.status is distinct from old.status and not (
      (v_actor = old.mentor_id and (
        (old.status = 'pending' and new.status in ('accepted', 'declined'))
        or (old.status = 'accepted' and new.status = 'completed')
      ))
      or (v_actor = old.mentee_id and (
        (old.status = 'pending' and new.status = 'cancelled')
        or (old.status = 'accepted' and new.status in ('cancelled', 'completed'))
      ))
    ) then
      raise exception using
        errcode = 'CD002',
        message = case
          when v_actor = old.mentee_id and new.status in ('accepted', 'declined')
            then 'Somente a mentora pode aceitar ou recusar o pedido.'
          when old.status in ('declined', 'cancelled', 'completed')
            then 'Este pedido de mentoria já foi encerrado.'
          else 'Mudança de status não permitida para este pedido de mentoria.'
        end;
    end if;
  end if;

  if new.status = 'accepted' and old.status <> 'accepted' then
    -- Serializa aceites concorrentes da mesma mentora.
    perform pg_advisory_xact_lock(hashtextextended('mentor_capacity:' || new.mentor_id::text, 0));

    select p.mentor_capacity into v_capacity from public.profiles p where p.id = new.mentor_id;
    select count(*) into v_accepted
    from public.mentorship_requests r
    where r.mentor_id = new.mentor_id and r.status = 'accepted' and r.id <> new.id;

    if v_accepted >= coalesce(v_capacity, 0) then
      raise exception using
        errcode = 'CD001',
        message = format(
          'Você já atingiu o limite de %s mentoria(s) simultânea(s). Conclua uma mentoria ou aumente sua capacidade no perfil para aceitar este pedido.',
          coalesce(v_capacity, 0)
        );
    end if;
  end if;

  if old.status = 'pending' and new.status in ('accepted', 'declined') then
    new.responded_at := coalesce(new.responded_at, now());
  end if;

  new.response_message := nullif(btrim(new.response_message), '');
  new.updated_at := now();
  return new;
end;
$$;

create trigger mentorship_requests_before_update
  before update on public.mentorship_requests
  for each row execute function private.mentorship_requests_before_update();

revoke all on function private.mentorship_requests_before_insert() from public, anon, authenticated;
revoke all on function private.mentorship_requests_before_update() from public, anon, authenticated;

alter table public.mentorship_requests enable row level security;

create policy "Participantes veem o pedido de mentoria"
  on public.mentorship_requests for select
  to authenticated
  using ((select auth.uid()) in (mentee_id, mentor_id));

create policy "Mentoranda pede mentoria a uma mentora"
  on public.mentorship_requests for insert
  to authenticated
  with check (
    mentee_id = (select auth.uid())
    and status = 'pending'
    and exists (
      select 1 from public.profiles p
      where p.id = mentor_id and p.is_mentor and p.mentor_available
    )
  );

create policy "Participantes atualizam o pedido de mentoria"
  on public.mentorship_requests for update
  to authenticated
  using ((select auth.uid()) in (mentee_id, mentor_id))
  with check ((select auth.uid()) in (mentee_id, mentor_id));

revoke all on table public.mentorship_requests from anon, authenticated;
grant select on table public.mentorship_requests to authenticated;
grant insert (mentee_id, mentor_id, message, match_score, match_reason)
  on table public.mentorship_requests to authenticated;
grant update (status, response_message) on table public.mentorship_requests to authenticated;
grant all on table public.mentorship_requests to service_role;
