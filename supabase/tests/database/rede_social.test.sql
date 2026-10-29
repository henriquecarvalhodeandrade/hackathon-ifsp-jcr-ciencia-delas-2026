-- =============================================================================
-- Artemis — rede social (migrations 20261029000000 a 20261029000500, docs/18-rede-social.md)
-- Mesmo formato de rls.test.sql: blocos DO que simulam usuárias (papel + request.jwt.claims,
-- como o PostgREST), EXCEÇÃO na primeira expectativa quebrada, pass() por grupo e ROLLBACK no
-- fim. Os dados são próprios (usuárias e9…), sem depender do seed.
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

-- Executa p_sql e exige que falhe com o SQLSTATE informado (NULL = qualquer erro).
create function cdtest.throws(p_sql text, p_errcode text, p_desc text)
returns void
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

-- Avisos (SECURITY DEFINER: conta tudo, sem RLS, mesmo com uma usuária logada).
create function cdtest.notifications(p_user uuid, p_type text, p_link text default null, p_only_unread boolean default false)
returns bigint
language sql stable security definer set search_path = '' as $$
  select count(*) from public.notifications n
  where n.user_id = p_user
    and n.type::text = p_type
    and (p_link is null or n.link = p_link)
    and (not p_only_unread or n.read_at is null);
$$;

grant execute on all functions in schema cdtest to anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Dados de teste (como postgres)
--   e9…01 Ana (graduação) · e9…02 Bia (docente) · e9…03 Clara (graduação)
--   e9…04 Dora (moderadora) · e9…05 Eva (ensino médio) · e9…06 Fê (sem cadastro completo)
--   e9…07 Gabi (mestrado)
-- -----------------------------------------------------------------------------
insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', 'e9000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
   'ana.rede@example.test', '{"full_name": "Ana Rede"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'e9000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated',
   'bia.rede@example.test', '{"full_name": "Bia Docente"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'e9000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated',
   'clara.rede@example.test', '{"full_name": "Clara Curiosa"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'e9000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated',
   'dora.rede@example.test', '{"full_name": "Dora Moderadora"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'e9000000-0000-4000-8000-000000000005', 'authenticated', 'authenticated',
   'eva.rede@example.test', '{"full_name": "Eva Estudante"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'e9000000-0000-4000-8000-000000000006', 'authenticated', 'authenticated',
   'fe.rede@example.test', '{"full_name": "Fê Incompleta"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'e9000000-0000-4000-8000-000000000007', 'authenticated', 'authenticated',
   'gabi.rede@example.test', '{"full_name": "Gabi Mestranda"}', now(), now());

update public.profiles set onboarded_at = now(), career_stage = 'undergraduate', institution = 'IFSP Jacareí'
  where id in ('e9000000-0000-4000-8000-000000000001', 'e9000000-0000-4000-8000-000000000003');
update public.profiles set onboarded_at = now(), career_stage = 'professor', institution = 'ifsp jacareí'
  where id = 'e9000000-0000-4000-8000-000000000002';
update public.profiles set onboarded_at = now(), role = 'moderator', career_stage = 'researcher'
  where id = 'e9000000-0000-4000-8000-000000000004';
update public.profiles set onboarded_at = now(), career_stage = 'high_school'
  where id = 'e9000000-0000-4000-8000-000000000005';
update public.profiles set onboarded_at = now(), career_stage = 'masters'
  where id = 'e9000000-0000-4000-8000-000000000007';
-- Fê (e9…06) fica sem onboarded_at.

