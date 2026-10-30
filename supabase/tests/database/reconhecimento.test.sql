-- =============================================================================
-- Artemis — reconhecimento da mentoria (migration 20261028190000_mentorship_recognition.sql)
-- Mesmo formato de mentorship_messages.test.sql: blocos DO que simulam usuárias (papel +
-- request.jwt.claims, como o PostgREST), EXCEÇÃO na primeira expectativa quebrada, pass() por
-- grupo e ROLLBACK no fim. Dados próprios (usuárias f2…), sem depender do seed.
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
create schema cdtest_rec;
grant usage on schema cdtest_rec to anon, authenticated, service_role;

create function cdtest_rec.login(p_user uuid) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end
$$;

create function cdtest_rec.login_anon() returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"role": "anon"}', true);
  perform set_config('role', 'anon', true);
end
$$;

create function cdtest_rec.logout() returns void
language plpgsql as $$
begin
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', '', true);
end
$$;

-- Executa p_sql e exige que falhe com o SQLSTATE informado (NULL = qualquer erro) e, se
-- p_message_like vier, com uma mensagem que case com ele.
create function cdtest_rec.throws(p_sql text, p_errcode text, p_desc text, p_message_like text default null)
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

create function cdtest_rec.affected(p_sql text) returns bigint
language plpgsql as $$
declare
  n bigint;
begin
  execute p_sql;
  get diagnostics n = row_count;
  return n;
end
$$;

create function cdtest_rec.check(p_condition boolean, p_desc text) returns void
language plpgsql as $$
begin
  if p_condition is not true then
    raise exception 'FALHOU: %', p_desc;
  end if;
end
$$;

create function cdtest_rec.put(p_key text, p_value text) returns void
language sql as $$ select set_config('cdtest_rec.' || p_key, p_value, true); $$;

create function cdtest_rec.get(p_key text) returns text
language sql stable as $$ select nullif(current_setting('cdtest_rec.' || p_key, true), ''); $$;

create function cdtest_rec.uid(p_key text) returns uuid
language sql stable as $$ select cdtest_rec.get(p_key)::uuid; $$;

-- Retornos que a usuária logada enxerga (pelo RLS).
create function cdtest_rec.visible_feedback(p_request uuid) returns bigint
language sql stable as $$ select count(*) from public.mentorship_feedback where request_id = p_request; $$;

-- Declarações que a usuária logada enxerga (pelo RLS).
create function cdtest_rec.visible_declarations(p_request uuid) returns bigint
language sql stable as $$ select count(*) from public.mentorship_declarations where request_id = p_request; $$;

-- Linha de uma declaração, sem RLS (SECURITY DEFINER), para conferir o que o banco gravou.
create function cdtest_rec.declaration(p_id uuid) returns public.mentorship_declarations
language sql stable security definer set search_path = '' as $$
  select d from public.mentorship_declarations d where d.id = p_id;
$$;

-- Avisos de conclusão (sem RLS).
create function cdtest_rec.completion_notifications(p_user uuid, p_request uuid) returns bigint
language sql stable security definer set search_path = '' as $$
  select count(*) from public.notifications n
  where n.user_id = p_user and n.link = '/mentoria/concluida/' || p_request::text;
$$;

grant execute on all functions in schema cdtest_rec to anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Dados de teste (como postgres)
--   f2…01 Ana (mentoranda; mentoria concluída) · f2…02 Bia (mentora) · f2…03 Clara (de fora)
--   f2…04 Dora (moderadora) · f2…05 Eva (mentoranda; mentoria aceita, não concluída)
--   f2…06 Gil (admin) · f2…07…10 Hana, Iris, Jade, Kira (mentorandas para o impacto)
-- -----------------------------------------------------------------------------
insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, created_at, updated_at)
select '00000000-0000-0000-0000-000000000000', v.id, 'authenticated', 'authenticated', v.email,
  jsonb_build_object('full_name', v.full_name), now(), now()
from (values
  ('f2000000-0000-4000-8000-000000000001'::uuid, 'ana.rec@example.test', 'Ana Retorno'),
  ('f2000000-0000-4000-8000-000000000002', 'bia.rec@example.test', 'Bia Mentora'),
  ('f2000000-0000-4000-8000-000000000003', 'clara.rec@example.test', 'Clara Curiosa'),
  ('f2000000-0000-4000-8000-000000000004', 'dora.rec@example.test', 'Dora Moderadora'),
  ('f2000000-0000-4000-8000-000000000005', 'eva.rec@example.test', 'Eva Andamento'),
  ('f2000000-0000-4000-8000-000000000006', 'gil.rec@example.test', 'Gil Admin'),
  ('f2000000-0000-4000-8000-000000000007', 'hana.rec@example.test', 'Hana Impacto'),
  ('f2000000-0000-4000-8000-000000000008', 'iris.rec@example.test', 'Iris Impacto'),
  ('f2000000-0000-4000-8000-000000000009', 'jade.rec@example.test', 'Jade Impacto'),
  ('f2000000-0000-4000-8000-000000000010', 'kira.rec@example.test', 'Kira Impacto')
) as v (id, email, full_name);

update public.profiles set onboarded_at = now(), career_stage = 'undergraduate', seeks_mentorship = true
  where id::text like 'f2000000-0000-4000-8000-0000000000%'
    and id not in ('f2000000-0000-4000-8000-000000000002', 'f2000000-0000-4000-8000-000000000004',
                   'f2000000-0000-4000-8000-000000000006');
update public.profiles set onboarded_at = now(), career_stage = 'professor', is_mentor = true,
  mentor_available = true, mentor_capacity = 10,
  mentorship_topics = array['escrita-cientifica', 'pos-graduacao']
  where id = 'f2000000-0000-4000-8000-000000000002';
update public.profiles set onboarded_at = now(), role = 'moderator' where id = 'f2000000-0000-4000-8000-000000000004';
update public.profiles set onboarded_at = now(), role = 'admin' where id = 'f2000000-0000-4000-8000-000000000006';

-- Pedidos pelo fluxo real: a mentoranda pede, a mentora aceita (a de Ana é concluída na seção 2).
do $$
declare
  v_ana uuid;
  v_eva uuid;
