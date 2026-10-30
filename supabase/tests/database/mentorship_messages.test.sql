-- =============================================================================
-- Artemis — conversa da mentoria (migration 20261028181500_mentorship_messages.sql)
-- Mesmo formato de rls.test.sql: blocos DO que simulam usuárias (papel + request.jwt.claims,
-- como o PostgREST), EXCEÇÃO na primeira expectativa quebrada, pass() por grupo e ROLLBACK no
-- fim. Os dados são próprios (usuárias e8…), sem depender do seed.
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

-- Mensagens que a usuária logada enxerga numa conversa (pelo RLS).
create function cdtest.visible(p_request uuid) returns bigint
language sql stable as $$ select count(*) from public.mentorship_messages where request_id = p_request; $$;

-- Avisos de conversa (SECURITY DEFINER: conta tudo, sem RLS, mesmo com uma usuária logada).
create function cdtest.message_notifications(p_user uuid, p_request uuid, p_only_unread boolean default false)
returns bigint
language sql stable security definer set search_path = '' as $$
  select count(*) from public.notifications n
  where n.user_id = p_user
    and n.type = 'mentorship_message'
    and n.link = '/mentoria/conversa/' || p_request::text
    and (not p_only_unread or n.read_at is null);
$$;

grant execute on all functions in schema cdtest to anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Dados de teste (como postgres)
--   e8…01 Ana (mentoranda) · e8…02 Bia (mentora) · e8…03 Clara (outra membra)
--   e8…04 Dora (moderadora) · e8…05 Eva (mentoranda, mentoria que será concluída)
--   e8…06 Fê (mentoranda, pedido pendente)
-- -----------------------------------------------------------------------------
insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', 'e8000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
   'ana.conversa@example.test', '{"full_name": "Ana Conversa"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'e8000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated',
   'bia.conversa@example.test', '{"full_name": "Bia Mentora"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'e8000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated',
   'clara.conversa@example.test', '{"full_name": "Clara Curiosa"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'e8000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated',
   'dora.conversa@example.test', '{"full_name": "Dora Moderadora"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'e8000000-0000-4000-8000-000000000005', 'authenticated', 'authenticated',
   'eva.conversa@example.test', '{"full_name": "Eva Concluída"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'e8000000-0000-4000-8000-000000000006', 'authenticated', 'authenticated',
   'fe.conversa@example.test', '{"full_name": "Fê Pendente"}', now(), now());

update public.profiles set onboarded_at = now(), career_stage = 'undergraduate', seeks_mentorship = true
  where id in ('e8000000-0000-4000-8000-000000000001', 'e8000000-0000-4000-8000-000000000003',
               'e8000000-0000-4000-8000-000000000005', 'e8000000-0000-4000-8000-000000000006');
update public.profiles set onboarded_at = now(), career_stage = 'professor', is_mentor = true,
  mentor_available = true, mentor_capacity = 5
  where id = 'e8000000-0000-4000-8000-000000000002';
update public.profiles set onboarded_at = now(), role = 'moderator' where id = 'e8000000-0000-4000-8000-000000000004';

-- Pedidos pelo fluxo real: a mentoranda pede, a mentora aceita.
do $$
declare
  v_ana uuid;
  v_eva uuid;
  v_fe uuid;
begin
  perform cdtest.login('e8000000-0000-4000-8000-000000000001');
  insert into public.mentorship_requests (mentor_id, message)
  values ('e8000000-0000-4000-8000-000000000002', 'Oi, Bia! Quero ajuda com a minha iniciação científica.')
  returning id into v_ana;
  perform cdtest.login('e8000000-0000-4000-8000-000000000005');
  insert into public.mentorship_requests (mentor_id, message)
  values ('e8000000-0000-4000-8000-000000000002', 'Oi, Bia! Quero conversar sobre o mestrado.')
  returning id into v_eva;
  perform cdtest.login('e8000000-0000-4000-8000-000000000006');
  insert into public.mentorship_requests (mentor_id, message)
  values ('e8000000-0000-4000-8000-000000000002', 'Oi, Bia! Posso pedir sua mentoria?')
  returning id into v_fe;
  perform cdtest.login('e8000000-0000-4000-8000-000000000002');
  update public.mentorship_requests set status = 'accepted' where id in (v_ana, v_eva);
  perform cdtest.logout();

  perform cdtest.put('ana', v_ana);
  perform cdtest.put('eva', v_eva);
  perform cdtest.put('fe', v_fe);