-- =============================================================================
-- 1. Rede — estrutura: RLS e GRANTs por coluna
-- =============================================================================
do $$
begin
  perform cdtest.check(
    (select relrowsecurity from pg_class where oid = 'public.follows'::regclass)
    and (select relrowsecurity from pg_class where oid = 'public.connections'::regclass),
    'RLS ligado em follows e connections');
  perform cdtest.check(
    has_table_privilege('authenticated', 'public.follows', 'select')
    and has_table_privilege('authenticated', 'public.follows', 'delete')
    and not has_table_privilege('authenticated', 'public.follows', 'update')
    and not has_table_privilege('anon', 'public.follows', 'select'),
    'follows: membras leem e apagam; ninguém atualiza; visitante não lê');
  perform cdtest.check(
    has_column_privilege('authenticated', 'public.connections', 'status', 'update')
    and not has_column_privilege('authenticated', 'public.connections', 'message', 'update')
    and not has_column_privilege('authenticated', 'public.connections', 'responded_at', 'insert')
    and not has_table_privilege('anon', 'public.connections', 'select'),
    'connections: só o status é atualizável; responded_at não é gravado pela membra');
end
$$;
select pass('rede: RLS e GRANTs de follows e connections');

-- =============================================================================
-- 2. Seguir: autoria, perfil incompleto, a si mesma, aviso agrupado, deixar de seguir
-- =============================================================================
do $$
begin
  perform cdtest.login('e9000000-0000-4000-8000-000000000001');
  insert into public.follows (followee_id) values ('e9000000-0000-4000-8000-000000000002');
  perform cdtest.throws(
    $q$insert into public.follows (follower_id, followee_id)
       values ('e9000000-0000-4000-8000-000000000003', 'e9000000-0000-4000-8000-000000000002')$q$,
    'CD013', 'seguir em nome de outra pessoa');
  perform cdtest.throws(
    $q$insert into public.follows (followee_id) values ('e9000000-0000-4000-8000-000000000001')$q$,
    'CD065', 'seguir a si mesma');
  perform cdtest.throws(
    $q$insert into public.follows (followee_id) values ('e9000000-0000-4000-8000-000000000006')$q$,
    'CD060', 'seguir perfil sem cadastro completo');
  perform cdtest.throws(
    $q$insert into public.follows (followee_id) values ('e9000000-0000-4000-8000-000000000002')$q$,
    '23505', 'seguir duas vezes');
  perform cdtest.logout();

  perform cdtest.check(
    cdtest.notifications('e9000000-0000-4000-8000-000000000002', 'new_follower',
      '/pesquisadoras/e9000000-0000-4000-8000-000000000001') = 1,
    'Bia recebe o aviso de que Ana começou a segui-la');

  -- Deixar de seguir e seguir de novo: o aviso não lido não se repete.
  perform cdtest.login('e9000000-0000-4000-8000-000000000001');
  perform cdtest.check(
    cdtest.affected($q$delete from public.follows where followee_id = 'e9000000-0000-4000-8000-000000000002'$q$) = 1,
    'Ana deixa de seguir Bia');
  insert into public.follows (followee_id) values ('e9000000-0000-4000-8000-000000000002');
  perform cdtest.logout();
  perform cdtest.check(
    cdtest.notifications('e9000000-0000-4000-8000-000000000002', 'new_follower') = 1,
    'seguir de novo com o aviso ainda não lido não cria outro');

  -- Clara não apaga o "seguir" da Ana.
  perform cdtest.login('e9000000-0000-4000-8000-000000000003');
  perform cdtest.check(
    cdtest.affected($q$delete from public.follows where follower_id = 'e9000000-0000-4000-8000-000000000001'$q$) = 0,
    'ninguém apaga o "seguir" de outra pessoa');
  perform cdtest.check(
    (select count(*) from public.follows where followee_id = 'e9000000-0000-4000-8000-000000000002') = 1,
    'todas as membras veem quem segue quem');
  perform cdtest.logout();
end
$$;
select pass('seguir: autoria, perfil incompleto, a si mesma, aviso agrupado');

-- =============================================================================
-- 3. Conectar: convite, quem responde, aceite cria o seguir mútuo, convite de volta aceita
-- =============================================================================
do $$
declare
  v_id uuid;
