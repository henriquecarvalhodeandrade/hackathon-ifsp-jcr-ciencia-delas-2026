-- =============================================================================
-- Artemis · 26 — rede social, parte 1: base comum + rede (seguir e conectar)
--                (docs/18-rede-social.md §2.1)
--
--   Base usada por todas as migrations da rede social (26 a 31):
--     * tipos de notificação novos (só usados dentro de corpos plpgsql, planejados na primeira
--       execução — por isso podem ser acrescentados na mesma migration);
--     * ações novas no registro anti-spam (lista COMPLETA repetida de propósito);
--     * private.is_onboarded(): perfil existe e tem cadastro completo.
--
--   Rede:
--   | Tabela      | Ler                                   | Escrever                                         |
--   | ----------- | ------------------------------------- | ------------------------------------------------ |
--   | follows     | todas as membras                      | segue em nome próprio; deixa de seguir apagando  |
--   | connections | aceitas: todas; pendentes/recusadas:  | convida em nome próprio; só quem recebeu aceita  |
--   |             | só as duas                            | ou recusa; ver regras de DELETE abaixo           |
--
--   - Convite de volta para quem já me convidou ACEITA o convite dela (o INSERT vira UPDATE: o
--     trigger devolve NULL e nenhuma linha nova é criada).
--   - Aceitar cria o "seguir" nos dois sentidos (sem avisos de "começou a seguir": o aviso de
--     conexão aceita já conta tudo).
--   - Convite recusado não pode ser refeito por quem convidou (não pode apagá-lo); quem recusou
--     pode aceitar depois ou apagar.
--   - LGPD: apagar o perfil apaga follows e connections em cascata; os avisos com link para o
--     perfil que saiu também somem (trigger em profiles).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Tipos de notificação da rede social
-- -----------------------------------------------------------------------------
alter type public.notification_type add value if not exists 'new_follower';
alter type public.notification_type add value if not exists 'connection_request';
alter type public.notification_type add value if not exists 'connection_accepted';
alter type public.notification_type add value if not exists 'post_like';
alter type public.notification_type add value if not exists 'post_comment';
alter type public.notification_type add value if not exists 'opportunity_application';
alter type public.notification_type add value if not exists 'application_update';
alter type public.notification_type add value if not exists 'direct_message';

-- -----------------------------------------------------------------------------
-- 2. Registro anti-spam: ações da rede social (lista COMPLETA repetida de propósito — quem
--    acrescentar outra ação depois precisa manter esta).
-- -----------------------------------------------------------------------------
alter table private.rate_limit_events
  drop constraint rate_limit_events_action_check,
  add constraint rate_limit_events_action_check check (
    action in (
      'forum_thread', 'forum_post', 'paper_comment', 'paper', 'paper_vote', 'mentorship_message',
      'public_answer',
      'follow', 'connection_request', 'portfolio_item', 'opportunity', 'opportunity_application',
      'feed_post', 'feed_comment', 'direct_message', 'direct_conversation'
    )
  );

-- -----------------------------------------------------------------------------
-- 3. Perfil com cadastro completo (usado por follows, connections e mensagens diretas)
-- -----------------------------------------------------------------------------
create function private.is_onboarded(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = p_profile_id and p.onboarded_at is not null
  );
$$;
revoke all on function private.is_onboarded(uuid) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 4. follows — seguir (de um lado só)
-- -----------------------------------------------------------------------------
create table public.follows (
  follower_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  followee_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followee_id),
  constraint follows_not_self check (follower_id <> followee_id)
);
comment on table public.follows is
  'Quem segue quem (de um lado só). Todas as membras veem; cada uma segue e deixa de seguir em nome próprio.';

create index follows_followee_id_idx on public.follows (followee_id, created_at desc);

