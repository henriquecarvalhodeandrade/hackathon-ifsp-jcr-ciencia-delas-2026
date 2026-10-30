-- =============================================================================
-- Artemis — busca sem acento, limites anti-spam, auditoria de exclusões e avatar
-- Migrations 20261028170000_accent_insensitive_search.sql,
--            20261028170100_anti_spam_limits.sql,
--            20261028170200_moderation_audit_avatar_hardening.sql e
--            20261028170400_panel_delete_audit_anonymity.sql.
-- Mesmo formato de rls.test.sql: blocos DO que simulam usuárias (papel + request.jwt.claims,
-- como o PostgREST), EXCEÇÃO na primeira expectativa quebrada, pass() por grupo e ROLLBACK no
-- fim. Os dados são próprios (usuárias e7…), sem depender do seed.
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
create schema cdtest;
grant usage on schema cdtest to anon, authenticated, service_role;

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

create function cdtest.login_service() returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"role": "service_role"}', true);
  perform set_config('role', 'service_role', true);
end
$$;

create function cdtest.logout() returns void
language plpgsql as $$
begin
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', '', true);
end
$$;

-- Executa p_sql e exige que falhe com o SQLSTATE informado (NULL = qualquer erro) e, se
-- p_message_like vier, com uma mensagem que case com ele.
create function cdtest.throws(p_sql text, p_errcode text, p_desc text, p_message_like text default null)
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

create function cdtest.put(p_key text, p_value uuid) returns void
language sql as $$ select set_config('cdtest.' || p_key, p_value::text, true); $$;

create function cdtest.get(p_key text) returns uuid
language sql stable as $$ select nullif(current_setting('cdtest.' || p_key, true), '')::uuid; $$;

-- Quantas linhas de auditoria existem depois de p_after_id (para contar só as novas).
create function cdtest.audit_since(p_after_id bigint) returns bigint
language sql stable as $$
  select count(*) from public.moderation_audit_log where id > coalesce(p_after_id, 0);
$$;

create function cdtest.audit_max() returns bigint
language sql stable as $$ select coalesce(max(id), 0) from public.moderation_audit_log; $$;

grant execute on all functions in schema cdtest to anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Dados de teste (como postgres)
--   e7…01 Íris (membra) · e7…02 Joana (membra) · e7…03 Moderadora · e7…04 Admin
--   e7…05 e e7…06 mentoras
-- -----------------------------------------------------------------------------
insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', 'e7000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
   'iris.busca@example.test', '{"full_name": "Íris Conceição"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'e7000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated',
   'joana.busca@example.test', '{"full_name": "Joana Prado"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'e7000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated',
   'mod.busca@example.test', '{"full_name": "Moderadora Busca"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'e7000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated',
   'admin.busca@example.test', '{"full_name": "Admin Busca"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'e7000000-0000-4000-8000-000000000005', 'authenticated', 'authenticated',
   'mentora5.busca@example.test', '{"full_name": "Mentora Cinco"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'e7000000-0000-4000-8000-000000000006', 'authenticated', 'authenticated',
   'mentora6.busca@example.test', '{"full_name": "Mentora Seis"}', now(), now());

update public.profiles set onboarded_at = now(), career_stage = 'undergraduate'
  where id in ('e7000000-0000-4000-8000-000000000001', 'e7000000-0000-4000-8000-000000000002');
update public.profiles set onboarded_at = now(), role = 'moderator' where id = 'e7000000-0000-4000-8000-000000000003';
update public.profiles set onboarded_at = now(), role = 'admin' where id = 'e7000000-0000-4000-8000-000000000004';
update public.profiles set onboarded_at = now(), career_stage = 'professor', is_mentor = true,
  mentor_available = true, mentor_capacity = 10
  where id in ('e7000000-0000-4000-8000-000000000005', 'e7000000-0000-4000-8000-000000000006');

insert into public.forum_categories (slug, name, allow_anonymous, sort_order) values
  ('teste-busca-anonima', 'Categoria anônima (busca)', true, 95),
  ('teste-busca-normal', 'Categoria normal (busca)', false, 96);

-- =============================================================================
-- A. Busca sem acento e sem diferença de maiúsculas
-- =============================================================================
do $$
begin
  perform cdtest.check(
    (select provolatile from pg_proc where oid = 'private.unaccent_immutable(text)'::regprocedure) = 'i'
    and (select provolatile from pg_proc where oid = 'private.search_text(text[])'::regprocedure) = 'i',
    'unaccent_immutable e search_text são IMMUTABLE');
  perform set_config('search_path', '', true);
  perform cdtest.check(private.unaccent_immutable('Jacareí, REVISÃO, Conceição') = 'Jacarei, REVISAO, Conceicao',
    'unaccent_immutable funciona com search_path vazio');
  perform cdtest.check(private.search_text(array['  Câmpus  JACAREÍ ', null, E'Visão\ncomputacional']) = 'campus jacarei visao computacional',
    'search_text: sem acento, minúsculas, sem NULLs e espaços colapsados');
  perform set_config('search_path', '"$user", public, extensions', true);
end
$$;
select pass('unaccent_immutable/search_text: IMMUTABLE e independentes do search_path');

do $$
declare
  v_text text;
  n bigint;