begin
  perform cdtest_rec.login('f2000000-0000-4000-8000-000000000001');
  insert into public.mentorship_requests (mentor_id, message)
  values ('f2000000-0000-4000-8000-000000000002', 'Oi, Bia! Quero ajuda para planejar o mestrado.')
  returning id into v_ana;
  perform cdtest_rec.login('f2000000-0000-4000-8000-000000000005');
  insert into public.mentorship_requests (mentor_id, message)
  values ('f2000000-0000-4000-8000-000000000002', 'Oi, Bia! Posso contar com a sua mentoria?')
  returning id into v_eva;
  perform cdtest_rec.login('f2000000-0000-4000-8000-000000000002');
  update public.mentorship_requests set status = 'accepted' where id in (v_ana, v_eva);
  perform cdtest_rec.logout();

  perform cdtest_rec.put('ana', v_ana::text);
  perform cdtest_rec.put('eva', v_eva::text);
end
$$;

-- =============================================================================
-- 1. Estrutura: RLS, GRANTs por coluna, sem UPDATE/DELETE onde não deve
-- =============================================================================
do $$
begin
  perform cdtest_rec.check(
    (select relrowsecurity from pg_class where oid = 'public.mentorship_feedback'::regclass)
    and (select relrowsecurity from pg_class where oid = 'public.mentorship_declarations'::regclass),
    'RLS ligado nas duas tabelas');

  -- Retorno: lê e apaga o próprio; insere só as colunas do formulário; nada de UPDATE.
  perform cdtest_rec.check(
    has_table_privilege('authenticated', 'public.mentorship_feedback', 'select')
    and has_table_privilege('authenticated', 'public.mentorship_feedback', 'delete')
    and not has_table_privilege('authenticated', 'public.mentorship_feedback', 'update')
    and not has_table_privilege('authenticated', 'public.mentorship_feedback', 'insert'),
    'retorno: SELECT e DELETE; INSERT só por coluna; sem UPDATE');
  perform cdtest_rec.check(
    has_column_privilege('authenticated', 'public.mentorship_feedback', 'request_id', 'insert')
    and has_column_privilege('authenticated', 'public.mentorship_feedback', 'helpfulness', 'insert')
    and has_column_privilege('authenticated', 'public.mentorship_feedback', 'outcomes', 'insert')
    and has_column_privilege('authenticated', 'public.mentorship_feedback', 'would_recommend', 'insert')
    and has_column_privilege('authenticated', 'public.mentorship_feedback', 'note', 'insert')
    and not has_column_privilege('authenticated', 'public.mentorship_feedback', 'author_id', 'insert')
    and not has_column_privilege('authenticated', 'public.mentorship_feedback', 'role', 'insert')
    and not has_column_privilege('authenticated', 'public.mentorship_feedback', 'created_at', 'insert'),
    'retorno: INSERT só de request_id, helpfulness, outcomes, would_recommend e note');

  -- Declaração: lê; insere só request_id; nada de UPDATE/DELETE.
  perform cdtest_rec.check(
    has_table_privilege('authenticated', 'public.mentorship_declarations', 'select')
    and not has_table_privilege('authenticated', 'public.mentorship_declarations', 'update')
    and not has_table_privilege('authenticated', 'public.mentorship_declarations', 'delete')
    and has_column_privilege('authenticated', 'public.mentorship_declarations', 'request_id', 'insert')
    and not has_column_privilege('authenticated', 'public.mentorship_declarations', 'code', 'insert')
    and not has_column_privilege('authenticated', 'public.mentorship_declarations', 'issued_at', 'insert')
    and not has_column_privilege('authenticated', 'public.mentorship_declarations', 'mentor_consented_at', 'insert'),
    'declaração: SELECT; INSERT só de request_id; sem UPDATE nem DELETE');

  perform cdtest_rec.check(
    not has_table_privilege('anon', 'public.mentorship_feedback', 'select')
    and not has_table_privilege('anon', 'public.mentorship_declarations', 'select'),
    'visitante não lê as tabelas');

  -- completed_at: legível pelas participantes, mas sem escrita para membras.
  perform cdtest_rec.check(
    not has_column_privilege('authenticated', 'public.mentorship_requests', 'completed_at', 'update')
    and not has_column_privilege('authenticated', 'public.mentorship_requests', 'completed_at', 'insert'),
    'completed_at sem INSERT/UPDATE para membras');

  -- RPCs: verificação e impacto são públicos; autorizar/revogar só para membras.
  perform cdtest_rec.check(
    has_function_privilege('anon', 'public.verify_mentorship_declaration(text)', 'execute')
    and has_function_privilege('anon', 'public.get_mentorship_impact()', 'execute')
    and not has_function_privilege('anon', 'public.consent_mentorship_declaration(uuid)', 'execute')
    and not has_function_privilege('anon', 'public.revoke_mentorship_declaration(uuid, text)', 'execute')
    and has_function_privilege('authenticated', 'public.consent_mentorship_declaration(uuid)', 'execute')
    and has_function_privilege('authenticated', 'public.revoke_mentorship_declaration(uuid, text)', 'execute'),
    'EXECUTE: verificar/impacto para todas; autorizar/revogar só para membras');

  perform cdtest_rec.check(
    exists (select 1 from pg_indexes where schemaname = 'public'
            and indexname = 'mentorship_declarations_active_request_idx'
            and indexdef like '%WHERE (revoked_at IS NULL)%'),
    'índice único parcial: uma declaração ativa por mentoria');
end
$$;
select pass('estrutura: RLS, GRANTs por coluna, sem UPDATE de retorno nem UPDATE/DELETE de declaração');

-- =============================================================================
-- 2. completed_at: carimbado na conclusão, imutável para membras
-- =============================================================================
do $$
declare
  v_req uuid := cdtest_rec.uid('ana');
  v_completed timestamptz;
