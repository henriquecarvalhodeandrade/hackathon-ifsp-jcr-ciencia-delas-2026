-- =============================================================================
-- Artemis — testes de RLS, permissões, triggers e RPCs
-- =============================================================================
-- Roda de dois jeitos:
--   * `npx supabase test db` (pgTAP de verdade, com Docker);
--   * `scripts/db/validate-local.sh` (Postgres local + shim de pgTAP, sem Docker).
-- Cada bloco DO simula uma usuária (papel + request.jwt.claims, como o PostgREST
-- faz) e levanta EXCEÇÃO na primeira expectativa quebrada. Depois de cada bloco,
-- `pass()` registra o grupo no relatório TAP. Tudo roda numa transação desfeita
-- no final (ROLLBACK): o banco não é alterado.
-- Os testes criam os próprios dados (usuárias f0…), então não dependem do seed.
-- =============================================================================
begin;
-- Mesmo search_path do Supabase (pgTAP fica no schema extensions).
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
create schema cdtest;
grant usage on schema cdtest to anon, authenticated;

create function cdtest.login(p_user uuid) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end
$$;

create function cdtest.login_anon() returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"role": "anon"}', true);
  perform set_config('role', 'anon', true);
end
$$;

create function cdtest.logout() returns void
language plpgsql as $$
begin
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', '', true);
end
$$;

-- Executa p_sql e exige que falhe com o SQLSTATE informado (NULL = qualquer erro).
create function cdtest.throws(p_sql text, p_errcode text, p_desc text) returns void
language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if p_errcode is null or sqlstate = p_errcode then
      return;
    end if;
    raise exception 'FALHOU: % — esperava SQLSTATE %, veio % (%)', p_desc, p_errcode, sqlstate, sqlerrm;
  end;
  raise exception 'FALHOU: % — esperava erro %, mas o comando funcionou', p_desc, coalesce(p_errcode, '(qualquer)');
end
$$;

-- Executa p_sql e devolve quantas linhas foram afetadas.
create function cdtest.affected(p_sql text) returns bigint
language plpgsql as $$
declare
  n bigint;
begin
  execute p_sql;
  get diagnostics n = row_count;
  return n;
end
$$;

create function cdtest.check(p_condition boolean, p_desc text) returns void
language plpgsql as $$
begin
  if p_condition is not true then
    raise exception 'FALHOU: %', p_desc;
  end if;
end
$$;

-- Guarda/recupera ids entre blocos (GUC customizada, vale até o fim da transação).
create function cdtest.put(p_key text, p_value uuid) returns void
language sql as $$ select set_config('cdtest.' || p_key, p_value::text, true); $$;

create function cdtest.get(p_key text) returns uuid
language sql stable as $$ select nullif(current_setting('cdtest.' || p_key, true), '')::uuid; $$;

-- Vetor unitário de 768 dimensões com 1 nas posições indicadas (normalizado).
create function cdtest.vec(p_dims int[]) returns extensions.vector
language sql immutable as $$
  select ('[' || array_to_string(array(
    select case when i = any (p_dims) then 1.0 / sqrt(cardinality(p_dims)) else 0 end
    from generate_series(1, 768) as i
  ), ',') || ']')::extensions.vector(768);
$$;

grant execute on all functions in schema cdtest to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Dados de teste (como postgres)
-- -----------------------------------------------------------------------------
insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', 'f0000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
   'ana.teste@example.test', '{"full_name": "Ana Teste", "avatar_url": "https://example.test/ana.png"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'f0000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated',
   'bruna.teste@example.test', '{"name": "Bruna Teste", "picture": "javascript:alert(1)"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'f0000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated',
   'mentora1.teste@example.test', '{"full_name": "Mentora Um"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'f0000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated',
   'mentora2.teste@example.test', '{"full_name": "Mentora Dois"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'f0000000-0000-4000-8000-000000000005', 'authenticated', 'authenticated',
   'mod.teste@example.test', '{"full_name": "Moderadora Teste"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'f0000000-0000-4000-8000-000000000006', 'authenticated', 'authenticated',
   'admin.teste@example.test', '{"full_name": "Admin Teste"}', now(), now());

select pass('handle_new_user cria perfis a partir de auth.users');

do $$
begin
  perform cdtest.check(
    (select full_name from public.profiles where id = 'f0000000-0000-4000-8000-000000000001') = 'Ana Teste',
    'full_name vem de raw_user_meta_data.full_name');
  perform cdtest.check(
    (select avatar_url from public.profiles where id = 'f0000000-0000-4000-8000-000000000001') = 'https://example.test/ana.png',
    'avatar_url vem de raw_user_meta_data.avatar_url');
  perform cdtest.check(
    (select full_name from public.profiles where id = 'f0000000-0000-4000-8000-000000000002') = 'Bruna Teste',
    'full_name usa "name" como alternativa');
  perform cdtest.check(
    (select avatar_url from public.profiles where id = 'f0000000-0000-4000-8000-000000000002') is null,
    'avatar com esquema perigoso (javascript:) é descartado');
  perform cdtest.check(
    (select role from public.profiles where id = 'f0000000-0000-4000-8000-000000000001') = 'member',
    'papel padrão é member');
end
$$;
select pass('perfil criado com nome/avatar sanitizados e papel member');

-- Configuração das usuárias de teste
update public.profiles set onboarded_at = now(), career_stage = 'undergraduate', seeks_mentorship = true,
  ai_consent = true where id in ('f0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000002');
update public.profiles set onboarded_at = now(), career_stage = 'professor', is_mentor = true,
  mentor_capacity = 1, mentor_available = true, ai_consent = true
  where id = 'f0000000-0000-4000-8000-000000000003';
update public.profiles set onboarded_at = now(), career_stage = 'researcher', is_mentor = true,
  mentor_capacity = 2, mentor_available = true, ai_consent = true
  where id = 'f0000000-0000-4000-8000-000000000004';
update public.profiles set onboarded_at = now(), role = 'moderator' where id = 'f0000000-0000-4000-8000-000000000005';
update public.profiles set onboarded_at = now(), role = 'admin' where id = 'f0000000-0000-4000-8000-000000000006';

insert into public.research_areas (slug, name, big_area) values
  ('teste-grande-area', 'Grande Área Teste', 'Grande Área Teste'),
  ('teste-subarea', 'Subárea Teste', 'Grande Área Teste');
insert into public.profile_research_areas (profile_id, area_id)
select p.id, ra.id
from (values ('f0000000-0000-4000-8000-000000000001'::uuid), ('f0000000-0000-4000-8000-000000000003'::uuid)) as p (id)
cross join public.research_areas ra where ra.slug = 'teste-subarea';

insert into public.forum_categories (slug, name, allow_anonymous, sort_order) values
  ('teste-anonimo', 'Categoria anônima de teste', true, 90),
  ('teste-normal', 'Categoria normal de teste', false, 91);

insert into public.newsletter_editions (slug, title, content, status) values
  ('teste-publicada', 'Edição publicada de teste', '{"papers": []}', 'published'),
  ('teste-rascunho', 'Rascunho de teste', '{"papers": []}', 'draft');

insert into public.newsletter_subscribers (email, consent_text) values
  ('inscrita.teste@example.test', 'Aceito receber a newsletter semanal (teste).');

-- -----------------------------------------------------------------------------
-- 1. Visitante anônima (anon)
-- -----------------------------------------------------------------------------
do $$
begin
  perform cdtest.login_anon();
  perform cdtest.throws('select count(*) from public.profiles', '42501', 'anon não lê profiles');
  perform cdtest.throws('select count(*) from public.forum_threads', '42501', 'anon não lê forum_threads');
  perform cdtest.throws('select count(*) from public.forum_posts', '42501', 'anon não lê forum_posts');
  perform cdtest.throws('select count(*) from public.forum_anonymous_authorship', '42501', 'anon não lê autoria anônima');
  perform cdtest.throws('select count(*) from public.forum_thread_reaction_counts', '42501', 'anon não lê contagem de reações');
  perform cdtest.throws('select count(*) from public.mentorship_requests', '42501', 'anon não lê mentorias');
  perform cdtest.throws('select count(*) from public.notifications', '42501', 'anon não lê notificações');
  perform cdtest.throws('select count(*) from public.reports', '42501', 'anon não lê denúncias');
  perform cdtest.throws('select count(*) from public.newsletter_subscribers', '42501', 'anon não lê inscritas');
  perform cdtest.throws('select count(*) from public.newsletter_deliveries', '42501', 'anon não lê envios');
  perform cdtest.throws('select count(*) from public.profile_embeddings', '42501', 'anon não lê embeddings');

  perform cdtest.check((select count(*) from public.research_areas where slug = 'teste-subarea') = 1,
    'anon lê research_areas');
  perform cdtest.check((select count(*) from public.forum_categories where slug = 'teste-anonimo') = 1,
    'anon lê forum_categories');
  perform cdtest.check((select count(*) from public.newsletter_editions where slug = 'teste-publicada') = 1,
    'anon lê edição publicada');
  perform cdtest.check((select count(*) from public.newsletter_editions where slug = 'teste-rascunho') = 0,
    'anon NÃO lê rascunho da newsletter');
  perform cdtest.check((select count(*) from public.get_platform_stats()) = 1, 'anon chama get_platform_stats');
  perform cdtest.check(public.is_moderator() = false, 'is_moderator() é false para anon');

  perform cdtest.throws('select * from public.get_mentor_candidates()', '42501', 'anon não chama get_mentor_candidates');
  perform cdtest.throws('select * from public.get_community_leaderboard()', '42501', 'anon não chama o leaderboard');
  perform cdtest.throws($q$insert into public.paper_votes (paper_id, user_id) values (gen_random_uuid(), gen_random_uuid())$q$,
    '42501', 'anon não vota');
  perform cdtest.logout();
end
$$;
select pass('anon: sem acesso a perfis/fórum/mentoria/newsletter; lê áreas, categorias e edições publicadas');

-- -----------------------------------------------------------------------------
-- 2. Perfis: colunas protegidas
-- -----------------------------------------------------------------------------
do $$
declare
  n bigint;
begin
  perform cdtest.login('f0000000-0000-4000-8000-000000000001');
  perform cdtest.check((select count(*) from public.profiles where id = 'f0000000-0000-4000-8000-000000000002') = 1,
    'membro lê perfis de outras membros');

  n := cdtest.affected($q$update public.profiles set headline = '  Pesquisadora em teste  ', keywords = array['IA', ' ia ', 'Dados']
    where id = 'f0000000-0000-4000-8000-000000000001'$q$);
  perform cdtest.check(n = 1, 'membro edita o próprio perfil');
  perform cdtest.check(
    (select headline from public.profiles where id = 'f0000000-0000-4000-8000-000000000001') = 'Pesquisadora em teste',
    'headline é normalizada (trim)');
  perform cdtest.check(
    (select keywords from public.profiles where id = 'f0000000-0000-4000-8000-000000000001') = array['ia', 'dados'],
    'keywords em minúsculas e sem duplicadas');

  perform cdtest.throws($q$update public.profiles set role = 'admin' where id = 'f0000000-0000-4000-8000-000000000001'$q$,
    '42501', 'membro não muda o próprio role');
  perform cdtest.throws($q$update public.profiles set created_at = now() where id = 'f0000000-0000-4000-8000-000000000001'$q$,
    '42501', 'membro não muda created_at');
  perform cdtest.throws($q$update public.profiles set website_url = 'javascript:alert(1)' where id = 'f0000000-0000-4000-8000-000000000001'$q$,
    '23514', 'URL precisa ser http(s)');
  perform cdtest.throws($q$update public.profiles set mentorship_topics = array['inexistente'] where id = 'f0000000-0000-4000-8000-000000000001'$q$,
    '23514', 'tópico de mentoria precisa existir no catálogo');

  n := cdtest.affected($q$update public.profiles set headline = 'invadido' where id = 'f0000000-0000-4000-8000-000000000002'$q$);
  perform cdtest.check(n = 0, 'membro NÃO edita perfil alheio');
  perform cdtest.logout();
end
$$;
select pass('perfis: edição só do próprio, role/created_at protegidos, normalização e CHECKs');

-- -----------------------------------------------------------------------------
-- 3. Papers, votos e ranking
-- -----------------------------------------------------------------------------
do $$
declare
  v_id uuid;
