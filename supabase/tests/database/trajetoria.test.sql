-- =============================================================================
-- Artemis — afinidade de trajetória (migration 20261028190200_trajectory_affinity.sql)
-- Mesmo formato dos outros testes: blocos DO que simulam usuárias (papel + request.jwt.claims,
-- como o PostgREST), EXCEÇÃO na primeira expectativa quebrada, pass() por grupo e ROLLBACK no
-- fim. Dados próprios (usuárias f4…), sem depender do seed.
-- =============================================================================
begin;
set local search_path = "$user", public, extensions;

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pgtap') then
    create extension if not exists pgtap with schema extensions;
  end if;
end
$$;

select no_plan();

-- -----------------------------------------------------------------------------
-- Helpers (schema temporário, desfeito no ROLLBACK)
-- -----------------------------------------------------------------------------
create schema cdtest_traj;
grant usage on schema cdtest_traj to anon, authenticated, service_role;

create function cdtest_traj.login(p_user uuid) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end
$$;

create function cdtest_traj.login_anon() returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"role": "anon"}', true);
  perform set_config('role', 'anon', true);
end
$$;

create function cdtest_traj.logout() returns void
language plpgsql as $$
begin
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', '', true);
end
$$;

-- Executa p_sql e exige que falhe com o SQLSTATE informado (NULL = qualquer erro) e, se
-- p_message_like vier, com uma mensagem que case com ele.
create function cdtest_traj.throws(p_sql text, p_errcode text, p_desc text, p_message_like text default null)
returns void
language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if (p_errcode is null or sqlstate = p_errcode)
       and (p_message_like is null or sqlerrm like p_message_like) then
      return;
    end if;
    raise exception 'FALHOU: % — esperava SQLSTATE % (%), veio % (%)',
      p_desc, p_errcode, coalesce(p_message_like, 'qualquer mensagem'), sqlstate, sqlerrm;
  end;
  raise exception 'FALHOU: % — esperava erro %, mas o comando funcionou', p_desc, coalesce(p_errcode, '(qualquer)');
end
$$;

create function cdtest_traj.affected(p_sql text) returns bigint
language plpgsql as $$
declare
  n bigint;
begin
  execute p_sql;
  get diagnostics n = row_count;
  return n;
end
$$;

create function cdtest_traj.check(p_condition boolean, p_desc text) returns void
language plpgsql as $$
begin
  if p_condition is not true then
    raise exception 'FALHOU: %', p_desc;
  end if;
end
$$;

-- Marcas gravadas, lidas sem RLS (SECURITY DEFINER), para conferir o que o banco guardou.
create function cdtest_traj.tags(p_id uuid) returns text[]
language sql stable security definer set search_path = '' as $$
  select p.trajectory_tags from public.profiles p where p.id = p_id;
$$;

grant execute on all functions in schema cdtest_traj to anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Dados de teste (como postgres)
--   f4…01 Ana (mentoranda) · f4…02 Bia (mentora disponível) · f4…03 Cris (mentora PAUSADA)
--   f4…04 Duda (mentora SEM onboarding) · f4…05 Eli (mentora disponível, sem marcas)
-- -----------------------------------------------------------------------------
insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, created_at, updated_at)
select '00000000-0000-0000-0000-000000000000', v.id, 'authenticated', 'authenticated', v.email,
  jsonb_build_object('full_name', v.full_name), now(), now()
from (values
  ('f4000000-0000-4000-8000-000000000001'::uuid, 'ana.traj@example.test', 'Ana Trajetória'),
  ('f4000000-0000-4000-8000-000000000002', 'bia.traj@example.test', 'Bia Trajetória'),
  ('f4000000-0000-4000-8000-000000000003', 'cris.traj@example.test', 'Cris Pausada'),
  ('f4000000-0000-4000-8000-000000000004', 'duda.traj@example.test', 'Duda Sem Perfil'),
  ('f4000000-0000-4000-8000-000000000005', 'eli.traj@example.test', 'Eli Sem Marcas')
) as v (id, email, full_name);

update public.profiles set onboarded_at = now(), career_stage = 'undergraduate', seeks_mentorship = true
  where id = 'f4000000-0000-4000-8000-000000000001';
update public.profiles set career_stage = 'professor', is_mentor = true, mentor_available = true,
  mentor_capacity = 3, mentorship_topics = array['pos-graduacao'],
  mentoring_offer = 'Ajudo quem está começando na pesquisa (perfil de teste).'
  where id in ('f4000000-0000-4000-8000-000000000002', 'f4000000-0000-4000-8000-000000000003',
               'f4000000-0000-4000-8000-000000000004', 'f4000000-0000-4000-8000-000000000005');