-- Antes de inserir: autoria, perfil seguido com cadastro completo e limite anti-spam. Linhas
-- criadas por outro trigger (aceite de conexão, pg_trigger_depth() > 1) pulam autoria e limite.
create function private.follows_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_direct boolean := pg_trigger_depth() = 1 and not private.is_trusted_context();
begin
  if not private.is_trusted_context() then
    new.created_at := now();
  end if;

  if new.follower_id = new.followee_id then
    raise exception using
      errcode = 'CD065',
      message = 'Você não pode seguir o seu próprio perfil.';
  end if;

  if v_direct then
    if new.follower_id is distinct from v_uid then
      raise exception using
        errcode = 'CD013',
        message = 'Autoria inválida: siga pesquisadoras sempre com a sua própria conta.';
    end if;
    if not private.is_onboarded(new.followee_id) then
      raise exception using
        errcode = 'CD060',
        message = 'Não encontramos esta pesquisadora. Confira o link ou procure no diretório.';
    end if;
    perform private.enforce_rate_limit('follow', 100, interval '1 hour', 'CD063',
      'Você seguiu muitas pessoas na última hora. Respire e tente de novo em alguns minutos.');
  end if;
  return new;
end;
$$;
revoke all on function private.follows_before_insert() from public, anon, authenticated;

create trigger follows_before_insert
  before insert on public.follows
  for each row execute function private.follows_before_insert();

-- Aviso "começou a seguir você" — agrupado (um não lido por pessoa que segue) e nunca para o
-- "seguir" criado pelo aceite de uma conexão.
create function private.notify_new_follower()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_link text := '/pesquisadoras/' || new.follower_id::text;
begin
  if pg_trigger_depth() > 1 or private.are_connected(new.follower_id, new.followee_id) then
    return null;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('new_follower_notify:' || new.followee_id::text || ':' || new.follower_id::text, 0)
  );
  if exists (
    select 1 from public.notifications n
    where n.user_id = new.followee_id and n.type = 'new_follower' and n.link = v_link
      and n.read_at is null
  ) then
    return null;
  end if;

  perform private.notify(
    new.followee_id,
    'new_follower',
    format('%s começou a seguir você', private.display_name(new.follower_id)),
    'As publicações dela aparecem para você no feed se você seguir de volta.',
    v_link,
    new.created_at
  );
  return null;
end;
$$;
revoke all on function private.notify_new_follower() from public, anon, authenticated;

create trigger follows_notify
  after insert on public.follows
  for each row execute function private.notify_new_follower();

alter table public.follows enable row level security;

create policy "Membros veem quem segue quem"
  on public.follows for select
  to authenticated
  using (true);

create policy "Membros seguem em nome próprio"
  on public.follows for insert
  to authenticated
  with check (follower_id = (select auth.uid()));

create policy "Membros deixam de seguir em nome próprio"
  on public.follows for delete
  to authenticated
  using (follower_id = (select auth.uid()));

revoke all on table public.follows from anon, authenticated;
grant select, delete on table public.follows to authenticated;
grant insert (follower_id, followee_id) on table public.follows to authenticated;
grant all on table public.follows to service_role;

-- -----------------------------------------------------------------------------
-- 5. connections — conexões (convite aceito pelas duas)
-- -----------------------------------------------------------------------------
create type public.connection_status as enum ('pending', 'accepted', 'declined');

create table public.connections (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  addressee_id uuid not null references public.profiles (id) on delete cascade,
  status public.connection_status not null default 'pending',
  message text check (char_length(message) <= 300),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint connections_not_self check (requester_id <> addressee_id)
);
comment on table public.connections is
  'Conexões entre membras. Aceitas: visíveis a todas; pendentes/recusadas: só às duas. Só quem recebeu responde.';
comment on column public.connections.message is 'Recado opcional do convite (até 300 caracteres).';

-- Um registro por par, em qualquer direção.
create unique index connections_pair_key on public.connections (
  least(requester_id, addressee_id), greatest(requester_id, addressee_id)
);
create index connections_requester_id_idx on public.connections (requester_id, status);
create index connections_addressee_id_idx on public.connections (addressee_id, status);

-- Conexão aceita entre as duas? (avisos e conversas diretas)
create function private.are_connected(p_a uuid, p_b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.connections c
    where c.status = 'accepted'
      and least(c.requester_id, c.addressee_id) = least(p_a, p_b)
      and greatest(c.requester_id, c.addressee_id) = greatest(p_a, p_b)
  );
