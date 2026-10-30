-- =============================================================================
-- Artemis — Pergunte a uma cientista (migration 20261028190100_public_questions.sql)
-- Mesmo formato de mentorship_messages.test.sql: blocos DO que simulam usuárias (papel +
-- request.jwt.claims, como o PostgREST), EXCEÇÃO na primeira expectativa quebrada, pass() por
-- grupo e ROLLBACK no fim. Dados próprios (usuárias f3…), sem depender do seed.
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
create schema cdtest_perg;
grant usage on schema cdtest_perg to anon, authenticated, service_role;

create function cdtest_perg.login(p_user uuid) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end
$$;

create function cdtest_perg.login_anon() returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"role": "anon"}', true);
  perform set_config('role', 'anon', true);
end
$$;

create function cdtest_perg.logout() returns void
language plpgsql as $$
begin
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', '', true);
end
$$;

-- Executa p_sql e exige que falhe com o SQLSTATE informado (NULL = qualquer erro) e, se
-- p_message_like vier, com uma mensagem que case com ele.
create function cdtest_perg.throws(p_sql text, p_errcode text, p_desc text, p_message_like text default null)
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

create function cdtest_perg.affected(p_sql text) returns bigint
language plpgsql as $$
declare
  n bigint;
begin
  execute p_sql;
  get diagnostics n = row_count;
  return n;
end
$$;

create function cdtest_perg.check(p_condition boolean, p_desc text) returns void
language plpgsql as $$
begin
  if p_condition is not true then
    raise exception 'FALHOU: %', p_desc;
  end if;
end
$$;

create function cdtest_perg.put(p_key text, p_value text) returns void
language sql as $$ select set_config('cdtest_perg.' || p_key, p_value, true); $$;

create function cdtest_perg.get(p_key text) returns text
language sql stable as $$ select nullif(current_setting('cdtest_perg.' || p_key, true), ''); $$;

-- Lê como contexto confiável (SECURITY DEFINER: sem RLS, mesmo com uma usuária logada).
create function cdtest_perg.question(p_id uuid) returns public.public_questions
language sql stable security definer set search_path = '' as $$
  select q.* from public.public_questions q where q.id = p_id;
$$;

create function cdtest_perg.answers_of(p_question uuid) returns bigint
language sql stable security definer set search_path = '' as $$
  select count(*) from public.public_answers a where a.question_id = p_question;
$$;

create function cdtest_perg.answer(p_id uuid) returns public.public_answers
language sql stable security definer set search_path = '' as $$
  select a.* from public.public_answers a where a.id = p_id;
$$;

create function cdtest_perg.audit_reason(p_action text, p_target_type text, p_target uuid) returns text
language sql stable security definer set search_path = '' as $$
  select l.reason from public.moderation_audit_log l
  where l.action = p_action and l.target_type = p_target_type and l.target_id = p_target
  order by l.id desc limit 1;
$$;

create function cdtest_perg.audit_count(p_action text, p_target_type text, p_target uuid) returns bigint
language sql stable security definer set search_path = '' as $$
  select count(*) from public.moderation_audit_log l
  where l.action = p_action and l.target_type = p_target_type and l.target_id = p_target;
$$;

grant execute on all functions in schema cdtest_perg to anon, authenticated, service_role;

-- Texto válido de pergunta (30–800 caracteres, sem dados pessoais).
create function cdtest_perg.question_text(p_n integer) returns text
language sql immutable as $$
  select format('Pergunta de teste número %s: como é fazer pesquisa em química?', p_n);
$$;
grant execute on function cdtest_perg.question_text(integer) to anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Dados de teste (como postgres)
--   f3…01 Ana (mentora, cadastro completo) · f3…02 Bia (membra, cadastro completo)
--   f3…03 Clara (cadastro incompleto) · f3…04 Dora (moderadora)
-- -----------------------------------------------------------------------------
insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', 'f3000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
   'ana.pergunte@example.test', '{"full_name": "Ana Cientista"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'f3000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated',
   'bia.pergunte@example.test', '{"full_name": "Bia Membra"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'f3000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated',
   'clara.pergunte@example.test', '{"full_name": "Clara Incompleta"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'f3000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated',
   'dora.pergunte@example.test', '{"full_name": "Dora Moderadora"}', now(), now());

update public.profiles set onboarded_at = now(), career_stage = 'professor', is_mentor = true
  where id = 'f3000000-0000-4000-8000-000000000001';
update public.profiles set onboarded_at = now(), career_stage = 'undergraduate'
  where id = 'f3000000-0000-4000-8000-000000000002';
update public.profiles set onboarded_at = now(), role = 'moderator'
  where id = 'f3000000-0000-4000-8000-000000000004';