begin
  perform cdtest_rec.check(
    (select completed_at from public.mentorship_requests where id = v_req) is null,
    'mentoria aceita ainda sem completed_at');

  perform cdtest_rec.login('f2000000-0000-4000-8000-000000000001');
  perform cdtest_rec.throws(
    format($q$update public.mentorship_requests set completed_at = now() - interval '1 year' where id = %L$q$, v_req),
    '42501', 'membra não escreve completed_at');

  -- A mentora conclui (fluxo real): completed_at = hora do servidor.
  perform cdtest_rec.login('f2000000-0000-4000-8000-000000000002');
  update public.mentorship_requests set status = 'completed' where id = v_req;
  select completed_at into v_completed from public.mentorship_requests where id = v_req;
  perform cdtest_rec.check(v_completed = now(), 'completed_at = now() na conclusão');
  perform cdtest_rec.throws(
    format($q$update public.mentorship_requests set completed_at = null where id = %L$q$, v_req),
    '42501', 'nem a mentora apaga completed_at');
  perform cdtest_rec.logout();

  -- O aviso de conclusão leva a outra participante direto para o retorno.
  perform cdtest_rec.check(
    cdtest_rec.completion_notifications('f2000000-0000-4000-8000-000000000001', v_req) = 1,
    'a mentoranda recebe o aviso com link para /mentoria/concluida/<pedido>');

  -- Contexto confiável (seed) pode ajustar a data; nos demais casos ela fica.
  update public.mentorship_requests set completed_at = now() - interval '3 days' where id = v_req;
  perform cdtest_rec.check(
    (select completed_at from public.mentorship_requests where id = v_req) = now() - interval '3 days',
    'contexto confiável ajusta a data de uma mentoria concluída');
  update public.mentorship_requests set completed_at = v_completed where id = v_req;

  -- Mudança de outra coluna (pela service role) não mexe em completed_at.
  update public.mentorship_requests set response_message = 'Foi ótimo!' where id = v_req;
  perform cdtest_rec.check(
    (select completed_at from public.mentorship_requests where id = v_req) = v_completed,
    'outras atualizações mantêm completed_at');
  -- Pedido que não está concluído não ganha completed_at.
  update public.mentorship_requests set completed_at = now() where id = cdtest_rec.uid('eva');
  perform cdtest_rec.check(
    (select completed_at from public.mentorship_requests where id = cdtest_rec.uid('eva')) is null,
    'mentoria aceita não ganha completed_at');
end
$$;
select pass('completed_at: carimbado na conclusão (hora do servidor), sem escrita para membras');

-- =============================================================================
-- 3. Retorno privado
-- =============================================================================
do $$
declare
  v_req uuid := cdtest_rec.uid('ana');
  v_row public.mentorship_feedback%rowtype;
  v_viewer uuid;