begin
  perform cdtest.login('e7000000-0000-4000-8000-000000000001');
  update public.profiles
  set institution = 'IFSP — Câmpus Jacareí', city = 'São José dos Campos',
      headline = 'Pesquisadora em Visão Computacional', keywords = array['Revisão Sistemática']
  where id = 'e7000000-0000-4000-8000-000000000001';
  select search_text into v_text from public.profiles where id = 'e7000000-0000-4000-8000-000000000001';
  perform cdtest.check(
    v_text = 'iris conceicao ifsp - campus jacarei pesquisadora em visao computacional sao jose dos campos revisao sistematica',
    format('profiles.search_text = nome + instituição + título + cidade + palavras-chave normalizados (veio %s)', v_text));
  -- Coluna gerada: o Postgres recusa a escrita antes até da checagem de GRANT (428C9).
  perform cdtest.throws($q$update public.profiles set search_text = 'x' where id = 'e7000000-0000-4000-8000-000000000001'$q$,
    '428C9', 'search_text não é editável pela usuária');
  perform cdtest.logout();

  perform cdtest.login('e7000000-0000-4000-8000-000000000002');
  perform cdtest.check(
    (select count(*) from public.profiles where id = 'e7000000-0000-4000-8000-000000000001' and search_text ilike '%jacarei%') = 1,
    '"Jacarei" (sem acento) encontra "Jacareí"');
  perform cdtest.check(
    (select count(*) from public.profiles where id = 'e7000000-0000-4000-8000-000000000001' and institution ilike '%jacarei%') = 0,
    'a coluna original continua sensível a acento (por isso a coluna gerada)');
  perform cdtest.check(
    (select count(*) from public.profiles where id = 'e7000000-0000-4000-8000-000000000001'
       and search_text ilike '%conceicao%' and search_text ilike '%revisao%' and search_text ilike '%sao jose%') = 1,
    'nome, palavras-chave e cidade sem acento');
  perform cdtest.logout();

  -- A coluna acompanha as edições.
  perform cdtest.login('e7000000-0000-4000-8000-000000000001');
  n := cdtest.affected($q$update public.profiles set headline = 'Ecóloga de Polinização' where id = 'e7000000-0000-4000-8000-000000000001'$q$);
  perform cdtest.check(n = 1
    and (select search_text like '%ecologa de polinizacao%' and search_text not like '%visao computacional%'
         from public.profiles where id = 'e7000000-0000-4000-8000-000000000001'),
    'search_text é recalculada ao editar o perfil');
  perform cdtest.logout();

  perform cdtest.login_anon();
  perform cdtest.throws('select search_text from public.profiles', '42501', 'anon continua sem ler profiles (nem search_text)');
  perform cdtest.logout();
end
$$;
select pass('profiles.search_text: nome/instituição/título/cidade/palavras-chave sem acento; só membros leem');

do $$
declare
  v_anon uuid;
  v_signed uuid;
  v_text text;
begin
  perform cdtest.login('e7000000-0000-4000-8000-000000000001');
  insert into public.forum_threads (category_id, author_id, is_anonymous, title, body, tags)
  values ((select id from public.forum_categories where slug = 'teste-busca-anonima'),
          'e7000000-0000-4000-8000-000000000001', true, 'Dúvida sobre REVISÃO',
          'Como faço uma revisão sistemática aqui em Jacareí?', array['Metodologia'])
  returning id into v_anon;
  insert into public.forum_threads (category_id, author_id, title, body)
  values ((select id from public.forum_categories where slug = 'teste-busca-normal'),
          'e7000000-0000-4000-8000-000000000001', 'Grupo de estudos em Óptica', 'Alguém de São Carlos quer participar?')
  returning id into v_signed;
  perform cdtest.put('anon_search_thread', v_anon);
  perform cdtest.logout();

  perform cdtest.login('e7000000-0000-4000-8000-000000000002');
  select search_text into v_text from public.forum_threads where id = v_anon;
  perform cdtest.check(v_text = 'duvida sobre revisao como faco uma revisao sistematica aqui em jacarei? metodologia',
    format('forum_threads.search_text = título + corpo + tags normalizados (veio %s)', v_text));
  perform cdtest.check(
    (select count(*) from public.forum_threads where search_text ilike '%revisao%' and search_text ilike '%jacarei%') = 1,
    '"revisao jacarei" encontra o tópico com "revisão" e "Jacareí"');
  perform cdtest.check(position('iris' in v_text) = 0 and position('conceicao' in v_text) = 0,
    'search_text do tópico anônimo não traz o nome da autora');
  perform cdtest.check(
    (select count(*) from public.forum_threads where id = v_anon and (search_text ilike '%iris%' or search_text ilike '%conceicao%')) = 0
    and (select count(*) from public.forum_threads where id = v_signed and search_text ilike '%iris%') = 0,
    'buscar pelo nome da autora não encontra os tópicos dela (nem o anônimo)');
  perform cdtest.check(
    (select count(*) from public.forum_threads where search_text ilike '%optica%' and search_text ilike '%sao carlos%') = 1,
    'tópico assinado também é encontrado sem acento');
  perform cdtest.logout();

  -- Estrutural: a expressão da coluna não usa autoria nenhuma.
  perform cdtest.check(
    (select pg_get_expr(d.adbin, d.adrelid)
     from pg_attrdef d join pg_attribute a on a.attrelid = d.adrelid and a.attnum = d.adnum
     where d.adrelid = 'public.forum_threads'::regclass and a.attname = 'search_text') !~* 'author',
    'a expressão de forum_threads.search_text não referencia author_id');

  perform cdtest.login_anon();
  perform cdtest.throws('select search_text from public.forum_threads', '42501', 'anon continua sem ler o fórum');
  perform cdtest.logout();
end
$$;
select pass('forum_threads.search_text: título/corpo/tags sem acento e sem a autoria (anônima ou não)');

do $$
declare
  v_visible uuid;
  v_hidden uuid;
begin
  perform cdtest.login('e7000000-0000-4000-8000-000000000001');
  insert into public.papers (title, abstract, authors, keywords, venue, submitter_relation, women_authorship_confirmed)
  values ('Abelhas nativas e polinização em Jacareí',
          'Uma revisão sobre polinizadoras nativas no Vale do Paraíba e o efeito da urbanização.',
          array['Íris Conceição', 'Zoé Müller'], array['Ecologia'], 'Revista Brasileira de Ecologia',
          'author', true)
  returning id into v_visible;
  insert into public.papers (title, abstract, authors, submitter_relation, women_authorship_confirmed)
  values ('Paper oculto sobre Óptica Quântica',
          'Resumo do paper que a moderação vai ocultar durante este teste de busca.',
          array['Íris Conceição'], 'author', true)
  returning id into v_hidden;
  perform cdtest.logout();

  perform cdtest.login('e7000000-0000-4000-8000-000000000003');
  perform public.moderate_paper(v_hidden, true);
  perform cdtest.logout();

  perform cdtest.login_anon();
  perform cdtest.check(
    (select search_text from public.papers where id = v_visible)
      = 'abelhas nativas e polinizacao em jacarei uma revisao sobre polinizadoras nativas no vale do paraiba e o efeito da urbanizacao. iris conceicao zoe muller ecologia revista brasileira de ecologia',
    'papers.search_text = título + resumo + autoras + palavras-chave + veículo normalizados');
  perform cdtest.check(
    (select count(*) from public.papers where search_text ilike '%muller%' and search_text ilike '%polinizacao%') = 1,
    'visitante encontra o paper pela autora e pelo tema sem acento');
  perform cdtest.check((select count(*) from public.papers where search_text ilike '%optica quantica%') = 0,
    'paper oculto continua invisível para visitantes (o RLS vale para a busca)');
  perform cdtest.logout();