end
$$;

-- =============================================================================
-- 1. Estrutura: RLS, GRANTs por coluna, sem DELETE para membras
-- =============================================================================
do $$
begin
  perform cdtest.check(
    (select relrowsecurity from pg_class where oid = 'public.mentorship_messages'::regclass),
    'RLS ligado em mentorship_messages');
  perform cdtest.check(
    has_table_privilege('authenticated', 'public.mentorship_messages', 'select')
    and not has_table_privilege('authenticated', 'public.mentorship_messages', 'delete')
    and not has_table_privilege('authenticated', 'public.mentorship_messages', 'insert')
    and not has_table_privilege('authenticated', 'public.mentorship_messages', 'update'),
    'membras: leitura; nada de INSERT/UPDATE na tabela inteira nem DELETE');
  perform cdtest.check(
    has_column_privilege('authenticated', 'public.mentorship_messages', 'body', 'insert')
    and has_column_privilege('authenticated', 'public.mentorship_messages', 'request_id', 'insert')
    and not has_column_privilege('authenticated', 'public.mentorship_messages', 'read_at', 'insert')
    and not has_column_privilege('authenticated', 'public.mentorship_messages', 'created_at', 'insert'),
    'INSERT só de request_id, sender_id e body');
  perform cdtest.check(
    has_column_privilege('authenticated', 'public.mentorship_messages', 'read_at', 'update')
    and not has_column_privilege('authenticated', 'public.mentorship_messages', 'body', 'update')
    and not has_column_privilege('authenticated', 'public.mentorship_messages', 'sender_id', 'update'),
    'UPDATE só de read_at');
  perform cdtest.check(
    not has_table_privilege('anon', 'public.mentorship_messages', 'select'),
    'visitante não lê');
  perform cdtest.check(
    exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'mentorship_messages_request_created_idx'),
    'índice (request_id, created_at)');
end
$$;
select pass('conversa: RLS, GRANTs por coluna (envio e leitura) e nenhum DELETE para membras');

-- =============================================================================
-- 2. Participantes conversam; quem está de fora não lê nem escreve
-- =============================================================================
do $$
declare
  v_req uuid := cdtest.get('ana');
  v_msg uuid;
  v_body text;
  v_created timestamptz;