begin
  -- A mentoranda envia (opções repetidas viram uma; nota sem espaços nas pontas).
  perform cdtest_rec.login('f2000000-0000-4000-8000-000000000001');
  insert into public.mentorship_feedback (request_id, helpfulness, outcomes, would_recommend, note)
  values (v_req, 5, array['menos-sozinha', 'plano-definido', 'menos-sozinha'], true, '  Saí com um plano.  ')
  returning * into v_row;
  perform cdtest_rec.check(v_row.author_id = 'f2000000-0000-4000-8000-000000000001', 'author_id = auth.uid()');
  perform cdtest_rec.check(v_row.role = 'mentee', 'papel vem do pedido (mentee)');
  perform cdtest_rec.check(v_row.outcomes = array['menos-sozinha', 'plano-definido'], 'opções sem repetição');
  perform cdtest_rec.check(v_row.note = 'Saí com um plano.', 'nota aparada');
  perform cdtest_rec.check(v_row.created_at = now(), 'created_at do servidor');

  perform cdtest_rec.throws(
    format($q$insert into public.mentorship_feedback (request_id, helpfulness) values (%L, 4)$q$, v_req),
    'CD032', 'segundo retorno da mesma pessoa é recusado', 'Você já contou como foi esta mentoria%');
  perform cdtest_rec.throws(
    format($q$insert into public.mentorship_feedback (request_id, helpfulness, created_at) values (%L, 4, now() - interval '1 year')$q$, v_req),
    '42501', 'created_at não é enviado pela cliente');

  -- Autoria: a coluna nem é gravável pela API (42501)...
  perform cdtest_rec.throws(
    format($q$insert into public.mentorship_feedback (request_id, author_id, helpfulness) values (%L, 'f2000000-0000-4000-8000-000000000002', 5)$q$, v_req),
    '42501', 'author_id não é enviado pela cliente');
  perform cdtest_rec.logout();
  -- ...e, mesmo que fosse, o trigger recusa a falsificação (CD013).
  grant insert (author_id) on public.mentorship_feedback to authenticated;
  perform cdtest_rec.login('f2000000-0000-4000-8000-000000000001');
  perform cdtest_rec.throws(
    format($q$insert into public.mentorship_feedback (request_id, author_id, helpfulness) values (%L, 'f2000000-0000-4000-8000-000000000002', 5)$q$, v_req),
    'CD013', 'retorno em nome da outra participante é recusado', 'Autoria inválida%');
  perform cdtest_rec.logout();
  revoke insert (author_id) on public.mentorship_feedback from authenticated;

  -- De fora (ou pedido inexistente): o mesmo CD031.
  perform cdtest_rec.login('f2000000-0000-4000-8000-000000000003');
  perform cdtest_rec.throws(
    format($q$insert into public.mentorship_feedback (request_id, helpfulness) values (%L, 5)$q$, v_req),
    'CD031', 'quem não participa não envia retorno', 'Não encontramos esta mentoria.');
  perform cdtest_rec.throws(
    format($q$insert into public.mentorship_feedback (request_id, helpfulness) values (%L, 5)$q$, gen_random_uuid()),
    'CD031', 'pedido inexistente dá o mesmo erro', 'Não encontramos esta mentoria.');

  -- Mentoria aceita, ainda não concluída.
  perform cdtest_rec.login('f2000000-0000-4000-8000-000000000005');
  perform cdtest_rec.throws(
    format($q$insert into public.mentorship_feedback (request_id, helpfulness) values (%L, 5)$q$, cdtest_rec.uid('eva')),
    'CD030', 'retorno só depois da conclusão', 'Você poderá contar como foi quando a mentoria for concluída.');

  -- A mentora: opção da mentoranda (ou inexistente) é recusada; as dela valem.
  perform cdtest_rec.login('f2000000-0000-4000-8000-000000000002');
  perform cdtest_rec.throws(
    format($q$insert into public.mentorship_feedback (request_id, helpfulness, outcomes) values (%L, 5, array['menos-sozinha'])$q$, v_req),
    'CD033', 'opção de outro papel é recusada', 'Uma das opções escolhidas não existe mais%');
  perform cdtest_rec.throws(
    format($q$insert into public.mentorship_feedback (request_id, helpfulness, outcomes) values (%L, 5, array['opcao-inventada'])$q$, v_req),
    'CD033', 'opção inexistente é recusada');
  perform cdtest_rec.throws(
    format($q$insert into public.mentorship_feedback (request_id, helpfulness) values (%L, 6)$q$, v_req),
    '23514', 'nota de ajuda fora de 1–5');
  perform cdtest_rec.throws(
    format($q$insert into public.mentorship_feedback (request_id, helpfulness, note) values (%L, 5, %L)$q$, v_req, repeat('a', 501)),
    '23514', 'nota com mais de 500 caracteres');
  insert into public.mentorship_feedback (request_id, helpfulness, outcomes, would_recommend)
  values (v_req, 4, array['aprendi-tambem'], null)
  returning * into v_row;
  perform cdtest_rec.check(v_row.role = 'mentor', 'papel vem do pedido (mentor)');

  -- Só a autora lê: a outra participante vê só o próprio retorno.
  perform cdtest_rec.check(cdtest_rec.visible_feedback(v_req) = 1, 'a mentora vê só o próprio retorno');
  perform cdtest_rec.check(
    not exists (select 1 from public.mentorship_feedback where author_id = 'f2000000-0000-4000-8000-000000000001'),
    'a mentora não lê o retorno da mentoranda');
  perform cdtest_rec.check(
    cdtest_rec.affected(format($q$delete from public.mentorship_feedback where request_id = %L and author_id = 'f2000000-0000-4000-8000-000000000001'$q$, v_req)) = 0,
    'a mentora não apaga o retorno da mentoranda');
  perform cdtest_rec.throws(
    format($q$update public.mentorship_feedback set helpfulness = 1 where request_id = %L$q$, v_req),
    '42501', 'ninguém edita retorno');

  -- Nem moderação, nem admin, nem quem está de fora.
  foreach v_viewer in array array['f2000000-0000-4000-8000-000000000004', 'f2000000-0000-4000-8000-000000000006',
                                   'f2000000-0000-4000-8000-000000000003']::uuid[] loop
    perform cdtest_rec.login(v_viewer);
    perform cdtest_rec.check(cdtest_rec.visible_feedback(v_req) = 0,
      format('%s (moderação, admin ou de fora) não lê retornos', v_viewer));
    perform cdtest_rec.check((select count(*) from public.mentorship_feedback) = 0,
      format('%s não lê nenhum retorno', v_viewer));
  end loop;
  perform cdtest_rec.login_anon();
  perform cdtest_rec.throws('select * from public.mentorship_feedback', '42501', 'visitante não lê retornos');

  -- A autora lê e apaga o próprio (e pode enviar de novo depois).
  perform cdtest_rec.login('f2000000-0000-4000-8000-000000000001');
  perform cdtest_rec.check(cdtest_rec.visible_feedback(v_req) = 1, 'a mentoranda lê só o próprio retorno');
  perform cdtest_rec.check(
    cdtest_rec.affected(format($q$delete from public.mentorship_feedback where request_id = %L$q$, v_req)) = 1,
    'a autora apaga o próprio retorno');
  insert into public.mentorship_feedback (request_id, helpfulness, outcomes)
  values (v_req, 5, array['menos-sozinha', 'plano-definido']);
  perform cdtest_rec.logout();

  -- Sem o trigger, o RLS também barra quem está de fora e mentoria não concluída.
  alter table public.mentorship_feedback disable trigger mentorship_feedback_before_insert;
  perform cdtest_rec.login('f2000000-0000-4000-8000-000000000003');
  perform cdtest_rec.throws(
    format($q$insert into public.mentorship_feedback (request_id, helpfulness) values (%L, 5)$q$, v_req),
    '42501', 'RLS barra quem não participa');
  perform cdtest_rec.login('f2000000-0000-4000-8000-000000000005');
  perform cdtest_rec.throws(
    format($q$insert into public.mentorship_feedback (request_id, helpfulness) values (%L, 5)$q$, cdtest_rec.uid('eva')),
    '42501', 'RLS barra retorno de mentoria não concluída');
  perform cdtest_rec.logout();
  alter table public.mentorship_feedback enable trigger mentorship_feedback_before_insert;
end
$$;
select pass('retorno: uma vez por participante de mentoria concluída; só a autora lê (nem a outra, nem moderação, nem admin)');

-- =============================================================================
-- 4. Declaração: pedido com autorização de quem pede, emissão com a segunda, revogação
-- =============================================================================
do $$
declare
  v_req uuid := cdtest_rec.uid('ana');
  v_decl public.mentorship_declarations%rowtype;
  v_issued timestamptz;
  v_viewer uuid;
