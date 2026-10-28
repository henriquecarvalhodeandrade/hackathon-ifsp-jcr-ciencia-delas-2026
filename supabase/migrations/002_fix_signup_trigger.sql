-- ==============================================================================
-- CORREÇÃO DO TRIGGER DE CADASTRO (SUPABASE AUTH -> PUBLIC.PROFILES)
-- ==============================================================================

-- 1. Garante que os tipos existam
do $$
begin
  if not exists (select 1 from pg_type where typname = 'account_type') then
    create type public.account_type as enum ('student', 'scientist');
  end if;
end $$;

-- 2. Recria a função handle_new_user com search_path = public e tratamento resiliente
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
  v_counter int := 1;
begin
  -- Normaliza o username base (minúsculo e sem espaços)
  v_base_username := lower(coalesce(
    nullif(trim(new.raw_user_meta_data->>'username'), ''),
    split_part(new.email, '@', 1),
    'pesquisadora'
  ));
  
  -- Remove caracteres especiais indesejados
  v_base_username := regexp_replace(v_base_username, '[^a-z0-9_]', '', 'g');
  if length(v_base_username) < 3 then
    v_base_username := v_base_username || '_user';
  end if;

  v_username := v_base_username;

  -- Garante unicidade do username no banco para nunca quebrar a transação de signup
  while exists (select 1 from public.profiles where username = v_username and id <> new.id) loop
    v_counter := v_counter + 1;
    v_username := v_base_username || v_counter::text;
  end loop;

  v_full_name := coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''), 'Cientista');

  -- Converte account_type com tratamento seguro de exceção
  begin
    v_account_type := (new.raw_user_meta_data->>'account_type')::public.account_type;
  exception when others then
    v_account_type := 'student'::public.account_type;
  end;
  if v_account_type is null then
    v_account_type := 'student'::public.account_type;
  end if;

  -- Converte autodeclaração feminina com segurança
  begin
    v_is_woman := coalesce((new.raw_user_meta_data->>'is_self_declared_woman')::boolean, false);
  exception when others then
    v_is_woman := false;
  end;

  -- Insere ou atualiza o perfil em public.profiles
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
  )
  on conflict (id) do update set
    username = excluded.username,
    full_name = excluded.full_name,
    account_type = excluded.account_type,
    course_or_area = excluded.course_or_area,
    is_self_declared_woman = excluded.is_self_declared_woman;

  return new;
end;
$$;

-- 3. Recria o trigger em auth.users
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