$$;
revoke all on function private.are_connected(uuid, uuid) from public, anon, authenticated;

-- Antes de inserir: autoria, convite pendente, destinatária com cadastro completo, par único
-- (convite de volta aceita o que já existia) e limite anti-spam.
create function private.connections_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_trusted boolean := private.is_trusted_context();
  v_existing public.connections%rowtype;
begin
  if not v_trusted then
    if new.requester_id is distinct from v_uid then
      raise exception using
        errcode = 'CD013',
        message = 'Autoria inválida: envie convites sempre com a sua própria conta.';
    end if;
    new.status := 'pending';
    new.created_at := now();
    new.responded_at := null;
  end if;
  new.message := nullif(btrim(new.message, E' \t\r\n'), '');

  if new.requester_id = new.addressee_id then
    raise exception using
      errcode = 'CD065',
      message = 'Você não pode se conectar com o seu próprio perfil.';
  end if;

  if not private.is_onboarded(new.addressee_id) then
    raise exception using
      errcode = 'CD060',
      message = 'Não encontramos esta pesquisadora. Confira o link ou procure no diretório.';
  end if;

  -- Serializa convites do mesmo par (os dois lados ao mesmo tempo).
  perform pg_advisory_xact_lock(hashtextextended(
    'connection:' || least(new.requester_id, new.addressee_id)::text || ':'
      || greatest(new.requester_id, new.addressee_id)::text, 0));

  select * into v_existing
  from public.connections c
  where least(c.requester_id, c.addressee_id) = least(new.requester_id, new.addressee_id)
    and greatest(c.requester_id, c.addressee_id) = greatest(new.requester_id, new.addressee_id)
  for update;

  if found then
    if v_existing.status = 'accepted' then
      raise exception using
        errcode = 'CD061',
        message = 'Vocês já estão conectadas.';
    elsif v_existing.requester_id = new.addressee_id then
      -- Ela já tinha me convidado (pendente, ou recusado por mim antes): aceito o convite dela.
      update public.connections
        set status = 'accepted'
      where id = v_existing.id;
      return null;
    else
      raise exception using
        errcode = 'CD061',
        message = 'Você já enviou um convite para esta pesquisadora. Agora é esperar a resposta dela.';
    end if;
  end if;

  perform private.enforce_rate_limit('connection_request', 30, interval '24 hours', 'CD064',
    'Você enviou muitos convites de conexão hoje. Tente de novo amanhã.');
  return new;
end;
$$;
revoke all on function private.connections_before_insert() from public, anon, authenticated;

create trigger connections_before_insert
  before insert on public.connections
  for each row execute function private.connections_before_insert();

-- Antes de atualizar: só o status muda, só quem recebeu responde, e uma conexão aceita não volta
-- (para desfazer, apaga-se a linha).
create function private.connections_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if new.id is distinct from old.id
     or new.requester_id is distinct from old.requester_id
     or new.addressee_id is distinct from old.addressee_id
     or new.message is distinct from old.message
     or new.created_at is distinct from old.created_at then
    raise exception using
      errcode = 'CD002',
      message = 'Só a resposta ao convite pode mudar.';
  end if;

  if new.status = old.status then
    return new;
  end if;

  if not private.is_trusted_context() then
    if v_uid is distinct from old.addressee_id then
      raise exception using
        errcode = 'CD062',
        message = 'Só quem recebeu o convite pode aceitar ou recusar.';
    end if;
    if new.status = 'pending' or old.status = 'accepted' then
      raise exception using
        errcode = 'CD062',
        message = case when old.status = 'accepted'
          then 'Vocês já estão conectadas. Para desfazer, remova a conexão.'
          else 'Este convite já foi respondido.'
        end;
    end if;
  end if;

  new.responded_at := case
    when private.is_trusted_context() then coalesce(new.responded_at, now())
    else now()
  end;
  return new;