begin
  -- Quem está de fora não pede nem lê; mentoria não concluída não tem declaração.
  perform cdtest_rec.login('f2000000-0000-4000-8000-000000000003');
  perform cdtest_rec.throws(
    format($q$insert into public.mentorship_declarations (request_id) values (%L)$q$, v_req),
    'CD031', 'quem não participa não pede declaração', 'Não encontramos esta mentoria.');
  perform cdtest_rec.login('f2000000-0000-4000-8000-000000000005');
  perform cdtest_rec.throws(
    format($q$insert into public.mentorship_declarations (request_id) values (%L)$q$, cdtest_rec.uid('eva')),
    'CD030', 'mentoria não concluída não tem declaração');

  -- A mentoranda pede: a autorização DELA é carimbada; ainda não emitida.
  perform cdtest_rec.login('f2000000-0000-4000-8000-000000000001');
  perform cdtest_rec.throws(
    format($q$insert into public.mentorship_declarations (request_id, code) values (%L, 'ART-0000-0000-0000')$q$, v_req),
    '42501', 'o código não é enviado pela cliente');
  insert into public.mentorship_declarations (request_id) values (v_req) returning * into v_decl;
  perform cdtest_rec.check(v_decl.requested_by = 'f2000000-0000-4000-8000-000000000001', 'requested_by = quem pediu');
  perform cdtest_rec.check(v_decl.mentee_consented_at = now(), 'autorização da mentoranda carimbada');
  perform cdtest_rec.check(v_decl.mentor_consented_at is null, 'a mentora ainda não autorizou');
  perform cdtest_rec.check(v_decl.issued_at is null, 'não emitida com uma autorização só');
  perform cdtest_rec.check(
    v_decl.code ~ '^ART-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$',
    format('código no formato ART-XXXX-XXXX-XXXX Crockford (veio %s)', v_decl.code));
  perform cdtest_rec.put('decl', v_decl.id::text);
  perform cdtest_rec.put('code', v_decl.code);

  -- Ela não edita nem apaga direto.
  perform cdtest_rec.throws(
    format($q$update public.mentorship_declarations set issued_at = now() where id = %L$q$, v_decl.id),
    '42501', 'membra não emite por UPDATE');
  perform cdtest_rec.throws(
    format($q$delete from public.mentorship_declarations where id = %L$q$, v_decl.id),
    '42501', 'membra não apaga declaração');
  -- Autorizar de novo não muda nada.
  perform cdtest_rec.check(public.consent_mentorship_declaration(v_decl.id) is null, 'autorizar de novo é no-op');

  -- Pendente é invisível na verificação pública (igual a código inexistente).
  perform cdtest_rec.login_anon();
  perform cdtest_rec.check(
    (select count(*) from public.verify_mentorship_declaration(v_decl.code)) = 0,
    'código pendente: nenhuma linha');
  perform cdtest_rec.check(
    (select count(*) from public.verify_mentorship_declaration('ART-0000-0000-0000')) = 0,
    'código inexistente: nenhuma linha');
  perform cdtest_rec.check(
    (select count(*) from public.verify_mentorship_declaration('não é um código')) = 0
    and (select count(*) from public.verify_mentorship_declaration(null)) = 0
    and (select count(*) from public.verify_mentorship_declaration(repeat('A', 500))) = 0,
    'texto inválido: nenhuma linha');

  -- A outra participante vê; de fora, moderação e admin não.
  perform cdtest_rec.login('f2000000-0000-4000-8000-000000000002');
  perform cdtest_rec.check(cdtest_rec.visible_declarations(v_req) = 1, 'a mentora vê o pedido de declaração');
  foreach v_viewer in array array['f2000000-0000-4000-8000-000000000003', 'f2000000-0000-4000-8000-000000000004',
                                   'f2000000-0000-4000-8000-000000000006']::uuid[] loop
    perform cdtest_rec.login(v_viewer);
    perform cdtest_rec.check(cdtest_rec.visible_declarations(v_req) = 0,
      format('%s (de fora, moderação ou admin) não vê a declaração', v_viewer));
  end loop;
  perform cdtest_rec.throws(
    format($q$select public.consent_mentorship_declaration(%L)$q$, cdtest_rec.uid('decl')),
    'CD031', 'quem não participa não autoriza', 'Não encontramos esta mentoria.');
  perform cdtest_rec.throws(
    format($q$select public.revoke_mentorship_declaration(%L)$q$, cdtest_rec.uid('decl')),
    'CD031', 'quem não participa não revoga');

  -- Segunda declaração ativa: recusada (inclusive pela outra participante).
  perform cdtest_rec.login('f2000000-0000-4000-8000-000000000002');
  perform cdtest_rec.throws(
    format($q$insert into public.mentorship_declarations (request_id) values (%L)$q$, v_req),
    'CD034', 'uma declaração ativa por mentoria', 'Já existe uma declaração para esta mentoria.');

  -- A mentora autoriza: emitida.
  v_issued := public.consent_mentorship_declaration(cdtest_rec.uid('decl'));
  perform cdtest_rec.check(v_issued = now(), 'emitida com a segunda autorização');
  v_decl := cdtest_rec.declaration(cdtest_rec.uid('decl'));
  perform cdtest_rec.check(v_decl.mentor_consented_at = now() and v_decl.issued_at = now(),
    'autorização da mentora e emissão carimbadas');
  perform cdtest_rec.logout();
end
$$;
select pass('declaração: quem pede autoriza; emitida só com as duas; de fora não vê nem age; uma ativa por vez (CD034)');

-- =============================================================================
-- 5. Verificação pública: válida, normalização do código, revogada sem nomes
-- =============================================================================
do $$
declare
  v_code text := cdtest_rec.get('code');
  v_row record;
  v_columns text;
  v_typed text;