end
$$;
select pass('papers.search_text: título/resumo/autoras/palavras-chave/veículo; visitantes leem só os visíveis');

do $$
begin
  -- A coluna nova segue o acesso que a tabela já tinha (nada a mais, nada a menos).
  perform cdtest.check(has_column_privilege('anon', 'public.papers', 'search_text', 'SELECT'), 'anon lê papers.search_text');
  perform cdtest.check(not has_column_privilege('anon', 'public.profiles', 'search_text', 'SELECT'), 'anon não lê profiles.search_text');
  perform cdtest.check(not has_column_privilege('anon', 'public.forum_threads', 'search_text', 'SELECT'), 'anon não lê forum_threads.search_text');
  perform cdtest.check(
    has_column_privilege('authenticated', 'public.papers', 'search_text', 'SELECT')
    and has_column_privilege('authenticated', 'public.profiles', 'search_text', 'SELECT')
    and has_column_privilege('authenticated', 'public.forum_threads', 'search_text', 'SELECT'),
    'membros leem search_text nas três tabelas');
  perform cdtest.check(
    not has_column_privilege('authenticated', 'public.papers', 'search_text', 'INSERT')
    and not has_column_privilege('authenticated', 'public.papers', 'search_text', 'UPDATE')
    and not has_column_privilege('authenticated', 'public.profiles', 'search_text', 'UPDATE')
    and not has_column_privilege('authenticated', 'public.forum_threads', 'search_text', 'INSERT')
    and not has_column_privilege('authenticated', 'public.forum_threads', 'search_text', 'UPDATE'),
    'ninguém escreve em search_text');
  perform cdtest.check(
    (select count(*) from pg_indexes
     where schemaname = 'public' and indexname in ('profiles_search_text_trgm_idx', 'forum_threads_search_text_trgm_idx',
                                                   'papers_search_text_trgm_idx')
       and indexdef like '%USING gin (search_text %gin_trgm_ops)%') = 3,
    'índices GIN de trigramas em search_text');
  perform cdtest.check(
    not has_function_privilege('anon', 'private.search_text(text[])', 'EXECUTE')
    and has_function_privilege('authenticated', 'private.search_text(text[])', 'EXECUTE'),
    'search_text executável por quem grava (authenticated), não por anon');
end
$$;
select pass('search_text: GRANTs iguais aos da tabela, só leitura, índices de trigramas');

-- =============================================================================
-- B. Limites anti-spam
-- =============================================================================
do $$
declare
  v_cat smallint := (select id from public.forum_categories where slug = 'teste-busca-normal');
  v_cat_anon smallint := (select id from public.forum_categories where slug = 'teste-busca-anonima');
  v_first uuid;
  i int;
begin
  delete from private.rate_limit_events;

  perform cdtest.login('e7000000-0000-4000-8000-000000000002');
  -- 4 assinados + 1 anônimo = 5 tópicos na hora (o anônimo conta igual).
  for i in 1 .. 4 loop
    insert into public.forum_threads (category_id, title, body)
    values (v_cat, 'Tópico de limite nº ' || i, 'Corpo do tópico de teste do limite por hora.')
    returning id into v_first;
  end loop;
  insert into public.forum_threads (category_id, author_id, is_anonymous, title, body)
  values (v_cat_anon, 'e7000000-0000-4000-8000-000000000002', true, 'Tópico anônimo de limite',
          'O anônimo também conta no limite por hora.');
  perform cdtest.throws(format($q$insert into public.forum_threads (category_id, title, body)
      values (%s, 'Sexto tópico na hora', 'Este precisa ser recusado pelo limite.')$q$, v_cat),
    'CD021', 'o 6º tópico na mesma hora é recusado', 'Você publicou muitos tópicos na última hora.%');

  -- Apagar um tópico não devolve a cota (publicar-e-apagar em laço não escapa do limite).
  perform cdtest.check(cdtest.affected(format('delete from public.forum_threads where id = %L', v_first)) = 1,
    'a autora apaga o próprio tópico');
  perform cdtest.throws(format($q$insert into public.forum_threads (category_id, title, body)
      values (%s, 'Tentativa depois de apagar', 'Apagar não pode liberar novos tópicos.')$q$, v_cat),
    'CD021', 'apagar um tópico não libera outro na mesma hora');
  perform cdtest.throws('select count(*) from private.rate_limit_events', '42501', 'a usuária não lê o registro de envios');
  perform cdtest.throws('delete from private.rate_limit_events', '42501', 'a usuária não apaga o registro de envios');
  perform cdtest.logout();

  perform cdtest.check(
    (select count(*) from private.rate_limit_events
     where user_id = 'e7000000-0000-4000-8000-000000000002' and action = 'forum_thread') = 5,
    'tentativas recusadas não entram no registro (5 eventos)');
  perform cdtest.check(
    (select array_agg(column_name::text order by column_name) from information_schema.columns
     where table_schema = 'private' and table_name = 'rate_limit_events') = array['action', 'created_at', 'id', 'user_id'],
    'o registro guarda só pessoa, ação e hora (nada sobre o conteúdo nem a autoria anônima)');

  -- Janela vencida: os eventos de mais de 1 hora deixam de contar (e são limpos no próximo envio).
  update private.rate_limit_events set created_at = now() - interval '61 minutes'
  where user_id = 'e7000000-0000-4000-8000-000000000002' and action = 'forum_thread';
  perform cdtest.login('e7000000-0000-4000-8000-000000000002');
  insert into public.forum_threads (category_id, title, body)
  values (v_cat, 'Tópico depois de uma hora', 'Depois da janela, publicar volta a ser possível.');
  perform cdtest.logout();
  perform cdtest.check(
    (select count(*) from private.rate_limit_events
     where user_id = 'e7000000-0000-4000-8000-000000000002' and action = 'forum_thread') = 1,
    'eventos fora da janela são apagados no envio seguinte');

  -- Moderação não tem limite.
  perform cdtest.login('e7000000-0000-4000-8000-000000000003');
  for i in 1 .. 6 loop
    insert into public.forum_threads (category_id, title, body)
    values (v_cat, 'Tópico da moderação nº ' || i, 'A moderação publica avisos sem limite.');
  end loop;
  perform cdtest.logout();

  -- service_role (sem auth.uid()) também não.
  perform cdtest.login_service();
  for i in 1 .. 6 loop
    insert into public.forum_threads (category_id, author_id, title, body)
    values (v_cat, 'e7000000-0000-4000-8000-000000000001', 'Tópico do servidor nº ' || i,
            'Tarefas do servidor não sofrem o limite das usuárias.');
  end loop;
  perform cdtest.logout();
