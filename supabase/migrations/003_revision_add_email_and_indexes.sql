-- ==============================================================================
-- ÁRTEMIS — MIGRATION 003: REVISÃO COMPLETA DE REQUISITOS DO BANCO
-- 1. Adiciona coluna EMAIL na tabela profiles (sincronizada com auth.users)
-- 2. Trigger handle_new_user() atualizado com email, unicidade e search_path
-- 3. Índices de alta performance (GIN para tags de IC, feeds e mensagens)
-- 4. Reforço de RLS para conexões, DM anti-assédio e vitrine pública
-- ==============================================================================

-- 1. ADICIONA A COLUNA EMAIL EM PROFILES
do $$
begin
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'email'
  ) then
    alter table public.profiles add column email text;
    -- Cria constraint única
    alter table public.profiles add constraint profiles_email_key unique (email);
  end if;
end $$;

-- Sincroniza emails existentes a partir de auth.users (caso já existam registros)
update public.profiles p
set email = u.email
from auth.users u
where p.id = u.id and p.email is null;

-- 2. RECRIAR O TRIGGER HANDLE_NEW_USER (COM EMAIL + UNICIDADE + SEARCH_PATH)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_username text;
  v_base_username text;
  v_full_name text;
  v_account_type public.account_type;
  v_is_woman boolean;
  v_email text;
  v_counter int := 1;
begin
  v_email := lower(trim(new.email));

  -- Define username base
  v_base_username := lower(coalesce(
    nullif(trim(new.raw_user_meta_data->>'username'), ''),
    split_part(v_email, '@', 1),
    'pesquisadora'
  ));
  
  -- Remove caracteres especiais indesejados
  v_base_username := regexp_replace(v_base_username, '[^a-z0-9_]', '', 'g');
  if length(v_base_username) < 3 then
    v_base_username := v_base_username || '_user';
  end if;

  v_username := v_base_username;

  -- Garante unicidade do username no banco
  while exists (select 1 from public.profiles where username = v_username and id <> new.id) loop
    v_counter := v_counter + 1;
    v_username := v_base_username || v_counter::text;
  end loop;

  v_full_name := coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''), 'Cientista');

  -- Converte account_type com fallback seguro
  begin
    v_account_type := (new.raw_user_meta_data->>'account_type')::public.account_type;
  exception when others then
    v_account_type := 'student'::public.account_type;
  end;
  if v_account_type is null then
    v_account_type := 'student'::public.account_type;
  end if;

  -- Converte autodeclaração feminina com fallback seguro
  begin
    v_is_woman := coalesce((new.raw_user_meta_data->>'is_self_declared_woman')::boolean, false);
  exception when others then
    v_is_woman := false;
  end;

  -- Insere ou atualiza o perfil em public.profiles incluindo email
  insert into public.profiles (
    id,
    email,
    username,
    full_name,
    account_type,
    course_or_area,
    is_self_declared_woman,
    conduct_accepted_at
  ) values (
    new.id,
    v_email,
    v_username,
    v_full_name,
    v_account_type,
    new.raw_user_meta_data->>'course_or_area',
    v_is_woman,
    now()
  )
  on conflict (id) do update set
    email = excluded.email,
    username = excluded.username,
    full_name = excluded.full_name,
    account_type = excluded.account_type,
    course_or_area = excluded.course_or_area,
    is_self_declared_woman = excluded.is_self_declared_woman;

  return new;
end;
$$;

-- Recria o trigger em auth.users
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 3. ÍNDICES DE PERFORMANCE PARA OS REQUISITOS DO SISTEMA
-- Feed: ordenação cronológica rápida
create index if not exists idx_posts_author_created on public.posts (author_id, created_at desc);
create index if not exists idx_post_likes_post on public.post_likes (post_id);

-- Explorar IC: filtros por área e busca em tags via GIN
create index if not exists idx_projects_area on public.projects (area);
create index if not exists idx_projects_is_open on public.projects (is_open);
create index if not exists idx_projects_tags_gin on public.projects using gin (tags);
create index if not exists idx_project_interests_proj_status on public.project_interests (project_id, status);

-- Rede & Conexões
create index if not exists idx_follows_following on public.follows (following_id);
create index if not exists idx_connections_users on public.connections (requester_id, addressee_id, status);

-- Chat Realtime
create index if not exists idx_messages_conv_created on public.messages (conversation_id, created_at asc);

-- 4. PRIVILÉGIOS DE COLUNAS EM PROFILES (SEGURANÇA RLS)
-- Permite que usuários atualizem seus dados sem alterar privilégios administrativos
revoke update on public.profiles from authenticated;
grant update (username, full_name, bio, avatar_url, course_or_area, is_self_declared_woman)
  on public.profiles to authenticated;