begin
  perform cdtest_rec.login_anon();
  select * into v_row from public.verify_mentorship_declaration(v_code);
  perform cdtest_rec.check(v_row.status = 'valida', 'válida depois da emissão');
  perform cdtest_rec.check(v_row.mentee_name = 'Ana Retorno' and v_row.mentor_name = 'Bia Mentora', 'nomes das duas');
  perform cdtest_rec.check(v_row.themes = array['escrita-cientifica', 'pos-graduacao'], 'temas da mentora (slugs)');
  perform cdtest_rec.check(
    v_row.period_start = date_trunc('month', now() at time zone 'America/Sao_Paulo')::date
    and v_row.period_end = date_trunc('month', now() at time zone 'America/Sao_Paulo')::date,
    'período em meses (fuso de São Paulo)');
  perform cdtest_rec.check(v_row.issued_at = now(), 'emitida em');

  -- Exatamente as 7 colunas públicas (nada de ids, e-mails, instituição, mensagens ou retornos).
  select string_agg(a.name, ',' order by a.ord) into v_columns
  from pg_proc p,
    unnest(p.proargnames, p.proargmodes::text[]) with ordinality as a (name, mode, ord)
  where p.oid = 'public.verify_mentorship_declaration(text)'::regprocedure and a.mode = 't';
  perform cdtest_rec.check(
    v_columns = 'status,mentee_name,mentor_name,period_start,period_end,themes,issued_at',
    format('7 colunas públicas (veio %s)', v_columns));

  -- Quem digita: minúsculas, espaços, sem prefixo, O no lugar de 0 e I/L no lugar de 1.
  v_typed := translate(lower(replace(v_code, '-', ' ')), '01', 'ol');
  perform cdtest_rec.check(
    (select status from public.verify_mentorship_declaration(v_typed)) = 'valida',
    format('código digitado como "%s" é encontrado', v_typed));
  perform cdtest_rec.check(
    (select status from public.verify_mentorship_declaration(substr(v_code, 5))) = 'valida',
    'código sem o prefixo ART é encontrado');
  perform cdtest_rec.logout();
  perform cdtest_rec.check(
    private.normalize_declaration_code(' art oil0-7k2m q9xd ') = 'ART-0110-7K2M-Q9XD'
    and private.normalize_declaration_code('oil07k2mq9xd') = 'ART-0110-7K2M-Q9XD'
    and private.normalize_declaration_code('ART-UUUU-0000-0000') is null
    and private.normalize_declaration_code('ART-0000-0000') is null,
    'normalização: O→0, I/L→1; U não existe no alfabeto; tamanho errado não vale');

  -- Revogação: qualquer das duas, uma vez; depois, nem autorizar.
  perform cdtest_rec.login('f2000000-0000-4000-8000-000000000001');
  perform public.revoke_mentorship_declaration(cdtest_rec.uid('decl'), '  Prefiro tirar meu nome.  ');
  perform cdtest_rec.check(
    (cdtest_rec.declaration(cdtest_rec.uid('decl'))).revoked_by = 'f2000000-0000-4000-8000-000000000001'
    and (cdtest_rec.declaration(cdtest_rec.uid('decl'))).revoke_reason = 'Prefiro tirar meu nome.',
    'quem revogou e o motivo (aparado)');
  perform cdtest_rec.throws(
    format($q$select public.revoke_mentorship_declaration(%L)$q$, cdtest_rec.uid('decl')),
    'CD035', 'revogar duas vezes', 'Esta declaração já foi revogada.');
  perform cdtest_rec.login('f2000000-0000-4000-8000-000000000002');
  perform cdtest_rec.throws(
    format($q$select public.consent_mentorship_declaration(%L)$q$, cdtest_rec.uid('decl')),
    'CD035', 'autorizar declaração revogada', 'Esta declaração foi revogada%');

  perform cdtest_rec.login_anon();
  select * into v_row from public.verify_mentorship_declaration(v_code);
  perform cdtest_rec.check(v_row.status = 'revogada', 'revogada na verificação');
  perform cdtest_rec.check(
    v_row.mentee_name is null and v_row.mentor_name is null and v_row.themes is null
    and v_row.period_start is null and v_row.period_end is null,
    'revogada: sem nomes, temas nem período');
  perform cdtest_rec.logout();

  -- Nem a service role reescreve o que foi registrado.
  perform cdtest_rec.throws(
    format($q$update public.mentorship_declarations set revoked_at = null where id = %L$q$, cdtest_rec.uid('decl')),
    'CD037', 'revogação não volta atrás', 'A declaração não pode ser editada%');
  perform cdtest_rec.throws(
    format($q$update public.mentorship_declarations set code = 'ART-0000-0000-0000' where id = %L$q$, cdtest_rec.uid('decl')),
    'CD037', 'código é definitivo');
end
$$;
select pass('verificação: válida com 7 colunas; normaliza o código; revogada sem nomes; revogação única (CD035)');

-- =============================================================================
-- 6. Nova declaração depois de revogar; limite de 5 pedidos por mentoria (CD036)
-- =============================================================================
do $$
declare
  v_req uuid := cdtest_rec.uid('ana');
  v_decl public.mentorship_declarations%rowtype;
  i integer;
begin
  perform cdtest_rec.login('f2000000-0000-4000-8000-000000000002');
  insert into public.mentorship_declarations (request_id) values (v_req) returning * into v_decl;
  perform cdtest_rec.check(
    v_decl.mentor_consented_at = now() and v_decl.mentee_consented_at is null,
    'depois da revogação, um pedido novo (autorização da mentora carimbada)');
  perform cdtest_rec.check(v_decl.code <> cdtest_rec.get('code'), 'código novo');
  -- Pedido pendente cancelado (revogado antes de emitir) também libera um novo.
  perform public.revoke_mentorship_declaration(v_decl.id);
  for i in 1..2 loop
    insert into public.mentorship_declarations (request_id) values (v_req) returning * into v_decl;
    perform public.revoke_mentorship_declaration(v_decl.id);
  end loop;
  -- 5 no total (1 da seção 4 + 4 aqui).
  insert into public.mentorship_declarations (request_id) values (v_req) returning * into v_decl;
  perform public.revoke_mentorship_declaration(v_decl.id);
  perform cdtest_rec.throws(
    format($q$insert into public.mentorship_declarations (request_id) values (%L)$q$, v_req),
    'CD036', 'sexto pedido para a mesma mentoria', 'Esta mentoria já teve 5 pedidos de declaração%');
  perform cdtest_rec.logout();
end
$$;
select pass('declaração: nova depois de revogar; no máximo 5 pedidos por mentoria (CD036)');

-- =============================================================================
-- 7. Impacto agregado: nada de resultados com menos de 5 retornos de mentorandas
-- =============================================================================
do $$
declare
  v_impact jsonb;
  v_user uuid;
  v_req uuid;
  i integer := 0;