begin
  -- Ana convida Clara.
  perform cdtest.login('e9000000-0000-4000-8000-000000000001');
  insert into public.connections (addressee_id, message)
  values ('e9000000-0000-4000-8000-000000000003', '  Oi, Clara! Vamos nos conectar?  ')
  returning id into v_id;
  perform cdtest.put('conn_ana_clara', v_id);
  perform cdtest.check(
    (select message from public.connections where id = v_id) = 'Oi, Clara! Vamos nos conectar?',
    'recado do convite sem espaços nas pontas');
  perform cdtest.throws(
    $q$insert into public.connections (addressee_id) values ('e9000000-0000-4000-8000-000000000003')$q$,
    'CD061', 'convite repetido');
  perform cdtest.check(
    cdtest.affected(format('update public.connections set status = %L where id = %L', 'accepted', v_id)) = 0
    and (select status = 'pending' from public.connections where id = v_id),
    'quem convidou não aceita o próprio convite (RLS)');
  perform cdtest.throws(
    $q$insert into public.connections (addressee_id) values ('e9000000-0000-4000-8000-000000000006')$q$,
    'CD060', 'convite para perfil sem cadastro completo');
  perform cdtest.throws(
    $q$insert into public.connections (addressee_id) values ('e9000000-0000-4000-8000-000000000001')$q$,
    'CD065', 'convite para si mesma');
  perform cdtest.logout();

  perform cdtest.check(
    cdtest.notifications('e9000000-0000-4000-8000-000000000003', 'connection_request',
      '/pesquisadoras/e9000000-0000-4000-8000-000000000001', true) = 1,
    'Clara recebe o aviso do convite');

  -- Gabi não vê o convite pendente entre Ana e Clara.
  perform cdtest.login('e9000000-0000-4000-8000-000000000007');
  perform cdtest.check(
    (select count(*) from public.connections where id = v_id) = 0,
    'convite pendente é só das duas');
  perform cdtest.logout();

  -- Clara aceita: seguir nos dois sentidos, aviso para Ana, aviso do convite lido, sem "começou a seguir".
  perform cdtest.login('e9000000-0000-4000-8000-000000000003');
  update public.connections set status = 'accepted' where id = v_id;
  perform cdtest.check(
    (select responded_at is not null from public.connections where id = v_id),
    'responded_at preenchido pelo banco');
  perform cdtest.throws(
    format('update public.connections set status = %L where id = %L', 'declined', v_id),
    'CD062', 'conexão aceita não volta para recusada');
  perform cdtest.logout();

  perform cdtest.check(
    (select count(*) from public.follows
      where (follower_id, followee_id) in (
        ('e9000000-0000-4000-8000-000000000001'::uuid, 'e9000000-0000-4000-8000-000000000003'::uuid),
        ('e9000000-0000-4000-8000-000000000003'::uuid, 'e9000000-0000-4000-8000-000000000001'::uuid))) = 2,
    'aceite cria o seguir nos dois sentidos');
  perform cdtest.check(
    cdtest.notifications('e9000000-0000-4000-8000-000000000001', 'connection_accepted',
      '/pesquisadoras/e9000000-0000-4000-8000-000000000003') = 1,
    'Ana recebe o aviso do aceite');
  perform cdtest.check(
    cdtest.notifications('e9000000-0000-4000-8000-000000000003', 'connection_request', null, true) = 0,
    'o aviso do convite ficou lido');
  perform cdtest.check(
    cdtest.notifications('e9000000-0000-4000-8000-000000000001', 'new_follower') = 0
    and cdtest.notifications('e9000000-0000-4000-8000-000000000003', 'new_follower') = 0,
    'o seguir criado pelo aceite não gera "começou a seguir você"');

  -- Conexão aceita é visível a todas.
  perform cdtest.login('e9000000-0000-4000-8000-000000000007');
  perform cdtest.check((select count(*) from public.connections where id = v_id) = 1, 'conexão aceita é pública');
  perform cdtest.logout();

  -- Convite de volta: Bia convida Gabi; Gabi "convida" Bia → aceita o da Bia, sem linha nova.
  perform cdtest.login('e9000000-0000-4000-8000-000000000002');
  insert into public.connections (addressee_id) values ('e9000000-0000-4000-8000-000000000007');
  perform cdtest.login('e9000000-0000-4000-8000-000000000007');
  perform cdtest.check(
    cdtest.affected($q$insert into public.connections (addressee_id) values ('e9000000-0000-4000-8000-000000000002')$q$) = 0,
    'convite de volta não cria linha nova');
  perform cdtest.logout();
  perform cdtest.check(
    (select status = 'accepted' and requester_id = 'e9000000-0000-4000-8000-000000000002'
       from public.connections
      where addressee_id = 'e9000000-0000-4000-8000-000000000007'),
    'convite de volta aceita o convite que já existia');