end
$$;
select pass('forum_threads: 5 por hora por pessoa (CD021), anônimos contam, apagar não libera; moderação e service_role sem limite');

do $$
declare
  v_thread uuid;
  i int;
begin
  delete from private.rate_limit_events;
  insert into public.forum_threads (category_id, author_id, title, body)
  values ((select id from public.forum_categories where slug = 'teste-busca-anonima'),
          'e7000000-0000-4000-8000-000000000001', 'Tópico para respostas', 'Tópico que recebe as respostas do teste.')
  returning id into v_thread;

  perform cdtest.login('e7000000-0000-4000-8000-000000000002');
  for i in 1 .. 30 loop
    insert into public.forum_posts (thread_id, is_anonymous, author_id, body)
    values (v_thread, i % 5 = 0, 'e7000000-0000-4000-8000-000000000002', 'Resposta de teste nº ' || i);
  end loop;
  perform cdtest.throws(format($q$insert into public.forum_posts (thread_id, body) values (%L, '31ª resposta')$q$, v_thread),
    'CD022', 'a 31ª resposta na mesma hora é recusada', 'Você enviou muitas respostas na última hora.%');
  perform cdtest.logout();

  perform cdtest.login('e7000000-0000-4000-8000-000000000004');
  for i in 1 .. 31 loop
    insert into public.forum_posts (thread_id, body) values (v_thread, 'Resposta da admin nº ' || i);
  end loop;
  perform cdtest.logout();
end
$$;
select pass('forum_posts: 30 por hora por pessoa (CD022); admin sem limite');

do $$
declare
  v_paper uuid;
  v_papers uuid[];
  i int;
begin
  delete from private.rate_limit_events;
  -- Papers de outra pessoa, criados como postgres (contexto confiável, sem limite).
  with ins as (
    insert into public.papers (submitted_by, title, abstract, authors, submitter_relation, women_authorship_confirmed)
    select 'e7000000-0000-4000-8000-000000000001', 'Paper para votos nº ' || g,
           'Resumo longo o bastante para o paper de teste de votos número ' || g || '.',
           array['Íris Conceição'], 'author', true
    from generate_series(1, 61) as g
    returning id
  )
  select array_agg(id) into v_papers from ins;
  v_paper := v_papers[1];

  -- Comentários: 20 por hora.
  perform cdtest.login('e7000000-0000-4000-8000-000000000002');
  for i in 1 .. 20 loop
    insert into public.paper_comments (paper_id, body) values (v_paper, 'Comentário de teste nº ' || i);
  end loop;
  perform cdtest.throws(format($q$insert into public.paper_comments (paper_id, body) values (%L, '21º comentário')$q$, v_paper),
    'CD023', 'o 21º comentário na mesma hora é recusado', 'Você comentou muitas vezes na última hora.%');

  -- Votos: 60 por hora.
  for i in 1 .. 60 loop
    insert into public.paper_votes (paper_id) values (v_papers[i]);
  end loop;
  perform cdtest.throws(format('insert into public.paper_votes (paper_id) values (%L)', v_papers[61]),
    'CD025', 'o 61º destaque na mesma hora é recusado', 'Você destacou muitos papers na última hora.%');
  -- Tirar e pôr o voto de novo também conta (sem laço infinito de votos).
  perform cdtest.check(cdtest.affected(format('delete from public.paper_votes where paper_id = %L', v_papers[1])) = 1,
    'retira um destaque');
  perform cdtest.throws(format('insert into public.paper_votes (paper_id) values (%L)', v_papers[1]),
    'CD025', 'retirar um destaque não libera outro na mesma hora');

  -- Papers: 5 em 24 h.
  for i in 1 .. 5 loop
    insert into public.papers (title, abstract, authors, submitter_relation, women_authorship_confirmed)
    values ('Paper da Joana nº ' || i, 'Resumo longo o bastante para o paper de teste da Joana, número ' || i || '.',
            array['Joana Prado'], 'author', true);
  end loop;
  perform cdtest.throws($q$insert into public.papers (title, abstract, authors, submitter_relation, women_authorship_confirmed)
      values ('Sexto paper do dia', 'Resumo longo o bastante para o sexto paper, que deve ser recusado.', array['Joana Prado'], 'author', true)$q$,
    'CD024', 'o 6º paper em 24 h é recusado', 'Você já divulgou 5 papers nas últimas 24 horas.%');
  perform cdtest.logout();

  -- Moderação sem limite nos três.
  perform cdtest.login('e7000000-0000-4000-8000-000000000003');
  for i in 1 .. 21 loop
    insert into public.paper_comments (paper_id, body) values (v_paper, 'Comentário da moderação nº ' || i);
  end loop;
  for i in 1 .. 61 loop
    insert into public.paper_votes (paper_id) values (v_papers[i]);
  end loop;
  for i in 1 .. 6 loop
    insert into public.papers (title, abstract, authors, submitter_relation, women_authorship_confirmed)
    values ('Paper da moderação nº ' || i, 'Resumo longo o bastante para o paper de teste da moderação, nº ' || i || '.',
            array['Moderadora Busca'], 'reader', true);
  end loop;
  perform cdtest.logout();
  perform cdtest.check(
    (select count(*) from private.rate_limit_events where user_id = 'e7000000-0000-4000-8000-000000000003') = 0,
    'envios da moderação nem entram no registro');
end
$$;
select pass('paper_comments 20/h (CD023), paper_votes 60/h (CD025), papers 5/24 h (CD024); moderação sem limite');

do $$
declare
  v_id uuid;
  v_mentor uuid;
  i int;