begin
  perform cdtest.login('e8000000-0000-4000-8000-000000000001');
  insert into public.mentorship_messages (request_id, body)
  values (v_req, E'  Oi, Bia! Que bom começar.\n  ')
  returning id, body, created_at into v_msg, v_body, v_created;
  perform cdtest.check(v_body = 'Oi, Bia! Que bom começar.', 'o corpo é gravado sem espaços nas pontas');
  perform cdtest.check(v_created = now(), 'created_at vem do servidor');
  perform cdtest.throws(
    format($q$insert into public.mentorship_messages (request_id, body, created_at) values (%L, 'Antedatada', now() - interval '3 days')$q$, v_req),
    '42501', 'created_at não é enviado pela autora (não dá para antedatar)');
  perform cdtest.check(
    (select sender_id from public.mentorship_messages where id = v_msg) = 'e8000000-0000-4000-8000-000000000001',
    'sender_id = auth.uid() por padrão');
  perform cdtest.throws(format($q$insert into public.mentorship_messages (request_id, body) values (%L, %L)$q$, v_req, E' \n\t '),
    '23514', 'mensagem só com espaços é recusada');
  perform cdtest.throws(format($q$insert into public.mentorship_messages (request_id, body) values (%L, %L)$q$, v_req, repeat('a', 2001)),
    '23514', 'mensagem com mais de 2.000 caracteres é recusada');
  perform cdtest.throws(format($q$insert into public.mentorship_messages (request_id, body, read_at) values (%L, 'Já lida?', now())$q$, v_req),
    '42501', 'read_at não é enviado pela autora');
  perform cdtest.check(cdtest.visible(v_req) = 1, 'a mentoranda lê a própria mensagem');

  perform cdtest.login('e8000000-0000-4000-8000-000000000002');
  perform cdtest.check(cdtest.visible(v_req) = 1, 'a mentora lê a mensagem');
  insert into public.mentorship_messages (request_id, body) values (v_req, 'Oi, Ana! Vamos marcar o primeiro encontro?');
  perform cdtest.check(cdtest.visible(v_req) = 2, 'a mentora responde');

  -- Outra membra: não lê, não escreve, não descobre se o pedido existe.
  perform cdtest.login('e8000000-0000-4000-8000-000000000003');
  perform cdtest.check(cdtest.visible(v_req) = 0, 'outra membra não lê a conversa');
  perform cdtest.check((select count(*) from public.mentorship_messages) = 0, 'outra membra não lê nenhuma mensagem');
  perform cdtest.throws(format($q$insert into public.mentorship_messages (request_id, body) values (%L, 'Posso entrar?')$q$, v_req),
    'CD015', 'outra membra não escreve na conversa', 'Não encontramos esta conversa%');
  perform cdtest.throws(format($q$insert into public.mentorship_messages (request_id, body) values (%L, 'Existe?')$q$, gen_random_uuid()),
    'CD015', 'pedido inexistente dá o mesmo erro', 'Não encontramos esta conversa%');
  perform cdtest.check(cdtest.affected(format($q$update public.mentorship_messages set read_at = now() where request_id = %L$q$, v_req)) = 0,
    'outra membra não marca como lida');

  -- Moderação também não lê: a conversa é privada.
  perform cdtest.login('e8000000-0000-4000-8000-000000000004');
  perform cdtest.check(cdtest.visible(v_req) = 0, 'a moderação não lê conversas privadas');
  perform cdtest.throws(format($q$insert into public.mentorship_messages (request_id, body) values (%L, 'Moderação aqui')$q$, v_req),
    'CD015', 'a moderação não escreve na conversa');

  perform cdtest.login_anon();
  perform cdtest.throws('select * from public.mentorship_messages', '42501', 'visitante não lê mensagens');
  perform cdtest.logout();
end
$$;
select pass('conversa: as duas participantes leem e escrevem; outra membra, moderação e visitante não');

-- =============================================================================
-- 3. Autoria: ninguém envia em nome da outra
-- =============================================================================
do $$
declare
  v_req uuid := cdtest.get('ana');
begin
  perform cdtest.login('e8000000-0000-4000-8000-000000000001');
  perform cdtest.throws(
    format($q$insert into public.mentorship_messages (request_id, sender_id, body) values (%L, 'e8000000-0000-4000-8000-000000000002', 'Sou a Bia')$q$, v_req),
    'CD013', 'mentoranda não envia como a mentora', 'Autoria inválida%');
  perform cdtest.login('e8000000-0000-4000-8000-000000000003');
  perform cdtest.throws(
    format($q$insert into public.mentorship_messages (request_id, sender_id, body) values (%L, 'e8000000-0000-4000-8000-000000000001', 'Sou a Ana')$q$, v_req),
    'CD015', 'outra membra não envia como participante');
  perform cdtest.logout();

  -- Mesmo sem o trigger, o RLS barra a falsificação.
  alter table public.mentorship_messages disable trigger mentorship_messages_before_insert;
  perform cdtest.login('e8000000-0000-4000-8000-000000000001');
  perform cdtest.throws(
    format($q$insert into public.mentorship_messages (request_id, sender_id, body) values (%L, 'e8000000-0000-4000-8000-000000000002', 'Sou a Bia')$q$, v_req),
    '42501', 'RLS barra sender_id de outra pessoa');
  perform cdtest.login('e8000000-0000-4000-8000-000000000003');
  perform cdtest.throws(
    format($q$insert into public.mentorship_messages (request_id, body) values (%L, 'Sem trigger')$q$, v_req),
    '42501', 'RLS barra quem não participa');
  perform cdtest.logout();
  alter table public.mentorship_messages enable trigger mentorship_messages_before_insert;
end
$$;
select pass('conversa: envio só em nome próprio (trigger CD013 e, sem ele, o RLS)');

-- =============================================================================
-- 4. Só com a mentoria aceita: pendente não abre; concluída/cancelada ficam só leitura
-- =============================================================================
do $$
declare
  v_eva uuid := cdtest.get('eva');
  v_fe uuid := cdtest.get('fe');