-- =============================================================================
-- 1. Estrutura: RLS, GRANTs por coluna, nada de escrita direta em perguntas
-- =============================================================================
do $$
begin
  perform cdtest_perg.check(
    (select relrowsecurity from pg_class where oid = 'public.public_questions'::regclass)
    and (select relrowsecurity from pg_class where oid = 'public.public_answers'::regclass),
    'RLS ligado nas duas tabelas');
  perform cdtest_perg.check(
    not has_table_privilege('anon', 'public.public_questions', 'insert')
    and not has_table_privilege('authenticated', 'public.public_questions', 'insert')
    and not has_table_privilege('authenticated', 'public.public_questions', 'update')
    and not has_table_privilege('authenticated', 'public.public_questions', 'delete'),
    'ninguém escreve direto em public_questions (só pelas RPCs)');
  perform cdtest_perg.check(
    has_column_privilege('anon', 'public.public_questions', 'body', 'select')
    and not has_column_privilege('anon', 'public.public_questions', 'tracking_token_hash', 'select')
    and not has_column_privilege('authenticated', 'public.public_questions', 'tracking_token_hash', 'select')
    and not has_column_privilege('authenticated', 'public.public_questions', 'reviewed_by', 'select')
    and not has_column_privilege('authenticated', 'public.public_questions', 'reject_reason', 'select')
    and not has_column_privilege('anon', 'public.public_questions', 'created_at', 'select')
    and not has_column_privilege('authenticated', 'public.public_questions', 'created_at', 'select')
    and has_column_privilege('anon', 'public.public_questions', 'published_at', 'select'),
    'colunas sensíveis (hash, quem revisou, motivo, hora exata do envio) fora da leitura');
  perform cdtest_perg.check(
    not has_table_privilege('anon', 'public.public_answers', 'select')
    and has_column_privilege('authenticated', 'public.public_answers', 'body', 'select')
    and has_column_privilege('authenticated', 'public.public_answers', 'is_hidden', 'select')
    and not has_column_privilege('authenticated', 'public.public_answers', 'hidden_by', 'select')
    and has_table_privilege('authenticated', 'public.public_answers', 'delete')
    and not has_table_privilege('authenticated', 'public.public_answers', 'update')
    and not has_column_privilege('authenticated', 'public.public_answers', 'is_hidden', 'insert')
    and not has_column_privilege('authenticated', 'public.public_answers', 'created_at', 'insert')
    and has_column_privilege('authenticated', 'public.public_answers', 'show_identity', 'insert'),
    'respostas: membras leem (sem hidden_by) e apagam (RLS), inserem só question_id, author_id, body e show_identity');
  perform cdtest_perg.check(
    not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'public_questions'
        and column_name in ('author_id', 'user_id', 'ip', 'ip_address', 'user_agent', 'asker_id')
    ),
    'a pergunta não tem coluna que identifique quem perguntou');
end
$$;
select pass('estrutura: RLS, GRANTs por coluna e nenhuma coluna que identifique quem pergunta');

-- =============================================================================
-- 2. Visitante envia: token de 32 caracteres, pendente, invisível para anon e membras
-- =============================================================================
do $$
declare
  v_token text;
  v_id uuid;
  v_row public.public_questions;
begin
  perform cdtest_perg.login_anon();
  v_token := public.submit_public_question(
    E'   Como faço para começar a estudar astronomia sozinha, sem telescópio?  \n',
    'ensino_medio_tecnico',
    (select a.id from public.research_areas a where a.name = a.big_area order by a.id limit 1));
  perform cdtest_perg.check(v_token ~ '^[A-Za-z0-9_-]{32}$', 'token base64url de 32 caracteres');

  perform cdtest_perg.check(
    (select count(*) from public.public_questions where body like 'Como faço para começar a estudar astronomia%') = 0,
    'visitante não lê a pergunta pendente');
  perform cdtest_perg.throws('select tracking_token_hash from public.public_questions', '42501',
    'visitante não lê tracking_token_hash');
  perform cdtest_perg.throws('select reviewed_by from public.public_questions', '42501',
    'visitante não lê reviewed_by');
  perform cdtest_perg.throws('select created_at from public.public_questions', '42501',
    'visitante não lê a hora exata do envio');
  perform cdtest_perg.throws('select * from public.list_pending_public_questions()', '42501',
    'visitante não lê a fila da moderação');

  perform cdtest_perg.logout();
  select q.* into v_row from public.public_questions q
  where q.tracking_token_hash = encode(extensions.digest(v_token, 'sha256'), 'hex');
  perform cdtest_perg.check(v_row.id is not null, 'o banco guarda só o SHA-256 do token');
  perform cdtest_perg.check(v_row.status = 'pending', 'a pergunta nasce pendente');
  perform cdtest_perg.check(v_row.body = 'Como faço para começar a estudar astronomia sozinha, sem telescópio?',
    'o corpo é gravado sem espaços nas pontas');
  perform cdtest_perg.check(v_row.stage = 'ensino_medio_tecnico' and v_row.area_id is not null, 'etapa e área gravadas');
  perform cdtest_perg.check(v_row.reviewed_by is null and v_row.published_at is null, 'sem revisão ainda');
  perform cdtest_perg.check(
    not exists (select 1 from public.public_questions q where q.tracking_token_hash = v_token),
    'o token cru nunca é gravado');

  perform cdtest_perg.login('f3000000-0000-4000-8000-000000000002');
  perform cdtest_perg.check((select count(*) from public.public_questions where id = v_row.id) = 0,
    'membra não lê a pergunta pendente');
  perform cdtest_perg.throws('select tracking_token_hash from public.public_questions', '42501',
    'membra não lê tracking_token_hash');
  perform cdtest_perg.throws(
    $q$insert into public.public_questions (body, tracking_token_hash) values ('Pergunta inserida direto pela API, sem RPC.', repeat('a', 64))$q$,
    '42501', 'membra não insere direto');

  -- Membra logada também pode perguntar (sem nada que a identifique).
  perform cdtest_perg.check(public.submit_public_question(cdtest_perg.question_text(1)) ~ '^[A-Za-z0-9_-]{32}$',
    'membra logada também envia pergunta');

  perform cdtest_perg.throws('select created_at from public.public_questions', '42501',
    'membra não lê a hora exata do envio');
  perform cdtest_perg.throws('select * from public.list_pending_public_questions()', '42501',
    'membra não lê a fila da moderação', 'Só a moderação vê a fila de perguntas.');

  perform cdtest_perg.login('f3000000-0000-4000-8000-000000000004');
  perform cdtest_perg.check((select count(*) from public.public_questions where id = v_row.id) = 1,
    'moderação lê a pergunta pendente');
  perform cdtest_perg.check(
    (select p.created_at is not null and p.body = v_row.body
     from public.list_pending_public_questions() p where p.id = v_row.id),
    'a fila da moderação traz a pergunta pendente com a hora do envio');
  perform cdtest_perg.throws('select tracking_token_hash from public.public_questions', '42501',
    'nem a moderação lê tracking_token_hash');

  perform cdtest_perg.logout();
  perform cdtest_perg.put('q1_token', v_token);
  perform cdtest_perg.put('q1', v_row.id::text);