begin
  perform cdtest.login('f0000000-0000-4000-8000-000000000001');
  insert into public.papers (submitted_by, title, abstract, authors, doi, area_id, submitter_relation, women_authorship_confirmed)
  values ('f0000000-0000-4000-8000-000000000001', 'Paper antigo de teste',
    repeat('Resumo de teste com tamanho suficiente. ', 3), array['Ana Teste'], 'https://doi.org/10.5555/TESTE.Antigo',
    (select id from public.research_areas where slug = 'teste-subarea'), 'author', true)
  returning id into v_id;
  perform cdtest.put('paper_old', v_id);
  perform cdtest.check((select doi from public.papers where id = v_id) = '10.5555/teste.antigo',
    'DOI normalizado (sem prefixo de URL, minúsculo)');

  insert into public.papers (submitted_by, title, abstract, authors, submitter_relation, women_authorship_confirmed)
  values ('f0000000-0000-4000-8000-000000000001', 'Paper novo de teste',
    repeat('Outro resumo de teste, também longo. ', 3), array['Ana Teste', 'Bruna Teste'], 'coauthor', true)
  returning id into v_id;
  perform cdtest.put('paper_new', v_id);

  insert into public.papers (submitted_by, title, abstract, authors, submitter_relation, women_authorship_confirmed)
  values ('f0000000-0000-4000-8000-000000000001', 'Paper que será ocultado',
    repeat('Resumo do paper que a moderação vai ocultar. ', 2), array['Ana Teste'], 'author', true)
  returning id into v_id;
  perform cdtest.put('paper_hidden', v_id);

  perform cdtest.throws($q$insert into public.papers (submitted_by, title, abstract, authors, submitter_relation, women_authorship_confirmed, vote_count)
    values ('f0000000-0000-4000-8000-000000000001', 'Paper com votos falsos', repeat('x', 60), array['Ana'], 'author', true, 999)$q$,
    '42501', 'membro não define vote_count ao inserir');
  perform cdtest.throws($q$insert into public.papers (submitted_by, title, abstract, authors, submitter_relation, women_authorship_confirmed)
    values ('f0000000-0000-4000-8000-000000000002', 'Paper em nome de outra', repeat('x', 60), array['Ana'], 'author', true)$q$,
    '42501', 'membro não envia paper em nome de outra pessoa');
  perform cdtest.throws($q$insert into public.papers (submitted_by, title, abstract, authors, submitter_relation, women_authorship_confirmed)
    values ('f0000000-0000-4000-8000-000000000001', 'Paper sem confirmação', repeat('x', 60), array['Ana'], 'author', false)$q$,
    '23514', 'women_authorship_confirmed precisa ser true');
  perform cdtest.throws(format('update public.papers set vote_count = 100 where id = %L', cdtest.get('paper_new')),
    '42501', 'membro não altera vote_count');
  perform cdtest.throws(format('update public.papers set is_hidden = true where id = %L', cdtest.get('paper_new')),
    '42501', 'membro não altera is_hidden');
  perform cdtest.throws(format('insert into public.paper_votes (paper_id, user_id) values (%L, %L)',
      cdtest.get('paper_new'), 'f0000000-0000-4000-8000-000000000001'),
    'CD012', 'não pode votar no próprio paper');
  perform cdtest.logout();
end
$$;
select pass('papers: envio próprio, colunas protegidas, DOI normalizado e sem auto-voto');

-- Paper antigo: criado há 100 dias, 3 votos há ~50 dias. Paper novo: 2 dias, 1 voto recente.
update public.papers set created_at = now() - interval '100 days' where id = cdtest.get('paper_old');
update public.papers set created_at = now() - interval '2 days' where id = cdtest.get('paper_new');
insert into public.paper_votes (paper_id, user_id, created_at) values
  (cdtest.get('paper_old'), 'f0000000-0000-4000-8000-000000000002', now() - interval '50 days'),
  (cdtest.get('paper_old'), 'f0000000-0000-4000-8000-000000000003', now() - interval '51 days'),
  (cdtest.get('paper_old'), 'f0000000-0000-4000-8000-000000000004', now() - interval '52 days');

do $$
declare
  n bigint;
begin
  perform cdtest.check((select vote_count from public.papers where id = cdtest.get('paper_old')) = 3,
    'trigger mantém vote_count (3)');

  perform cdtest.login('f0000000-0000-4000-8000-000000000002');
  insert into public.paper_votes (paper_id, user_id) values (cdtest.get('paper_new'), 'f0000000-0000-4000-8000-000000000002');
  perform cdtest.check((select vote_count from public.papers where id = cdtest.get('paper_new')) = 1,
    'voto da Bruna incrementa vote_count');
  perform cdtest.throws(format('insert into public.paper_votes (paper_id, user_id) values (%L, %L)',
      cdtest.get('paper_new'), 'f0000000-0000-4000-8000-000000000003'),
    '42501', 'não vota em nome de outra pessoa');
  perform cdtest.throws(format('insert into public.paper_votes (paper_id, user_id) values (%L, %L)',
      cdtest.get('paper_new'), 'f0000000-0000-4000-8000-000000000002'),
    '23505', 'não vota duas vezes');
  perform cdtest.logout();

  -- Voto + retirada do voto pela Mentora Um
  perform cdtest.login('f0000000-0000-4000-8000-000000000003');
  insert into public.paper_votes (paper_id, user_id) values (cdtest.get('paper_new'), 'f0000000-0000-4000-8000-000000000003');
  perform cdtest.check((select vote_count from public.papers where id = cdtest.get('paper_new')) = 2, 'segundo voto (2)');
  n := cdtest.affected(format('delete from public.paper_votes where paper_id = %L', cdtest.get('paper_new')));
  perform cdtest.check(n = 1, 'só apaga o próprio voto');
  perform cdtest.check((select vote_count from public.papers where id = cdtest.get('paper_new')) = 1,
    'retirar o voto decrementa vote_count');
  perform cdtest.logout();
end
$$;
select pass('paper_votes: trigger de vote_count, voto único, sem voto em nome alheio');

do $$
declare
  v_week_old int;
  v_week_new int;
  v_all_old int;
  v_all_new int;
begin
  perform cdtest.login_anon();
  select ord into v_week_old from public.get_paper_ranking('week', null, 100, 0) with ordinality as r(id, title, authors, venue, year, doi, url, area_id, area_slug, area_name, plain_summary, vote_count, period_votes, comment_count, hot_score, created_at, submitted_by, ord)
    where r.id = cdtest.get('paper_old');
  select ord into v_week_new from public.get_paper_ranking('week', null, 100, 0) with ordinality as r(id, title, authors, venue, year, doi, url, area_id, area_slug, area_name, plain_summary, vote_count, period_votes, comment_count, hot_score, created_at, submitted_by, ord)
    where r.id = cdtest.get('paper_new');
  select ord into v_all_old from public.get_paper_ranking('all', null, 100, 0) with ordinality as r(id, title, authors, venue, year, doi, url, area_id, area_slug, area_name, plain_summary, vote_count, period_votes, comment_count, hot_score, created_at, submitted_by, ord)
    where r.id = cdtest.get('paper_old');
  select ord into v_all_new from public.get_paper_ranking('all', null, 100, 0) with ordinality as r(id, title, authors, venue, year, doi, url, area_id, area_slug, area_name, plain_summary, vote_count, period_votes, comment_count, hot_score, created_at, submitted_by, ord)
    where r.id = cdtest.get('paper_new');

  perform cdtest.check(v_week_new < v_week_old, format('semana: paper novo (%s) antes do antigo (%s)', v_week_new, v_week_old));
  perform cdtest.check(v_all_old < v_all_new, format('todos os tempos: paper antigo (%s) antes do novo (%s)', v_all_old, v_all_new));
  perform cdtest.check(
    (select period_votes from public.get_paper_ranking('week', null, 100, 0) where id = cdtest.get('paper_old')) = 0,
    'semana: paper antigo tem 0 votos no período');
  perform cdtest.check(
    (select period_votes from public.get_paper_ranking('month', null, 100, 0) where id = cdtest.get('paper_old')) = 0,
    'mês: votos de 50 dias atrás não contam');
  perform cdtest.check(
    (select period_votes from public.get_paper_ranking('year', null, 100, 0) where id = cdtest.get('paper_old')) = 3,
    'ano: os 3 votos contam');
  perform cdtest.check(
    (select period_votes from public.get_paper_ranking('all', null, 100, 0) where id = cdtest.get('paper_old')) = 3,
    'todos os tempos: period_votes = vote_count');
  perform cdtest.check(
    (select hot_score from public.get_paper_ranking('hot', null, 100, 0) where id = cdtest.get('paper_new'))
      > (select hot_score from public.get_paper_ranking('hot', null, 100, 0) where id = cdtest.get('paper_old')),
    'em alta: paper novo com 1 voto supera o antigo com 3');
  perform cdtest.check(
    (select count(*) from public.get_paper_ranking('all', 'teste-grande-area', 100, 0)) = 1
      and (select id from public.get_paper_ranking('all', 'teste-grande-area', 100, 0)) = cdtest.get('paper_old'),
    'filtro por grande área inclui papers das subáreas');
  perform cdtest.check(
    (select area_slug from public.get_paper_ranking('all', 'teste-subarea', 100, 0)) = 'teste-subarea',
    'filtro por subárea devolve area_slug');
  perform cdtest.throws($q$select * from public.get_paper_ranking('decada')$q$, '22023', 'período inválido gera erro');
  perform cdtest.logout();
end
$$;
select pass('get_paper_ranking: semana ≠ todos os tempos, janelas, hot e filtro por área');

do $$
begin
  perform cdtest.login('f0000000-0000-4000-8000-000000000001');
  perform cdtest.throws(format('select public.moderate_paper(%L, true)', cdtest.get('paper_hidden')),
    '42501', 'membro não oculta papers');
  perform cdtest.logout();

  perform cdtest.login('f0000000-0000-4000-8000-000000000005');
  perform public.moderate_paper(cdtest.get('paper_hidden'), true);
  perform cdtest.check((select count(*) from public.papers where id = cdtest.get('paper_hidden')) = 1,
    'moderadora ainda vê o paper oculto');
  perform cdtest.logout();

  perform cdtest.login_anon();
  perform cdtest.check((select count(*) from public.papers where id = cdtest.get('paper_hidden')) = 0,
    'anon não vê paper oculto');
  perform cdtest.check((select count(*) from public.papers where id = cdtest.get('paper_new')) = 1,
    'anon vê paper visível');
  perform cdtest.check(
    (select count(*) from public.get_paper_ranking('all', null, 100, 0) where id = cdtest.get('paper_hidden')) = 0,
    'ranking exclui paper oculto');
  perform cdtest.logout();

  perform cdtest.login('f0000000-0000-4000-8000-000000000001');
  perform cdtest.check((select count(*) from public.papers where id = cdtest.get('paper_hidden')) = 1,
    'quem enviou ainda vê o próprio paper oculto');
  perform cdtest.logout();

  perform cdtest.login('f0000000-0000-4000-8000-000000000002');
  perform cdtest.throws(format('insert into public.paper_votes (paper_id, user_id) values (%L, %L)',
      cdtest.get('paper_hidden'), 'f0000000-0000-4000-8000-000000000002'),
    'CD015', 'não vota em paper oculto');
  perform cdtest.logout();
end
$$;
select pass('moderação de papers: ocultar via RPC, visibilidade de ocultos');

-- Comentários
do $$
declare
  v_id uuid;
  n bigint;
begin
  perform cdtest.login('f0000000-0000-4000-8000-000000000002');
  insert into public.paper_comments (paper_id, author_id, body)
  values (cdtest.get('paper_new'), 'f0000000-0000-4000-8000-000000000002', 'Comentário de teste!')
  returning id into v_id;
  perform cdtest.put('comment', v_id);
  perform cdtest.check((select comment_count from public.papers where id = cdtest.get('paper_new')) = 1,
    'comment_count incrementa');
  perform cdtest.throws(format('update public.paper_comments set author_id = %L where id = %L',
      'f0000000-0000-4000-8000-000000000001', v_id),
    '42501', 'não troca autoria do comentário');
  perform cdtest.logout();

  perform cdtest.login('f0000000-0000-4000-8000-000000000001');
  perform cdtest.check(
    (select count(*) from public.notifications where type = 'paper_comment' and link like '/papers/' || cdtest.get('paper_new') || '%') = 1,
    'quem enviou o paper é notificada do comentário');
  n := cdtest.affected(format('delete from public.paper_comments where id = %L', cdtest.get('comment')));
  perform cdtest.check(n = 0, 'membro não apaga comentário alheio');
  perform cdtest.logout();

  perform cdtest.login('f0000000-0000-4000-8000-000000000005');
  n := cdtest.affected(format('delete from public.paper_comments where id = %L', cdtest.get('comment')));
  perform cdtest.check(n = 1, 'moderadora apaga comentário');
  perform cdtest.check((select comment_count from public.papers where id = cdtest.get('paper_new')) = 0,
    'comment_count decrementa');
  perform cdtest.logout();