begin
  perform cdtest.login('e8000000-0000-4000-8000-000000000006');
  perform cdtest.throws(format($q$insert into public.mentorship_messages (request_id, body) values (%L, 'Já posso falar?')$q$, v_fe),
    'CD027', 'pedido pendente ainda não tem conversa', 'A conversa abre quando a mentora aceitar%');

  perform cdtest.login('e8000000-0000-4000-8000-000000000005');
  insert into public.mentorship_messages (request_id, body) values (v_eva, 'Obrigada por tudo, Bia!');
  perform cdtest.login('e8000000-0000-4000-8000-000000000002');
  update public.mentorship_requests set status = 'completed' where id = v_eva;
  perform cdtest.throws(format($q$insert into public.mentorship_messages (request_id, body) values (%L, 'Mais uma coisa…')$q$, v_eva),
    'CD027', 'mentora não escreve depois da conclusão', 'Esta mentoria foi concluída%');
  perform cdtest.check(cdtest.visible(v_eva) = 1, 'a mentora continua lendo a conversa concluída');
  -- Ler (marcar como lida) continua valendo depois da conclusão.
  perform cdtest.check(cdtest.affected(format($q$update public.mentorship_messages set read_at = now() where request_id = %L$q$, v_eva)) = 1,
    'a mentora ainda marca como lida a mensagem da conversa concluída');

  perform cdtest.login('e8000000-0000-4000-8000-000000000005');
  perform cdtest.throws(format($q$insert into public.mentorship_messages (request_id, body) values (%L, 'Volta?')$q$, v_eva),
    'CD027', 'mentoranda não escreve depois da conclusão');
  perform cdtest.check(cdtest.visible(v_eva) = 1, 'a mentoranda continua lendo a conversa concluída');

  -- Cancelada (pela mentoranda) também fica só leitura.
  perform cdtest.login('e8000000-0000-4000-8000-000000000006');
  update public.mentorship_requests set status = 'cancelled' where id = v_fe;
  perform cdtest.throws(format($q$insert into public.mentorship_messages (request_id, body) values (%L, 'E agora?')$q$, v_fe),
    'CD027', 'conversa cancelada não recebe mensagens', 'Esta mentoria foi cancelada%');
  perform cdtest.logout();

  -- Sem o trigger, o RLS também exige o pedido aceito.
  alter table public.mentorship_messages disable trigger mentorship_messages_before_insert;
  perform cdtest.login('e8000000-0000-4000-8000-000000000005');
  perform cdtest.throws(format($q$insert into public.mentorship_messages (request_id, body) values (%L, 'Sem trigger')$q$, v_eva),
    '42501', 'RLS barra envio em mentoria concluída');
  perform cdtest.logout();
  alter table public.mentorship_messages enable trigger mentorship_messages_before_insert;
end
$$;
select pass('conversa: só com a mentoria aceita; concluída ou cancelada fica só para leitura');

-- =============================================================================
-- 5. Leitura: só quem recebeu marca; o texto nunca muda; a leitura não é desfeita
-- =============================================================================
do $$
declare
  v_req uuid := cdtest.get('ana');
  v_from_ana uuid;
  v_from_bia uuid;
  v_read timestamptz;