update public.profiles set onboarded_at = now()
  where id in ('f4000000-0000-4000-8000-000000000002', 'f4000000-0000-4000-8000-000000000003',
               'f4000000-0000-4000-8000-000000000005');
update public.profiles set mentor_available = false where id = 'f4000000-0000-4000-8000-000000000003';
-- Marcas iniciais (contexto confiável) — Duda tem marca mas nunca concluiu o onboarding.
update public.profiles set trajectory_tags = array['primeira-geracao', 'escola-publica']
  where id in ('f4000000-0000-4000-8000-000000000002', 'f4000000-0000-4000-8000-000000000003',
               'f4000000-0000-4000-8000-000000000004');

-- =============================================================================
-- 1. Estrutura: coluna, CHECK, índice, trigger próprio e GRANTs por coluna
-- =============================================================================
do $$
begin
  perform cdtest_traj.check(
    exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'profiles' and column_name = 'trajectory_tags'
        and data_type = 'ARRAY' and is_nullable = 'NO' and column_default = '''{}''::text[]'
    ),
    'profiles.trajectory_tags text[] not null default ''{}''');
  perform cdtest_traj.check(
    exists (select 1 from pg_constraint where conname = 'profiles_trajectory_tags_catalog'
            and conrelid = 'public.profiles'::regclass and contype = 'c'),
    'CHECK profiles_trajectory_tags_catalog existe');
  perform cdtest_traj.check(
    exists (select 1 from pg_indexes where schemaname = 'public' and tablename = 'profiles'
            and indexname = 'profiles_trajectory_tags_idx' and indexdef ilike '%using gin%'),
    'índice GIN para o filtro do diretório');
  perform cdtest_traj.check(
    exists (select 1 from pg_trigger where tgname = 'profiles_normalize_trajectory'
            and tgrelid = 'public.profiles'::regclass and not tgisinternal)
    and exists (select 1 from pg_trigger where tgname = 'profiles_before_write'
            and tgrelid = 'public.profiles'::regclass and not tgisinternal),
    'trigger novo ao lado do profiles_before_write (que continua lá)');

  perform cdtest_traj.check(
    has_column_privilege('authenticated', 'public.profiles', 'trajectory_tags', 'update')
    and has_column_privilege('authenticated', 'public.profiles', 'trajectory_tags', 'insert')
    and has_column_privilege('authenticated', 'public.profiles', 'trajectory_tags', 'select'),
    'membras: SELECT, INSERT e UPDATE na coluna');
  perform cdtest_traj.check(
    not has_column_privilege('anon', 'public.profiles', 'trajectory_tags', 'select')
    and not has_column_privilege('anon', 'public.profiles', 'trajectory_tags', 'update')
    and not has_table_privilege('anon', 'public.profiles', 'select'),
    'visitantes: nada em profiles');
  -- O GRANT novo não abriu colunas protegidas.
  perform cdtest_traj.check(
    not has_column_privilege('authenticated', 'public.profiles', 'role', 'update')
    and not has_column_privilege('authenticated', 'public.profiles', 'id', 'update'),
    'role e id continuam sem UPDATE');

  perform cdtest_traj.check(
    not has_function_privilege('authenticated', 'private.profiles_normalize_trajectory()', 'execute')
    and not has_function_privilege('anon', 'private.profiles_normalize_trajectory()', 'execute'),
    'função do trigger sem EXECUTE para membras e visitantes');
  perform cdtest_traj.check(
    (select proconfig @> array['search_path=""'] from pg_proc
     where oid = 'private.profiles_normalize_trajectory()'::regprocedure),
    'função do trigger com search_path vazio');
end
$$;
select pass('estrutura: coluna, CHECK, índice GIN, trigger e GRANTs por coluna');