end
$$;
select pass('paper_comments: contador, notificação e exclusão pela moderação');

-- -----------------------------------------------------------------------------
-- 4. Fórum: anonimato
-- -----------------------------------------------------------------------------
do $$
declare
  v_thread uuid;
  v_author uuid;
  v_cat_anon smallint := (select id from public.forum_categories where slug = 'teste-anonimo');
  v_cat_normal smallint := (select id from public.forum_categories where slug = 'teste-normal');
  n bigint;
begin
  perform cdtest.login('f0000000-0000-4000-8000-000000000001');
  insert into public.forum_threads (category_id, author_id, is_anonymous, title, body)
  values (v_cat_anon, 'f0000000-0000-4000-8000-000000000001', true, 'Tópico anônimo de teste',
          'Preciso de ajuda, mas prefiro não me identificar.')
  returning id, author_id into v_thread, v_author;
  perform cdtest.put('anon_thread', v_thread);
  perform cdtest.check(v_author is null, 'tópico anônimo é gravado com author_id NULL');
  perform cdtest.check(
    (select user_id from public.forum_anonymous_authorship where thread_id = v_thread) = 'f0000000-0000-4000-8000-000000000001',
    'autora vê a própria autoria anônima');

  n := cdtest.affected(format($q$update public.forum_threads set title = 'Tópico anônimo editado' where id = %L$q$, v_thread));
  perform cdtest.check(n = 1, 'autora anônima edita o próprio tópico');
  perform cdtest.check(
    (select edited_at is not null from public.forum_threads where id = v_thread), 'edited_at preenchido ao editar');
  perform cdtest.throws(format('update public.forum_threads set is_anonymous = false where id = %L', v_thread),
    '42501', 'não dá para desfazer o anonimato');
  perform cdtest.throws(format('update public.forum_threads set author_id = %L where id = %L',
      'f0000000-0000-4000-8000-000000000001', v_thread),
    '42501', 'não dá para trocar author_id');

  perform cdtest.throws(format($q$insert into public.forum_threads (category_id, author_id, is_anonymous, title, body)
      values (%s, %L, true, 'Anônimo proibido', 'Categoria sem anonimato permitido.')$q$,
      v_cat_normal, 'f0000000-0000-4000-8000-000000000001'),
    'CD010', 'anonimato em categoria que não permite');
  perform cdtest.throws(format($q$insert into public.forum_threads (category_id, author_id, is_anonymous, title, body)
      values (%s, null, true, 'Anônimo sem autoria', 'Tentando pular o registro de autoria.')$q$, v_cat_anon),
    'CD013', 'anônimo sem author_id é rejeitado');
  perform cdtest.throws(format($q$insert into public.forum_threads (category_id, author_id, title, body, is_pinned)
      values (%s, %L, 'Tópico fixado por membro', 'Membros não podem fixar tópicos.', true)$q$,
      v_cat_normal, 'f0000000-0000-4000-8000-000000000001'),
    '42501', 'membro não cria tópico já fixado');
  perform cdtest.logout();

  -- Outra membro: não descobre a autoria
  perform cdtest.login('f0000000-0000-4000-8000-000000000002');
  perform cdtest.check((select author_id from public.forum_threads where id = v_thread) is null,
    'outra membro vê author_id NULL');
  perform cdtest.check((select count(*) from public.forum_anonymous_authorship where thread_id = v_thread) = 0,
    'outra membro não vê a autoria anônima');
  n := cdtest.affected(format($q$update public.forum_threads set title = 'Invadido' where id = %L$q$, v_thread));
  perform cdtest.check(n = 0, 'outra membro não edita o tópico anônimo');
  n := cdtest.affected(format('delete from public.forum_threads where id = %L', v_thread));
  perform cdtest.check(n = 0, 'outra membro não apaga o tópico anônimo');
  perform cdtest.throws(format('select public.reveal_anonymous_author(%L)', v_thread),
    '42501', 'membro não revela autoria');

  -- Falsificação de autoria
  perform cdtest.throws(format($q$insert into public.forum_threads (category_id, author_id, title, body)
      values (%s, %L, 'Me passando pela Ana', 'Tentativa de falsificar a autoria do tópico.')$q$,
      v_cat_normal, 'f0000000-0000-4000-8000-000000000001'),
    'CD013', 'não publica em nome de outra (não anônimo)');
  perform cdtest.throws(format($q$insert into public.forum_threads (category_id, author_id, is_anonymous, title, body)
      values (%s, %L, true, 'Anônimo em nome da Ana', 'Tentativa de registrar a autoria como outra.')$q$,
      v_cat_anon, 'f0000000-0000-4000-8000-000000000001'),
    'CD013', 'não publica anônimo registrando outra como autora');
  perform cdtest.throws(format($q$insert into public.forum_posts (thread_id, author_id, body)
      values (%L, %L, 'Resposta falsificada')$q$, v_thread, 'f0000000-0000-4000-8000-000000000001'),
    'CD013', 'não responde em nome de outra');
  perform cdtest.logout();

  -- Moderação NÃO lê a autoria direto (auditoria da segurança): só pela RPC, com motivo + registro.
  perform cdtest.login('f0000000-0000-4000-8000-000000000005');
  perform cdtest.check(
    (select count(*) from public.forum_anonymous_authorship where thread_id = v_thread) = 0,
    'moderadora não lê forum_anonymous_authorship direto (sem contornar a auditoria)');
  perform cdtest.check((select count(*) from public.forum_anonymous_authorship) = 0,
    'moderadora sem autoria anônima própria não vê nenhuma linha');
  perform cdtest.check(
    public.reveal_anonymous_author(p_thread_id => v_thread,
      p_reason => 'Ameaça explícita a outra membra no tópico (teste).') = 'f0000000-0000-4000-8000-000000000001',
    'reveal_anonymous_author devolve a autora');
  perform cdtest.check(
    (select count(*) from public.moderation_audit_log
     where action = 'reveal_author' and target_id = v_thread
       and actor_id = 'f0000000-0000-4000-8000-000000000005') = 1,
    'a revelação pela RPC fica no registro de auditoria');
  perform cdtest.throws('select public.reveal_anonymous_author()', '22023', 'reveal exige exatamente um alvo');
  perform cdtest.throws(format('select public.reveal_anonymous_author(%L)', v_thread),
    'CD016', 'reveal exige motivo');
  perform cdtest.logout();
end
$$;
select pass('anonimato: author_id NULL, autoria só para a autora e a moderação, sem falsificação');

-- Defesa em profundidade: mesmo sem o trigger, o RLS barra anônimo sem autoria registrada.
alter table public.forum_threads disable trigger forum_threads_before_insert;
do $$
begin
  perform cdtest.login('f0000000-0000-4000-8000-000000000002');
  perform cdtest.throws(format($q$insert into public.forum_threads (category_id, author_id, is_anonymous, title, body)
      values (%s, null, true, 'Burlando o trigger', 'Sem registro de autoria, o RLS precisa barrar.')$q$,
      (select id from public.forum_categories where slug = 'teste-anonimo')),
    '42501', 'RLS exige autoria anônima registrada para a própria usuária');
  perform cdtest.logout();
end
$$;
alter table public.forum_threads enable trigger forum_threads_before_insert;
select pass('RLS de forum_threads rejeita anônimo sem autoria registrada (sem depender do trigger)');

-- -----------------------------------------------------------------------------
-- 5. Respostas, notificações, solução, tópico trancado, reações
-- -----------------------------------------------------------------------------
do $$
declare
  v_thread uuid := cdtest.get('anon_thread');
  v_post uuid;
  v_anon_post uuid;
  n bigint;
begin
  perform cdtest.login('f0000000-0000-4000-8000-000000000002');
  insert into public.forum_posts (thread_id, author_id, body)
  values (v_thread, 'f0000000-0000-4000-8000-000000000002', 'Força! Estamos com você.')
  returning id into v_post;
  perform cdtest.put('bruna_post', v_post);
  insert into public.forum_posts (thread_id, author_id, is_anonymous, body)
  values (v_thread, 'f0000000-0000-4000-8000-000000000002', true, 'Já passei por isso também (anônima).')
  returning id into v_anon_post;
  perform cdtest.put('bruna_anon_post', v_anon_post);
  perform cdtest.check((select author_id from public.forum_posts where id = v_anon_post) is null,
    'resposta anônima com author_id NULL');
  perform cdtest.check((select reply_count from public.forum_threads where id = v_thread) = 2,
    'reply_count = 2');
  perform cdtest.check((select count(*) from public.notifications) = 0,
    'Bruna não vê notificações da Ana');
  insert into public.forum_reactions (user_id, thread_id, kind)
  values ('f0000000-0000-4000-8000-000000000002', v_thread, 'support');
  perform cdtest.check(
    (select total from public.forum_thread_reaction_counts where thread_id = v_thread and kind = 'support') = 1,
    'view de contagem de reações');
  perform cdtest.throws(format($q$insert into public.forum_reactions (user_id, thread_id, kind) values (%L, %L, 'support')$q$,
      'f0000000-0000-4000-8000-000000000002', v_thread),
    '23505', 'reação única por tipo');
  perform cdtest.throws(format($q$insert into public.forum_reactions (user_id, thread_id, kind) values (%L, %L, 'useful')$q$,
      'f0000000-0000-4000-8000-000000000001', v_thread),
    '42501', 'não reage em nome de outra');
  perform cdtest.logout();

  -- A autora (anônima) do tópico recebe as notificações das respostas
  perform cdtest.login('f0000000-0000-4000-8000-000000000001');
  perform cdtest.check(
    (select count(*) from public.notifications where type = 'thread_reply' and link like '/forum/t/' || v_thread || '%') = 2,
    'autora anônima é notificada das 2 respostas');
  n := cdtest.affected($q$update public.notifications set read_at = now() where type = 'thread_reply'$q$);
  perform cdtest.check(n = 2, 'marca as próprias notificações como lidas');
  perform cdtest.throws($q$update public.notifications set title = 'alterado'$q$, '42501', 'não altera o título da notificação');
  perform cdtest.throws($q$insert into public.notifications (user_id, type, title) values ('f0000000-0000-4000-8000-000000000001', 'thread_reply', 'x')$q$,
    '42501', 'clientes não criam notificações');

  -- A dona do tópico não mexe na resposta anônima de outra pessoa nem descobre a autoria
  n := cdtest.affected(format($q$update public.forum_posts set body = 'Editado por outra' where id = %L$q$, v_anon_post));
  perform cdtest.check(n = 0, 'outra membro não edita resposta anônima alheia');
  n := cdtest.affected(format('delete from public.forum_posts where id = %L', v_anon_post));
  perform cdtest.check(n = 0, 'outra membro não apaga resposta anônima alheia');
  perform cdtest.check((select count(*) from public.forum_anonymous_authorship where post_id = v_anon_post) = 0,
    'outra membro não vê a autoria da resposta anônima');

  -- Marca a resposta da Bruna como solução
  n := cdtest.affected(format('update public.forum_threads set solution_post_id = %L where id = %L', v_post, v_thread));
  perform cdtest.check(n = 1, 'autora anônima marca a solução');
  perform cdtest.logout();

  perform cdtest.login('f0000000-0000-4000-8000-000000000002');
  perform cdtest.check(
    (select count(*) from public.notifications where type = 'solution_marked') = 1,
    'autora da resposta é notificada da solução');
  n := cdtest.affected(format('update public.forum_threads set solution_post_id = null where id = %L', v_thread));
  perform cdtest.check(n = 0, 'quem não é dona do tópico não muda a solução');
  n := cdtest.affected(format($q$update public.forum_posts set body = 'Resposta anônima editada' where id = %L$q$, v_anon_post));
  perform cdtest.check(n = 1, 'autora edita a própria resposta anônima');
  perform cdtest.throws(format('update public.forum_posts set is_anonymous = false where id = %L', v_anon_post),
    '42501', 'não desfaz o anonimato da resposta');
  perform cdtest.logout();
end
$$;
select pass('respostas: contadores, notificações (inclusive para autora anônima), solução e reações');