begin
  -- Pedidos de mentoria: a moderação não tem o limite diário (5), mas continua com o de 3 por
  -- mentora em 7 dias. (O limite das membras está em rls.test.sql.)
  perform cdtest.login('e7000000-0000-4000-8000-000000000003');
  foreach v_mentor in array array['e7000000-0000-4000-8000-000000000005', 'e7000000-0000-4000-8000-000000000006']::uuid[] loop
    for i in 1 .. 3 loop
      insert into public.mentorship_requests (mentor_id, message)
      values (v_mentor, 'Pedido de teste da moderação para conferir o limite diário.')
      returning id into v_id;
      update public.mentorship_requests set status = 'cancelled' where id = v_id;
    end loop;
  end loop;
  perform cdtest.check(
    (select count(*) from public.mentorship_requests where mentee_id = 'e7000000-0000-4000-8000-000000000003') = 6,
    'moderação fez 6 pedidos em 24 h');
  perform cdtest.throws($q$insert into public.mentorship_requests (mentor_id, message)
      values ('e7000000-0000-4000-8000-000000000005', 'Quarto pedido para a mesma mentora na semana.')$q$,
    'CD020', 'o limite de 3 pedidos por mentora em 7 dias vale para a moderação', '%7 dias%');
  perform cdtest.logout();

  -- Denúncias: membra com 10 em 24 h recebe CD019 (detalhado em rls.test.sql); aqui, a mensagem.
  perform cdtest.login('e7000000-0000-4000-8000-000000000002');
  for v_id in select p.id from public.papers p where p.submitted_by = 'e7000000-0000-4000-8000-000000000001' limit 10 loop
    insert into public.reports (target_type, target_id, reason) values ('paper', v_id, 'spam');
  end loop;
  perform cdtest.throws(format($q$insert into public.reports (target_type, target_id, reason)
      values ('profile', %L, 'other')$q$, 'e7000000-0000-4000-8000-000000000001'),
    'CD019', 'a 11ª denúncia em 24 h é recusada com mensagem pt-BR', 'Você já enviou 10 denúncias nas últimas 24 horas.%');
  perform cdtest.logout();
end
$$;
select pass('mentorship_requests e reports: moderação sem limite diário; mensagens pt-BR');

-- =============================================================================
-- C1. Exclusões feitas pela moderação ficam na auditoria (uma linha, nunca a autoria anônima)
-- =============================================================================
delete from private.rate_limit_events;

do $$
declare
  v_cat smallint := (select id from public.forum_categories where slug = 'teste-busca-normal');
  v_cat_anon smallint := (select id from public.forum_categories where slug = 'teste-busca-anonima');
  v_thread uuid;
  v_post uuid;
  v_anon_thread uuid;
  v_anon_post uuid;
  v_mod_anon_thread uuid;
  v_mod_anon_post uuid;
  v_mod_thread uuid;
  v_paper uuid;
  v_comment uuid;
  v_mod_paper uuid;
  v_last bigint;
  i int;
