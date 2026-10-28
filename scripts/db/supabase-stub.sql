-- =============================================================================
-- Artemis — "stub" mínimo de um banco Supabase para validação local SEM Docker.
--
-- Emula apenas o que as migrations, o seed e os testes usam:
--   * papéis anon / authenticated / service_role (BYPASSRLS) / authenticator /
--     supabase_auth_admin / supabase_storage_admin;
--   * schemas auth, extensions, storage (+ publicação supabase_realtime vazia);
--   * auth.users e auth.identities com os nomes reais de colunas do GoTrue;
--   * auth.uid() / auth.role() / auth.jwt() lendo current_setting('request.jwt.claims'),
--     exatamente como o Supabase faz;
--   * storage.buckets / storage.objects / storage.foldername();
--   * extensões pgcrypto (+ uuid-ossp) no schema extensions (o Supabase já as traz).
--
-- NÃO use este arquivo em um projeto Supabase de verdade: lá tudo isso já existe.
-- Diferença conhecida: localmente o pgvector é 0.6.0; no Supabase Cloud é mais novo
-- (a sintaxe usada nas migrations — vector(768), <=> e HNSW cosine — vale para ambos).
-- =============================================================================

-- Papéis são globais no cluster: crie só se ainda não existirem.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticator') then
    create role authenticator login noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then
    create role supabase_auth_admin login noinherit createrole;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'supabase_storage_admin') then
    create role supabase_storage_admin login noinherit createrole;
  end if;
end
$$;

grant anon, authenticated, service_role to authenticator;

-- No Supabase o banco nasce com USAGE em public para os papéis da API.
grant usage on schema public to anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- extensions
-- -----------------------------------------------------------------------------
create schema if not exists extensions;
grant usage on schema extensions to anon, authenticated, service_role;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;

-- -----------------------------------------------------------------------------
-- auth
-- -----------------------------------------------------------------------------
create schema if not exists auth authorization supabase_auth_admin;
grant usage on schema auth to anon, authenticated, service_role;

create table if not exists auth.users (
  instance_id uuid,
  id uuid not null primary key,
  aud varchar(255),
  role varchar(255),
  email varchar(255),
  encrypted_password varchar(255),
  email_confirmed_at timestamptz,
  invited_at timestamptz,
  confirmation_token varchar(255),
  confirmation_sent_at timestamptz,
  recovery_token varchar(255),
  recovery_sent_at timestamptz,
  email_change_token_new varchar(255),
  email_change varchar(255),
  email_change_sent_at timestamptz,
  last_sign_in_at timestamptz,
  raw_app_meta_data jsonb,
  raw_user_meta_data jsonb,
  is_super_admin boolean,
  created_at timestamptz,
  updated_at timestamptz,
  phone text unique default null,
  phone_confirmed_at timestamptz,
  phone_change text default '',
  phone_change_token varchar(255) default '',
  phone_change_sent_at timestamptz,
  confirmed_at timestamptz generated always as (least(email_confirmed_at, phone_confirmed_at)) stored,
  email_change_token_current varchar(255) default '',
  email_change_confirm_status smallint default 0
    check (email_change_confirm_status >= 0 and email_change_confirm_status <= 2),
  banned_until timestamptz,
  reauthentication_token varchar(255) default '',
  reauthentication_sent_at timestamptz,
  is_sso_user boolean not null default false,
  deleted_at timestamptz,
  is_anonymous boolean not null default false
);
create unique index if not exists users_email_partial_key on auth.users (email) where (is_sso_user = false);

create table if not exists auth.identities (
  provider_id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  identity_data jsonb not null,
  provider text not null,
  last_sign_in_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  email text generated always as (lower(identity_data ->> 'email')) stored,
  id uuid not null default gen_random_uuid() primary key,
  constraint identities_provider_id_provider_unique unique (provider_id, provider)
);
create index if not exists identities_user_id_idx on auth.identities (user_id);

alter table auth.users owner to supabase_auth_admin;
alter table auth.identities owner to supabase_auth_admin;

-- Mesmas definições usadas pelo Supabase (lêem o JWT repassado pelo PostgREST).
create or replace function auth.uid() returns uuid
language sql stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;

create or replace function auth.role() returns text
language sql stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  )::text
$$;

create or replace function auth.email() returns text
language sql stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.email', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email')
  )::text
$$;

create or replace function auth.jwt() returns jsonb
language sql stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')
  )::jsonb
$$;

grant execute on function auth.uid(), auth.role(), auth.email(), auth.jwt()
  to anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- storage
-- -----------------------------------------------------------------------------
create schema if not exists storage authorization supabase_storage_admin;
grant usage on schema storage to anon, authenticated, service_role;

create table if not exists storage.buckets (
  id text not null primary key,
  name text not null,
  owner uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  public boolean default false,
  avif_autodetection boolean default false,
  file_size_limit bigint,
  allowed_mime_types text[],
  owner_id text
);
create unique index if not exists bname on storage.buckets (name);

create table if not exists storage.objects (
  id uuid not null default gen_random_uuid() primary key,
  bucket_id text references storage.buckets (id),
  name text,
  owner uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  last_accessed_at timestamptz default now(),
  metadata jsonb,
  path_tokens text[] generated always as (string_to_array(name, '/')) stored,
  version text,
  owner_id text,
  user_metadata jsonb
);
create unique index if not exists bucketid_objname on storage.objects (bucket_id, name);

alter table storage.objects enable row level security;
alter table storage.buckets enable row level security;

create or replace function storage.foldername(name text) returns text[]
language plpgsql
as $$
declare
  _parts text[];
begin
  select string_to_array(name, '/') into _parts;
  return _parts[1:array_length(_parts, 1) - 1];
end
$$;

create or replace function storage.filename(name text) returns text
language plpgsql
as $$
declare
  _parts text[];
begin
  select string_to_array(name, '/') into _parts;
  return _parts[array_length(_parts, 1)];
end
$$;

grant all on storage.buckets, storage.objects to anon, authenticated, service_role;
grant execute on function storage.foldername(text), storage.filename(text)
  to anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- realtime (publicação vazia, como num projeto novo)
-- -----------------------------------------------------------------------------
set client_min_messages = error; -- sem wal_level=logical o Postgres só avisa
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end
$$;
reset client_min_messages;

-- Caminho de busca padrão do Supabase.
do $$
begin
  execute format('alter database %I set search_path = "$user", public, extensions', current_database());
end
$$;