begin
  select id into v_from_ana from public.mentorship_messages
    where request_id = v_req and sender_id = 'e8000000-0000-4000-8000-000000000001' limit 1;
  select id into v_from_bia from public.mentorship_messages
    where request_id = v_req and sender_id = 'e8000000-0000-4000-8000-000000000002' limit 1;

  -- A autora não marca a própria mensagem como lida.
  perform cdtest.login('e8000000-0000-4000-8000-000000000001');
  perform cdtest.check(cdtest.affected(format($q$update public.mentorship_messages set read_at = now() where id = %L$q$, v_from_ana)) = 0,
    'a remetente não marca a própria mensagem como lida');
  perform cdtest.check((select read_at from public.mentorship_messages where id = v_from_ana) is null,
    'continua não lida');

  -- Quem recebeu marca como lida (hora do servidor, mesmo se mandar outra).
  perform cdtest.login('e8000000-0000-4000-8000-000000000002');
  perform cdtest.check(cdtest.affected(format($q$update public.mentorship_messages set read_at = '2001-01-01' where id = %L$q$, v_from_ana)) = 1,
    'a destinatária marca como lida');
  select read_at into v_read from public.mentorship_messages where id = v_from_ana;
  perform cdtest.check(v_read = now(), 'read_at é a hora do servidor');
  -- …mas não edita o texto nem desfaz a leitura.
  perform cdtest.throws(format($q$update public.mentorship_messages set body = 'Editado' where id = %L$q$, v_from_ana),
    '42501', 'a destinatária não edita o texto');
  perform cdtest.throws(format($q$update public.mentorship_messages set sender_id = 'e8000000-0000-4000-8000-000000000002' where id = %L$q$, v_from_ana),
    '42501', 'ninguém troca a autoria');
  update public.mentorship_messages set read_at = null where id = v_from_ana;
  perform cdtest.check((select read_at from public.mentorship_messages where id = v_from_ana) = v_read,
    'a leitura não volta a NULL');
  -- Nem apaga.
  perform cdtest.throws(format($q$delete from public.mentorship_messages where id = %L$q$, v_from_ana),
    '42501', 'participante não apaga mensagens');

  -- A remetente vê o recibo de leitura.
  perform cdtest.login('e8000000-0000-4000-8000-000000000001');
  perform cdtest.check((select read_at from public.mentorship_messages where id = v_from_ana) = v_read,
    'a remetente vê que a mensagem foi lida');
  perform cdtest.check(cdtest.affected(format($q$update public.mentorship_messages set read_at = now() where id = %L$q$, v_from_bia)) = 1,
    'a mentoranda marca como lida a mensagem da mentora');
  perform cdtest.logout();

  -- Defesa em profundidade: mesmo com mais permissões, o trigger só deixa read_at mudar.
  perform cdtest.throws(format($q$update public.mentorship_messages set body = 'Reescrito' where id = %L$q$, v_from_ana),
    'CD002', 'o trigger recusa editar o texto (inclusive pela service role)', 'As mensagens não podem ser editadas%');
end
$$;
select pass('conversa: recibo de leitura só pela destinatária; texto imutável; leitura não volta atrás; sem DELETE');

-- =============================================================================
-- 6. Avisos agrupados por conversa
-- =============================================================================
do $$
declare
  v_req uuid := cdtest.get('ana');
  v_ana constant uuid := 'e8000000-0000-4000-8000-000000000001';
  v_bia constant uuid := 'e8000000-0000-4000-8000-000000000002';
  v_title text;
  v_body text;
begin
  -- Os envios da seção 2 já geraram um aviso para cada uma.
  perform cdtest.check(cdtest.message_notifications(v_bia, v_req) = 1, 'a mentora recebeu um aviso');
  perform cdtest.check(cdtest.message_notifications(v_ana, v_req) = 1, 'a mentoranda recebeu um aviso');
  select title, body into v_title, v_body from public.notifications
    where user_id = v_bia and type = 'mentorship_message';
  perform cdtest.check(v_title = 'Nova mensagem de Ana Conversa', format('título do aviso (veio %s)', v_title));
  perform cdtest.check(position('Que bom começar' in coalesce(v_body, '')) = 0, 'o aviso não copia o texto da mensagem');

  -- Mais mensagens com o aviso ainda não lido → nenhum aviso novo.
  perform cdtest.login(v_ana);
  insert into public.mentorship_messages (request_id, body) values (v_req, 'Pode ser na terça?');
  insert into public.mentorship_messages (request_id, body) values (v_req, 'Ou na quinta, às 14h.');
  perform cdtest.check(cdtest.message_notifications(v_bia, v_req) = 1, 'mensagens seguidas não criam outro aviso');

  -- Leu o aviso → a próxima mensagem avisa de novo.
  perform cdtest.login(v_bia);
  update public.notifications set read_at = now() where user_id = v_bia and type = 'mentorship_message';
  perform cdtest.login(v_ana);
  insert into public.mentorship_messages (request_id, body) values (v_req, 'Confirmado então!');
  perform cdtest.check(cdtest.message_notifications(v_bia, v_req) = 2
    and cdtest.message_notifications(v_bia, v_req, true) = 1,
    'depois de ler o aviso, a próxima mensagem cria um novo');
  -- A remetente não recebe aviso das próprias mensagens.
  perform cdtest.check(cdtest.message_notifications(v_ana, v_req) = 1, 'quem envia não é avisada');
  perform cdtest.logout();

  perform cdtest.check(
    (select link from public.notifications where user_id = v_bia and type = 'mentorship_message' and read_at is null)
      = '/mentoria/conversa/' || v_req::text,
    'o aviso leva para /mentoria/conversa/<pedido>');