end
$$;
select pass('envio anônimo: token de 32 caracteres, só o hash no banco, pendente e invisível fora da moderação');

-- =============================================================================
-- 3. Validação no banco: dados pessoais (CD041), tamanho/etapa/área (CD042)
-- =============================================================================
do $$
begin
  perform cdtest_perg.login_anon();
  perform cdtest_perg.throws($q$select public.submit_public_question('Meu e-mail é ana.souza@gmail.com, alguém me ajuda com química?')$q$,
    'CD041', 'e-mail na pergunta', 'Para proteger você, tire da pergunta%');
  perform cdtest_perg.throws($q$select public.submit_public_question('Me chama no (12) 99876-5432 para falar de engenharia, por favor')$q$,
    'CD041', 'telefone na pergunta');
  perform cdtest_perg.throws($q$select public.submit_public_question('Me liga no +55 12 9 9876-5432 que eu explico melhor a dúvida')$q$,
    'CD041', 'telefone com DDI na pergunta');
  perform cdtest_perg.throws($q$select public.submit_public_question('Meu CPF é 123.456.789-09, posso usar para me inscrever em algo?')$q$,
    'CD041', 'CPF na pergunta');
  perform cdtest_perg.throws($q$select public.submit_public_question('Me segue no @ana_sci para conversarmos sobre biologia marinha')$q$,
    'CD041', '@ de rede social na pergunta');
  perform cdtest_perg.throws($q$select public.submit_public_question('Vi isso em https://www.exemplo.com.br e fiquei com dúvida sobre ciência')$q$,
    'CD041', 'link na pergunta');
  perform cdtest_perg.throws($q$select public.submit_public_question('Meu perfil é instagram.com/ana, vocês podem olhar meus projetos?')$q$,
    'CD041', 'link de rede social na pergunta');
  -- Disfarces: espaços ou (at) no lugar do @, ponto ideográfico, telefone com pontos.
  perform cdtest_perg.throws($q$select public.submit_public_question('Me escreve em ana @ gmail.com para falar de química, por favor')$q$,
    'CD041', 'e-mail com espaços em volta do @');
  perform cdtest_perg.throws($q$select public.submit_public_question('Me escreve em ana (at) gmail.com para falar de química, por favor')$q$,
    'CD041', 'e-mail com (at)');
  perform cdtest_perg.throws($q$select public.submit_public_question('Meu perfil é instagram。com/ana, vocês podem olhar meus projetos?')$q$,
    'CD041', 'rede social com ponto ideográfico');
  perform cdtest_perg.throws($q$select public.submit_public_question('Me chama no 12.99876.5432 para falar de engenharia, por favor')$q$,
    'CD041', 'telefone separado por pontos');
  perform cdtest_perg.throws($q$select public.submit_public_question('Curta demais?')$q$,
    'CD042', 'pergunta curta demais', 'Sua pergunta precisa ter entre 30 e 800 caracteres.');
  perform cdtest_perg.throws(format($q$select public.submit_public_question(%L)$q$, repeat('a', 801)),
    'CD042', 'pergunta longa demais');
  perform cdtest_perg.throws(format($q$select public.submit_public_question(%L)$q$, E'   \n\t' || repeat(' ', 40) || E'\n'),
    'CD042', 'pergunta só com espaços');
  perform cdtest_perg.throws(format($q$select public.submit_public_question(%L, 'doutorado')$q$, cdtest_perg.question_text(2)),
    'CD042', 'etapa fora da lista');
  perform cdtest_perg.throws(format($q$select public.submit_public_question(%L, null, %s::smallint)$q$, cdtest_perg.question_text(3),
      (select a.id from public.research_areas a where a.name <> a.big_area order by a.id limit 1)),
    'CD042', 'subárea (não é grande área)');
  perform cdtest_perg.throws(format($q$select public.submit_public_question(%L, null, 32000::smallint)$q$, cdtest_perg.question_text(4)),
    'CD042', 'área inexistente');
  -- Números comuns em perguntas de ciência não são dado pessoal.
  perform cdtest_perg.check(public.submit_public_question(
    'Em 2026 vou estudar CO2 e pH 7,4; a Lei 9.394 fala de 10.000 células no capítulo 12?') ~ '^[A-Za-z0-9_-]{32}$',
    'números comuns (anos, pH, leis, capítulos) passam');
  perform cdtest_perg.logout();