end;
$$;
revoke all on function private.connections_before_update() from public, anon, authenticated;

create trigger connections_before_update
  before update on public.connections
  for each row execute function private.connections_before_update();

-- Convite novo → aviso para quem recebeu.
create function private.notify_connection_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.notify(
    new.addressee_id,
    'connection_request',
    format('%s quer se conectar com você', private.display_name(new.requester_id)),
    coalesce(new.message, 'Abra o perfil dela para aceitar ou recusar o convite.'),
    '/pesquisadoras/' || new.requester_id::text,
    new.created_at
  );
  return null;
end;
$$;
revoke all on function private.notify_connection_request() from public, anon, authenticated;

create trigger connections_notify_request
  after insert on public.connections
  for each row execute function private.notify_connection_request();

-- Resposta ao convite: o aviso do convite conta como lido; aceite → seguir nos dois sentidos e
-- aviso para quem convidou.
create function private.connections_after_response()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = old.status then
    return null;
  end if;

  update public.notifications n
    set read_at = now()
  where n.user_id = new.addressee_id
    and n.type = 'connection_request'
    and n.link = '/pesquisadoras/' || new.requester_id::text
    and n.read_at is null;

  if new.status = 'accepted' then
    insert into public.follows (follower_id, followee_id)
    values (new.requester_id, new.addressee_id), (new.addressee_id, new.requester_id)
    on conflict do nothing;

    perform private.notify(
      new.requester_id,
      'connection_accepted',
      format('%s aceitou o seu convite de conexão', private.display_name(new.addressee_id)),
      'Agora vocês são conexões: as publicações de uma aparecem no feed da outra.',
      '/pesquisadoras/' || new.addressee_id::text,
      new.responded_at
    );
  end if;
  return null;
end;
$$;
revoke all on function private.connections_after_response() from public, anon, authenticated;

create trigger connections_after_response
  after update of status on public.connections
  for each row execute function private.connections_after_response();

-- Convite apagado ainda pendente (desistência) → some o aviso que ficou com quem recebeu.
create function private.connections_after_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status = 'pending' then
    delete from public.notifications n
    where n.user_id = old.addressee_id
      and n.type = 'connection_request'
      and n.link = '/pesquisadoras/' || old.requester_id::text;
  end if;
  return null;
end;
$$;
revoke all on function private.connections_after_delete() from public, anon, authenticated;

create trigger connections_after_delete
  after delete on public.connections
  for each row execute function private.connections_after_delete();

alter table public.connections enable row level security;

create policy "Membros veem conexões aceitas; convites só as duas"
  on public.connections for select
  to authenticated
  using (
    status = 'accepted'
    or (select auth.uid()) in (requester_id, addressee_id)
  );

create policy "Membros convidam em nome próprio"
  on public.connections for insert
  to authenticated
  with check (requester_id = (select auth.uid()));

create policy "Quem recebeu responde ao convite"
  on public.connections for update
  to authenticated
  using (addressee_id = (select auth.uid()))
  with check (addressee_id = (select auth.uid()));

-- Quem recebeu apaga sempre; quem convidou apaga o convite pendente ou a conexão aceita, mas não
-- o convite recusado (senão poderia refazê-lo).
create policy "Participantes removem convites e conexões"
  on public.connections for delete
  to authenticated
  using (
    addressee_id = (select auth.uid())
    or (requester_id = (select auth.uid()) and status <> 'declined')
  );

revoke all on table public.connections from anon, authenticated;
grant select, delete on table public.connections to authenticated;
grant insert (requester_id, addressee_id, message) on table public.connections to authenticated;
grant update (status) on table public.connections to authenticated;
grant all on table public.connections to service_role;

-- -----------------------------------------------------------------------------
-- 6. LGPD: perfil apagado → somem os avisos (de outras pessoas) com link para o perfil dela.
--    follows/connections já somem em cascata pelas FKs.
-- -----------------------------------------------------------------------------
create function private.profiles_after_delete_social_notifications()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.notifications n
  where n.type in ('new_follower', 'connection_request', 'connection_accepted')
    and n.link = '/pesquisadoras/' || old.id::text;
  return null;