end
$$;
select pass('conversa: um aviso não lido por conversa (agrupado), com link para a conversa');

-- =============================================================================
-- 7. Anti-spam: 60 mensagens por hora (CD026); moderação sem limite
-- =============================================================================
do $$
declare
  v_req uuid := cdtest.get('ana');
  i integer;
begin
  delete from private.rate_limit_events;
  perform cdtest.login('e8000000-0000-4000-8000-000000000002');
  for i in 1..60 loop
    insert into public.mentorship_messages (request_id, body) values (v_req, format('Mensagem %s', i));
  end loop;
  perform cdtest.throws(format($q$insert into public.mentorship_messages (request_id, body) values (%L, 'A 61ª')$q$, v_req),
    'CD026', 'a 61ª mensagem na hora é recusada', 'Você enviou muitas mensagens na última hora%');
  perform cdtest.logout();
  perform cdtest.check(
    (select count(*) from private.rate_limit_events
     where user_id = 'e8000000-0000-4000-8000-000000000002' and action = 'mentorship_message') = 60,
    'o registro anti-spam conta só as 60 aceitas');
  -- A outra participante tem a própria cota.
  perform cdtest.login('e8000000-0000-4000-8000-000000000001');
  insert into public.mentorship_messages (request_id, body) values (v_req, 'Calma, Bia!');
  perform cdtest.logout();
end
$$;
select pass('conversa: limite de 60 mensagens por hora por pessoa (CD026)');

-- =============================================================================
-- 8. LGPD: excluir a conta leva a conversa e os avisos dela
-- =============================================================================
do $$
declare
  v_req uuid := cdtest.get('ana');
  v_bia constant uuid := 'e8000000-0000-4000-8000-000000000002';
  v_other_notifications bigint;
begin
  perform cdtest.check((select count(*) from public.mentorship_messages where request_id = v_req) > 0,
    'há mensagens antes da exclusão');
  perform cdtest.check(cdtest.message_notifications(v_bia, v_req) > 0, 'a mentora tem avisos desta conversa');
  select count(*) into v_other_notifications from public.notifications
    where user_id = v_bia and type <> 'mentorship_message';

  delete from auth.users where id = 'e8000000-0000-4000-8000-000000000001';

  perform cdtest.check(not exists (select 1 from public.mentorship_requests where id = v_req), 'o pedido some em cascata');
  perform cdtest.check((select count(*) from public.mentorship_messages where request_id = v_req) = 0,
    'as mensagens das duas somem em cascata');
  perform cdtest.check(
    not exists (select 1 from public.mentorship_messages where sender_id = 'e8000000-0000-4000-8000-000000000001'),
    'nenhuma mensagem da conta excluída sobra');
  perform cdtest.check(cdtest.message_notifications(v_bia, v_req) = 0,
    'os avisos desta conversa somem da caixa da mentora');
  perform cdtest.check(
    (select count(*) from public.notifications where user_id = v_bia and type <> 'mentorship_message') = v_other_notifications,
    'os outros avisos da mentora ficam');
  -- A conversa concluída com a Eva continua lá.
  perform cdtest.check((select count(*) from public.mentorship_messages where request_id = cdtest.get('eva')) = 1,
    'as outras conversas da mentora não são afetadas');
end
$$;
select pass('LGPD: excluir a conta apaga a conversa (das duas) e os avisos dela');

-- =============================================================================
-- 9. Higiene das funções novas
-- =============================================================================
do $$
declare
  v_missing text;
begin
  select string_agg(p.proname, ', ') into v_missing
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'private'
    and p.proname in ('mentorship_messages_before_insert', 'mentorship_messages_before_update',
                      'notify_mentorship_message', 'mentorship_requests_after_delete_messages')
    and (has_function_privilege('authenticated', p.oid, 'execute')
         or not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) cfg where cfg = 'search_path=""'));
  perform cdtest.check(v_missing is null, format('funções expostas ou sem search_path vazio: %s', v_missing));
end
$$;
select pass('conversa: funções novas com search_path vazio e sem EXECUTE para membras');

select * from finish();
rollback;