end
$$;
select pass('dados pessoais (e-mail, telefone, CPF, @, links) → CD041; tamanho, etapa e área → CD042');

-- =============================================================================
-- 4. Limite global da fila (CD040) e limpeza das recusadas antigas
-- =============================================================================
do $$
declare
  v_pending bigint;
  v_old uuid := gen_random_uuid();
  v_recent uuid := gen_random_uuid();
begin
  -- Contexto confiável: enche a fila até 50 pendentes.
  select count(*) into v_pending from public.public_questions where status = 'pending';
  insert into public.public_questions (body, tracking_token_hash)
  select cdtest_perg.question_text(100 + n::integer), encode(extensions.digest('cap-' || n, 'sha256'), 'hex')
  from generate_series(1, greatest(50 - v_pending, 0)) as n;

  perform cdtest_perg.login_anon();
  perform cdtest_perg.throws(format($q$select public.submit_public_question(%L)$q$, cdtest_perg.question_text(5)),
    'CD040', 'fila com 50 pendentes recusa', 'Recebemos muitas perguntas agora%');
  perform cdtest_perg.logout();

  -- Libera a fila (só as pendentes criadas aqui) e cria duas recusadas: uma antiga, uma recente.
  delete from public.public_questions where tracking_token_hash in (
    select encode(extensions.digest('cap-' || n, 'sha256'), 'hex') from generate_series(1, 50) as n);
  insert into public.public_questions (id, body, status, reject_reason, reviewed_at, tracking_token_hash, created_at)
  values
    (v_old, cdtest_perg.question_text(6), 'rejected', 'fora_do_tema', now() - interval '31 days',
     encode(extensions.digest('old-rejected', 'sha256'), 'hex'), now() - interval '32 days'),
    (v_recent, cdtest_perg.question_text(7), 'rejected', 'duplicada', now() - interval '29 days',
     encode(extensions.digest('recent-rejected', 'sha256'), 'hex'), now() - interval '30 days');

  perform cdtest_perg.login_anon();
  perform public.submit_public_question(cdtest_perg.question_text(8));
  perform cdtest_perg.logout();
  perform cdtest_perg.check((cdtest_perg.question(v_old)).id is null, 'recusada há mais de 30 dias é apagada');
  perform cdtest_perg.check((cdtest_perg.question(v_recent)).id is not null, 'recusada há menos de 30 dias fica');
end
$$;
select pass('fila: 50 pendentes → CD040; recusadas há mais de 30 dias são apagadas no próximo envio');

-- =============================================================================
-- 5. Moderação: só moderadoras revisam; segunda revisão → CD046; registro de auditoria
-- =============================================================================
do $$
declare
  v_q1 uuid := cdtest_perg.get('q1')::uuid;
  v_token text;
  v_q2 uuid;
  v_q3 uuid;
  v_row public.public_questions;