begin
  -- Só os retornos deste teste contam (o ROLLBACK devolve os do seed).
  delete from public.mentorship_feedback where author_id::text not like 'f2000000-%';

  -- Mais 4 mentorias concluídas, cada uma com o retorno da mentoranda (Ana já tem 1).
  foreach v_user in array array['f2000000-0000-4000-8000-000000000007', 'f2000000-0000-4000-8000-000000000008',
                                'f2000000-0000-4000-8000-000000000009', 'f2000000-0000-4000-8000-000000000010']::uuid[] loop
    i := i + 1;
    perform cdtest_rec.login(v_user);
    insert into public.mentorship_requests (mentor_id, message)
    values ('f2000000-0000-4000-8000-000000000002', 'Oi, Bia! Quero conversar sobre a minha pesquisa.')
    returning id into v_req;
    perform cdtest_rec.login('f2000000-0000-4000-8000-000000000002');
    update public.mentorship_requests set status = 'accepted' where id = v_req;
    update public.mentorship_requests set status = 'completed' where id = v_req;

    if i = 4 then
      -- Com 4 retornos de mentorandas (+ 1 da mentora, que não conta): nada de resultados.
      perform cdtest_rec.login_anon();
      v_impact := public.get_mentorship_impact();
      perform cdtest_rec.check((v_impact ->> 'mentee_feedback')::int = 4, format('4 retornos (veio %s)', v_impact));
      perform cdtest_rec.check(
        v_impact -> 'outcomes' = 'null'::jsonb and v_impact -> 'helpfulness_avg' = 'null'::jsonb,
        'com menos de 5 retornos: outcomes e helpfulness_avg nulos');
      perform cdtest_rec.check((v_impact ->> 'k_min')::int = 5, 'k_min = 5');
    end if;

    perform cdtest_rec.login(v_user);
    -- Com o da Ana (menos-sozinha, plano-definido; nota 5): menos-sozinha 5, plano-definido 4,
    -- rede-ampliada 2, candidatura 2, iniciacao-cientifica 1, trabalho-apresentado 0; média 4,6.
    insert into public.mentorship_feedback (request_id, helpfulness, outcomes)
    values (v_req, case when i % 2 = 0 then 4 else 5 end, case i
      when 1 then array['menos-sozinha', 'plano-definido', 'rede-ampliada']
      when 2 then array['menos-sozinha', 'plano-definido', 'rede-ampliada']
      when 3 then array['menos-sozinha', 'plano-definido', 'candidatura']
      else array['menos-sozinha', 'iniciacao-cientifica', 'candidatura']
    end);
  end loop;

  perform cdtest_rec.login_anon();
  v_impact := public.get_mentorship_impact();
  perform cdtest_rec.logout();
  perform cdtest_rec.check((v_impact ->> 'mentee_feedback')::int = 5, format('5 retornos (veio %s)', v_impact));
  perform cdtest_rec.check(jsonb_array_length(v_impact -> 'outcomes') = 6, 'as 6 opções da mentoranda');
  perform cdtest_rec.check(
    (select (o ->> 'count')::int from jsonb_array_elements(v_impact -> 'outcomes') o where o ->> 'slug' = 'menos-sozinha') = 5
    and (select (o ->> 'count')::int from jsonb_array_elements(v_impact -> 'outcomes') o where o ->> 'slug' = 'plano-definido') = 4,
    'contagens de 3 ou mais aparecem');
  perform cdtest_rec.check(
    (select o -> 'count' from jsonb_array_elements(v_impact -> 'outcomes') o where o ->> 'slug' = 'candidatura') = 'null'::jsonb
    and (select o -> 'count' from jsonb_array_elements(v_impact -> 'outcomes') o where o ->> 'slug' = 'iniciacao-cientifica') = 'null'::jsonb
    and (select o -> 'count' from jsonb_array_elements(v_impact -> 'outcomes') o where o ->> 'slug' = 'trabalho-apresentado') = 'null'::jsonb,
    'contagens abaixo de 3 voltam nulas ("menos de 3")');
  perform cdtest_rec.check(
    not exists (select 1 from jsonb_array_elements(v_impact -> 'outcomes') o where o ->> 'slug' = 'aprendi-tambem'),
    'opções da mentora não entram no impacto das mentorandas');
  perform cdtest_rec.check((v_impact ->> 'helpfulness_avg')::numeric = 4.6, format('média 4,6 (veio %s)', v_impact ->> 'helpfulness_avg'));
  perform cdtest_rec.check(jsonb_typeof(v_impact -> 'is_demo') = 'boolean', 'is_demo booleano');
  perform cdtest_rec.check(
    v_impact ?& array['completed', 'mentee_feedback', 'published_feedback', 'outcomes', 'helpfulness_avg',
                      'declarations_issued', 'k_min', 'is_demo'],
    'formato do JSON');
  perform cdtest_rec.check((v_impact ->> 'published_feedback')::int = 5, 'os 5 retornos entram nos resultados');
end
$$;
select pass('impacto: resultados só com 5 retornos de mentorandas; células abaixo de 3 nulas');

-- =============================================================================
-- 7b. Impacto em blocos de 5: um retorno novo sozinho não muda os resultados (senão quem compara
--     o antes e o depois — ex.: a mentora — deduziria a nota e as opções da mentoranda dela)
-- =============================================================================
do $$
declare
  v_before jsonb;
  v_impact jsonb;
  v_user uuid;
  v_req uuid;
  i integer := 0;