do $$
declare
  v_normal_thread uuid;
  v_other_post uuid;
  v_cat_normal smallint := (select id from public.forum_categories where slug = 'teste-normal');
begin
  -- Solução precisa ser uma resposta do próprio tópico
  perform cdtest.login('f0000000-0000-4000-8000-000000000003');
  insert into public.forum_threads (category_id, author_id, title, body)
  values (v_cat_normal, 'f0000000-0000-4000-8000-000000000003', 'Tópico normal da mentora', 'Vamos falar de carreira acadêmica?')
  returning id into v_normal_thread;
  perform cdtest.put('normal_thread', v_normal_thread);
  perform cdtest.throws(format('update public.forum_threads set solution_post_id = %L where id = %L',
      cdtest.get('bruna_post'), v_normal_thread),
    'CD014', 'solução de outro tópico é rejeitada');
  perform cdtest.logout();

  -- Moderação tranca; membros não respondem; moderadora responde
  perform cdtest.login('f0000000-0000-4000-8000-000000000001');
  perform cdtest.throws(format('select public.moderate_thread(%L, p_locked => true)', v_normal_thread),
    '42501', 'membro não tranca tópico');
  perform cdtest.throws(format('update public.forum_threads set is_locked = true where id = %L', v_normal_thread),
    '42501', 'membro não altera is_locked direto');
  perform cdtest.logout();

  perform cdtest.login('f0000000-0000-4000-8000-000000000005');
  perform public.moderate_thread(v_normal_thread, p_pinned => true, p_locked => true);
  perform cdtest.check((select is_locked and is_pinned from public.forum_threads where id = v_normal_thread),
    'moderate_thread fixa e tranca');
  insert into public.forum_posts (thread_id, author_id, body)
  values (v_normal_thread, 'f0000000-0000-4000-8000-000000000005', 'Tópico trancado pela moderação.');
  perform cdtest.logout();

  perform cdtest.login('f0000000-0000-4000-8000-000000000002');
  perform cdtest.throws(format($q$insert into public.forum_posts (thread_id, author_id, body) values (%L, %L, 'Posso responder?')$q$,
      v_normal_thread, 'f0000000-0000-4000-8000-000000000002'),
    'CD011', 'tópico trancado bloqueia respostas');
  perform cdtest.throws(format($q$insert into public.forum_posts (thread_id, author_id, is_anonymous, body) values (%L, %L, true, 'Anônima aqui?')$q$,
      cdtest.get('normal_thread'), 'f0000000-0000-4000-8000-000000000002'),
    'CD011', 'tópico trancado bloqueia também respostas anônimas');
  perform cdtest.logout();

  perform cdtest.login('f0000000-0000-4000-8000-000000000005');
  perform public.moderate_thread(v_normal_thread, p_locked => false);
  perform cdtest.check((select not is_locked and is_pinned from public.forum_threads where id = v_normal_thread),
    'destrancar mantém o tópico fixado (NULL não altera)');
  perform cdtest.logout();

  perform cdtest.login('f0000000-0000-4000-8000-000000000002');
  perform cdtest.throws(format($q$insert into public.forum_posts (thread_id, author_id, is_anonymous, body) values (%L, %L, true, 'Anônima em categoria normal')$q$,
      v_normal_thread, 'f0000000-0000-4000-8000-000000000002'),
    'CD010', 'resposta anônima em categoria sem anonimato');
  -- author_id omitido: o default auth.uid() preenche com a própria usuária
  insert into public.forum_posts (thread_id, body)
  values (v_normal_thread, 'Agora posso responder!')
  returning id into v_other_post;
  perform cdtest.check(
    (select author_id from public.forum_posts where id = v_other_post) = 'f0000000-0000-4000-8000-000000000002',
    'author_id padrão = auth.uid()');
  insert into public.forum_reactions (post_id, kind) values (v_other_post, 'useful');
  perform cdtest.check(
    (select total from public.forum_post_reaction_counts where post_id = v_other_post and kind = 'useful') = 1,
    'reação com user_id padrão e view de contagem por resposta');
  perform cdtest.check((select reply_count from public.forum_threads where id = v_normal_thread) = 2,
    'reply_count após destrancar');
  perform cdtest.logout();
end
$$;
select pass('tópico trancado bloqueia respostas; moderate_thread só para moderação');

-- -----------------------------------------------------------------------------
-- 6. Mentoria: candidatas, pedidos, transições, capacidade, contato
-- -----------------------------------------------------------------------------
-- Embeddings: Ana = e1; Mentora Um = e1 (idêntica); Mentora Dois = e2 (ortogonal).
insert into public.profile_embeddings (profile_id, embedding, content_hash, model) values
  ('f0000000-0000-4000-8000-000000000003', cdtest.vec(array[1]), 'h3', 'teste'),
  ('f0000000-0000-4000-8000-000000000004', cdtest.vec(array[2]), 'h4', 'teste');

do $$
declare
  r record;
  n bigint;
begin
  perform cdtest.login('f0000000-0000-4000-8000-000000000001');
  insert into public.profile_embeddings (profile_id, embedding, content_hash, model)
  values ('f0000000-0000-4000-8000-000000000001', cdtest.vec(array[1]), 'h1', 'teste');
  perform cdtest.check((select count(*) from public.profile_embeddings) = 1, 'membro só enxerga o próprio embedding');
  perform cdtest.throws($q$insert into public.profile_embeddings (profile_id, embedding, content_hash, model)
      values ('f0000000-0000-4000-8000-000000000002', cdtest.vec(array[3]), 'x', 'teste')$q$,
    '42501', 'não grava embedding de outra pessoa');

  perform cdtest.check(
    not exists (select 1 from public.get_mentor_candidates(100) where mentor_id = 'f0000000-0000-4000-8000-000000000001'),
    'candidatas não incluem a própria usuária');
  perform cdtest.check(
    not exists (select 1 from public.get_mentor_candidates(100) where mentor_id = 'f0000000-0000-4000-8000-000000000002'),
    'candidatas não incluem quem não é mentora');

  select * into r from public.get_mentor_candidates(100) where mentor_id = 'f0000000-0000-4000-8000-000000000003';
  perform cdtest.check(r.mentor_id is not null, 'Mentora Um aparece');
  perform cdtest.check(abs(r.similarity - 1) < 1e-6, format('similaridade com vetor idêntico ≈ 1 (veio %s)', r.similarity));
  perform cdtest.check(r.open_slots = 1, 'open_slots = capacidade (1)');
  perform cdtest.check(r.existing_request_status is null, 'sem pedido existente');
  perform cdtest.check(r.area_ids = array[(select id from public.research_areas where slug = 'teste-subarea')],
    'area_ids agregadas do perfil');

  select * into r from public.get_mentor_candidates(100) where mentor_id = 'f0000000-0000-4000-8000-000000000004';
  perform cdtest.check(abs(r.similarity) < 1e-6, format('similaridade com vetor ortogonal ≈ 0 (veio %s)', r.similarity));

  perform cdtest.check(
    (select c.mentor_id from public.get_mentor_candidates(100) as c limit 1) = 'f0000000-0000-4000-8000-000000000003',
    'mais similar vem primeiro (sem embedding = NULL, vai para o fim)');
  perform cdtest.logout();

  -- Sem embedding: similaridade NULL
  perform cdtest.login('f0000000-0000-4000-8000-000000000002');
  perform cdtest.check(
    (select similarity from public.get_mentor_candidates(100) where mentor_id = 'f0000000-0000-4000-8000-000000000003') is null,
    'similaridade NULL quando a mentoranda não tem embedding');
  perform cdtest.check((select count(*) from public.profile_embeddings) = 0, 'Bruna não vê embeddings alheios');
  perform cdtest.logout();

  -- Sugestões: só a mentoranda vê
  perform cdtest.login('f0000000-0000-4000-8000-000000000001');
  insert into public.mentor_suggestions (mentee_id, mentor_id, rank, score, reason, source)
  values ('f0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000003', 1, 95, 'Mesma área', 'heuristic');
  perform cdtest.logout();
  perform cdtest.login('f0000000-0000-4000-8000-000000000003');
  perform cdtest.check((select count(*) from public.mentor_suggestions) = 0, 'mentora não vê as sugestões da mentoranda');
  perform cdtest.logout();
end
$$;
select pass('get_mentor_candidates: similaridade de cosseno, exclusões, ordenação; embeddings e sugestões privados');

do $$
declare
  v_req uuid;
  v_req2 uuid;
  n bigint;
begin
  perform cdtest.login('f0000000-0000-4000-8000-000000000001');
  insert into public.mentorship_requests (mentee_id, mentor_id, message, match_score)
  values ('f0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000003',
          'Olá! Gostaria muito da sua mentoria para o mestrado.', 90)
  returning id into v_req;
  perform cdtest.put('req_ana', v_req);
  perform cdtest.check(
    (select existing_request_status from public.get_mentor_candidates(100) where mentor_id = 'f0000000-0000-4000-8000-000000000003') = 'pending',
    'existing_request_status = pending');

  perform cdtest.throws(format($q$insert into public.mentorship_requests (mentee_id, mentor_id, message)
      values (%L, %L, 'Pedido duplicado para a mesma mentora.')$q$,
      'f0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000003'),
    'CD004', 'pedido duplicado em aberto');
  perform cdtest.throws(format($q$insert into public.mentorship_requests (mentee_id, mentor_id, message)
      values (%L, %L, 'Pedido para quem não é mentora.')$q$,
      'f0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000002'),
    'CD003', 'pedido para quem não é mentora');
  perform cdtest.throws(format($q$insert into public.mentorship_requests (mentee_id, mentor_id, message)
      values (%L, %L, 'Pedido para mim mesma, não pode.')$q$,
      'f0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001'),
    'CD003', 'pedido para si mesma');
  perform cdtest.throws(format($q$insert into public.mentorship_requests (mentee_id, mentor_id, message, status)
      values (%L, %L, 'Já quero entrar como aceito.', 'accepted')$q$,
      'f0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000004'),
    '42501', 'mentoranda não define status no insert');
  perform cdtest.throws(format($q$insert into public.mentorship_requests (mentee_id, mentor_id, message)
      values (%L, %L, 'Pedido em nome de outra pessoa.')$q$,
      'f0000000-0000-4000-8000-000000000002', 'f0000000-0000-4000-8000-000000000004'),
    '42501', 'não pede mentoria em nome de outra');

  perform cdtest.throws(format($q$update public.mentorship_requests set status = 'accepted' where id = %L$q$, v_req),
    'CD002', 'mentoranda não aceita o próprio pedido');
  perform cdtest.throws(format($q$update public.mentorship_requests set response_message = 'oi' where id = %L$q$, v_req),
    'CD002', 'mentoranda não escreve a resposta da mentora');
  perform cdtest.throws(format($q$update public.mentorship_requests set message = 'mensagem trocada depois' where id = %L$q$, v_req),
    '42501', 'mensagem não pode ser alterada');
  perform cdtest.check(
    (select count(*) from public.get_mentorship_contact(v_req)) = 0, 'contato indisponível enquanto pendente');
  perform cdtest.logout();

  -- A mentora foi notificada
  perform cdtest.login('f0000000-0000-4000-8000-000000000003');
  perform cdtest.check(
    (select count(*) from public.notifications where type = 'mentorship_request') = 1,
    'mentora recebe notificação de novo pedido');
  perform cdtest.logout();

  -- Bruna também pede à Mentora Um (capacidade 1)
  perform cdtest.login('f0000000-0000-4000-8000-000000000002');
  insert into public.mentorship_requests (mentee_id, mentor_id, message)
  values ('f0000000-0000-4000-8000-000000000002', 'f0000000-0000-4000-8000-000000000003',
          'Oi! Também queria sua mentoria, se houver vaga.')
  returning id into v_req2;
  perform cdtest.put('req_bruna', v_req2);
  perform cdtest.check((select count(*) from public.mentorship_requests where id = cdtest.get('req_ana')) = 0,
    'Bruna não vê o pedido da Ana');
  perform cdtest.logout();

  -- Terceira pessoa não altera o pedido
  perform cdtest.login('f0000000-0000-4000-8000-000000000005');
  n := cdtest.affected(format($q$update public.mentorship_requests set status = 'declined' where id = %L$q$, v_req));
  perform cdtest.check(n = 0, 'não participante não altera o pedido');
  perform cdtest.logout();

  -- Mentora aceita a Ana; aceitar a Bruna estoura a capacidade
  perform cdtest.login('f0000000-0000-4000-8000-000000000003');
  update public.mentorship_requests set status = 'accepted', response_message = 'Vamos lá!' where id = v_req;
  perform cdtest.check((select responded_at is not null from public.mentorship_requests where id = v_req),
    'responded_at preenchido ao aceitar');
  perform cdtest.throws(format($q$update public.mentorship_requests set status = 'accepted' where id = %L$q$, v_req2),
    'CD001', 'mentora não aceita acima da capacidade');
  perform cdtest.check(
    (select email from public.get_mentorship_contact(v_req)) = 'ana.teste@example.test',
    'mentora recebe o e-mail da mentoranda');
  perform cdtest.check(
    (select count(*) from public.get_mentorship_contact(v_req2)) = 0, 'sem contato para pedido pendente');
  perform cdtest.logout();

  perform cdtest.login('f0000000-0000-4000-8000-000000000001');
  perform cdtest.check(
    (select email from public.get_mentorship_contact(v_req)) = 'mentora1.teste@example.test',
    'mentoranda recebe o e-mail da mentora');
  perform cdtest.check(
    (select count(*) from public.notifications where type = 'mentorship_response') = 1,
    'mentoranda é notificada do aceite');
  perform cdtest.check(
    not exists (select 1 from public.get_mentor_candidates(100) where mentor_id = 'f0000000-0000-4000-8000-000000000003'),
    'mentora sem vagas some das candidatas');
  perform cdtest.logout();

  perform cdtest.login('f0000000-0000-4000-8000-000000000005');
  perform cdtest.check((select count(*) from public.get_mentorship_contact(v_req)) = 0,
    'quem não participa não recebe contato');
  perform cdtest.logout();

  -- Mentora conclui; agora há vaga para aceitar a Bruna
  perform cdtest.login('f0000000-0000-4000-8000-000000000003');
  update public.mentorship_requests set status = 'completed' where id = v_req;
  update public.mentorship_requests set status = 'accepted' where id = v_req2;
  perform cdtest.check((select status from public.mentorship_requests where id = v_req2) = 'accepted',
    'aceite liberado depois de concluir outra mentoria');
  perform cdtest.throws(format($q$update public.mentorship_requests set status = 'pending' where id = %L$q$, v_req),
    'CD002', 'pedido concluído não volta a pendente');
  perform cdtest.logout();

  -- Mentoranda cancela uma mentoria ativa
  perform cdtest.login('f0000000-0000-4000-8000-000000000002');
  update public.mentorship_requests set status = 'cancelled' where id = v_req2;
  perform cdtest.check((select status from public.mentorship_requests where id = v_req2) = 'cancelled',
    'mentoranda cancela mentoria ativa');
  perform cdtest.logout();