end
$$;
select pass('conectar: convite, resposta, seguir mútuo, convite de volta');

-- =============================================================================
-- 4. Recusa, remoção e desistência
-- =============================================================================
do $$
declare
  v_id uuid;
begin
  -- Clara convida Bia; Bia recusa; Clara não consegue apagar nem refazer.
  perform cdtest.login('e9000000-0000-4000-8000-000000000003');
  insert into public.connections (addressee_id) values ('e9000000-0000-4000-8000-000000000002')
  returning id into v_id;
  perform cdtest.login('e9000000-0000-4000-8000-000000000002');
  update public.connections set status = 'declined' where id = v_id;
  perform cdtest.login('e9000000-0000-4000-8000-000000000003');
  perform cdtest.check(
    cdtest.affected(format('delete from public.connections where id = %L', v_id)) = 0,
    'quem convidou não apaga convite recusado');
  perform cdtest.throws(
    $q$insert into public.connections (addressee_id) values ('e9000000-0000-4000-8000-000000000002')$q$,
    'CD061', 'quem convidou não refaz convite recusado');
  -- Bia muda de ideia: aceita depois.
  perform cdtest.login('e9000000-0000-4000-8000-000000000002');
  update public.connections set status = 'accepted' where id = v_id;
  perform cdtest.check((select status = 'accepted' from public.connections where id = v_id),
    'quem recusou pode aceitar depois');
  -- Qualquer uma das duas remove a conexão aceita.
  perform cdtest.login('e9000000-0000-4000-8000-000000000003');
  perform cdtest.check(
    cdtest.affected(format('delete from public.connections where id = %L', v_id)) = 1,
    'quem convidou remove a conexão aceita');

  -- Desistência de convite pendente apaga o aviso de quem recebeu.
  perform cdtest.login('e9000000-0000-4000-8000-000000000001');
  insert into public.connections (addressee_id) values ('e9000000-0000-4000-8000-000000000007')
  returning id into v_id;
  perform cdtest.logout();
  perform cdtest.check(
    cdtest.notifications('e9000000-0000-4000-8000-000000000007', 'connection_request',
      '/pesquisadoras/e9000000-0000-4000-8000-000000000001') = 1, 'aviso do convite criado');
  perform cdtest.login('e9000000-0000-4000-8000-000000000001');
  delete from public.connections where id = v_id;
  perform cdtest.logout();
  perform cdtest.check(
    cdtest.notifications('e9000000-0000-4000-8000-000000000007', 'connection_request',
      '/pesquisadoras/e9000000-0000-4000-8000-000000000001') = 0,
    'desistir do convite apaga o aviso');
end
$$;
select pass('conectar: recusa sem refazer, aceitar depois, remover, desistir');

-- =============================================================================
-- 5. RPCs: números da rede e sugestões
-- =============================================================================
do $$
declare
  v_counts record;