begin
  perform cdtest_perg.login('f3000000-0000-4000-8000-000000000002');
  perform cdtest_perg.throws(format($q$select public.review_public_question(%L, 'publish')$q$, v_q1),
    '42501', 'membra não revisa');
  perform cdtest_perg.login_anon();
  perform cdtest_perg.throws(format($q$select public.review_public_question(%L, 'publish')$q$, v_q1),
    '42501', 'visitante não revisa');

  perform cdtest_perg.login('f3000000-0000-4000-8000-000000000004');
  perform cdtest_perg.throws(format($q$select public.review_public_question(%L, 'reject')$q$, v_q1),
    '22023', 'recusar exige motivo');
  perform cdtest_perg.throws(format($q$select public.review_public_question(%L, 'reject', 'chata')$q$, v_q1),
    '22023', 'motivo fora da lista');
  perform cdtest_perg.throws(format($q$select public.review_public_question(%L, 'talvez')$q$, v_q1),
    '22023', 'decisão inválida');
  perform cdtest_perg.throws(format($q$select public.review_public_question(%L, 'publish')$q$, gen_random_uuid()),
    'CD015', 'pergunta inexistente');

  perform public.review_public_question(v_q1, 'publish');
  v_row := cdtest_perg.question(v_q1);
  perform cdtest_perg.check(v_row.status = 'published' and v_row.published_at is not null
    and v_row.reviewed_at is not null and v_row.reviewed_by = 'f3000000-0000-4000-8000-000000000004'
    and v_row.reject_reason is null, 'publicar grava status, datas e quem revisou');
  perform cdtest_perg.throws(format($q$select public.review_public_question(%L, 'reject', 'duplicada')$q$, v_q1),
    'CD046', 'segunda revisão', 'Esta pergunta já foi revisada por outra moderadora.');
  perform cdtest_perg.check(cdtest_perg.audit_count('publish_question', 'public_question', v_q1) = 1,
    'publicação registrada no moderation_audit_log');

  -- Recusa com motivo: quem tem o link vê o motivo.
  perform cdtest_perg.login_anon();
  v_token := public.submit_public_question(cdtest_perg.question_text(9));
  perform cdtest_perg.logout();
  select q.id into v_q2 from public.public_questions q
  where q.tracking_token_hash = encode(extensions.digest(v_token, 'sha256'), 'hex');
  perform cdtest_perg.login('f3000000-0000-4000-8000-000000000004');
  perform public.review_public_question(v_q2, 'reject', 'dados_pessoais');
  perform cdtest_perg.check(cdtest_perg.audit_count('reject_question', 'public_question', v_q2) = 1,
    'recusa registrada no moderation_audit_log');
  perform cdtest_perg.check(
    (select reason from public.moderation_audit_log where action = 'reject_question' and target_id = v_q2) = 'Dados pessoais',
    'o registro guarda o motivo legível');
  perform cdtest_perg.login_anon();
  perform cdtest_perg.check(
    (select s.status = 'rejected' and s.reject_reason = 'dados_pessoais' and s.question_id is null
     from public.get_public_question_status(v_token) s),
    'acompanhamento mostra "recusada" com o motivo e sem id');
  perform cdtest_perg.check((select count(*) from public.public_questions where id = v_q2) = 0,
    'recusada não fica pública');
  perform cdtest_perg.logout();

  -- O CHECK de ações continua aceitando as antigas.
  insert into public.moderation_audit_log (actor_id, action, target_type, target_id)
  values ('f3000000-0000-4000-8000-000000000004', 'lock_thread', 'thread', gen_random_uuid());
  perform cdtest_perg.throws($q$insert into public.moderation_audit_log (action, target_type) values ('publicar_tudo', 'public_question')$q$,
    '23514', 'ação desconhecida continua recusada');
  perform cdtest_perg.throws($q$insert into public.moderation_audit_log (action, target_type) values ('lock_thread', 'pergunta')$q$,
    '23514', 'alvo desconhecido continua recusado');
  perform cdtest_perg.check(
    pg_get_constraintdef((select oid from pg_constraint where conname = 'rate_limit_events_action_check'))
      like all (array['%forum_thread%', '%forum_post%', '%paper_comment%', '%''paper''%', '%paper_vote%',
                      '%mentorship_message%', '%public_answer%']),
    'rate_limit_events_action_check mantém a lista completa + public_answer');

  -- Uma pendente para o teste de CD043.
  perform cdtest_perg.login_anon();
  v_token := public.submit_public_question(cdtest_perg.question_text(10));
  perform cdtest_perg.logout();
  select q.id into v_q3 from public.public_questions q
  where q.tracking_token_hash = encode(extensions.digest(v_token, 'sha256'), 'hex');
  perform cdtest_perg.put('q_pending', v_q3::text);
end
$$;
select pass('moderação: membra e visitante → 42501; publicar/recusar com motivo; segunda revisão → CD046; auditoria');

-- =============================================================================
-- 6. Respostas: quem pode responder, onde, o quê e quantas
-- =============================================================================
do $$
declare
  v_q1 uuid := cdtest_perg.get('q1')::uuid;
  v_pending uuid := cdtest_perg.get('q_pending')::uuid;
  v_answer uuid;
  v_created timestamptz;
  i integer;