end
$$;
select pass('mentorship_requests: transições, capacidade, duplicidade, contato só em mentoria aceita');

-- Revogar consentimento de IA apaga o embedding
do $$
begin
  perform cdtest.login('f0000000-0000-4000-8000-000000000001');
  perform cdtest.check((select count(*) from public.mentor_suggestions) = 1, 'Ana tem uma sugestão antes de revogar');
  update public.profiles set ai_consent = false where id = 'f0000000-0000-4000-8000-000000000001';
  perform cdtest.check((select count(*) from public.profile_embeddings) = 0, 'embedding apagado ao revogar consentimento');
  perform cdtest.check((select count(*) from public.mentor_suggestions) = 0,
    'sugestões de mentoras apagadas ao revogar consentimento');
  perform cdtest.check(
    (select ai_consent_at is null from public.profiles where id = 'f0000000-0000-4000-8000-000000000001'),
    'ai_consent_at limpo');
  perform cdtest.logout();
end
$$;
select pass('LGPD: revogar consentimento de IA apaga o embedding');

-- Regressão (revisão de segurança): ai_consent_at é definido pelo banco, nunca pela
-- cliente; e só existe embedding com consentimento de IA vigente.
update public.profiles set ai_consent_at = '2026-01-01 12:00:00+00'
  where id = 'f0000000-0000-4000-8000-000000000002'; -- contexto confiável (postgres)
insert into public.profile_embeddings (profile_id, embedding, content_hash, model)
values ('f0000000-0000-4000-8000-000000000001', cdtest.vec(array[1]), 'h-legado', 'teste'); -- Ana sem consentimento
do $$
begin
  perform cdtest.check(
    (select ai_consent_at from public.profiles where id = 'f0000000-0000-4000-8000-000000000002')
      = '2026-01-01 12:00:00+00'::timestamptz,
    'contexto confiável (seed/service role) informa a data do consentimento');

  perform cdtest.login('f0000000-0000-4000-8000-000000000002');
  update public.profiles set ai_consent_at = '2000-01-01' where id = 'f0000000-0000-4000-8000-000000000002';
  perform cdtest.check(
    (select ai_consent_at from public.profiles where id = 'f0000000-0000-4000-8000-000000000002')
      = '2026-01-01 12:00:00+00'::timestamptz,
    'membro não antedata um consentimento já dado');
  update public.profiles set ai_consent = false where id = 'f0000000-0000-4000-8000-000000000002';
  update public.profiles set ai_consent = true, ai_consent_at = '2030-01-01'
    where id = 'f0000000-0000-4000-8000-000000000002';
  perform cdtest.check(
    (select ai_consent_at from public.profiles where id = 'f0000000-0000-4000-8000-000000000002') = now(),
    'novo consentimento recebe a hora do servidor, não a enviada pela cliente');
  perform cdtest.logout();

  -- Ana revogou o consentimento no bloco anterior.
  perform cdtest.login('f0000000-0000-4000-8000-000000000001');
  perform cdtest.throws($q$update public.profile_embeddings set content_hash = 'h-novo'
      where profile_id = 'f0000000-0000-4000-8000-000000000001'$q$,
    '42501', 'sem consentimento de IA não atualiza o embedding');
  perform cdtest.check(
    cdtest.affected($q$delete from public.profile_embeddings where profile_id = 'f0000000-0000-4000-8000-000000000001'$q$) = 1,
    'apagar o próprio embedding é sempre permitido');
  perform cdtest.throws($q$insert into public.profile_embeddings (profile_id, embedding, content_hash, model)
      values ('f0000000-0000-4000-8000-000000000001', cdtest.vec(array[1]), 'h1', 'teste')
      on conflict (profile_id) do update set embedding = excluded.embedding, content_hash = excluded.content_hash$q$,
    '42501', 'sem consentimento de IA não grava embedding (ex.: cálculo que termina depois da revogação)');
  update public.profiles set ai_consent = true where id = 'f0000000-0000-4000-8000-000000000001';
  insert into public.profile_embeddings (profile_id, embedding, content_hash, model)
  values ('f0000000-0000-4000-8000-000000000001', cdtest.vec(array[1]), 'h1', 'teste');
  update public.profiles set ai_consent = false where id = 'f0000000-0000-4000-8000-000000000001';
  perform cdtest.check((select count(*) from public.profile_embeddings) = 0, 'revogar de novo apaga o embedding');
  perform cdtest.logout();
end
$$;
select pass('LGPD: ai_consent_at definido pelo servidor; embedding só com consentimento vigente');

-- -----------------------------------------------------------------------------
-- 7. Denúncias
-- -----------------------------------------------------------------------------
do $$
declare
  v_report uuid;
  n bigint;
begin
  perform cdtest.login('f0000000-0000-4000-8000-000000000001');
  insert into public.reports (reporter_id, target_type, target_id, reason, details)
  values ('f0000000-0000-4000-8000-000000000001', 'post', cdtest.get('bruna_post'), 'spam', 'Teste de denúncia')
  returning id into v_report;
  perform cdtest.put('report', v_report);
  perform cdtest.check((select count(*) from public.reports where id = v_report) = 1, 'denunciante vê a própria denúncia');
  n := cdtest.affected(format($q$update public.reports set status = 'dismissed' where id = %L$q$, v_report));
  perform cdtest.check(n = 0, 'denunciante não resolve a própria denúncia');
  perform cdtest.throws(format($q$insert into public.reports (reporter_id, target_type, target_id, reason)
      values (%L, 'thread', %L, 'other')$q$, 'f0000000-0000-4000-8000-000000000002', cdtest.get('anon_thread')),
    '42501', 'não denuncia em nome de outra');
  perform cdtest.logout();

  perform cdtest.login('f0000000-0000-4000-8000-000000000002');
  perform cdtest.check((select count(*) from public.reports where id = cdtest.get('report')) = 0,
    'outra membro não vê a denúncia');
  perform cdtest.logout();

  perform cdtest.login('f0000000-0000-4000-8000-000000000005');
  perform cdtest.check((select count(*) from public.reports where id = cdtest.get('report')) = 1, 'moderadora vê a denúncia');
  update public.reports set status = 'resolved', resolution_note = 'Conteúdo revisado.' where id = cdtest.get('report');
  perform cdtest.check(
    (select resolved_by = 'f0000000-0000-4000-8000-000000000005' and resolved_at is not null
     from public.reports where id = cdtest.get('report')),
    'resolved_by/resolved_at preenchidos pela moderadora');
  perform cdtest.logout();
end
$$;
select pass('reports: visíveis só para denunciante e moderação; só moderação resolve');

-- Regressão (revisão de segurança): resolved_by não é falsificável, mas a FK
-- `on delete set null` precisa funcionar quando a conta da moderadora é excluída
-- numa sessão com JWT (antes o trigger revertia o NULL e a exclusão falhava com 23503).
do $$
begin
  perform cdtest.login('f0000000-0000-4000-8000-000000000005');
  update public.reports set resolved_by = 'f0000000-0000-4000-8000-000000000006', resolution_note = 'Nota revisada.'
    where id = cdtest.get('report');
  perform cdtest.check(
    (select resolved_by from public.reports where id = cdtest.get('report')) = 'f0000000-0000-4000-8000-000000000005',
    'moderadora não atribui a resolução a outra pessoa');
  update public.reports set resolved_by = null where id = cdtest.get('report');
  perform cdtest.check(
    (select resolved_by from public.reports where id = cdtest.get('report')) = 'f0000000-0000-4000-8000-000000000005',
    'moderadora não apaga quem resolveu');
  perform cdtest.logout();

  begin
    -- Como uma RPC SECURITY DEFINER "excluir minha conta" faria (claims da própria usuária).
    perform set_config('request.jwt.claims',
      json_build_object('sub', 'f0000000-0000-4000-8000-000000000005', 'role', 'authenticated')::text, true);
    delete from auth.users where id = 'f0000000-0000-4000-8000-000000000005';
    perform set_config('request.jwt.claims', '', true);
    perform cdtest.check(
      (select resolved_by is null and status = 'resolved' from public.reports where id = cdtest.get('report')),
      'conta da moderadora excluída: resolved_by vira NULL e a denúncia segue resolvida');
    raise exception using errcode = 'CDT99', message = 'desfaz a exclusão de teste';
  exception when sqlstate 'CDT99' then
    null;
  end;
  perform cdtest.check(
    (select resolved_by from public.reports where id = cdtest.get('report')) = 'f0000000-0000-4000-8000-000000000005',
    'exclusão de teste desfeita');
end
$$;
select pass('reports: resolved_by protegido e exclusão da conta da moderadora não quebra');

-- -----------------------------------------------------------------------------
-- 8. Newsletter (somente service role / admins)
-- -----------------------------------------------------------------------------
do $$
begin
  perform cdtest.login('f0000000-0000-4000-8000-000000000001');
  perform cdtest.throws('select count(*) from public.newsletter_subscribers', '42501', 'membro não lê inscritas');
  perform cdtest.throws('select count(*) from public.newsletter_deliveries', '42501', 'membro não lê envios');
  perform cdtest.check((select count(*) from public.newsletter_editions where slug = 'teste-rascunho') = 0,
    'membro não vê rascunhos');
  perform cdtest.throws($q$insert into public.newsletter_editions (slug, title, content) values ('teste-membro', 'Edição de membro', '{}')$q$,
    '42501', 'membro não cria edições');
  perform cdtest.logout();

  perform cdtest.login('f0000000-0000-4000-8000-000000000005');
  perform cdtest.check((select count(*) from public.newsletter_editions where slug = 'teste-rascunho') = 0,
    'moderadora (não admin) não vê rascunhos');
  perform cdtest.logout();

  perform cdtest.login('f0000000-0000-4000-8000-000000000006');
  perform cdtest.check(public.is_admin(), 'is_admin() para admin');
  perform cdtest.check((select count(*) from public.newsletter_editions where slug = 'teste-rascunho') = 1,
    'admin vê rascunhos');
  update public.newsletter_editions set status = 'published' where slug = 'teste-rascunho';
  perform cdtest.check(
    (select published_at is not null from public.newsletter_editions where slug = 'teste-rascunho'),
    'published_at preenchido ao publicar');
  perform cdtest.throws('select count(*) from public.newsletter_subscribers', '42501', 'nem admin lê inscritas pela API');
  perform cdtest.logout();