begin
  perform cdtest.login('e9000000-0000-4000-8000-000000000001');
  select * into v_counts from public.get_network_counts('e9000000-0000-4000-8000-000000000001');
  perform cdtest.check(v_counts.connections = 1 and v_counts.following = 2 and v_counts.followers = 1,
    format('números da Ana (conexões %s, seguindo %s, seguidoras %s)',
      v_counts.connections, v_counts.following, v_counts.followers));

  -- Sugestões da Ana: sem ela mesma, sem a Clara (conexão), sem a Fê (cadastro incompleto); Bia
  -- (mesma instituição, sem diferença de maiúsculas) aparece.
  perform cdtest.check(
    not exists (select 1 from public.get_connection_suggestions(50) s
                where s.id in ('e9000000-0000-4000-8000-000000000001', 'e9000000-0000-4000-8000-000000000003',
                               'e9000000-0000-4000-8000-000000000006')),
    'sugestões sem a própria, sem conexões e sem cadastro incompleto');
  perform cdtest.check(
    (select s.same_institution from public.get_connection_suggestions(50) s
      where s.id = 'e9000000-0000-4000-8000-000000000002'),
    'Bia sugerida por ser da mesma instituição');
  perform cdtest.check(
    (select s.mutual_connections from public.get_connection_suggestions(50) s
      where s.id = 'e9000000-0000-4000-8000-000000000002') = 0,
    'conexões em comum contadas só entre conexões aceitas');
  perform cdtest.logout();

  perform cdtest.login_anon();
  perform cdtest.throws($q$select * from public.get_connection_suggestions(5)$q$, '42501',
    'visitante não chama as RPCs da rede');
  perform cdtest.logout();
end
$$;
select pass('rede: get_network_counts e get_connection_suggestions');

-- =============================================================================
-- 6. Portfólio: só a dona escreve, todas leem, limite de 50 itens
-- =============================================================================
do $$
declare
  v_id uuid;
begin
  perform cdtest.login('e9000000-0000-4000-8000-000000000002');
  insert into public.portfolio_items (kind, title, url, year, tags)
  values ('article', '  Ciência aberta no IFSP  ', 'https://example.test/artigo', 2025, array['Ciência Aberta', 'ciência aberta', ' IFSP '])
  returning id into v_id;
  perform cdtest.put('portfolio_bia', v_id);
  perform cdtest.check(
    (select title = 'Ciência aberta no IFSP' and tags = array['ciência aberta', 'ifsp']
       from public.portfolio_items where id = v_id),
    'título aparado e tags normalizadas');
  perform cdtest.throws(
    $q$insert into public.portfolio_items (owner_id, kind, title)
       values ('e9000000-0000-4000-8000-000000000001', 'project', 'Projeto alheio')$q$,
    'CD013', 'adicionar item ao portfólio de outra pessoa');
  perform cdtest.throws(
    format('update public.portfolio_items set owner_id = %L where id = %L', 'e9000000-0000-4000-8000-000000000001', v_id),
    '42501', 'a dona do item não é atualizável (GRANT por coluna)');
  perform cdtest.logout();

  perform cdtest.login('e9000000-0000-4000-8000-000000000001');
  perform cdtest.check((select count(*) from public.portfolio_items where id = v_id) = 1, 'membras leem o portfólio');
  perform cdtest.check(
    cdtest.affected(format('update public.portfolio_items set title = %L where id = %L', 'Invadido', v_id)) = 0
    and cdtest.affected(format('delete from public.portfolio_items where id = %L', v_id)) = 0,
    'outra membra não edita nem apaga');
  perform cdtest.logout();

  perform cdtest.login_anon();
  perform cdtest.throws('select count(*) from public.portfolio_items', '42501', 'visitante não lê portfólios');
  perform cdtest.logout();

  -- 49 itens criados pelo banco (sem limite) + o da Bia = 50 → o próximo dela é recusado.
  insert into public.portfolio_items (owner_id, kind, title)
  select 'e9000000-0000-4000-8000-000000000002', 'other', 'Item ' || g from generate_series(1, 49) g;
  perform cdtest.login('e9000000-0000-4000-8000-000000000002');
  perform cdtest.throws(
    $q$insert into public.portfolio_items (kind, title) values ('course', 'Mais um curso')$q$,
    'CD066', 'portfólio cheio (50 itens)');
  perform cdtest.logout();
  delete from public.portfolio_items where owner_id = 'e9000000-0000-4000-8000-000000000002' and title like 'Item %';