begin
  perform cdtest_perg.login_anon();
  perform cdtest_perg.throws('select * from public.public_answers', '42501', 'visitante não lê a tabela de respostas');

  perform cdtest_perg.login('f3000000-0000-4000-8000-000000000003');
  perform cdtest_perg.throws(format($q$insert into public.public_answers (question_id, body) values (%L, 'Uma resposta qualquer, com calma e carinho.')$q$, v_q1),
    'CD044', 'cadastro incompleto não responde', 'Complete seu cadastro na Artemis para responder.');

  perform cdtest_perg.login('f3000000-0000-4000-8000-000000000001');
  perform cdtest_perg.throws(format($q$insert into public.public_answers (question_id, body) values (%L, 'Resposta para pergunta que ainda está em análise.')$q$, v_pending),
    'CD043', 'pergunta pendente não recebe resposta', 'Esta pergunta não está aberta para respostas.');
  perform cdtest_perg.throws(format($q$insert into public.public_answers (question_id, body) values (%L, 'Resposta para pergunta que não existe mais.')$q$, gen_random_uuid()),
    'CD043', 'pergunta inexistente não recebe resposta');
  perform cdtest_perg.throws(format($q$insert into public.public_answers (question_id, body) values (%L, 'Me escreva em ana.cientista@gmail.com que eu explico.')$q$, v_q1),
    'CD047', 'e-mail na resposta', 'Para a segurança de quem perguntou%');
  perform cdtest_perg.throws(format($q$insert into public.public_answers (question_id, body) values (%L, 'Me chama no zap (12) 99876-5432 que a gente conversa.')$q$, v_q1),
    'CD047', 'telefone na resposta');
  perform cdtest_perg.throws(format($q$insert into public.public_answers (question_id, body) values (%L, 'Me segue em instagram.com/ana.cientista para mais dicas.')$q$, v_q1),
    'CD047', 'rede social na resposta');
  -- Disfarces que o Markdown desfaz na tela: %XX no site, entidade HTML e barra invertida.
  perform cdtest_perg.throws(format($q$insert into public.public_answers (question_id, body) values (%L, 'Veja meu [perfil oficial](https://%%69nstagram.com/ana) para mais dicas.')$q$, v_q1),
    'CD047', 'rede social com %XX no endereço');
  perform cdtest_perg.throws(format($q$insert into public.public_answers (question_id, body) values (%L, 'Escreva para ana&commat;gmail&period;com que eu explico.')$q$, v_q1),
    'CD047', 'e-mail com entidades HTML');
  perform cdtest_perg.throws(format($q$insert into public.public_answers (question_id, body) values (%L, E'Me chama no zap (12) 99876\\-5432 que a gente conversa.')$q$, v_q1),
    'CD047', 'telefone com barra invertida do Markdown');
  perform cdtest_perg.throws(format($q$insert into public.public_answers (question_id, author_id, body) values (%L, 'f3000000-0000-4000-8000-000000000002', 'Resposta em nome de outra pessoa da rede.')$q$, v_q1),
    'CD013', 'autoria forjada', 'Autoria inválida%');
  perform cdtest_perg.throws(format($q$insert into public.public_answers (question_id, body, is_hidden) values (%L, 'Tentando criar uma resposta já oculta.', true)$q$, v_q1),
    '42501', 'is_hidden não é enviado pela autora');
  perform cdtest_perg.throws(format($q$insert into public.public_answers (question_id, body) values (%L, 'Curta')$q$, v_q1),
    '23514', 'resposta curta demais');

  -- Link https público é permitido na resposta.
  insert into public.public_answers (question_id, body, show_identity)
  values (v_q1, E'  Comece pelos materiais públicos em https://www.gov.br e procure clubes de ciências da sua escola.\n', true)
  returning id, created_at into v_answer, v_created;
  perform cdtest_perg.check(v_created = now(), 'created_at vem do servidor');
  perform cdtest_perg.check(
    (select body from public.public_answers where id = v_answer) = 'Comece pelos materiais públicos em https://www.gov.br e procure clubes de ciências da sua escola.',
    'o corpo é gravado sem espaços nas pontas');
  perform cdtest_perg.put('a_ana', v_answer::text);

  perform cdtest_perg.login('f3000000-0000-4000-8000-000000000002');
  insert into public.public_answers (question_id, body)
  values (v_q1, 'Também tive essa dúvida! Converse com as professoras, elas adoram ajudar.')
  returning id into v_answer;
  perform cdtest_perg.put('a_bia', v_answer::text);
  perform cdtest_perg.check((select count(*) from public.public_answers) = 1, 'membra lê só a própria resposta');
  perform cdtest_perg.throws('select hidden_by from public.public_answers', '42501',
    'a autora não lê quem da moderação ocultou');
  perform cdtest_perg.throws(format($q$update public.public_answers set body = 'Editada' where id = %L$q$, v_answer),
    '42501', 'resposta não é editada pela API');
  perform cdtest_perg.check(
    cdtest_perg.affected(format($q$delete from public.public_answers where id = %L$q$, cdtest_perg.get('a_ana'))) = 0,
    'membra não apaga resposta de outra pessoa');

  -- 20 respostas por hora; a 21ª é recusada (a resposta da Bia acima já conta).
  for i in 1..19 loop
    insert into public.public_answers (question_id, body)
    values (v_q1, format('Resposta de incentivo número %s: siga perguntando!', i));
  end loop;
  perform cdtest_perg.throws(format($q$insert into public.public_answers (question_id, body) values (%L, 'A vigésima primeira resposta da hora.')$q$, v_q1),
    'CD045', '21ª resposta na mesma hora', 'Você respondeu muitas perguntas na última hora.%');
  perform cdtest_perg.check(
    cdtest_perg.affected(format($q$delete from public.public_answers where question_id = %L and body like 'Resposta de incentivo%%'$q$, v_q1)) = 19,
    'a autora apaga as próprias respostas');
  perform cdtest_perg.logout();
end
$$;
select pass('respostas: anon não lê; CD044/CD043/CD047/CD013/CD045; link https permitido; autora apaga só as próprias');

-- =============================================================================
-- 7. Leitura pública: identidade só por consentimento, sem author_id, ocultas fora
-- =============================================================================
do $$
declare
  v_q1 uuid := cdtest_perg.get('q1')::uuid;
  v_a_ana uuid := cdtest_perg.get('a_ana')::uuid;
  v_a_bia uuid := cdtest_perg.get('a_bia')::uuid;
  v_name text;
  v_mentor boolean;
  v_stage public.career_stage;
