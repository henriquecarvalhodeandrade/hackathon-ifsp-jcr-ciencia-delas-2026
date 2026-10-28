-- ==============================================================================
-- ÁRTEMIS — SCHEMA INICIAL & POLICIES DE RLS (SUPABASE / POSTGRESQL)
-- Tema: "Ciência Delas" (SNCT 2026)
-- ==============================================================================

-- 1. EXTENSÕES & ENUMS
create extension if not exists "uuid-ossp";

create type account_type as enum ('student', 'scientist');
create type request_status as enum ('pending', 'accepted', 'rejected');
create type interest_origin as enum ('user_request', 'creator_invite');

-- 2. TABELA: PROFILES (Estende auth.users)
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  username text unique not null,
  full_name text not null,
  account_type account_type not null,
  bio text,
  avatar_url text,
  course_or_area text,
  is_self_declared_woman boolean not null default false,  -- Emblema WomanBadge
  conduct_accepted_at timestamptz not null default now(), -- Trust & Safety
  is_verified_scientist boolean not null default false,   -- Admin/Etapa 3
  created_at timestamptz not null default now()
);

-- 3. TABELA: POSTS & POST_LIKES (Feed)
create table posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references profiles(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 500),
  created_at timestamptz not null default now()
);

create table post_likes (
  post_id uuid not null references posts(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

-- 4. TABELA: PROJECTS & PROJECT_INTERESTS (Explorar Iniciação Científica)
create table projects (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  description text not null,
  area text not null,
  tags text[] not null default '{}',
  slots int not null default 3,
  is_open boolean not null default true,
  created_at timestamptz not null default now()
);

create table project_interests (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  origin interest_origin not null default 'user_request',
  message text,
  status request_status not null default 'pending',
  created_at timestamptz not null default now(),
  unique (project_id, user_id)
);

-- 5. TABELA: FOLLOWS & CONNECTIONS (Rede)
create table follows (
  follower_id uuid not null references profiles(id) on delete cascade,
  following_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);

create table connections (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references profiles(id) on delete cascade,
  addressee_id uuid not null references profiles(id) on delete cascade,
  status request_status not null default 'pending',
  created_at timestamptz not null default now(),
  check (requester_id <> addressee_id)
);

create unique index connections_pair_uq on connections
  (least(requester_id, addressee_id), greatest(requester_id, addressee_id));

-- 6. TABELA: CONVERSATIONS & MESSAGES (DM / Chat Realtime)
create table conversations (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references profiles(id) on delete cascade,
  user_b uuid not null references profiles(id) on delete cascade,
  requested_by uuid not null references profiles(id),
  status request_status not null default 'pending',
  created_at timestamptz not null default now()
);

create unique index conv_pair_uq on conversations
  (least(user_a, user_b), greatest(user_a, user_b));

create table messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  sender_id uuid not null references profiles(id),
  content text not null check (char_length(content) <= 2000),
  created_at timestamptz not null default now()
);

create index messages_conv_created_idx on messages (conversation_id, created_at);

-- 7. TABELA: SHOWCASES (Vitrine Científica)
create table showcases (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  summary text not null,
  image_urls text[] not null default '{}',
  external_url text,
  created_at timestamptz not null default now()
);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

-- 8. PROFILES RLS
alter table profiles enable row level security;

create policy "profiles_select_all" on profiles
  for select using (true);

create policy "profiles_insert_own" on profiles
  for insert to authenticated
  with check (id = (select auth.uid()));

create policy "profiles_update_own" on profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Prevenção de auto-promoção de privilégio (apenas admin pode alterar is_verified_scientist)
revoke update on profiles from authenticated;
grant update (username, full_name, bio, avatar_url, course_or_area, is_self_declared_woman)
  on profiles to authenticated;

-- 9. POSTS RLS
alter table posts enable row level security;

create policy "posts_select_all" on posts
  for select using (true);

create policy "posts_insert_auth" on posts
  for insert to authenticated
  with check (author_id = (select auth.uid()));

create policy "posts_delete_own" on posts
  for delete to authenticated
  using (author_id = (select auth.uid()));

-- 10. POST_LIKES RLS
alter table post_likes enable row level security;

create policy "post_likes_select_all" on post_likes
  for select using (true);

create policy "post_likes_insert_own" on post_likes
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "post_likes_delete_own" on post_likes
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- 11. PROJECTS RLS
alter table projects enable row level security;

create policy "projects_select_all" on projects
  for select using (true);

create policy "projects_insert_auth" on projects
  for insert to authenticated
  with check (creator_id = (select auth.uid()));

create policy "projects_update_own" on projects
  for update to authenticated
  using (creator_id = (select auth.uid()))
  with check (creator_id = (select auth.uid()));

create policy "projects_delete_own" on projects
  for delete to authenticated
  using (creator_id = (select auth.uid()));

-- 12. PROJECT_INTERESTS RLS
alter table project_interests enable row level security;

create policy "project_interests_select_involved" on project_interests
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from projects p
      where p.id = project_interests.project_id
        and p.creator_id = (select auth.uid())
    )
    or status = 'accepted' -- Permite listar participantes aceitos para todos
  );