begin
  perform cdtest_rec.logout();
  v_before := public.get_mentorship_impact();

  -- Mais 5 mentorias concluídas (contexto confiável, datas depois das 5 primeiras), cada uma com
  -- um retorno bem diferente: nota 1 e três opções que estavam abaixo de 3.
  foreach v_user in array array['f2000000-0000-4000-8000-000000000007', 'f2000000-0000-4000-8000-000000000008',
                                'f2000000-0000-4000-8000-000000000009', 'f2000000-0000-4000-8000-000000000010',
                                'f2000000-0000-4000-8000-000000000003']::uuid[] loop
    i := i + 1;
    insert into public.mentorship_requests (mentee_id, mentor_id, message)
    values (v_user, 'f2000000-0000-4000-8000-000000000002', 'Oi, Bia! Mais uma conversa sobre a minha pesquisa.')
    returning id into v_req;
    update public.mentorship_requests set status = 'accepted' where id = v_req;
    update public.mentorship_requests set status = 'completed' where id = v_req;
    insert into public.mentorship_feedback (request_id, author_id, helpfulness, outcomes, created_at)
    values (v_req, v_user, 1, array['trabalho-apresentado', 'iniciacao-cientifica', 'candidatura'],
            now() + make_interval(mins => i));

    if i < 5 then
      perform cdtest_rec.login_anon();
      v_impact := public.get_mentorship_impact();
      perform cdtest_rec.logout();
      perform cdtest_rec.check(
        (v_impact ->> 'mentee_feedback')::int = 5 + i and (v_impact ->> 'published_feedback')::int = 5,
        format('retorno %s de um bloco incompleto: conta no total, não nos resultados (veio %s)', 5 + i, v_impact));
      perform cdtest_rec.check(
        v_impact -> 'outcomes' = v_before -> 'outcomes'
        and v_impact -> 'helpfulness_avg' = v_before -> 'helpfulness_avg',
        format('resultados iguais aos de antes com %s retornos', 5 + i));
    end if;
  end loop;

  -- Bloco completo (10): entram os 5 novos de uma vez.
  perform cdtest_rec.login_anon();
  v_impact := public.get_mentorship_impact();
  perform cdtest_rec.logout();
  perform cdtest_rec.check(
    (v_impact ->> 'mentee_feedback')::int = 10 and (v_impact ->> 'published_feedback')::int = 10,
    format('10 retornos: bloco completo (veio %s)', v_impact));
  perform cdtest_rec.check((v_impact ->> 'helpfulness_avg')::numeric = 2.8,
    format('média com os 10: 2,8 (veio %s)', v_impact ->> 'helpfulness_avg'));
  perform cdtest_rec.check(
    (select (o ->> 'count')::int from jsonb_array_elements(v_impact -> 'outcomes') o where o ->> 'slug' = 'candidatura') = 7
    and (select (o ->> 'count')::int from jsonb_array_elements(v_impact -> 'outcomes') o where o ->> 'slug' = 'trabalho-apresentado') = 5
    and (select o -> 'count' from jsonb_array_elements(v_impact -> 'outcomes') o where o ->> 'slug' = 'rede-ampliada') = 'null'::jsonb,
    'contagens do bloco de 10 (e rede-ampliada continua "menos de 3")');
end
$$;
select pass('impacto: resultados atualizados só em blocos de 5 retornos (sem dedução por diferença)');

-- =============================================================================
-- 8. LGPD: excluir a conta apaga mentoria, retornos, declarações e o aviso de conclusão
-- =============================================================================
do $$
declare
  v_req uuid := cdtest_rec.uid('ana');
begin
  perform cdtest_rec.check(
    exists (select 1 from public.mentorship_feedback where request_id = v_req)
    and exists (select 1 from public.mentorship_declarations where request_id = v_req),
    'há retornos e declarações antes da exclusão');
  -- Como se a Ana tivesse concluído: o aviso de conclusão ficou com a Bia.
  insert into public.notifications (user_id, type, title, body, link)
  values ('f2000000-0000-4000-8000-000000000002', 'mentorship_response', 'Mentoria concluída',
          'Obrigada!', '/mentoria/concluida/' || v_req::text);
  perform cdtest_rec.check(
    cdtest_rec.completion_notifications('f2000000-0000-4000-8000-000000000002', v_req) = 1,
    'a mentora tem o aviso de conclusão');
  perform cdtest_rec.check(
    (select count(*) from public.verify_mentorship_declaration(cdtest_rec.get('code'))) = 1,
    'o código antigo ainda responde (revogada)');

  delete from auth.users where id = 'f2000000-0000-4000-8000-000000000001';

  perform cdtest_rec.check(not exists (select 1 from public.mentorship_requests where id = v_req), 'pedido some');
  perform cdtest_rec.check(not exists (select 1 from public.mentorship_feedback where request_id = v_req),
    'retornos das duas somem');
  perform cdtest_rec.check(not exists (select 1 from public.mentorship_declarations where request_id = v_req),
    'declarações somem');
  perform cdtest_rec.check(
    (select count(*) from public.verify_mentorship_declaration(cdtest_rec.get('code'))) = 0,
    'o código passa a "não encontrada"');
  perform cdtest_rec.check(
    cdtest_rec.completion_notifications('f2000000-0000-4000-8000-000000000002', v_req) = 0,
    'nenhum aviso com link para a mentoria apagada');
end
$$;
select pass('LGPD: excluir a conta apaga a mentoria, os retornos, as declarações e o aviso de conclusão');

-- =============================================================================
-- 9. Higiene das funções novas
-- =============================================================================
do $$
declare
  v_missing text;
begin
  select string_agg(n.nspname || '.' || p.proname, ', ') into v_missing
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where (n.nspname, p.proname) in (
      ('private', 'mentorship_requests_set_completed_at'), ('private', 'mentorship_outcomes'),
      ('private', 'mentorship_feedback_before_insert'), ('private', 'declaration_code_alphabet'),
      ('private', 'new_declaration_code'), ('private', 'normalize_declaration_code'),
      ('private', 'mentorship_declarations_before_insert'), ('private', 'mentorship_declarations_before_update'),
      ('private', 'mentorship_requests_after_delete_recognition'), ('private', 'notify_mentorship_change'),
      ('public', 'consent_mentorship_declaration'), ('public', 'revoke_mentorship_declaration'),
      ('public', 'verify_mentorship_declaration'), ('public', 'get_mentorship_impact'))
    and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) cfg where cfg = 'search_path=""');
  perform cdtest_rec.check(v_missing is null, format('funções sem search_path vazio: %s', v_missing));

  select string_agg(p.proname, ', ') into v_missing
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'private'
    and p.proname in ('mentorship_requests_set_completed_at', 'mentorship_feedback_before_insert',
                      'new_declaration_code', 'normalize_declaration_code', 'declaration_code_alphabet',
                      'mentorship_declarations_before_insert', 'mentorship_declarations_before_update',
                      'mentorship_requests_after_delete_recognition')
    and (has_function_privilege('authenticated', p.oid, 'execute') or has_function_privilege('anon', p.oid, 'execute'));
  perform cdtest_rec.check(v_missing is null, format('funções privadas com EXECUTE para membras: %s', v_missing));
end
$$;
select pass('funções novas com search_path vazio e sem EXECUTE indevido');

select * from finish();
rollback;
