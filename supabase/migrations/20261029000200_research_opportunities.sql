-- =============================================================================
-- Artemis · 28 — rede social, parte 3: Explorar ICs (docs/18-rede-social.md §2.3)
--
--   Pesquisadoras publicam vagas de iniciação científica (e IC júnior, TCC, extensão,
--   voluntariado); estudantes se candidatam com uma carta de apresentação.
--
--   | Tabela                   | Ler                         | Escrever                                       |
--   | ------------------------ | --------------------------- | ---------------------------------------------- |
--   | research_opportunities   | todas as membras            | mestrado em diante publica (CD070); a dona     |
--   |                          |                             | edita, encerra/reabre e apaga                  |
--   | opportunity_applications | a candidata e a dona da vaga| a candidata se candidata e desiste; a dona     |
--   |                          |                             | responde (em análise, aprovada, não aprovada)  |
--
--   - Candidatura só em vaga aberta e dentro do prazo (horário de Brasília) — CD071; nunca na
--     própria (CD072); uma por vaga (CD073). Transições inválidas: CD074.
--   - application_count (candidaturas não desistidas) é mantido por trigger.
--   - Avisos: nova candidatura → dona (agrupado por vaga); resposta → candidata.
--   - LGPD: apagar o perfil apaga vagas e candidaturas em cascata; vaga apagada leva os avisos
--     que apontavam para ela.
-- =============================================================================

create type public.opportunity_kind as enum ('ic', 'ic_junior', 'tcc', 'extension', 'volunteer');
create type public.opportunity_status as enum ('open', 'closed');
create type public.application_status as enum ('submitted', 'in_review', 'accepted', 'declined', 'withdrawn');