-- =============================================================================
-- 2. Normalização e CD050
-- =============================================================================
do $$
begin
  perform cdtest_traj.login('f4000000-0000-4000-8000-000000000001');

  perform cdtest_traj.throws(
    $q$update public.profiles set trajectory_tags = array['primeira-geracao', 'raca']
       where id = 'f4000000-0000-4000-8000-000000000001'$q$,
    'CD050', 'marca fora do catálogo', 'Uma das opções de trajetória não existe mais.%');
  perform cdtest_traj.throws(
    $q$update public.profiles set trajectory_tags = array[null]::text[]
       where id = 'f4000000-0000-4000-8000-000000000001'$q$,
    'CD050', 'marca NULL dentro da lista');
  perform cdtest_traj.throws(
    $q$update public.profiles set trajectory_tags = array['']
       where id = 'f4000000-0000-4000-8000-000000000001'$q$,
    'CD050', 'marca vazia');

  perform cdtest_traj.check(
    cdtest_traj.affected($q$update public.profiles
      set trajectory_tags = array['mae-cuidadora', 'escola-publica', 'mae-cuidadora', ' Escola-Publica ']
      where id = 'f4000000-0000-4000-8000-000000000001'$q$) = 1,
    'a dona atualiza as próprias marcas');
  perform cdtest_traj.logout();

  perform cdtest_traj.check(
    cdtest_traj.tags('f4000000-0000-4000-8000-000000000001') = array['escola-publica', 'mae-cuidadora'],
    'repetidas saem, maiúsculas/espaços normalizados e lista em ordem');

  perform cdtest_traj.login('f4000000-0000-4000-8000-000000000001');
  update public.profiles set trajectory_tags = null where id = 'f4000000-0000-4000-8000-000000000001';
  perform cdtest_traj.logout();
  perform cdtest_traj.check(
    cdtest_traj.tags('f4000000-0000-4000-8000-000000000001') = '{}'::text[],
    'NULL vira lista vazia (tirar todas as marcas)');

  perform cdtest_traj.login('f4000000-0000-4000-8000-000000000001');
  update public.profiles
    set trajectory_tags = array['fora-das-capitais', 'mudanca-de-area', 'retorno-aos-estudos',
      'trabalha-e-estuda', 'mae-cuidadora', 'ensino-tecnico', 'escola-publica', 'primeira-geracao']
    where id = 'f4000000-0000-4000-8000-000000000001';
  perform cdtest_traj.logout();
  perform cdtest_traj.check(
    cardinality(cdtest_traj.tags('f4000000-0000-4000-8000-000000000001')) = 8,
    'as 8 marcas do catálogo cabem');

  -- Editar outra coluna não mexe nas marcas.
  perform cdtest_traj.login('f4000000-0000-4000-8000-000000000001');
  update public.profiles set headline = 'Graduanda (teste)' where id = 'f4000000-0000-4000-8000-000000000001';
  perform cdtest_traj.logout();
  perform cdtest_traj.check(
    cardinality(cdtest_traj.tags('f4000000-0000-4000-8000-000000000001')) = 8,
    'atualizar outra coluna preserva as marcas');
end
$$;
select pass('normalização (ordem, repetidas, NULL) e CD050 para marca desconhecida');

-- O CHECK segura mesmo sem o trigger (defesa em profundidade): triggers desligados só aqui.
set local session_replication_role = replica;
do $$
begin
  perform cdtest_traj.throws(
    $q$update public.profiles set trajectory_tags = array['inventada']
       where id = 'f4000000-0000-4000-8000-000000000005'$q$,
    '23514', 'CHECK recusa marca fora do catálogo');
  perform cdtest_traj.throws(
    $q$update public.profiles set trajectory_tags = array_fill('escola-publica'::text, array[9])
       where id = 'f4000000-0000-4000-8000-000000000005'$q$,
    '23514', 'CHECK recusa mais de 8 marcas');
end
$$;
set local session_replication_role = origin;
select pass('CHECK do catálogo segura mesmo sem o trigger');

-- =============================================================================
-- 3. Só a dona altera; membras leem; visitantes não
-- =============================================================================
do $$
declare
  v_tags text[];
begin
  perform cdtest_traj.login('f4000000-0000-4000-8000-000000000001');
  perform cdtest_traj.check(
    cdtest_traj.affected($q$update public.profiles set trajectory_tags = array['mudanca-de-area']
      where id = 'f4000000-0000-4000-8000-000000000002'$q$) = 0,
    'atualizar as marcas de outra membra afeta 0 linhas');
  select trajectory_tags into v_tags from public.profiles where id = 'f4000000-0000-4000-8000-000000000002';
  perform cdtest_traj.check(v_tags = array['escola-publica', 'primeira-geracao'],
    'membras leem as marcas de outra membra');
  perform cdtest_traj.logout();
  perform cdtest_traj.check(
    cdtest_traj.tags('f4000000-0000-4000-8000-000000000002') = array['escola-publica', 'primeira-geracao'],
    'as marcas da outra membra continuam iguais');

  perform cdtest_traj.login_anon();
  perform cdtest_traj.throws(
    'select trajectory_tags from public.profiles limit 1', '42501', 'visitante não lê profiles');
  perform cdtest_traj.throws(
    'select * from public.get_mentor_candidates(100)', '42501', 'visitante não chama get_mentor_candidates');
  perform cdtest_traj.throws(
    $q$update public.profiles set trajectory_tags = '{}' where id = 'f4000000-0000-4000-8000-000000000002'$q$,
    '42501', 'visitante não altera marcas');
  perform cdtest_traj.logout();