begin
  -- Conteúdo da Íris (membra): tópico assinado com 2 respostas, tópico anônimo com resposta
  -- anônima, paper com comentário.
  perform cdtest.login('e7000000-0000-4000-8000-000000000001');
  insert into public.forum_threads (category_id, title, body)
  values (v_cat, 'Tópico da Íris para moderar', 'Tópico assinado que a moderação vai excluir.')
  returning id into v_thread;
  insert into public.forum_posts (thread_id, body) values (v_thread, 'Primeira resposta da Íris.') returning id into v_post;
  insert into public.forum_posts (thread_id, body) values (v_thread, 'Segunda resposta da Íris.');
  insert into public.forum_threads (category_id, author_id, is_anonymous, title, body)
  values (v_cat_anon, 'e7000000-0000-4000-8000-000000000001', true, 'Tópico anônimo da Íris',
          'Tópico anônimo que a moderação vai excluir.')
  returning id into v_anon_thread;
  insert into public.forum_posts (thread_id, author_id, is_anonymous, body)
  values (v_anon_thread, 'e7000000-0000-4000-8000-000000000001', true, 'Resposta anônima da Íris.')
  returning id into v_anon_post;
  insert into public.papers (title, abstract, authors, submitter_relation, women_authorship_confirmed)
  values ('Paper da Íris para moderar', 'Resumo longo o bastante para o paper que a moderação vai excluir.',
          array['Íris Conceição'], 'author', true)
  returning id into v_paper;
  insert into public.paper_comments (paper_id, body) values (v_paper, 'Comentário da Íris.') returning id into v_comment;
  perform cdtest.logout();

  -- Conteúdo da própria moderadora (inclusive anônimo).
  perform cdtest.login('e7000000-0000-4000-8000-000000000003');
  insert into public.forum_threads (category_id, title, body)
  values (v_cat, 'Tópico da moderadora', 'Tópico que a própria moderadora vai apagar.')
  returning id into v_mod_thread;
  insert into public.forum_threads (category_id, author_id, is_anonymous, title, body)
  values (v_cat_anon, 'e7000000-0000-4000-8000-000000000003', true, 'Desabafo anônimo da moderadora',
          'A moderadora também pode escrever anonimamente.')
  returning id into v_mod_anon_thread;
  insert into public.forum_posts (thread_id, author_id, is_anonymous, body)
  values (v_anon_thread, 'e7000000-0000-4000-8000-000000000003', true, 'Resposta anônima da moderadora.')
  returning id into v_mod_anon_post;
  insert into public.papers (title, abstract, authors, submitter_relation, women_authorship_confirmed)
  values ('Paper indicado pela moderadora', 'Resumo longo o bastante para o paper que a moderadora vai apagar.',
          array['Alguém'], 'reader', true)
  returning id into v_mod_paper;

  -- 1. A moderadora apaga o PRÓPRIO conteúdo (assinado e anônimo): nada é registrado.
  v_last := cdtest.audit_max();
  perform cdtest.check(cdtest.affected(format('delete from public.forum_threads where id = %L', v_mod_thread)) = 1, 'apaga o próprio tópico');
  perform cdtest.check(cdtest.affected(format('delete from public.forum_threads where id = %L', v_mod_anon_thread)) = 1, 'apaga o próprio tópico anônimo');
  perform cdtest.check(cdtest.affected(format('delete from public.forum_posts where id = %L', v_mod_anon_post)) = 1, 'apaga a própria resposta anônima');
  perform cdtest.check(cdtest.affected(format('delete from public.papers where id = %L', v_mod_paper)) = 1, 'apaga o próprio paper');
  perform cdtest.check(cdtest.audit_since(v_last) = 0,
    'moderadora apagando o próprio conteúdo (inclusive anônimo) não gera registro');

  -- 2. Resposta assinada de outra pessoa (DELETE direto, fora do painel): uma linha.
  v_last := cdtest.audit_max();
  perform cdtest.check(cdtest.affected(format('delete from public.forum_posts where id = %L', v_post)) = 1, 'apaga a resposta da Íris');
  perform cdtest.check(
    (select count(*) from public.moderation_audit_log
     where id > v_last and action = 'delete_content' and target_type = 'post' and target_id = v_post
       and actor_id = 'e7000000-0000-4000-8000-000000000003' and reason is null and report_id is null) = 1
    and cdtest.audit_since(v_last) = 1,
    'exclusão de resposta alheia registrada uma vez, com a moderadora como autora da ação');

  -- 3. Tópico de outra pessoa: uma linha para o tópico, nenhuma para as respostas em cascata.
  v_last := cdtest.audit_max();
  perform cdtest.check(cdtest.affected(format('delete from public.forum_threads where id = %L', v_thread)) = 1, 'apaga o tópico da Íris');
  perform cdtest.check(
    cdtest.audit_since(v_last) = 1
    and (select target_type from public.moderation_audit_log where id > v_last) = 'thread',
    'tópico apagado = 1 registro (as respostas que somem em cascata não geram linhas)');

  -- 4. Conteúdo anônimo de outra pessoa: registrado, sem nunca guardar quem escreveu.
  v_last := cdtest.audit_max();
  perform cdtest.check(cdtest.affected(format('delete from public.forum_posts where id = %L', v_anon_post)) = 1, 'apaga a resposta anônima da Íris');
  perform cdtest.check(cdtest.affected(format('delete from public.forum_threads where id = %L', v_anon_thread)) = 1, 'apaga o tópico anônimo da Íris');
  perform cdtest.check(
    (select array_agg(target_type order by id) from public.moderation_audit_log where id > v_last) = array['post', 'thread'],
    'exclusões de conteúdo anônimo alheio registradas (resposta e tópico)');
  perform cdtest.check(
    (select count(*) from public.moderation_audit_log
     where id > v_last
       and (actor_id = 'e7000000-0000-4000-8000-000000000001'
            or target_id = 'e7000000-0000-4000-8000-000000000001'
            or coalesce(reason, '') ilike '%íris%' or coalesce(reason, '') ilike '%iris%')) = 0,
    'o registro não guarda a autora anônima');

  -- 5. Paper alheio: uma linha (comentários em cascata não geram linhas).
  v_last := cdtest.audit_max();
  perform cdtest.check(cdtest.affected(format('delete from public.papers where id = %L', v_paper)) = 1, 'apaga o paper da Íris');
  perform cdtest.check(
    cdtest.audit_since(v_last) = 1
    and (select target_type from public.moderation_audit_log where id > v_last) = 'paper'
    and (select count(*) from public.paper_comments where id = v_comment) = 0,
    'paper apagado = 1 registro; o comentário sumiu junto sem linha própria');
  perform cdtest.logout();

  -- 6. Comentário alheio apagado pela admin: uma linha com a admin.
  perform cdtest.login('e7000000-0000-4000-8000-000000000001');
  insert into public.papers (title, abstract, authors, submitter_relation, women_authorship_confirmed)
  values ('Outro paper da Íris', 'Resumo longo o bastante para o segundo paper da Íris neste teste.',
          array['Íris Conceição'], 'author', true)
  returning id into v_paper;
  perform cdtest.put('iris_paper', v_paper);
  perform cdtest.logout();
  perform cdtest.login('e7000000-0000-4000-8000-000000000002');
  insert into public.paper_comments (paper_id, body) values (v_paper, 'Comentário da Joana.') returning id into v_comment;
  -- 7. Membra apagando o próprio comentário: nada é registrado.
  v_last := cdtest.audit_max();
  perform cdtest.check(cdtest.affected(format('delete from public.paper_comments where id = %L', v_comment)) = 1, 'Joana apaga o próprio comentário');
  perform cdtest.check(cdtest.audit_since(v_last) = 0, 'autora apagando o próprio comentário não gera registro');
  insert into public.paper_comments (paper_id, body) values (v_paper, 'Outro comentário da Joana.') returning id into v_comment;
  perform cdtest.logout();

  perform cdtest.login('e7000000-0000-4000-8000-000000000004');
  v_last := cdtest.audit_max();
  perform cdtest.check(cdtest.affected(format('delete from public.paper_comments where id = %L', v_comment)) = 1, 'admin apaga o comentário');
  perform cdtest.check(
    (select count(*) from public.moderation_audit_log
     where id > v_last and action = 'delete_content' and target_type = 'paper_comment' and target_id = v_comment
       and actor_id = 'e7000000-0000-4000-8000-000000000004') = 1,
    'exclusão de comentário pela admin registrada');
  perform cdtest.logout();

  -- 8. Contexto confiável (service_role, exclusão de conta): sem registro.
  v_last := cdtest.audit_max();
  perform cdtest.login_service();
  delete from public.forum_threads where title like 'Tópico do servidor nº %';
  perform cdtest.logout();
  delete from public.forum_threads where title like 'Tópico da moderação nº %';
  perform cdtest.check(cdtest.audit_since(v_last) = 0, 'service_role e postgres não geram registro');
end
$$;
select pass('delete_content: trigger registra exclusões da moderação em qualquer tela, uma vez, sem expor autoria anônima');

do $$
declare
  v_cat smallint := (select id from public.forum_categories where slug = 'teste-busca-normal');
  v_thread uuid;
  v_other uuid;
  v_report uuid;
  v_other_report uuid;
  v_last bigint;