begin
  perform cdtest_perg.check(
    not exists (
      select 1 from pg_proc p, unnest(p.proargnames) as arg
      where p.oid = 'public.list_public_answers(uuid)'::regprocedure and arg in ('author_id', 'user_id')
    ),
    'list_public_answers não devolve author_id');

  perform cdtest_perg.login_anon();
  perform cdtest_perg.check((select count(*) from public.list_public_answers(v_q1)) = 2, 'visitante lê as 2 respostas');
  select author_name, author_is_mentor, author_stage into v_name, v_mentor, v_stage
  from public.list_public_answers(v_q1) where id = v_a_ana;
  perform cdtest_perg.check(v_name = 'Ana Cientista' and v_mentor and v_stage = 'professor',
    'com show_identity: nome, mentora e etapa');
  perform cdtest_perg.check(
    (select author_name is null and author_stage is null and author_is_mentor is null
     from public.list_public_answers(v_q1) where id = v_a_bia),
    'sem show_identity: nenhuma identidade');
  perform cdtest_perg.check(not exists (select 1 from public.list_public_answers(v_q1) where is_mine),
    'is_mine falso para visitante');
  perform cdtest_perg.check(
    (select answer_count from public.list_public_questions('respondidas') where id = v_q1) = 2,
    'list_public_questions conta as respostas visíveis');
  perform cdtest_perg.check(
    not exists (select 1 from public.list_public_questions('sem_resposta') where id = v_q1),
    'respondida não aparece em sem_resposta');
  perform cdtest_perg.check(
    exists (select 1 from public.list_public_questions('todas', 'ensino_medio_tecnico') where id = v_q1)
    and not exists (select 1 from public.list_public_questions('todas', 'graduacao') where id = v_q1),
    'filtro por etapa');
  perform cdtest_perg.check(
    (select count(*) from public.list_public_questions('todas', null, null, 500)) <= 50,
    'limite máximo de 50 por página');
  perform cdtest_perg.throws($q$select * from public.list_public_questions('qualquer')$q$, '22023', 'filtro inválido');
  perform cdtest_perg.check((select count(*) from public.list_public_answers(cdtest_perg.get('q_pending')::uuid)) = 0,
    'pergunta pendente não expõe respostas');

  perform cdtest_perg.login('f3000000-0000-4000-8000-000000000002');
  perform cdtest_perg.check((select is_mine from public.list_public_answers(v_q1) where id = v_a_bia),
    'is_mine verdadeiro para a autora');
  perform cdtest_perg.throws(format($q$select public.set_public_answer_hidden(%L, true)$q$, v_a_ana),
    '42501', 'membra não oculta resposta');

  -- Moderação oculta: some da leitura pública e da contagem; reexibir volta.
  perform cdtest_perg.login('f3000000-0000-4000-8000-000000000004');
  perform cdtest_perg.check((select count(*) from public.public_answers where question_id = v_q1) = 2,
    'moderação lê todas as respostas');
  perform cdtest_perg.check(public.set_public_answer_hidden(v_a_bia, true, 'Fora do código de conduta'),
    'moderação oculta');
  perform cdtest_perg.check(not public.set_public_answer_hidden(v_a_bia, true), 'ocultar de novo não muda nada');
  perform cdtest_perg.check(
    (select a.is_hidden and a.hidden_at is not null and a.hidden_by = 'f3000000-0000-4000-8000-000000000004'
     from cdtest_perg.answer(v_a_bia) a),
    'ocultação grava data e quem ocultou');
  perform cdtest_perg.throws('select hidden_by from public.public_answers', '42501',
    'nem a moderação lê hidden_by pela API (quem agiu fica no registro)');

  -- A autora vê que a resposta dela foi ocultada (para poder apagar), mas não por quem.
  perform cdtest_perg.login('f3000000-0000-4000-8000-000000000002');
  perform cdtest_perg.check(
    (select is_hidden and hidden_at is not null from public.public_answers where id = v_a_bia),
    'a autora vê que a própria resposta está oculta');
  perform cdtest_perg.login('f3000000-0000-4000-8000-000000000004');
  perform cdtest_perg.check(cdtest_perg.audit_count('hide_answer', 'public_answer', v_a_bia) = 1,
    'ocultação registrada (uma vez)');

  perform cdtest_perg.login_anon();
  perform cdtest_perg.check(not exists (select 1 from public.list_public_answers(v_q1) where id = v_a_bia),
    'resposta oculta some da leitura pública');
  perform cdtest_perg.check(
    (select answer_count from public.list_public_questions('todas') where id = v_q1) = 1,
    'contagem ignora respostas ocultas');

  perform cdtest_perg.login('f3000000-0000-4000-8000-000000000004');
  perform cdtest_perg.check(public.set_public_answer_hidden(v_a_bia, false), 'moderação reexibe');
  perform cdtest_perg.check(cdtest_perg.audit_count('unhide_answer', 'public_answer', v_a_bia) = 1,
    'reexibição registrada');
  perform cdtest_perg.check(
    (select not a.is_hidden and a.hidden_at is null and a.hidden_by is null from cdtest_perg.answer(v_a_bia) a),
    'reexibir limpa data e quem ocultou');
  perform cdtest_perg.throws(format($q$select public.set_public_answer_hidden(%L, true)$q$, gen_random_uuid()),
    'CD015', 'resposta inexistente');
  perform cdtest_perg.logout();
end
$$;
select pass('leitura pública: nome só com show_identity, sem author_id, ocultas fora da lista e da contagem');

-- =============================================================================
-- 7b. Moderação remove de vez (pergunta publicada que identifica a estudante, ou pedido dela)
-- =============================================================================
do $$
declare
  v_q uuid;
  v_a uuid;