end
$$;
select pass('portfólio: autoria, leitura, limite');

-- =============================================================================
-- 7. Oportunidades: quem publica, quem edita, contador protegido
-- =============================================================================
do $$
declare
  v_id uuid;
begin
  perform cdtest.login('e9000000-0000-4000-8000-000000000001');
  perform cdtest.throws(
    $q$insert into public.research_opportunities (title, description)
       values ('IC em robótica educacional', 'Descrição longa o bastante para passar na checagem de tamanho.')$q$,
    'CD070', 'graduanda não publica oportunidade');
  perform cdtest.logout();

  perform cdtest.login('e9000000-0000-4000-8000-000000000002');
  insert into public.research_opportunities (
    title, description, state, has_scholarship, scholarship_info, target_stages, keywords, deadline
  )
  values (
    'IC em robótica educacional', 'Projeto de iniciação científica com robôs de baixo custo nas escolas públicas.',
    'sp', false, 'não deveria ficar', array['undergraduate', 'high_school', 'undergraduate']::public.career_stage[],
    array['Robótica', 'robótica'], (now() at time zone 'America/Sao_Paulo')::date + 10
  )
  returning id into v_id;
  perform cdtest.put('opp', v_id);
  perform cdtest.check(
    (select state = 'SP' and scholarship_info is null and keywords = array['robótica']
            and target_stages = array['high_school', 'undergraduate']::public.career_stage[]
            and search_text like '%robotica educacional%'
       from public.research_opportunities where id = v_id),
    'normalização: UF, bolsa sem detalhe, palavras-chave, etapas e busca sem acento');
  perform cdtest.throws(
    format('update public.research_opportunities set application_count = 99 where id = %L', v_id),
    '42501', 'contador não é atualizável pela membra');
  perform cdtest.logout();

  perform cdtest.login('e9000000-0000-4000-8000-000000000003');
  perform cdtest.check(
    cdtest.affected(format('update public.research_opportunities set title = %L where id = %L', 'Invadida', v_id)) = 0,
    'outra membra não edita a vaga');
  perform cdtest.logout();
end
$$;
select pass('oportunidades: publicar (mestrado em diante), normalização, contador protegido');

-- =============================================================================
-- 8. Candidaturas: regras, privacidade, transições, contador e avisos
-- =============================================================================
do $$
declare
  v_opp uuid := cdtest.get('opp');
  v_app uuid;
  v_clara uuid;
  v_closed uuid;