end
$$;
select pass('newsletter: inscritas/envios invisíveis; edições publicadas públicas; rascunhos só para admin');

-- -----------------------------------------------------------------------------
-- 9. Leaderboard e estatísticas
-- -----------------------------------------------------------------------------
do $$
declare
  r record;
  v_expected int;
begin
  perform cdtest.login('f0000000-0000-4000-8000-000000000002');
  select * into r from public.get_community_leaderboard(100)
  where profile_id = 'f0000000-0000-4000-8000-000000000001';
  -- Ana: 3 papers visíveis? Não: 1 está oculto → 2 papers, 3 + 1 votos recebidos,
  -- 0 soluções, 0 mentorias, 0 tópicos/respostas públicos (o tópico dela é anônimo).
  perform cdtest.check(r.papers = 2, format('papers visíveis contados (veio %s)', r.papers));
  perform cdtest.check(r.votes_received = 4, format('votos recebidos (veio %s)', r.votes_received));
  perform cdtest.check(r.posts = 0, format('conteúdo anônimo não conta no leaderboard (veio %s)', r.posts));
  v_expected := 10 * 2 + 2 * 4;
  perform cdtest.check(r.points = v_expected, format('points = %s (veio %s)', v_expected, r.points));

  select * into r from public.get_community_leaderboard(100)
  where profile_id = 'f0000000-0000-4000-8000-000000000002';
  -- Bruna: 1 resposta pública (a anônima não conta) + 1 resposta no tópico destrancado,
  -- 1 solução (no tópico anônimo da Ana).
  perform cdtest.check(r.solutions = 1, format('solução contada (veio %s)', r.solutions));
  perform cdtest.check(r.posts = 2, format('respostas públicas contadas (veio %s)', r.posts));

  select * into r from public.get_community_leaderboard(100)
  where profile_id = 'f0000000-0000-4000-8000-000000000003';
  -- Mentora Um: 1 mentoria concluída conta; a que foi aceita e depois cancelada não conta.
  perform cdtest.check(r.mentorships = 1, format('mentorias aceitas/concluídas como mentora (veio %s)', r.mentorships));

  perform cdtest.check(
    (select members >= 6 and mentors >= 2 and papers >= 2 and threads >= 2 from public.get_platform_stats()),
    'get_platform_stats devolve contagens agregadas');
  perform cdtest.logout();
end
$$;
select pass('get_community_leaderboard e get_platform_stats');

-- Regressão (revisão de segurança): o leaderboard não pode servir de oráculo da
-- autoria anônima. Antes, a autora anônima que marcava a própria resposta ASSINADA
-- como solução não ganhava o ponto — e qualquer membro, comparando com as soluções
-- visíveis, descobria quem escreveu o tópico anônimo.
do $$
declare
  v_cat smallint := (select id from public.forum_categories where slug = 'teste-anonimo');
  v_thread uuid;
  v_post uuid;
  v_visible integer;
  v_ranked integer;
begin
  perform cdtest.login('f0000000-0000-4000-8000-000000000001');
  insert into public.forum_threads (category_id, author_id, is_anonymous, title, body)
  values (v_cat, 'f0000000-0000-4000-8000-000000000001', true, 'Outro tópico anônimo',
          'Pergunta anônima usada no teste de vazamento pelo leaderboard.')
  returning id into v_thread;
  insert into public.forum_posts (thread_id, author_id, body)
  values (v_thread, 'f0000000-0000-4000-8000-000000000001', 'Resposta assinada da própria autora anônima.')
  returning id into v_post;
  update public.forum_threads set solution_post_id = v_post where id = v_thread;
  perform cdtest.logout();

  perform cdtest.login('f0000000-0000-4000-8000-000000000002');
  -- O que qualquer membro calcula com dados públicos: soluções da Ana fora de tópicos
  -- com autoria pública dela mesma.
  select count(*)::integer into v_visible
  from public.forum_threads t
  join public.forum_posts p on p.id = t.solution_post_id
  where p.author_id = 'f0000000-0000-4000-8000-000000000001'
    and t.author_id is distinct from p.author_id;
  select l.solutions into v_ranked
  from public.get_community_leaderboard(100) l
  where l.profile_id = 'f0000000-0000-4000-8000-000000000001';
  perform cdtest.check(v_visible = 1, format('solução visível no tópico anônimo (veio %s)', v_visible));
  perform cdtest.check(v_ranked = v_visible,
    format('soluções do leaderboard não dependem da autoria anônima (visíveis %s, ranking %s)', v_visible, v_ranked));
  perform cdtest.logout();

  perform cdtest.login('f0000000-0000-4000-8000-000000000001');
  delete from public.forum_threads where id = v_thread;
  perform cdtest.logout();
end
$$;
select pass('leaderboard não revela a autora de tópico anônimo');

-- -----------------------------------------------------------------------------
-- 10. Storage: avatares só na própria pasta
-- -----------------------------------------------------------------------------
do $$
declare
  n bigint;
begin
  perform cdtest.check((select public from storage.buckets where id = 'avatars'), 'bucket avatars é público');

  perform cdtest.login('f0000000-0000-4000-8000-000000000001');
  insert into storage.objects (bucket_id, name, owner)
  values ('avatars', 'f0000000-0000-4000-8000-000000000001/avatar.png', 'f0000000-0000-4000-8000-000000000001');
  perform cdtest.throws($q$insert into storage.objects (bucket_id, name) values ('avatars', 'f0000000-0000-4000-8000-000000000002/avatar.png')$q$,
    '42501', 'não envia avatar para a pasta de outra');
  perform cdtest.throws($q$insert into storage.objects (bucket_id, name) values ('avatars', 'avatar-na-raiz.png')$q$,
    '42501', 'não envia avatar fora de uma pasta');
  perform cdtest.logout();

  perform cdtest.login('f0000000-0000-4000-8000-000000000002');
  -- No Supabase real, storage.protect_delete() bloqueia DELETE direto em storage.objects
  -- (exige a Storage API). Liberamos só nesta transação para testar a política de RLS.
  perform set_config('storage.allow_delete_query', 'true', true);
  n := cdtest.affected($q$delete from storage.objects where name = 'f0000000-0000-4000-8000-000000000001/avatar.png'$q$);
  perform cdtest.check(n = 0, 'não apaga avatar alheio');
  perform cdtest.logout();

  perform cdtest.login_anon();
  perform cdtest.throws($q$insert into storage.objects (bucket_id, name) values ('avatars', 'qualquer/avatar.png')$q$,
    '42501', 'anon não envia avatar');
  perform cdtest.logout();
end
$$;
select pass('storage: escrita de avatares restrita à própria pasta');

-- -----------------------------------------------------------------------------
-- 10b. Rodada de integração (migration 20261028090000_integration.sql)
-- -----------------------------------------------------------------------------

-- Revogar o consentimento de IA apaga só as sugestões da própria mentoranda.
do $$
begin
  insert into public.mentor_suggestions (mentee_id, mentor_id, rank, score, reason, source) values
    ('f0000000-0000-4000-8000-000000000002', 'f0000000-0000-4000-8000-000000000003', 1, 90, 'Mesma área', 'ai'),
    ('f0000000-0000-4000-8000-000000000002', 'f0000000-0000-4000-8000-000000000004', 2, 70, 'Temas em comum', 'heuristic'),
    ('f0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000004', 1, 60, 'Heurística', 'heuristic');
  perform cdtest.check((select ai_consent from public.profiles where id = 'f0000000-0000-4000-8000-000000000002'),
    'Bruna tem consentimento de IA');

  perform cdtest.login('f0000000-0000-4000-8000-000000000002');
  perform cdtest.check((select count(*) from public.mentor_suggestions) = 2, 'Bruna vê as próprias sugestões');
  update public.profiles set ai_consent = false where id = 'f0000000-0000-4000-8000-000000000002';
  perform cdtest.check((select count(*) from public.mentor_suggestions) = 0,
    'revogar o consentimento apaga as sugestões (IA e heurísticas)');
  perform cdtest.logout();

  perform cdtest.check(
    (select count(*) from public.mentor_suggestions where mentee_id = 'f0000000-0000-4000-8000-000000000001') = 1,
    'sugestões de outra mentoranda continuam');
end
$$;
select pass('LGPD: revogar o consentimento de IA apaga também as sugestões de mentoras');

-- Registro de auditoria da moderação
do $$
declare
  v_report uuid;
  v_other_report uuid;
  v_before bigint;
  v_last_id bigint;
begin
  -- Bruna denuncia o tópico anônimo da Ana e um tópico normal.
  perform cdtest.login('f0000000-0000-4000-8000-000000000002');
  insert into public.reports (target_type, target_id, reason, details)
  values ('thread', cdtest.get('anon_thread'), 'harassment', 'Ameaça a uma colega (teste).')
  returning id into v_report;
  insert into public.reports (target_type, target_id, reason)
  values ('thread', cdtest.get('normal_thread'), 'spam')
  returning id into v_other_report;
  perform cdtest.put('audit_report', v_report);
  perform cdtest.put('audit_other_report', v_other_report);

  -- Membros não leem nem escrevem no registro.
  perform cdtest.check((select count(*) from public.moderation_audit_log) = 0, 'membro não lê o registro de auditoria');
  perform cdtest.throws($q$insert into public.moderation_audit_log (action, target_type) values ('change_role', 'profile')$q$,
    '42501', 'membro não grava no registro de auditoria');
  perform cdtest.logout();

  perform cdtest.login_anon();
  perform cdtest.throws('select count(*) from public.moderation_audit_log', '42501', 'anon não lê o registro de auditoria');
  perform cdtest.logout();

  perform cdtest.login('f0000000-0000-4000-8000-000000000005');
  select count(*) into v_before from public.moderation_audit_log;

  -- Revelar autoria: motivo obrigatório (20–300) e denúncia precisa ser sobre o conteúdo.
  perform cdtest.throws(format('select public.reveal_anonymous_author(p_thread_id => %L, p_reason => %L)',
      cdtest.get('anon_thread'), 'curto demais'),
    'CD016', 'motivo com menos de 20 caracteres é recusado');
  perform cdtest.throws(format('select public.reveal_anonymous_author(p_thread_id => %L, p_reason => %L)',
      cdtest.get('anon_thread'), repeat('x', 301)),
    'CD016', 'motivo com mais de 300 caracteres é recusado');
  perform cdtest.throws(format('select public.reveal_anonymous_author(p_thread_id => %L, p_reason => %L, p_report_id => %L)',
      cdtest.get('anon_thread'), 'Motivo detalhado o bastante para o teste.', v_other_report),
    'CD017', 'denúncia sobre outro conteúdo é recusada');
  perform cdtest.check((select count(*) from public.moderation_audit_log) = v_before,
    'tentativas recusadas não gravam nada');

  perform cdtest.check(
    public.reveal_anonymous_author(p_thread_id => cdtest.get('anon_thread'),
      p_reason => '  Ameaça explícita contra outra membra.  ', p_report_id => v_report)
      = 'f0000000-0000-4000-8000-000000000001',
    'revelação com motivo devolve a autora');
  perform cdtest.check(
    (select count(*) from public.moderation_audit_log
     where action = 'reveal_author' and actor_id = 'f0000000-0000-4000-8000-000000000005'
       and target_type = 'thread' and target_id = cdtest.get('anon_thread') and report_id = v_report
       and reason = 'Ameaça explícita contra outra membra.') = 1,
    'revelação registrada com quem, alvo, denúncia e motivo');
  perform cdtest.check(
    (select count(*) from public.moderation_audit_log
     where reason like '%Ana%' or target_id = 'f0000000-0000-4000-8000-000000000001') = 0,
    'o registro não guarda quem foi revelada');

  -- Fixar/trancar: só registra o que mudou.
  perform public.moderate_thread(cdtest.get('normal_thread'), p_pinned => false, p_reason => 'Não é mais destaque.',
    p_report_id => v_other_report);
  perform public.moderate_thread(cdtest.get('normal_thread'), p_pinned => false);
  perform cdtest.check(
    (select count(*) from public.moderation_audit_log
     where action = 'unpin_thread' and target_id = cdtest.get('normal_thread')
       and reason = 'Não é mais destaque.' and report_id = v_other_report) = 1,
    'desafixar registrado uma vez (repetir não duplica)');
  select max(id) into v_last_id from public.moderation_audit_log;
  perform public.moderate_thread(cdtest.get('normal_thread'), p_pinned => true, p_locked => true);
  perform cdtest.check(
    (select array_agg(action order by action) from public.moderation_audit_log
     where id > v_last_id and target_id = cdtest.get('normal_thread')) = array['lock_thread', 'pin_thread'],
    'fixar e trancar juntos geram dois registros');
  perform public.moderate_thread(cdtest.get('normal_thread'), p_locked => false);

  -- Ocultar/reexibir paper
  select max(id) into v_last_id from public.moderation_audit_log;
  perform public.moderate_paper(cdtest.get('paper_hidden'), false, 'Revisado: pode voltar.');
  perform public.moderate_paper(cdtest.get('paper_hidden'), true);
  perform public.moderate_paper(cdtest.get('paper_hidden'), true);
  perform cdtest.check(
    (select array_agg(action || ':' || coalesce(reason, '-') order by id) from public.moderation_audit_log
     where id > v_last_id and target_id = cdtest.get('paper_hidden'))
      = array['unhide_paper:Revisado: pode voltar.', 'hide_paper:-'],
    'ocultar/reexibir registrados só quando mudam');

  -- Inclusão manual (ex.: exclusão de conteúdo pelo painel) só em nome próprio; registro imutável.
  insert into public.moderation_audit_log (action, target_type, target_id, report_id, reason)
  values ('delete_content', 'post', cdtest.get('bruna_post'), null, 'Spam repetido.');
  perform cdtest.check(
    (select actor_id from public.moderation_audit_log where action = 'delete_content')
      = 'f0000000-0000-4000-8000-000000000005',
    'actor_id padrão é a própria moderadora');
  perform cdtest.throws($q$insert into public.moderation_audit_log (actor_id, action) values ('f0000000-0000-4000-8000-000000000006', 'change_role')$q$,
    '42501', 'não registra ação em nome de outra pessoa');
  perform cdtest.throws($q$insert into public.moderation_audit_log (action) values ('apagar_tudo')$q$,
    '23514', 'ação fora da lista é recusada');
  perform cdtest.throws($q$update public.moderation_audit_log set reason = 'alterado'$q$, '42501', 'registro não é editável');
  perform cdtest.throws($q$delete from public.moderation_audit_log$q$, '42501', 'registro não é apagável');
  perform cdtest.throws($q$insert into public.moderation_audit_log (action, created_at) values ('change_role', '2000-01-01')$q$,
    '42501', 'created_at não é informado pela cliente');
  perform cdtest.logout();

  -- Admin também lê o registro.
  perform cdtest.login('f0000000-0000-4000-8000-000000000006');
  perform cdtest.check((select count(*) from public.moderation_audit_log) > v_before, 'admin lê o registro de auditoria');
  perform cdtest.logout();