begin
  -- Pergunta publicada e uma resposta, como contexto confiável.
  insert into public.public_questions (body, status, tracking_token_hash, reviewed_at, published_at)
  values ('Pergunta publicada por engano com o nome da escola da estudante.', 'published',
          repeat('b', 64), now(), now())
  returning id into v_q;
  insert into public.public_answers (question_id, author_id, body)
  values (v_q, 'f3000000-0000-4000-8000-000000000001', 'Uma resposta que vai embora junto com a pergunta.')
  returning id into v_a;

  perform cdtest_perg.login_anon();
  perform cdtest_perg.throws(format($q$select public.remove_public_question(%L, 'Identifica a estudante.')$q$, v_q),
    '42501', 'visitante não remove');
  perform cdtest_perg.login('f3000000-0000-4000-8000-000000000002');
  perform cdtest_perg.throws(format($q$select public.remove_public_question(%L, 'Identifica a estudante.')$q$, v_q),
    '42501', 'membra não remove', 'Só a moderação pode remover perguntas.');

  perform cdtest_perg.login('f3000000-0000-4000-8000-000000000004');
  perform cdtest_perg.throws(format($q$select public.remove_public_question(%L, '  curto  ')$q$, v_q),
    '22023', 'motivo curto demais', 'Explique o motivo da remoção%');
  perform public.remove_public_question(v_q, '  Tinha o nome da escola: pedido da estudante.  ');
  perform cdtest_perg.check((cdtest_perg.question(v_q)).id is null, 'a pergunta some');
  perform cdtest_perg.check((cdtest_perg.answer(v_a)).id is null, 'as respostas vão junto (cascata)');
  perform cdtest_perg.check(cdtest_perg.audit_count('delete_content', 'public_question', v_q) = 1,
    'remoção registrada como delete_content');
  perform cdtest_perg.check(
    cdtest_perg.audit_reason('delete_content', 'public_question', v_q) = 'Tinha o nome da escola: pedido da estudante.',
    'o motivo vai para o registro, sem espaços nas pontas');
  perform cdtest_perg.throws(format($q$select public.remove_public_question(%L, 'Tinha o nome da escola.')$q$, v_q),
    'CD015', 'remover de novo: não encontrada');
  perform cdtest_perg.logout();
end
$$;
select pass('moderação remove de vez: visitante e membra → 42501; motivo obrigatório; cascata e registro');

-- =============================================================================
-- 8. Acompanhamento e exclusão pelo link (as respostas vão junto)
-- =============================================================================
do $$
declare
  v_q1 uuid := cdtest_perg.get('q1')::uuid;
  v_token text := cdtest_perg.get('q1_token');
begin
  perform cdtest_perg.login_anon();
  perform cdtest_perg.check(
    (select s.status = 'published' and s.question_id = v_q1 and s.answer_count = 2 and s.reject_reason is null
     from public.get_public_question_status(v_token) s),
    'acompanhamento: publicada, com id e 2 respostas');
  perform cdtest_perg.check(not exists (select 1 from public.get_public_question_status('curto')),
    'token em formato inválido: nenhuma linha');
  perform cdtest_perg.check(not exists (select 1 from public.get_public_question_status(repeat('A', 32))),
    'token desconhecido: nenhuma linha');
  perform cdtest_perg.check(not public.delete_public_question_by_token('curto'), 'apagar com token inválido: false');
  perform cdtest_perg.check(not public.delete_public_question_by_token(repeat('A', 32)), 'apagar com token desconhecido: false');

  perform cdtest_perg.check(public.delete_public_question_by_token(v_token), 'quem tem o link apaga a pergunta');
  perform cdtest_perg.logout();
  perform cdtest_perg.check((cdtest_perg.question(v_q1)).id is null, 'a pergunta some');
  perform cdtest_perg.check(cdtest_perg.answers_of(v_q1) = 0, 'as respostas vão junto (cascata)');
  perform cdtest_perg.login_anon();
  perform cdtest_perg.check(not exists (select 1 from public.get_public_question_status(v_token)),
    'depois de apagada, o link não mostra mais nada');
  perform cdtest_perg.logout();
end
$$;
select pass('link de acompanhamento: andamento, formato inválido sem consulta e exclusão em cascata');

-- =============================================================================
-- 9. Higiene das funções novas
-- =============================================================================
do $$
declare
  v_missing text;
begin
  select string_agg(p.oid::regprocedure::text, ', ') into v_missing
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where (n.nspname = 'public' and p.proname in ('submit_public_question', 'get_public_question_status',
           'delete_public_question_by_token', 'list_public_questions', 'list_public_answers',
           'review_public_question', 'set_public_answer_hidden', 'remove_public_question',
           'list_pending_public_questions')
         or n.nspname = 'private' and p.proname in ('detect_personal_data', 'public_answers_before_insert'))
    and (not p.prosecdef and p.proname <> 'detect_personal_data'
         or not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) cfg where cfg = 'search_path=""'));
  perform cdtest_perg.check(v_missing is null, format('funções sem SECURITY DEFINER ou search_path vazio: %s', v_missing));

  perform cdtest_perg.check(
    not has_function_privilege('anon', 'public.review_public_question(uuid, text, text)', 'execute')
    and not has_function_privilege('anon', 'public.set_public_answer_hidden(uuid, boolean, text)', 'execute')
    and not has_function_privilege('anon', 'public.remove_public_question(uuid, text)', 'execute')
    and not has_function_privilege('anon', 'public.list_pending_public_questions(integer)', 'execute')
    and has_function_privilege('anon', 'public.submit_public_question(text, text, smallint)', 'execute')
    and has_function_privilege('anon', 'public.list_public_answers(uuid)', 'execute')
    and not has_function_privilege('authenticated', 'private.detect_personal_data(text, boolean)', 'execute')
    and not has_function_privilege('authenticated', 'private.public_answers_before_insert()', 'execute'),
    'EXECUTE: visitante envia e lê; só a moderação revisa; funções privadas fechadas');
end
$$;
select pass('funções novas: SECURITY DEFINER com search_path vazio e EXECUTE explícito');

select * from finish();
rollback;