begin
  -- Ana se candidata.
  perform cdtest.login('e9000000-0000-4000-8000-000000000001');
  insert into public.opportunity_applications (opportunity_id, message)
  values (v_opp, 'Olá! Tenho muito interesse em robótica e já participei de olimpíadas.')
  returning id into v_app;
  perform cdtest.put('app_ana', v_app);
  perform cdtest.throws(
    format('insert into public.opportunity_applications (opportunity_id, message) values (%L, %L)',
      v_opp, 'Mandando de novo a mesma candidatura para ver se passa.'),
    'CD073', 'segunda candidatura na mesma vaga');
  perform cdtest.throws(
    format('update public.opportunity_applications set status = %L where id = %L', 'accepted', v_app),
    'CD074', 'candidata não aprova a própria candidatura');
  perform cdtest.logout();

  -- Clara também.
  perform cdtest.login('e9000000-0000-4000-8000-000000000003');
  insert into public.opportunity_applications (opportunity_id, message)
  values (v_opp, 'Oi! Quero aprender robótica e tenho tempo livre à tarde.')
  returning id into v_clara;
  perform cdtest.check((select count(*) from public.opportunity_applications where id = v_app) = 0,
    'uma candidata não vê a candidatura da outra');
  perform cdtest.logout();

  perform cdtest.check(
    (select application_count from public.research_opportunities where id = v_opp) = 2,
    'contador com duas candidaturas');
  perform cdtest.check(
    cdtest.notifications('e9000000-0000-4000-8000-000000000002', 'opportunity_application',
      '/ics/' || v_opp || '/candidaturas') = 1,
    'dona recebe um aviso agrupado pelas duas candidaturas');

  -- A dona não se candidata à própria vaga.
  perform cdtest.login('e9000000-0000-4000-8000-000000000002');
  perform cdtest.throws(
    format('insert into public.opportunity_applications (opportunity_id, message) values (%L, %L)',
      v_opp, 'Candidatura da própria dona da vaga, que não deveria passar.'),
    'CD072', 'candidatura na própria vaga');
  perform cdtest.check((select count(*) from public.opportunity_applications where opportunity_id = v_opp) = 2,
    'a dona vê todas as candidaturas da vaga');
  -- Dona aprova Ana com recado; não volta "enviada".
  update public.opportunity_applications set status = 'accepted', owner_note = 'Bem-vinda ao grupo!' where id = v_app;
  perform cdtest.throws(
    format('update public.opportunity_applications set status = %L where id = %L', 'submitted', v_app),
    'CD074', 'dona não volta a candidatura para enviada');
  perform cdtest.throws(
    format('update public.opportunity_applications set message = %L where id = %L', 'Carta trocada pela dona da vaga!', v_app),
    '42501', 'carta não é atualizável (GRANT por coluna)');
  perform cdtest.logout();

  perform cdtest.check(
    cdtest.notifications('e9000000-0000-4000-8000-000000000001', 'application_update', '/ics/' || v_opp) = 1,
    'Ana recebe o aviso da aprovação');
  perform cdtest.check(
    (select responded_at is not null from public.opportunity_applications where id = v_app),
    'responded_at preenchido na resposta');

  -- Clara desiste: contador cai; não se candidata de novo.
  perform cdtest.login('e9000000-0000-4000-8000-000000000003');
  update public.opportunity_applications set status = 'withdrawn' where id = v_clara;
  perform cdtest.throws(
    format('insert into public.opportunity_applications (opportunity_id, message) values (%L, %L)',
      v_opp, 'Mudei de ideia e quero me candidatar de novo nesta vaga.'),
    'CD073', 'quem desistiu não se candidata de novo');
  perform cdtest.logout();
  perform cdtest.check(
    (select application_count from public.research_opportunities where id = v_opp) = 1,
    'desistência sai do contador');

  -- Vaga encerrada e vaga com prazo vencido não aceitam candidaturas.
  perform cdtest.login('e9000000-0000-4000-8000-000000000002');
  insert into public.research_opportunities (title, description, deadline)
  values ('IC em química verde', 'Projeto sobre solventes alternativos em laboratório didático.', (now() at time zone 'America/Sao_Paulo')::date - 1)
  returning id into v_closed;
  perform cdtest.logout();
  perform cdtest.login('e9000000-0000-4000-8000-000000000007');
  perform cdtest.throws(
    format('insert into public.opportunity_applications (opportunity_id, message) values (%L, %L)',
      v_closed, 'Quero participar do projeto de química verde, por favor.'),
    'CD071', 'prazo vencido');
  perform cdtest.logout();
  perform cdtest.login('e9000000-0000-4000-8000-000000000002');
  update public.research_opportunities set deadline = null, status = 'closed' where id = v_closed;
  perform cdtest.check((select closed_at is not null from public.research_opportunities where id = v_closed),
    'encerrar marca closed_at');
  perform cdtest.logout();
  perform cdtest.login('e9000000-0000-4000-8000-000000000007');
  perform cdtest.throws(
    format('insert into public.opportunity_applications (opportunity_id, message) values (%L, %L)',
      v_closed, 'Quero participar do projeto de química verde, por favor.'),
    'CD071', 'vaga encerrada');
  perform cdtest.logout();

  -- Apagar a vaga leva candidaturas e avisos.
  perform cdtest.login('e9000000-0000-4000-8000-000000000002');
  delete from public.research_opportunities where id = v_closed;
  perform cdtest.logout();
end
$$;
select pass('candidaturas: regras, privacidade, transições, contador e avisos');

select * from finish();
rollback;
