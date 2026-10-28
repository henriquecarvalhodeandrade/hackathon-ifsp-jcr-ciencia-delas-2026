-- =============================================================================
-- Artemis · 06 — newsletter: inscritas, edições e envios
-- =============================================================================
-- Inscrição, confirmação (double opt-in), descadastro e envio são feitos pelo
-- servidor com o cliente admin (service role). Clientes da API não enxergam
-- inscritas nem envios; edições publicadas são públicas (arquivo do site).

-- -----------------------------------------------------------------------------
-- newsletter_subscribers — somente service role
-- -----------------------------------------------------------------------------
create table public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email extensions.citext not null unique
    check (char_length(email::text) <= 254 and email::text ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  profile_id uuid references public.profiles (id) on delete set null,
  area_ids smallint[] not null default '{}' check (cardinality(area_ids) <= 100),
  status public.subscriber_status not null default 'pending',
  confirm_token uuid not null default gen_random_uuid() unique,
  unsubscribe_token uuid not null default gen_random_uuid() unique,
  consent_text text not null check (char_length(consent_text) between 10 and 2000),
  consented_at timestamptz not null default now(),
  confirmed_at timestamptz,
  unsubscribed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.newsletter_subscribers is
  'Inscritas na newsletter (double opt-in). Sem políticas RLS: acesso apenas via service role.';
comment on column public.newsletter_subscribers.area_ids is
  'Áreas de interesse (research_areas.id). Vazio = todas as áreas.';

create index newsletter_subscribers_profile_id_idx on public.newsletter_subscribers (profile_id);
create index newsletter_subscribers_status_idx on public.newsletter_subscribers (status);

create trigger newsletter_subscribers_set_updated_at
  before update on public.newsletter_subscribers
  for each row execute function private.set_updated_at();

alter table public.newsletter_subscribers enable row level security;
-- (sem políticas de propósito)

revoke all on table public.newsletter_subscribers from anon, authenticated;
grant all on table public.newsletter_subscribers to service_role;

-- -----------------------------------------------------------------------------
-- newsletter_editions — edições semanais
-- -----------------------------------------------------------------------------
create table public.newsletter_editions (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 80),
  title text not null check (char_length(title) between 3 and 200),
  summary text check (char_length(summary) <= 2000),
  content jsonb not null default '{}'::jsonb check (jsonb_typeof(content) = 'object'),
  status public.edition_status not null default 'draft',
  period_start date,
  period_end date,
  published_at timestamptz,
  sent_at timestamptz,
  recipients_count integer not null default 0 check (recipients_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint newsletter_editions_period check (period_end is null or period_start is null or period_end >= period_start)
);
create index newsletter_editions_status_published_idx on public.newsletter_editions (status, published_at desc);

create function private.newsletter_editions_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status in ('published', 'sent') and new.published_at is null then
    new.published_at := now();
  end if;
  if new.status = 'sent' and new.sent_at is null then
    new.sent_at := now();
  end if;
  if tg_op = 'UPDATE' then
    new.updated_at := now();
  end if;
  return new;
end;
$$;
revoke all on function private.newsletter_editions_before_write() from public, anon, authenticated;

create trigger newsletter_editions_before_write
  before insert or update on public.newsletter_editions
  for each row execute function private.newsletter_editions_before_write();

alter table public.newsletter_editions enable row level security;

create policy "Edições publicadas são públicas"
  on public.newsletter_editions for select
  to anon, authenticated
  using (status in ('published', 'sent'));

create policy "Admins gerenciam as edições"
  on public.newsletter_editions for all
  to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

revoke all on table public.newsletter_editions from anon, authenticated;
grant select on table public.newsletter_editions to anon, authenticated;
grant insert, update, delete on table public.newsletter_editions to authenticated;
grant all on table public.newsletter_editions to service_role;

-- -----------------------------------------------------------------------------
-- newsletter_deliveries — registro de envio por inscrita (somente service role)
-- -----------------------------------------------------------------------------
create table public.newsletter_deliveries (
  edition_id uuid not null references public.newsletter_editions (id) on delete cascade,
  subscriber_id uuid not null references public.newsletter_subscribers (id) on delete cascade,
  sent_at timestamptz,
  provider_message_id text,
  error text,
  primary key (edition_id, subscriber_id)
);
create index newsletter_deliveries_subscriber_id_idx on public.newsletter_deliveries (subscriber_id);

alter table public.newsletter_deliveries enable row level security;
-- (sem políticas de propósito)

revoke all on table public.newsletter_deliveries from anon, authenticated;
grant all on table public.newsletter_deliveries to service_role;