begin
  perform cdtest.login('e7000000-0000-4000-8000-000000000001');
  insert into public.forum_threads (category_id, title, body)
  values (v_cat, 'Tópico denunciado', 'Tópico que será denunciado e excluído pelo painel.')
  returning id into v_thread;
  insert into public.forum_threads (category_id, title, body)
  values (v_cat, 'Outro tópico', 'Tópico que a moderação apaga sem passar pelo painel.')
  returning id into v_other;
  perform cdtest.logout();

  perform cdtest.login('e7000000-0000-4000-8000-000000000006');
  insert into public.reports (target_type, target_id, reason) values ('thread', v_thread, 'spam') returning id into v_report;
  insert into public.reports (target_type, target_id, reason) values ('thread', v_other, 'spam') returning id into v_other_report;
  perform cdtest.logout();

  perform cdtest.login('e7000000-0000-4000-8000-000000000002');
  perform cdtest.throws(format($q$select public.moderate_delete_content('thread', %L)$q$, v_thread),
    '42501', 'membra não usa a RPC de exclusão da moderação');
  perform cdtest.logout();

  perform cdtest.login('e7000000-0000-4000-8000-000000000003');
  perform cdtest.throws(format($q$select public.moderate_delete_content('profile', %L)$q$, 'e7000000-0000-4000-8000-000000000001'),
    '22023', 'perfil não é conteúdo excluível pela RPC');
  perform cdtest.throws(format($q$select public.moderate_delete_content('thread', %L, 'Motivo', %L)$q$, v_thread, v_other_report),
    'CD017', 'denúncia sobre outro conteúdo é recusada');
  perform cdtest.check((select count(*) from public.forum_threads where id = v_thread) = 1, 'nada foi apagado na tentativa recusada');

  v_last := cdtest.audit_max();
  perform cdtest.check(
    public.moderate_delete_content('thread', v_thread, '  Spam repetido em vários tópicos.  ', v_report),
    'a RPC devolve true quando apaga');
  perform cdtest.check(
    cdtest.audit_since(v_last) = 1
    and (select count(*) from public.moderation_audit_log
         where id > v_last and action = 'delete_content' and target_type = 'thread' and target_id = v_thread
           and report_id = v_report and reason = 'Spam repetido em vários tópicos.'
           and actor_id = 'e7000000-0000-4000-8000-000000000003') = 1,
    'exclusão pelo painel: UMA linha, com motivo e denúncia, gravada na mesma transação');
  perform cdtest.check(not public.moderate_delete_content('thread', v_thread, 'De novo', v_report),
    'conteúdo que já não existe: false e nenhum registro novo');
  perform cdtest.check(cdtest.audit_since(v_last) = 1, 'repetir não duplica o registro');

  -- O motivo da RPC não vaza para outras exclusões na mesma sessão.
  v_last := cdtest.audit_max();
  delete from public.forum_threads where id = v_other;
  perform cdtest.check(
    (select reason is null and report_id is null from public.moderation_audit_log where id > v_last and target_id = v_other),
    'exclusão direta depois da RPC fica sem o motivo/denúncia da RPC');
  perform cdtest.logout();

  perform cdtest.check(not has_function_privilege('anon', 'public.moderate_delete_content(public.report_target, uuid, text, uuid)', 'EXECUTE'),
    'anon não executa moderate_delete_content');
end
$$;
select pass('moderate_delete_content: só moderação, motivo/denúncia validados, um registro por exclusão');

-- Migration 20261028170400_panel_delete_audit_anonymity.sql: pelo painel, a exclusão é sempre
-- registrada — inclusive do conteúdo anônimo da própria moderadora. Sem a linha, o registro
-- mostraria só o encerramento da denúncia por ela e entregaria a autoria anônima.
do $$
declare
  v_cat_anon smallint := (select id from public.forum_categories where slug = 'teste-busca-anonima');
  v_thread uuid;
  v_direct uuid;
  v_report uuid;
  v_last bigint;
begin
  perform cdtest.login('e7000000-0000-4000-8000-000000000003');
  insert into public.forum_threads (category_id, author_id, is_anonymous, title, body)
  values (v_cat_anon, 'e7000000-0000-4000-8000-000000000003', true, 'Desabafo anônimo denunciado',
          'Tópico anônimo da moderadora que recebe uma denúncia.')
  returning id into v_thread;
  insert into public.forum_threads (category_id, author_id, is_anonymous, title, body)
  values (v_cat_anon, 'e7000000-0000-4000-8000-000000000003', true, 'Outro desabafo anônimo',
          'Tópico anônimo da moderadora que ela mesma apaga no fórum.')
  returning id into v_direct;
  perform cdtest.logout();

  -- (A Joana já está no limite de denúncias do dia: quem denuncia aqui é a mentora e7…05.)
  perform cdtest.login('e7000000-0000-4000-8000-000000000005');
  insert into public.reports (target_type, target_id, reason) values ('thread', v_thread, 'spam') returning id into v_report;
  perform cdtest.logout();

  perform cdtest.login('e7000000-0000-4000-8000-000000000003');
  v_last := cdtest.audit_max();
  perform cdtest.check(public.moderate_delete_content('thread', v_thread, null, v_report),
    'a moderadora exclui pelo painel o próprio tópico anônimo denunciado');
  perform cdtest.check(
    cdtest.audit_since(v_last) = 1
    and (select count(*) from public.moderation_audit_log
         where id > v_last and action = 'delete_content' and target_type = 'thread' and target_id = v_thread
           and report_id = v_report and actor_id = 'e7000000-0000-4000-8000-000000000003') = 1,
    'exclusão pelo painel registrada como qualquer outra (a falta da linha revelaria a autoria anônima)');

  -- Fora do painel nada muda: a autora apagando o próprio conteúdo não gera linha.
  v_last := cdtest.audit_max();
  perform cdtest.check(cdtest.affected(format('delete from public.forum_threads where id = %L', v_direct)) = 1,
    'apaga o outro tópico anônimo direto no fórum');
  perform cdtest.check(cdtest.audit_since(v_last) = 0, 'exclusão do próprio conteúdo fora do painel continua sem registro');
  perform cdtest.logout();
end
$$;
select pass('moderate_delete_content: exclusão pelo painel sempre registrada, sem deduzir autoria anônima pela linha que falta');

-- =============================================================================
-- C2. avatar_url só aponta para o avatar público da própria pasta no Storage
-- =============================================================================
do $$
declare
  v_me text := 'e7000000-0000-4000-8000-000000000001';
  n bigint;