end
$$;
select pass('só a dona altera as marcas; membras leem; visitantes não leem nem alteram');

-- =============================================================================
-- 4. get_mentor_candidates devolve trajectory_tags e mantém as exclusões
-- =============================================================================
do $$
declare
  v_tags text[];
  v_result text := pg_get_function_result('public.get_mentor_candidates(integer)'::regprocedure);
begin
  perform cdtest_traj.check(v_result like '%existing_request_status mentorship_status, trajectory_tags text[])',
    format('trajectory_tags é a ÚLTIMA coluna do retorno (%s)', v_result));
  perform cdtest_traj.check(
    (select prosecdef and proconfig @> array['search_path=""'] from pg_proc
     where oid = 'public.get_mentor_candidates(integer)'::regprocedure),
    'continua SECURITY DEFINER com search_path vazio');
  perform cdtest_traj.check(
    has_function_privilege('authenticated', 'public.get_mentor_candidates(integer)', 'execute')
    and not has_function_privilege('anon', 'public.get_mentor_candidates(integer)', 'execute'),
    'EXECUTE só para membras (e service_role)');

  perform cdtest_traj.login('f4000000-0000-4000-8000-000000000001');
  select c.trajectory_tags into v_tags from public.get_mentor_candidates(100) c
    where c.mentor_id = 'f4000000-0000-4000-8000-000000000002';
  perform cdtest_traj.check(v_tags = array['escola-publica', 'primeira-geracao'],
    'devolve as marcas da mentora disponível');
  select c.trajectory_tags into v_tags from public.get_mentor_candidates(100) c
    where c.mentor_id = 'f4000000-0000-4000-8000-000000000005';
  perform cdtest_traj.check(v_tags = '{}'::text[], 'mentora sem marcas vem com lista vazia (não NULL)');
  perform cdtest_traj.check(
    not exists (select 1 from public.get_mentor_candidates(100) where mentor_id = 'f4000000-0000-4000-8000-000000000003'),
    'mentora pausada fica de fora');
  perform cdtest_traj.check(
    not exists (select 1 from public.get_mentor_candidates(100) where mentor_id = 'f4000000-0000-4000-8000-000000000004'),
    'perfil sem onboarding fica de fora');
  perform cdtest_traj.logout();

  -- A própria mentora não aparece para si mesma.
  perform cdtest_traj.login('f4000000-0000-4000-8000-000000000002');
  perform cdtest_traj.check(
    not exists (select 1 from public.get_mentor_candidates(100) where mentor_id = 'f4000000-0000-4000-8000-000000000002'),
    'a usuária não aparece entre as próprias candidatas');
  perform cdtest_traj.check(
    exists (select 1 from public.get_mentor_candidates(100) where mentor_id = 'f4000000-0000-4000-8000-000000000005'),
    'e enxerga as outras mentoras disponíveis');
  perform cdtest_traj.logout();
end
$$;
select pass('get_mentor_candidates: trajectory_tags no fim; exclui a própria, pausadas e sem onboarding');

-- =============================================================================
-- 5. Nenhuma função aberta a visitantes devolve a coluna
-- =============================================================================
do $$
declare
  v_leaks text;
begin
  select string_agg(p.oid::regprocedure::text, ', ') into v_leaks
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and has_function_privilege('anon', p.oid, 'execute')
    and (pg_get_function_result(p.oid) ilike '%trajectory%'
         or pg_get_function_result(p.oid) ilike '%profiles%'
         or p.prosrc ilike '%trajectory_tags%');
  perform cdtest_traj.check(v_leaks is null,
    format('funções de visitantes que tocam trajectory_tags: %s', v_leaks));
end
$$;
select pass('nenhuma função aberta a visitantes lê ou devolve trajectory_tags');

select * from finish();
rollback;