end
$$;
select pass('moderation_audit_log: só moderação lê; revelar exige motivo; RPCs registram; imutável');

-- Denúncia resolvida/arquivada: aviso para quem denunciou + auditoria
do $$
declare
  n bigint;
begin
  perform cdtest.login('f0000000-0000-4000-8000-000000000005');
  update public.reports set status = 'resolved', resolution_note = 'Conteúdo removido e autora orientada.'
    where id = cdtest.get('audit_report');
  update public.reports set status = 'dismissed' where id = cdtest.get('audit_other_report');
  perform cdtest.check(
    (select count(*) from public.moderation_audit_log where report_id = cdtest.get('audit_report') and action = 'resolve_report'
       and actor_id = 'f0000000-0000-4000-8000-000000000005') = 1
    and (select count(*) from public.moderation_audit_log where report_id = cdtest.get('audit_other_report')
       and action = 'dismiss_report') = 1,
    'resolver/arquivar fica registrado');
  -- Reabrir não avisa; editar só a nota de uma denúncia resolvida também não.
  update public.reports set status = 'open' where id = cdtest.get('audit_other_report');
  update public.reports set resolution_note = 'Arquivada após revisão.' where id = cdtest.get('audit_report');
  perform cdtest.logout();

  perform cdtest.login('f0000000-0000-4000-8000-000000000002');
  perform cdtest.check(
    (select count(*) from public.notifications where type = 'report_resolved') = 2,
    'denunciante recebe um aviso por denúncia concluída');
  perform cdtest.check(
    (select count(*) from public.notifications
     where type = 'report_resolved' and title = 'Sua denúncia foi resolvida' and link = '/notificacoes'
       and body like '%um tópico do fórum%' and body like '%Nota da moderação: Conteúdo removido e autora orientada.%') = 1,
    'aviso de denúncia resolvida traz o alvo e a nota visível para a denunciante');
  perform cdtest.check(
    (select count(*) from public.notifications
     where type = 'report_resolved' and title = 'Sua denúncia foi analisada' and body not like '%Nota da moderação%') = 1,
    'aviso de denúncia arquivada (sem nota)');
  perform cdtest.check(
    (select count(*) from public.notifications where type = 'report_resolved' and body like '%Moderadora Teste%') = 0,
    'o aviso não diz quem moderou');
  perform cdtest.logout();

  -- A moderação resolvendo a própria denúncia não gera aviso para ela mesma.
  perform cdtest.login('f0000000-0000-4000-8000-000000000005');
  insert into public.reports (target_type, target_id, reason) values ('thread', cdtest.get('normal_thread'), 'other');
  update public.reports set status = 'resolved'
    where reporter_id = 'f0000000-0000-4000-8000-000000000005' and status = 'open';
  perform cdtest.check((select count(*) from public.notifications where type = 'report_resolved') = 0,
    'sem aviso para quem resolveu a própria denúncia');
  perform cdtest.logout();
end
$$;
select pass('reports: aviso para a denunciante ao resolver/arquivar, sem expor a moderação');

-- Newsletter: limites de e-mails de confirmação (service role)
do $$
declare
  v_a uuid;
  v_b uuid;
  v_daily bigint;
begin
  insert into public.newsletter_subscribers (email, consent_text)
  values ('limite.a@example.test', 'Aceito receber a newsletter semanal (teste).') returning id into v_a;
  insert into public.newsletter_subscribers (email, consent_text)
  values ('limite.b@example.test', 'Aceito receber a newsletter semanal (teste).') returning id into v_b;
  perform cdtest.check((select confirmation_sent_count = 0 and confirmation_sent_at is null
                        from public.newsletter_subscribers where id = v_a), 'colunas novas começam zeradas');

  perform cdtest.check(public.newsletter_reserve_confirmation(v_a, 3, 1000000) = 'ok', '1º envio');
  perform cdtest.check(public.newsletter_reserve_confirmation(v_a, 3, 1000000) = 'ok', '2º envio');
  perform cdtest.check(public.newsletter_reserve_confirmation(v_a, 3, 1000000) = 'ok', '3º envio');
  perform cdtest.check(public.newsletter_reserve_confirmation(v_a, 3, 1000000) = 'address_limit', '4º envio no mesmo dia é barrado');
  perform cdtest.check((select confirmation_sent_count from public.newsletter_subscribers where id = v_a) = 3,
    'contador por endereço = 3');

  -- Janela vencida (último envio há mais de 24 h): recomeça a contagem.
  update public.newsletter_subscribers set confirmation_sent_at = now() - interval '25 hours' where id = v_a;
  perform cdtest.check(public.newsletter_reserve_confirmation(v_a, 3, 1000000) = 'ok', 'novo dia libera o endereço');
  perform cdtest.check((select confirmation_sent_count from public.newsletter_subscribers where id = v_a) = 1,
    'contagem recomeça');

  -- Teto diário global (soma das janelas ativas; o banco local pode ter outras inscritas).
  select coalesce(sum(confirmation_sent_count), 0) into v_daily
  from public.newsletter_subscribers where confirmation_sent_at >= now() - interval '24 hours';
  perform cdtest.check(public.newsletter_reserve_confirmation(v_b, 3, (v_daily + 1)::integer) = 'ok',
    'cabe no teto diário');
  perform cdtest.check(public.newsletter_reserve_confirmation(v_b, 3, (v_daily + 1)::integer) = 'daily_limit',
    'teto diário atingido');
  perform cdtest.check((select confirmation_sent_count from public.newsletter_subscribers where id = v_b) = 1,
    'envio barrado não conta');
  perform cdtest.check(public.newsletter_reserve_confirmation(gen_random_uuid(), 3, 80) = 'not_found',
    'inscrita inexistente');

  perform cdtest.login('f0000000-0000-4000-8000-000000000006');
  perform cdtest.throws(format('select public.newsletter_reserve_confirmation(%L)', v_a), '42501',
    'nem admin reserva envios pela API');
  perform cdtest.logout();
  perform cdtest.login_anon();
  perform cdtest.throws(format('select public.newsletter_reserve_confirmation(%L)', v_a), '42501',
    'anon não reserva envios');
  perform cdtest.logout();
end
$$;
select pass('newsletter: até 3 confirmações por endereço a cada 24 h e teto diário global');

-- Newsletter: o arquivo público não leva nomes de mentoras (só o agregado mentor_summary).
do $$
begin
  perform cdtest.login_anon();
  perform cdtest.check(
    (select count(*) from public.newsletter_editions
     where jsonb_typeof(content -> 'mentors') = 'array' and jsonb_array_length(content -> 'mentors') > 0) = 0,
    'nenhuma edição pública traz a lista de mentoras com nomes');
  perform cdtest.check(
    (select count(*) from public.newsletter_editions where content::text like '%full_name%') = 0,
    'nenhuma edição pública traz full_name');
  perform cdtest.logout();
end
$$;
select pass('newsletter: edições públicas sem nomes de mentoras');

-- get_mentor_open_slots: vagas das mentoras indicadas
do $$
begin
  perform cdtest.login('f0000000-0000-4000-8000-000000000001');
  perform cdtest.check(
    (select count(*) from public.get_mentor_open_slots(array[
      'f0000000-0000-4000-8000-000000000003', 'f0000000-0000-4000-8000-000000000004',
      'f0000000-0000-4000-8000-000000000001']::uuid[])) = 2,
    'só mentoras entram no resultado');
  perform cdtest.check(
    (select open_slots from public.get_mentor_open_slots(array['f0000000-0000-4000-8000-000000000004']::uuid[]))
      = (select p.mentor_capacity - (select count(*) from public.mentorship_requests r
            where r.mentor_id = p.id and r.status = 'accepted')
         from public.profiles p where p.id = 'f0000000-0000-4000-8000-000000000004'),
    'vagas = capacidade − mentorias aceitas');
  perform cdtest.check(
    (select open_slots from public.get_mentor_open_slots(array['f0000000-0000-4000-8000-000000000003']::uuid[])) >= 0,
    'mentora sem vagas aparece com 0 (nunca negativo)');
  perform cdtest.check((select count(*) from public.get_mentor_open_slots(null)) = 0, 'lista nula → nada');
  perform cdtest.logout();

  perform cdtest.login_anon();
  perform cdtest.throws($q$select * from public.get_mentor_open_slots(array['f0000000-0000-4000-8000-000000000003']::uuid[])$q$,
    '42501', 'anon não consulta vagas');
  perform cdtest.logout();
end
$$;
select pass('get_mentor_open_slots: vagas das mentoras para membros');

-- -----------------------------------------------------------------------------
-- Auditoria de segurança (migration 20261028150000_security_audit.sql)
-- -----------------------------------------------------------------------------

-- Denúncias: sem repetição, sem alvo inexistente, sem rajadas (mesmo pela API).
do $$
declare
  v_posts uuid[];
  v_prior bigint;
  i int;