create policy "project_interests_insert" on project_interests
  for insert to authenticated
  with check (
    -- Aluna solicitando vaga
    (origin = 'user_request' and user_id = (select auth.uid()))
    or
    -- Criador do projeto convidando
    (origin = 'creator_invite' and exists (
      select 1 from projects p
      where p.id = project_id and p.creator_id = (select auth.uid())
    ))
  );

create policy "project_interests_update" on project_interests
  for update to authenticated
  using (
    -- Criador responde a user_request
    (origin = 'user_request' and exists (
      select 1 from projects p
      where p.id = project_interests.project_id and p.creator_id = (select auth.uid())
    ))
    or
    -- Convidado responde a creator_invite
    (origin = 'creator_invite' and user_id = (select auth.uid()))
  );

create policy "project_interests_delete" on project_interests
  for delete to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from projects p
      where p.id = project_interests.project_id and p.creator_id = (select auth.uid())
    )
  );

-- 13. FOLLOWS RLS
alter table follows enable row level security;

create policy "follows_select_all" on follows
  for select using (true);

create policy "follows_insert_own" on follows
  for insert to authenticated
  with check (follower_id = (select auth.uid()));

create policy "follows_delete_own" on follows
  for delete to authenticated
  using (follower_id = (select auth.uid()));

-- 14. CONNECTIONS RLS
alter table connections enable row level security;

create policy "connections_select_involved" on connections
  for select to authenticated
  using ((select auth.uid()) in (requester_id, addressee_id));

create policy "connections_insert_requester" on connections
  for insert to authenticated
  with check (requester_id = (select auth.uid()));

create policy "connections_update_addressee" on connections
  for update to authenticated
  using (addressee_id = (select auth.uid()))
  with check (addressee_id = (select auth.uid()));

create policy "connections_delete_involved" on connections
  for delete to authenticated
  using ((select auth.uid()) in (requester_id, addressee_id));

-- 15. CONVERSATIONS RLS
alter table conversations enable row level security;

create policy "conversations_select_participants" on conversations
  for select to authenticated
  using ((select auth.uid()) in (user_a, user_b));

create policy "conversations_insert_participant" on conversations
  for insert to authenticated
  with check (
    (select auth.uid()) in (user_a, user_b)
    and requested_by = (select auth.uid())
  );

create policy "conversations_update_addressee" on conversations
  for update to authenticated
  using (
    (select auth.uid()) in (user_a, user_b)
    and requested_by <> (select auth.uid())
  )
  with check (
    (select auth.uid()) in (user_a, user_b)
    and requested_by <> (select auth.uid())
  );

-- 16. MESSAGES RLS (Regra anti-assédio estrita no banco)
alter table messages enable row level security;

create policy "messages_select_participants" on messages
  for select to authenticated
  using (
    exists (
      select 1 from conversations c
      where c.id = messages.conversation_id
        and (select auth.uid()) in (c.user_a, c.user_b)
    )
  );

create policy "messages_insert_guarded" on messages
  for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and exists (
      select 1 from conversations c
      where c.id = conversation_id
        and (select auth.uid()) in (c.user_a, c.user_b)
        and (
          -- Conversa já aceita: mensagens livres
          c.status = 'accepted'
          or (
            -- Conversa pendente: solicitante só pode mandar 1 mensagem inicial
            c.status = 'pending'
            and c.requested_by = (select auth.uid())
            and not exists (
              select 1 from messages m
              where m.conversation_id = c.id
            )
          )
        )
    )
  );

-- 17. SHOWCASES RLS (Vitrine pública)
alter table showcases enable row level security;

create policy "showcases_select_public" on showcases
  for select using (true);

create policy "showcases_insert_own" on showcases
  for insert to authenticated
  with check (author_id = (select auth.uid()));

create policy "showcases_update_own" on showcases
  for update to authenticated
  using (author_id = (select auth.uid()))
  with check (author_id = (select auth.uid()));

create policy "showcases_delete_own" on showcases
  for delete to authenticated
  using (author_id = (select auth.uid()));

-- ==============================================================================
-- TRIGGER: CRIAR PERFIL AUTOMATICAMENTE AO CADASTRAR NO AUTH
-- ==============================================================================

create or replace function public.handle_new_user()
returns trigger as $$
declare
  v_username text;
  v_full_name text;
  v_account_type account_type;
  v_is_woman boolean;
begin
  -- Extrair metadados passados no signup
  v_username := coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1));
  v_full_name := coalesce(new.raw_user_meta_data->>'full_name', 'Cientista');
  v_account_type := coalesce((new.raw_user_meta_data->>'account_type')::account_type, 'student'::account_type);
  v_is_woman := coalesce((new.raw_user_meta_data->>'is_self_declared_woman')::boolean, false);

  insert into public.profiles (
    id,
    username,
    full_name,
    account_type,
    course_or_area,
    is_self_declared_woman,
    conduct_accepted_at
  ) values (
    new.id,
    v_username,
    v_full_name,
    v_account_type,
    new.raw_user_meta_data->>'course_or_area',
    v_is_woman,
    now()
  );
  return new;
end;
$$ language plpgsql security definer;

-- Trigger disparado após inserção em auth.users
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ==============================================================================
-- REALTIME PUBLICATION
-- ==============================================================================
alter publication supabase_realtime add table messages;