end;
$$;
revoke all on function private.profiles_after_delete_social_notifications() from public, anon, authenticated;

create trigger profiles_after_delete_social_notifications
  after delete on public.profiles
  for each row execute function private.profiles_after_delete_social_notifications();

-- -----------------------------------------------------------------------------
-- 7. RPCs de leitura (SECURITY INVOKER: o RLS de quem chama vale)
-- -----------------------------------------------------------------------------
create function public.get_network_counts(p_profile_id uuid)
returns table (followers integer, following integer, connections integer)
language sql
stable
set search_path = ''
as $$
  select
    (select count(*) from public.follows f where f.followee_id = p_profile_id)::integer,
    (select count(*) from public.follows f where f.follower_id = p_profile_id)::integer,
    (select count(*) from public.connections c
      where c.status = 'accepted' and p_profile_id in (c.requester_id, c.addressee_id))::integer;
$$;
comment on function public.get_network_counts(uuid) is
  'Seguidoras, seguindo e conexões aceitas de um perfil (docs/18 §2.1).';

-- Pessoas que você talvez conheça: áreas em comum (peso 3), conexões em comum (2), mesma
-- instituição (2). Sem quem já tem convite/conexão comigo, sem eu mesma, só cadastro completo.
create function public.get_connection_suggestions(p_limit integer default 8)
returns table (
  id uuid,
  full_name text,
  avatar_url text,
  headline text,
  institution text,
  career_stage public.career_stage,
  shared_areas integer,
  mutual_connections integer,
  same_institution boolean
)
language sql
stable
set search_path = ''
as $$
  with me as (
    select p.id, nullif(lower(btrim(p.institution)), '') as institution
    from public.profiles p
    where p.id = (select auth.uid())
  ),
  my_areas as (
    select pra.area_id from public.profile_research_areas pra, me where pra.profile_id = me.id
  ),
  my_links as (
    select case when c.requester_id = me.id then c.addressee_id else c.requester_id end as other_id,
           c.status
    from public.connections c, me
    where me.id in (c.requester_id, c.addressee_id)
  ),
  my_connections as (
    select l.other_id from my_links l where l.status = 'accepted'
  ),
  scored as (
    select
      p.id, p.full_name, p.avatar_url, p.headline, p.institution, p.career_stage, p.onboarded_at,
      (select count(*) from public.profile_research_areas pra
        where pra.profile_id = p.id and pra.area_id in (select a.area_id from my_areas a))::integer
        as shared_areas,
      (select count(*) from public.connections c
        where c.status = 'accepted'
          and (
            (c.requester_id = p.id and c.addressee_id in (select m.other_id from my_connections m))
            or (c.addressee_id = p.id and c.requester_id in (select m.other_id from my_connections m))
          ))::integer as mutual_connections,
      coalesce(nullif(lower(btrim(p.institution)), '') = (select me.institution from me), false)
        as same_institution
    from public.profiles p
    where p.onboarded_at is not null
      and p.id <> (select me.id from me)
      and p.id not in (select l.other_id from my_links l)
  )
  select s.id, s.full_name, s.avatar_url, s.headline, s.institution, s.career_stage,
         s.shared_areas, s.mutual_connections, s.same_institution
  from scored s
  order by
    s.shared_areas * 3 + s.mutual_connections * 2 + case when s.same_institution then 2 else 0 end desc,
    s.onboarded_at desc
  limit least(greatest(coalesce(p_limit, 8), 1), 50);
$$;
comment on function public.get_connection_suggestions(integer) is
  'Sugestões de conexão para quem chama (docs/18 §2.1). Pontuação: áreas×3 + conexões em comum×2 + instituição×2.';

revoke all on function public.get_network_counts(uuid) from public, anon, authenticated;
revoke all on function public.get_connection_suggestions(integer) from public, anon, authenticated;
grant execute on function public.get_network_counts(uuid) to authenticated, service_role;
grant execute on function public.get_connection_suggestions(integer) to authenticated, service_role;