begin
  -- Alvos distintos para a rajada (criados como postgres, contexto confiável).
  with ins as (
    insert into public.forum_posts (thread_id, author_id, body)
    select cdtest.get('normal_thread'), 'f0000000-0000-4000-8000-000000000004', 'Resposta de teste nº ' || g
    from generate_series(1, 25) as g
    returning id
  )
  select array_agg(id) into v_posts from ins;

  perform cdtest.login('f0000000-0000-4000-8000-000000000002');
  insert into public.reports (target_type, target_id, reason)
  values ('profile', 'f0000000-0000-4000-8000-000000000003', 'other');
  perform cdtest.throws($q$insert into public.reports (target_type, target_id, reason)
      values ('profile', 'f0000000-0000-4000-8000-000000000003', 'spam')$q$,
    'CD018', 'denúncia repetida (mesmo alvo, ainda aberta) é recusada');
  perform cdtest.throws(format($q$insert into public.reports (target_type, target_id, reason)
      values ('profile', %L, 'spam')$q$, gen_random_uuid()),
    'CD015', 'denúncia de perfil inexistente é recusada');
  perform cdtest.throws(format($q$insert into public.reports (target_type, target_id, reason)
      values ('thread', %L, 'spam')$q$, gen_random_uuid()),
    'CD015', 'denúncia de tópico inexistente é recusada');

  select count(*) into v_prior from public.reports
  where reporter_id = 'f0000000-0000-4000-8000-000000000002' and created_at > now() - interval '1 hour';
  for i in 1 .. (20 - v_prior) loop
    insert into public.reports (target_type, target_id, reason) values ('post', v_posts[i], 'spam');
  end loop;
  perform cdtest.throws(format($q$insert into public.reports (target_type, target_id, reason)
      values ('post', %L, 'spam')$q$, v_posts[25]),
    'CD019', 'a 21ª denúncia na mesma hora é recusada');
  perform cdtest.logout();

  -- Contexto confiável (seed/service role) não sofre os limites.
  insert into public.reports (reporter_id, target_type, target_id, reason)
  values ('f0000000-0000-4000-8000-000000000002', 'post', v_posts[25], 'spam');
end
$$;
select pass('reports: banco recusa denúncia repetida, alvo inexistente e mais de 20 por hora');

-- Pedidos de mentoria: no máximo 3 por mentora a cada 7 dias e 10 a cada 24 h.
do $$
declare
  v_mentor uuid;
  v_id uuid;
  v_count bigint;
  v_msg text;
begin
  update public.profiles
  set is_mentor = true, mentor_available = true, mentor_capacity = 5, onboarded_at = coalesce(onboarded_at, now())
  where id in ('f0000000-0000-4000-8000-000000000003', 'f0000000-0000-4000-8000-000000000004',
               'f0000000-0000-4000-8000-000000000005', 'f0000000-0000-4000-8000-000000000006');
  update public.mentorship_requests set status = 'cancelled'
  where mentee_id = 'f0000000-0000-4000-8000-000000000002' and status in ('pending', 'accepted');

  perform cdtest.login('f0000000-0000-4000-8000-000000000002');
  -- Pedir e cancelar em laço para a mesma mentora: o 4º pedido em 7 dias é recusado.
  for i in 1 .. 3 loop
    insert into public.mentorship_requests (mentor_id, message)
    values ('f0000000-0000-4000-8000-000000000004', 'Pedido de teste para o limite por mentora.')
    returning id into v_id;
    update public.mentorship_requests set status = 'cancelled' where id = v_id;
  end loop;
  begin
    insert into public.mentorship_requests (mentor_id, message)
    values ('f0000000-0000-4000-8000-000000000004', 'Quarto pedido para a mesma mentora na semana.');
    raise exception 'FALHOU: o 4º pedido para a mesma mentora em 7 dias foi aceito';
  exception when sqlstate 'CD020' then
    v_msg := sqlerrm;
  end;
  perform cdtest.check(v_msg like '%7 dias%', 'limite por mentora explica a espera de 7 dias');

  -- Limite diário: completa 10 pedidos em 24 h com outras mentoras; o 11º é recusado.
  select count(*) into v_count from public.mentorship_requests
  where mentee_id = 'f0000000-0000-4000-8000-000000000002' and created_at > now() - interval '24 hours';
  foreach v_mentor in array array['f0000000-0000-4000-8000-000000000003', 'f0000000-0000-4000-8000-000000000005',
                                  'f0000000-0000-4000-8000-000000000006']::uuid[] loop
    for i in 1 .. 3 loop
      -- A última mentora guarda uma vaga (< 3) para o 11º pedido bater no limite diário.
      exit when v_count >= 10
        or (select count(*) from public.mentorship_requests
            where mentee_id = 'f0000000-0000-4000-8000-000000000002' and mentor_id = v_mentor)
           >= case when v_mentor = 'f0000000-0000-4000-8000-000000000006' then 2 else 3 end;
      insert into public.mentorship_requests (mentor_id, message)
      values (v_mentor, 'Pedido de teste para o limite diário de pedidos.')
      returning id into v_id;
      update public.mentorship_requests set status = 'cancelled' where id = v_id;
      v_count := v_count + 1;
    end loop;
  end loop;
  perform cdtest.check(v_count = 10, format('preparou 10 pedidos em 24 h (veio %s)', v_count));
  v_msg := null;
  begin
    insert into public.mentorship_requests (mentor_id, message)
    values ('f0000000-0000-4000-8000-000000000006', 'Décimo primeiro pedido do dia, deve ser recusado.');
    raise exception 'FALHOU: o 11º pedido em 24 h foi aceito';
  exception when sqlstate 'CD020' then
    v_msg := sqlerrm;
  end;
  perform cdtest.check(v_msg like '%24 horas%', 'limite diário explica a espera de 24 horas');
  perform cdtest.logout();
end
$$;
select pass('mentorship_requests: pedir e cancelar em laço tem limite (3 por mentora/7 dias, 10/24 h)');

-- Cota do matching com IA: guardada no banco, fora do alcance da usuária.
do $$
begin
  perform cdtest.login_anon();
  perform cdtest.throws('select public.claim_ai_matching_slot()', '42501', 'anon não reserva cota de IA');
  perform cdtest.logout();

  perform cdtest.login('f0000000-0000-4000-8000-000000000004');
  perform cdtest.check(public.claim_ai_matching_slot(), 'primeira geração com IA é liberada');
  perform cdtest.check(not public.claim_ai_matching_slot(), 'segunda geração em menos de 60 s é negada');
  perform cdtest.throws('select count(*) from private.ai_matching_usage', '42501', 'usuária não lê a tabela de cota');
  perform cdtest.throws('delete from private.ai_matching_usage', '42501', 'usuária não zera a própria cota');
  -- Apagar as próprias sugestões (o que zerava a espera antiga) não muda nada.
  delete from public.mentor_suggestions where mentee_id = 'f0000000-0000-4000-8000-000000000004';
  perform cdtest.check(not public.claim_ai_matching_slot(), 'apagar as sugestões não libera outra geração');
  perform cdtest.logout();

  update private.ai_matching_usage set last_claimed_at = now() - interval '61 seconds'
  where profile_id = 'f0000000-0000-4000-8000-000000000004';
  perform cdtest.login('f0000000-0000-4000-8000-000000000004');
  perform cdtest.check(public.claim_ai_matching_slot(), 'depois de 60 s a geração volta a ser liberada');
  perform cdtest.logout();

  update private.ai_matching_usage set last_claimed_at = now() - interval '61 seconds', window_count = 20
  where profile_id = 'f0000000-0000-4000-8000-000000000004';
  perform cdtest.login('f0000000-0000-4000-8000-000000000004');
  perform cdtest.check(not public.claim_ai_matching_slot(), '20 gerações em 24 h esgotam a cota diária');
  perform cdtest.logout();

  update private.ai_matching_usage
  set last_claimed_at = now() - interval '61 seconds', window_started_at = now() - interval '25 hours'
  where profile_id = 'f0000000-0000-4000-8000-000000000004';
  perform cdtest.login('f0000000-0000-4000-8000-000000000004');
  perform cdtest.check(public.claim_ai_matching_slot(), 'a cota diária renova depois de 24 h');
  perform cdtest.logout();
  perform cdtest.check(
    (select window_count from private.ai_matching_usage where profile_id = 'f0000000-0000-4000-8000-000000000004') = 1,
    'nova janela começa a contar do zero');
end
$$;
select pass('claim_ai_matching_slot: 60 s entre gerações e 20 por dia, sem como zerar pela API');

-- -----------------------------------------------------------------------------
-- 11. LGPD: excluir a conta apaga também o conteúdo anônimo
-- -----------------------------------------------------------------------------
do $$
begin
  perform cdtest.check((select count(*) from public.forum_posts where id = cdtest.get('bruna_anon_post')) = 1,
    'resposta anônima da Bruna existe');
  delete from auth.users where id = 'f0000000-0000-4000-8000-000000000002';
  perform cdtest.check((select count(*) from public.forum_posts where id = cdtest.get('bruna_anon_post')) = 0,
    'resposta anônima apagada junto com a conta');
  perform cdtest.check((select count(*) from public.forum_posts where id = cdtest.get('bruna_post')) = 0,
    'resposta pública apagada junto com a conta (cascade)');
  perform cdtest.check((select reply_count from public.forum_threads where id = cdtest.get('anon_thread')) = 0,
    'reply_count recalculado');
  perform cdtest.check((select solution_post_id from public.forum_threads where id = cdtest.get('anon_thread')) is null,
    'solution_post_id volta a NULL');

  delete from auth.users where id = 'f0000000-0000-4000-8000-000000000001';
  perform cdtest.check((select count(*) from public.forum_threads where id = cdtest.get('anon_thread')) = 0,
    'tópico anônimo apagado junto com a conta da autora');
  perform cdtest.check(
    (select count(*) from public.forum_anonymous_authorship
     where thread_id = cdtest.get('anon_thread') or post_id = cdtest.get('bruna_anon_post')) = 0,
    'linhas de autoria removidas');
end
$$;
select pass('LGPD: conta excluída leva junto o conteúdo anônimo');

-- -----------------------------------------------------------------------------
-- 12. Higiene de privilégios: toda tabela de public com RLS e sem grants a PUBLIC
-- -----------------------------------------------------------------------------
do $$
declare
  v_missing text;
begin
  select string_agg(c.relname, ', ') into v_missing
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;
  perform cdtest.check(v_missing is null, format('tabelas sem RLS: %s', v_missing));

  select string_agg(p.proname, ', ') into v_missing
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('public', 'private')
    and has_function_privilege('public', p.oid, 'execute') is not distinct from true
    and exists (select 1 from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a where a.grantee = 0);
  perform cdtest.check(v_missing is null, format('funções executáveis por PUBLIC: %s', v_missing));

  select string_agg(p.proname, ', ') into v_missing
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('public', 'private')
    and p.prokind = 'f'
    and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) cfg where cfg like 'search_path=%');
  perform cdtest.check(v_missing is null, format('funções sem search_path fixo: %s', v_missing));

  -- Views precisam respeitar o RLS de quem consulta.
  select string_agg(c.relname, ', ') into v_missing
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('v', 'm')
    and not exists (
      select 1 from unnest(coalesce(c.reloptions, '{}')) o
      where o in ('security_invoker=true', 'security_invoker=on', 'security_invoker=1')
    );
  perform cdtest.check(v_missing is null, format('views sem security_invoker: %s', v_missing));

  -- SECURITY DEFINER exposto a anon só onde o contrato manda.
  select string_agg(p.proname, ', ') into v_missing
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prosecdef
    and has_function_privilege('anon', p.oid, 'execute')
    and p.proname not in ('is_moderator', 'is_admin', 'get_platform_stats');
  perform cdtest.check(v_missing is null, format('funções SECURITY DEFINER inesperadas para anon: %s', v_missing));

  -- anon nunca escreve; authenticated só escreve por GRANT de coluna (exceto
  -- newsletter_editions, cuja política libera tudo apenas para admins).
  select string_agg(distinct g.grantee || ':' || g.table_name || ':' || g.privilege_type, ', ') into v_missing
  from information_schema.role_table_grants g
  where g.table_schema = 'public'
    and g.privilege_type in ('INSERT', 'UPDATE', 'TRUNCATE', 'REFERENCES', 'TRIGGER')
    and (g.grantee = 'anon' or (g.grantee = 'authenticated' and g.table_name <> 'newsletter_editions'));
  perform cdtest.check(v_missing is null, format('GRANTs de escrita em tabela inteira: %s', v_missing));
  select string_agg(distinct g.table_name, ', ') into v_missing
  from information_schema.role_table_grants g
  where g.table_schema = 'public' and g.grantee = 'anon' and g.privilege_type = 'DELETE';
  perform cdtest.check(v_missing is null, format('anon com DELETE: %s', v_missing));
end
$$;
select pass('higiene: RLS em todas as tabelas, nenhuma função para PUBLIC, search_path fixo');

select * from finish();
rollback;