begin
  perform cdtest.login(v_me::uuid);
  n := cdtest.affected(format($q$update public.profiles set avatar_url = %L where id = %L$q$,
    'http://127.0.0.1:54321/storage/v1/object/public/avatars/' || v_me || '/avatar-1730000000000.webp', v_me));
  perform cdtest.check(n = 1, 'aceita o avatar da própria pasta (Storage local)');
  n := cdtest.affected(format($q$update public.profiles set avatar_url = %L where id = %L$q$,
    'https://abcdefghijklmnopqrst.supabase.co/storage/v1/object/public/avatars/' || v_me || '/avatar-1730000000001.png', v_me));
  perform cdtest.check(n = 1, 'aceita o avatar da própria pasta (Supabase Cloud)');

  perform cdtest.throws(format($q$update public.profiles set avatar_url = %L where id = %L$q$,
      'https://abcdefghijklmnopqrst.supabase.co/storage/v1/object/public/avatars/e7000000-0000-4000-8000-000000000002/avatar.png', v_me),
    '23514', 'recusa o avatar da pasta de outra pessoa');
  perform cdtest.throws(format($q$update public.profiles set avatar_url = 'https://example.com/foto.png' where id = %L$q$, v_me),
    '23514', 'recusa imagem de outro servidor');
  perform cdtest.throws(format($q$update public.profiles set avatar_url = 'https://lh3.googleusercontent.com/a/foto' where id = %L$q$, v_me),
    '23514', 'recusa foto do login social (outro servidor)');
  perform cdtest.throws(format($q$update public.profiles set avatar_url = %L where id = %L$q$,
      'https://abcdefghijklmnopqrst.supabase.co@rastreador.example/storage/v1/object/public/avatars/' || v_me || '/a.png', v_me),
    '23514', 'recusa usuário/senha na URL (host disfarçado)');
  perform cdtest.throws(format($q$update public.profiles set avatar_url = %L where id = %L$q$,
      'https://abcdefghijklmnopqrst.supabase.co/storage/v1/object/public/avatars/' || v_me || '/../e7000000-0000-4000-8000-000000000002/a.png', v_me),
    '23514', 'recusa subpastas e ..');
  perform cdtest.throws(format($q$update public.profiles set avatar_url = %L where id = %L$q$,
      'https://abcdefghijklmnopqrst.supabase.co/storage/v1/object/public/avatars/' || v_me || '/a.png?rastreio=1', v_me),
    '23514', 'recusa query string');
  perform cdtest.throws(format($q$update public.profiles set avatar_url = %L where id = %L$q$,
      'https://abcdefghijklmnopqrst.supabase.co/storage/v1/object/public/outro-bucket/' || v_me || '/a.png', v_me),
    '23514', 'recusa outro bucket');
  perform cdtest.throws(format($q$update public.profiles set avatar_url = 'javascript:alert(1)' where id = %L$q$, v_me),
    '23514', 'recusa esquemas perigosos');

  n := cdtest.affected(format($q$update public.profiles set avatar_url = '   ' where id = %L$q$, v_me));
  perform cdtest.check(n = 1 and (select avatar_url is null from public.profiles where id = v_me::uuid),
    'texto vazio vira NULL (remover a foto)');
  n := cdtest.affected(format($q$update public.profiles set avatar_url = null where id = %L$q$, v_me));
  perform cdtest.check(n = 1, 'NULL é aceito');
  perform cdtest.logout();

  -- Nem a service role grava avatar de terceiros (CHECK vale para todo mundo).
  perform cdtest.throws(format($q$update public.profiles set avatar_url = 'https://example.com/foto.png' where id = %L$q$, v_me),
    '23514', 'contexto confiável também respeita a regra');
end
$$;
select pass('avatar_url: NULL ou o avatar público da própria pasta (outra pasta, outro servidor, @, .., query → 23514)');

do $$
begin
  -- Cadastro pelo Google: a foto (`picture`) é de outro servidor → descartada sem impedir o cadastro.
  insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, created_at, updated_at)
  values ('00000000-0000-0000-0000-000000000000', 'e7000000-0000-4000-8000-000000000009', 'authenticated', 'authenticated',
          'google.busca@example.test',
          '{"name": "Cadastro Google", "picture": "https://lh3.googleusercontent.com/a/foto-da-conta"}', now(), now());
  perform cdtest.check(
    (select full_name = 'Cadastro Google' and avatar_url is null from public.profiles
     where id = 'e7000000-0000-4000-8000-000000000009'),
    'cadastro com foto do provedor cria o perfil sem avatar');

  perform cdtest.check(
    (select convalidated from pg_constraint
     where conrelid = 'public.profiles'::regclass and conname = 'profiles_avatar_url_own_storage'),
    'a CHECK existe e foi validada para todas as linhas (inclusive seed/demonstração)');
  perform cdtest.check(
    (select count(*) from public.profiles where not private.is_own_avatar_url(id, avatar_url)) = 0,
    'nenhum perfil existente fere a regra');
end
$$;
select pass('avatar_url: cadastro descarta foto externa; regra validada em todos os perfis');

-- =============================================================================
-- Regressão: search_text (gerada) não faz votos/respostas contarem como edição
-- (migration 20261028170300_search_text_trigger_fix.sql)
-- =============================================================================
do $$
declare
  v_cat smallint := (select id from public.forum_categories where slug = 'teste-busca-normal');
  v_thread uuid;
  v_paper uuid;
  v_thread_updated timestamptz;
  v_paper_updated timestamptz;
begin
  delete from private.rate_limit_events;
  insert into public.forum_threads (category_id, author_id, title, body, updated_at)
  values (v_cat, 'e7000000-0000-4000-8000-000000000001', 'Tópico do updated_at', 'Tópico para conferir o updated_at.',
          now() - interval '1 day')
  returning id, updated_at into v_thread, v_thread_updated;
  insert into public.papers (submitted_by, title, abstract, authors, submitter_relation, women_authorship_confirmed, updated_at)
  values ('e7000000-0000-4000-8000-000000000001', 'Paper do updated_at',
          'Resumo longo o bastante para conferir que votos não contam como edição.', array['Íris Conceição'],
          'author', true, now() - interval '1 day')
  returning id, updated_at into v_paper, v_paper_updated;

  perform cdtest.login('e7000000-0000-4000-8000-000000000002');
  insert into public.forum_posts (thread_id, body) values (v_thread, 'Resposta que não é edição.');
  insert into public.paper_votes (paper_id) values (v_paper);
  insert into public.paper_comments (paper_id, body) values (v_paper, 'Comentário que não é edição.');
  perform cdtest.logout();

  perform cdtest.check((select updated_at from public.forum_threads where id = v_thread) = v_thread_updated,
    'nova resposta não muda o updated_at do tópico');
  perform cdtest.check((select updated_at from public.papers where id = v_paper) = v_paper_updated,
    'destaque e comentário não mudam o updated_at do paper');

  perform cdtest.login('e7000000-0000-4000-8000-000000000001');
  update public.forum_threads set title = 'Tópico do updated_at (editado)' where id = v_thread;
  update public.papers set title = 'Paper do updated_at (editado)' where id = v_paper;
  perform cdtest.logout();
  perform cdtest.check(
    (select updated_at > v_thread_updated and search_text like '%(editado)%' from public.forum_threads where id = v_thread)
    and (select updated_at > v_paper_updated and search_text like '%(editado)%' from public.papers where id = v_paper),
    'editar o título muda updated_at e search_text');
end
$$;
select pass('search_text: votos, comentários e respostas não contam como edição (updated_at)');

select * from finish();
rollback;