-- -----------------------------------------------------------------------------
-- 1. research_opportunities
-- -----------------------------------------------------------------------------
create table public.research_opportunities (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  kind public.opportunity_kind not null default 'ic',
  title text not null check (char_length(title) between 5 and 160),
  description text not null check (char_length(description) between 30 and 4000),
  requirements text check (char_length(requirements) <= 2000),
  area_id smallint references public.research_areas (id) on delete set null,
  keywords text[] not null default '{}'
    check (private.text_array_ok(keywords, 10, 40) and keywords = private.normalize_tags(keywords)),
  institution text check (char_length(institution) <= 160),
  city text check (char_length(city) <= 80),
  state char(2) check (state ~ '^[A-Z]{2}$'),
  modality public.meeting_format not null default 'in_person',
  has_scholarship boolean not null default false,
  scholarship_info text check (char_length(scholarship_info) <= 160),
  weekly_hours smallint check (weekly_hours between 1 and 40),
  vacancies smallint not null default 1 check (vacancies between 1 and 20),
  target_stages public.career_stage[] not null default '{undergraduate}'
    check (cardinality(target_stages) between 1 and 8),
  deadline date,
  status public.opportunity_status not null default 'open',
  application_count integer not null default 0 check (application_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz
);
comment on table public.research_opportunities is
  'Vagas de IC e afins (docs/18 §2.3). Todas as membras leem; mestrado em diante publica; a dona edita.';
comment on column public.research_opportunities.application_count is
  'Candidaturas não desistidas (trigger). Ninguém grava direto.';
comment on column public.research_opportunities.deadline is
  'Último dia para se candidatar (data de Brasília). NULL = sem prazo.';

alter table public.research_opportunities
  add column search_text text generated always as (
    private.search_text(array[title, description, institution, city] || keywords)
  ) stored;
comment on column public.research_opportunities.search_text is
  'Gerada: título, descrição, instituição, cidade e palavras-chave sem acento e em minúsculas.';

create index research_opportunities_owner_idx on public.research_opportunities (owner_id, created_at desc);
create index research_opportunities_open_idx on public.research_opportunities (status, created_at desc);
create index research_opportunities_area_idx on public.research_opportunities (area_id);
create index research_opportunities_search_text_trgm_idx on public.research_opportunities
  using gin (search_text extensions.gin_trgm_ops);

-- Hoje em Brasília (prazos são datas locais).
create function private.today_brt()
returns date
language sql
stable
set search_path = ''
as $$ select (now() at time zone 'America/Sao_Paulo')::date; $$;
revoke all on function private.today_brt() from public, anon, authenticated;

create function private.research_opportunities_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_trusted boolean := private.is_trusted_context();
  v_stage public.career_stage;
begin
  new.title := btrim(new.title, E' \t\r\n');
  new.description := btrim(new.description, E' \t\r\n');
  new.requirements := nullif(btrim(new.requirements, E' \t\r\n'), '');
  new.institution := nullif(btrim(new.institution), '');
  new.city := nullif(btrim(new.city), '');
  new.state := nullif(upper(btrim(new.state)), '');
  new.scholarship_info := nullif(btrim(new.scholarship_info), '');
  new.keywords := private.normalize_tags(new.keywords);
  new.target_stages := array(select distinct s from unnest(new.target_stages) s order by s);
  if not new.has_scholarship then
    new.scholarship_info := null;
  end if;

  if tg_op = 'INSERT' then
    if not v_trusted then
      if new.owner_id is distinct from v_uid then
        raise exception using
          errcode = 'CD013',
          message = 'Autoria inválida: publique oportunidades sempre com a sua própria conta.';
      end if;
      select p.career_stage into v_stage
      from public.profiles p
      where p.id = v_uid and p.onboarded_at is not null;
      if v_stage is null or v_stage not in ('masters', 'phd', 'postdoc', 'researcher', 'professor', 'industry') then
        raise exception using
          errcode = 'CD070',
          message = 'Só pesquisadoras do mestrado em diante publicam oportunidades. Se a sua etapa mudou, atualize o seu perfil.';
      end if;
      new.status := 'open';
      new.application_count := 0;
      new.created_at := now();
      new.updated_at := now();
      new.closed_at := null;
      perform private.enforce_rate_limit('opportunity', 5, interval '24 hours', 'CD075',
        'Você já publicou 5 oportunidades nas últimas 24 horas. Tente de novo amanhã.');
    end if;
  else
    if new.owner_id is distinct from old.owner_id or new.created_at is distinct from old.created_at then
      raise exception using
        errcode = 'CD002',
        message = 'A dona e a data de publicação de uma oportunidade não mudam.';
    end if;
    -- O contador só muda pelos triggers das candidaturas (chamada aninhada).
    if pg_trigger_depth() = 1 and not v_trusted
       and new.application_count is distinct from old.application_count then
      raise exception using
        errcode = 'CD002',
        message = 'O número de candidaturas é calculado pela plataforma.';
    end if;
    if new.status is distinct from old.status then
      new.closed_at := case when new.status = 'closed' then now() else null end;
    end if;
    -- Edição da dona (não a contagem de candidaturas) marca a data de atualização.
    if pg_trigger_depth() = 1 then
      new.updated_at := now();
    end if;
  end if;
  return new;
end;
$$;
revoke all on function private.research_opportunities_before_write() from public, anon, authenticated;

create trigger research_opportunities_before_write
  before insert or update on public.research_opportunities
  for each row execute function private.research_opportunities_before_write();

-- Vaga apagada → somem os avisos que apontavam para ela (candidaturas já somem pela FK).
create function private.research_opportunities_after_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.notifications n
  where n.type in ('opportunity_application', 'application_update')
    and (n.link = '/ics/' || old.id::text or n.link = '/ics/' || old.id::text || '/candidaturas');
  return null;
end;
$$;
revoke all on function private.research_opportunities_after_delete() from public, anon, authenticated;

create trigger research_opportunities_after_delete
  after delete on public.research_opportunities
  for each row execute function private.research_opportunities_after_delete();

alter table public.research_opportunities enable row level security;

create policy "Membros veem as oportunidades"
  on public.research_opportunities for select
  to authenticated
  using (true);

create policy "Pesquisadoras publicam em nome próprio"
  on public.research_opportunities for insert
  to authenticated
  with check (owner_id = (select auth.uid()));

create policy "Dona edita a própria oportunidade"
  on public.research_opportunities for update
  to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "Dona apaga a própria oportunidade"
  on public.research_opportunities for delete
  to authenticated
  using (owner_id = (select auth.uid()));

revoke all on table public.research_opportunities from anon, authenticated;
grant select, delete on table public.research_opportunities to authenticated;
grant insert (
  owner_id, kind, title, description, requirements, area_id, keywords, institution, city, state,
  modality, has_scholarship, scholarship_info, weekly_hours, vacancies, target_stages, deadline
) on table public.research_opportunities to authenticated;
grant update (
  kind, title, description, requirements, area_id, keywords, institution, city, state,
  modality, has_scholarship, scholarship_info, weekly_hours, vacancies, target_stages, deadline, status
) on table public.research_opportunities to authenticated;
grant all on table public.research_opportunities to service_role;

-- -----------------------------------------------------------------------------
-- 2. opportunity_applications
-- -----------------------------------------------------------------------------
create table public.opportunity_applications (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.research_opportunities (id) on delete cascade,
  applicant_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  message text not null check (char_length(message) between 30 and 2000),
  status public.application_status not null default 'submitted',
  owner_note text check (char_length(owner_note) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint opportunity_applications_unique unique (opportunity_id, applicant_id)
);
comment on table public.opportunity_applications is
  'Candidaturas às oportunidades (docs/18 §2.3). Só a candidata e a dona da vaga leem.';
comment on column public.opportunity_applications.owner_note is
  'Recado da dona da vaga para a candidata (aparece para a candidata).';

create index opportunity_applications_applicant_idx on public.opportunity_applications (applicant_id, created_at desc);
create index opportunity_applications_opportunity_idx on public.opportunity_applications (opportunity_id, created_at);

-- A usuária é a dona da vaga? (RLS das candidaturas; SECURITY DEFINER evita depender do RLS da vaga)
create function private.owns_opportunity(p_opportunity_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.research_opportunities o
    where o.id = p_opportunity_id and o.owner_id = (select auth.uid())
  );
$$;
revoke all on function private.owns_opportunity(uuid) from public, anon, authenticated;
grant execute on function private.owns_opportunity(uuid) to authenticated, service_role;

create function private.opportunity_applications_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_trusted boolean := private.is_trusted_context();
  v_opp public.research_opportunities%rowtype;
  v_previous public.application_status;
begin
  new.message := btrim(new.message, E' \t\r\n');

  if not v_trusted then
    if new.applicant_id is distinct from v_uid then
      raise exception using
        errcode = 'CD013',
        message = 'Autoria inválida: candidate-se sempre com a sua própria conta.';
    end if;
    new.status := 'submitted';
    new.owner_note := null;
    new.created_at := now();
    new.updated_at := now();
    new.responded_at := null;
  end if;

  -- FOR SHARE: encerrar a vaga ao mesmo tempo espera esta candidatura (ou vice-versa).
  select * into v_opp from public.research_opportunities o where o.id = new.opportunity_id for share;
  if not found then
    raise exception using
      errcode = 'CD071',
      message = 'Não encontramos esta oportunidade. Ela pode ter sido apagada.';
  end if;

  if v_opp.owner_id = new.applicant_id then
    raise exception using
      errcode = 'CD072',
      message = 'Esta oportunidade é sua: não dá para se candidatar a ela.';
  end if;

  if not v_trusted then
    if v_opp.status <> 'open' or (v_opp.deadline is not null and v_opp.deadline < private.today_brt()) then
      raise exception using
        errcode = 'CD071',
        message = 'As candidaturas para esta oportunidade estão encerradas.';
    end if;
    if not private.is_onboarded(new.applicant_id) then
      raise exception using
        errcode = 'CD060',
        message = 'Complete o seu cadastro antes de se candidatar.';
    end if;
  end if;

  select a.status into v_previous
  from public.opportunity_applications a
  where a.opportunity_id = new.opportunity_id and a.applicant_id = new.applicant_id;
  if found then
    raise exception using
      errcode = 'CD073',
      message = case when v_previous = 'withdrawn'
        then 'Você desistiu desta vaga antes e não pode se candidatar de novo.'
        else 'Você já se candidatou a esta vaga. Acompanhe o andamento em Minhas candidaturas.'
      end;
  end if;

  perform private.enforce_rate_limit('opportunity_application', 10, interval '24 hours', 'CD076',
    'Você já enviou 10 candidaturas nas últimas 24 horas. Tente de novo amanhã.');
  return new;
end;
$$;
revoke all on function private.opportunity_applications_before_insert() from public, anon, authenticated;

create trigger opportunity_applications_before_insert
  before insert on public.opportunity_applications
  for each row execute function private.opportunity_applications_before_insert();

-- Antes de atualizar: a candidata só desiste; a dona responde (em análise, aprovada, não aprovada)
-- e escreve o recado. Carta, vaga, candidata e data não mudam.
create function private.opportunity_applications_before_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_owner uuid;
begin
  if new.id is distinct from old.id
     or new.opportunity_id is distinct from old.opportunity_id
     or new.applicant_id is distinct from old.applicant_id
     or new.message is distinct from old.message
     or new.created_at is distinct from old.created_at then
    raise exception using
      errcode = 'CD002',
      message = 'A carta de apresentação e os dados da candidatura não mudam depois do envio.';
  end if;
  new.owner_note := nullif(btrim(new.owner_note, E' \t\r\n'), '');

  if not private.is_trusted_context() then
    select o.owner_id into v_owner from public.research_opportunities o where o.id = old.opportunity_id;

    if v_uid = old.applicant_id then
      if new.owner_note is distinct from old.owner_note
         or (new.status is distinct from old.status
             and not (new.status = 'withdrawn' and old.status in ('submitted', 'in_review'))) then
        raise exception using
          errcode = 'CD074',
          message = 'Você só pode desistir da candidatura enquanto ela estiver enviada ou em análise.';
      end if;
    elsif v_uid = v_owner then
      if new.status is distinct from old.status
         and (old.status = 'withdrawn' or new.status not in ('in_review', 'accepted', 'declined')) then
        raise exception using
          errcode = 'CD074',
          message = case when old.status = 'withdrawn'
            then 'A candidata desistiu desta vaga.'
            else 'Escolha entre em análise, aprovada ou não aprovada.'
          end;
      end if;
    else
      raise exception using
        errcode = 'CD074',
        message = 'Só a candidata e a dona da vaga mexem nesta candidatura.';
    end if;
  end if;

  new.updated_at := now();
  if new.status is distinct from old.status and new.status <> 'withdrawn' then
    new.responded_at := now();
  end if;
  return new;
end;
$$;
revoke all on function private.opportunity_applications_before_update() from public, anon, authenticated;

create trigger opportunity_applications_before_update
  before update on public.opportunity_applications
  for each row execute function private.opportunity_applications_before_update();

-- Depois de mudar: contador da vaga e avisos.
create function private.opportunity_applications_after_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_opp public.research_opportunities%rowtype;
  v_link text;
  v_title text;
begin
  if tg_op = 'INSERT' then
    update public.research_opportunities
      set application_count = application_count + case when new.status = 'withdrawn' then 0 else 1 end
    where id = new.opportunity_id
    returning * into v_opp;

    v_link := '/ics/' || new.opportunity_id::text || '/candidaturas';
    perform pg_advisory_xact_lock(hashtextextended('application_notify:' || v_link, 0));
    if not exists (
      select 1 from public.notifications n
      where n.user_id = v_opp.owner_id and n.type = 'opportunity_application'
        and n.link = v_link and n.read_at is null
    ) then
      perform private.notify(
        v_opp.owner_id,
        'opportunity_application',
        format('Nova candidatura para “%s”', left(v_opp.title, 120)),
        format('%s se candidatou. Abra para ler a carta de apresentação.', private.display_name(new.applicant_id)),
        v_link,
        new.created_at
      );
    end if;
    return null;
  end if;

  if tg_op = 'DELETE' then
    if old.status <> 'withdrawn' then
      update public.research_opportunities
        set application_count = greatest(application_count - 1, 0)
      where id = old.opportunity_id;
    end if;
    return null;
  end if;

  -- UPDATE
  if new.status is not distinct from old.status then
    return null;
  end if;

  if (new.status = 'withdrawn') <> (old.status = 'withdrawn') then
    update public.research_opportunities
      set application_count = greatest(application_count + case when new.status = 'withdrawn' then -1 else 1 end, 0)
    where id = new.opportunity_id;
  end if;

  if new.status in ('in_review', 'accepted', 'declined') then
    select left(o.title, 120) into v_title from public.research_opportunities o where o.id = new.opportunity_id;
    perform private.notify(
      new.applicant_id,
      'application_update',
      case new.status
        when 'accepted' then format('Sua candidatura para “%s” foi aprovada!', v_title)
        when 'declined' then format('Sua candidatura para “%s” não foi aprovada desta vez', v_title)
        else format('Sua candidatura para “%s” está em análise', v_title)
      end,
      coalesce(new.owner_note, case new.status
        when 'accepted' then 'Abra a vaga para ver os próximos passos e mandar uma mensagem.'
        when 'declined' then 'Obrigada pelo interesse. Há outras vagas abertas em Explorar ICs.'
        else 'A pesquisadora começou a ler as candidaturas.'
      end),
      '/ics/' || new.opportunity_id::text,
      new.responded_at
    );
  end if;
  return null;
end;
$$;
revoke all on function private.opportunity_applications_after_change() from public, anon, authenticated;

create trigger opportunity_applications_after_change
  after insert or update of status or delete on public.opportunity_applications
  for each row execute function private.opportunity_applications_after_change();

alter table public.opportunity_applications enable row level security;

create policy "Candidata e dona da vaga veem a candidatura"
  on public.opportunity_applications for select
  to authenticated
  using (applicant_id = (select auth.uid()) or (select private.owns_opportunity(opportunity_id)));

create policy "Membras se candidatam em nome próprio"
  on public.opportunity_applications for insert
  to authenticated
  with check (applicant_id = (select auth.uid()));

create policy "Candidata desiste; dona responde"
  on public.opportunity_applications for update
  to authenticated
  using (applicant_id = (select auth.uid()) or (select private.owns_opportunity(opportunity_id)))
  with check (applicant_id = (select auth.uid()) or (select private.owns_opportunity(opportunity_id)));

revoke all on table public.opportunity_applications from anon, authenticated;
grant select on table public.opportunity_applications to authenticated;
grant insert (opportunity_id, applicant_id, message) on table public.opportunity_applications to authenticated;
grant update (status, owner_note) on table public.opportunity_applications to authenticated;
grant all on table public.opportunity_applications to service_role;
