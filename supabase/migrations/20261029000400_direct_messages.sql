-- =============================================================================
-- Artemis · 30 — rede social, parte 5: mensagens diretas (docs/18-rede-social.md §2.5)
--
--   Conversa privada entre quaisquer duas membras.
--
--   | Tabela               | Ler                  | Escrever                                            |
--   | -------------------- | -------------------- | --------------------------------------------------- |
--   | direct_conversations | as duas participantes| só pelas RPCs (start/respond/mark_read) e triggers  |
--   | direct_messages      | as duas participantes| em nome próprio, nas regras abaixo; nada se edita   |
--   |                      |                      | nem se apaga                                        |
--
--   - Uma conversa por par. Nasce `active` quando as duas já têm vínculo na plataforma (conexão
--     aceita, mentoria aceita/concluída ou candidatura aprovada); senão `request`.
--   - Pedido de mensagem: quem começou manda UMA mensagem e espera (CD086). Quem recebeu aceita
--     respondendo (ou pelo botão) ou recusa; recusada, quem começou continua vendo "aguardando"
--     (a recusa nunca é revelada) e não manda mais nada.
--   - Estudantes do ensino médio (podem ter menos de 18 anos) só recebem mensagens de quem tem
--     vínculo com elas (CD084).
--   - Anti-spam: 60 mensagens/h (CD088), 20 conversas novas/dia (CD089).
--   - Nem a moderação lê: denuncia-se o perfil (docs/09).
--   - Realtime: as duas tabelas entram na publicação supabase_realtime (o Realtime respeita o RLS).
--   - LGPD: apagar o perfil apaga as conversas dela (e as mensagens) em cascata; os avisos das
--     conversas apagadas também somem.
-- =============================================================================

create type public.conversation_status as enum ('request', 'active', 'declined');

-- -----------------------------------------------------------------------------
-- 1. Tabelas
-- -----------------------------------------------------------------------------
create table public.direct_conversations (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references public.profiles (id) on delete cascade,
  user_b uuid not null references public.profiles (id) on delete cascade,
  initiator_id uuid not null references public.profiles (id) on delete cascade,
  status public.conversation_status not null default 'request',
  user_a_read_at timestamptz,
  user_b_read_at timestamptz,
  last_message_at timestamptz,
  last_message_preview text check (char_length(last_message_preview) <= 140),
  last_sender_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint direct_conversations_ordered check (user_a < user_b),
  constraint direct_conversations_initiator check (initiator_id in (user_a, user_b)),
  constraint direct_conversations_pair unique (user_a, user_b)
);
comment on table public.direct_conversations is
  'Conversas diretas (docs/18 §2.5). Uma por par (user_a < user_b). Escrita só por RPCs e triggers.';

create index direct_conversations_user_a_idx on public.direct_conversations (user_a, last_message_at desc nulls last);
create index direct_conversations_user_b_idx on public.direct_conversations (user_b, last_message_at desc nulls last);

create table public.direct_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.direct_conversations (id) on delete cascade,
  sender_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body text not null check (char_length(btrim(body, E' \t\r\n')) between 1 and 2000),
  created_at timestamptz not null default now()
);
comment on table public.direct_messages is
  'Mensagens das conversas diretas. Só as participantes leem; não se editam nem se apagam.';

create index direct_messages_conversation_created_idx on public.direct_messages (conversation_id, created_at);
create index direct_messages_sender_idx on public.direct_messages (sender_id);

-- -----------------------------------------------------------------------------
-- 2. Regras auxiliares
-- -----------------------------------------------------------------------------
-- Vínculo que dispensa o pedido de mensagem: conexão aceita, mentoria aceita/concluída ou
-- candidatura aprovada (em qualquer direção).
create function private.can_message_freely(p_a uuid, p_b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.are_connected(p_a, p_b)
    or exists (
      select 1 from public.mentorship_requests r
      where r.status in ('accepted', 'completed')
        and ((r.mentee_id = p_a and r.mentor_id = p_b) or (r.mentee_id = p_b and r.mentor_id = p_a))
    )
    or exists (
      select 1 from public.opportunity_applications a
      join public.research_opportunities o on o.id = a.opportunity_id
      where a.status = 'accepted'
        and ((a.applicant_id = p_a and o.owner_id = p_b) or (a.applicant_id = p_b and o.owner_id = p_a))
    );
$$;
revoke all on function private.can_message_freely(uuid, uuid) from public, anon, authenticated;

create function private.is_high_school(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select p.career_stage = 'high_school' from public.profiles p where p.id = p_profile_id), false);
$$;
revoke all on function private.is_high_school(uuid) from public, anon, authenticated;

-- A usuária participa da conversa? (RLS das mensagens)
create function private.in_conversation(p_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.direct_conversations c
    where c.id = p_conversation_id and (select auth.uid()) in (c.user_a, c.user_b)
  );
$$;
revoke all on function private.in_conversation(uuid) from public, anon, authenticated;
grant execute on function private.in_conversation(uuid) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 3. Mensagens: regras antes de inserir e efeitos depois
-- -----------------------------------------------------------------------------
create function private.direct_messages_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_trusted boolean := private.is_trusted_context();
  v_conv public.direct_conversations%rowtype;
  v_other uuid;
begin
  new.body := btrim(new.body, E' \t\r\n');
  if not v_trusted then
    new.created_at := now();
  end if;

  select * into v_conv from public.direct_conversations c where c.id = new.conversation_id for update;
  if not found or (not v_trusted and (v_uid is null or v_uid not in (v_conv.user_a, v_conv.user_b))) then
    raise exception using
      errcode = 'CD085',
      message = 'Não encontramos esta conversa. Confira o link ou volte para as suas mensagens.';
  end if;

  if not v_trusted and new.sender_id is distinct from v_uid then
    raise exception using
      errcode = 'CD013',
      message = 'Autoria inválida: envie mensagens sempre com a sua própria conta.';
  end if;
  if new.sender_id is null or new.sender_id not in (v_conv.user_a, v_conv.user_b) then
    raise exception using
      errcode = 'CD013',
      message = 'A mensagem precisa ser de uma das participantes da conversa.';
  end if;
  v_other := case when new.sender_id = v_conv.user_a then v_conv.user_b else v_conv.user_a end;

  if v_conv.status <> 'active' then
    if private.can_message_freely(new.sender_id, v_other) or new.sender_id <> v_conv.initiator_id then
      -- Vínculo novo (conexão aceita depois do pedido) ou resposta de quem recebeu: a conversa abre.
      update public.direct_conversations set status = 'active' where id = v_conv.id;
    elsif not v_trusted then
      if private.is_high_school(v_other) then
        raise exception using
          errcode = 'CD084',
          message = 'Para proteger estudantes do ensino médio, só conexões mandam mensagem para elas. Envie um convite de conexão.';
      end if;
      -- Pedido (ou pedido recusado, que quem começou continua vendo como pedido): uma mensagem só.
      if exists (
        select 1 from public.direct_messages m
        where m.conversation_id = v_conv.id and m.sender_id = new.sender_id
      ) then
        raise exception using
          errcode = 'CD086',
          message = 'Seu pedido de mensagem foi enviado. Você poderá mandar mais mensagens quando ela responder.';
      end if;
    end if;
  end if;

  if not v_trusted then
    perform private.enforce_rate_limit('direct_message', 60, interval '1 hour', 'CD088',
      'Você enviou muitas mensagens na última hora. Respire e tente de novo em alguns minutos.');
  end if;
  return new;
end;
$$;
revoke all on function private.direct_messages_before_insert() from public, anon, authenticated;

create trigger direct_messages_before_insert
  before insert on public.direct_messages
  for each row execute function private.direct_messages_before_insert();

-- Depois de inserir: resumo da conversa, leitura de quem enviou e aviso agrupado para a outra.
create function private.direct_messages_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_conv public.direct_conversations%rowtype;
  v_recipient uuid;
  v_link text := '/mensagens/' || new.conversation_id::text;
begin
  update public.direct_conversations c
    set last_message_at = new.created_at,
        last_message_preview = left(regexp_replace(new.body, '\s+', ' ', 'g'), 140),
        last_sender_id = new.sender_id,
        user_a_read_at = case when c.user_a = new.sender_id then new.created_at else c.user_a_read_at end,
        user_b_read_at = case when c.user_b = new.sender_id then new.created_at else c.user_b_read_at end
  where c.id = new.conversation_id
  returning * into v_conv;

  v_recipient := case when new.sender_id = v_conv.user_a then v_conv.user_b else v_conv.user_a end;

  perform pg_advisory_xact_lock(hashtextextended('direct_message_notify:' || v_recipient::text || ':' || v_link, 0));
  if exists (
    select 1 from public.notifications n
    where n.user_id = v_recipient and n.type = 'direct_message' and n.link = v_link and n.read_at is null
  ) then
    return null;
  end if;

  perform private.notify(
    v_recipient,
    'direct_message',
    case when v_conv.status = 'active'
      then format('Nova mensagem de %s', private.display_name(new.sender_id))
      else format('%s quer conversar com você', private.display_name(new.sender_id))
    end,
    case when v_conv.status = 'active'
      then 'Abra a conversa para ler e responder.'
      else 'É um pedido de mensagem: responda para aceitar ou recuse, se preferir.'
    end,
    v_link,
    new.created_at
  );
  return null;
end;
$$;
revoke all on function private.direct_messages_after_insert() from public, anon, authenticated;

create trigger direct_messages_after_insert
  after insert on public.direct_messages
  for each row execute function private.direct_messages_after_insert();

-- Conversa apagada (em geral em cascata, pela exclusão de uma conta) → somem os avisos dela.
create function private.direct_conversations_after_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.notifications n
  where n.type = 'direct_message' and n.link = '/mensagens/' || old.id::text;
  return null;
end;
$$;
revoke all on function private.direct_conversations_after_delete() from public, anon, authenticated;

create trigger direct_conversations_after_delete
  after delete on public.direct_conversations
  for each row execute function private.direct_conversations_after_delete();

-- -----------------------------------------------------------------------------
-- 4. RLS + GRANTs
-- -----------------------------------------------------------------------------
alter table public.direct_conversations enable row level security;
alter table public.direct_messages enable row level security;

create policy "Participantes veem a conversa"
  on public.direct_conversations for select
  to authenticated
  using ((select auth.uid()) in (user_a, user_b));

create policy "Participantes leem as mensagens"
  on public.direct_messages for select
  to authenticated
  using (private.in_conversation(conversation_id));

create policy "Participantes escrevem em nome próprio"
  on public.direct_messages for insert
  to authenticated
  with check (sender_id = (select auth.uid()) and private.in_conversation(conversation_id));

revoke all on table public.direct_conversations from anon, authenticated;
revoke all on table public.direct_messages from anon, authenticated;
grant select on table public.direct_conversations to authenticated;
grant select on table public.direct_messages to authenticated;
grant insert (conversation_id, sender_id, body) on table public.direct_messages to authenticated;
grant all on table public.direct_conversations to service_role;
grant all on table public.direct_messages to service_role;

-- Realtime (se a publicação existir): a conversa aberta ouve mensagens novas.
do $$
declare
  v_table text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach v_table in array array['direct_messages', 'direct_conversations'] loop
      if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = v_table
      ) then
        execute format('alter publication supabase_realtime add table public.%I', v_table);
      end if;
    end loop;
  end if;
end
$$;

-- -----------------------------------------------------------------------------
-- 5. RPCs
-- -----------------------------------------------------------------------------
-- Acha ou cria a conversa com outra membra e devolve o id.
create function public.start_direct_conversation(p_other uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_a uuid;
  v_b uuid;
  v_conv public.direct_conversations%rowtype;
  v_free boolean;
begin
  if v_uid is null then
    raise exception using errcode = '42501', message = 'Entre na sua conta para mandar mensagens.';
  end if;
  if p_other is null or p_other = v_uid then
    raise exception using
      errcode = 'CD065',
      message = 'Você não pode mandar mensagem para si mesma.';
  end if;
  if not private.is_onboarded(v_uid) then
    raise exception using
      errcode = 'CD060',
      message = 'Complete o seu cadastro para mandar mensagens.';
  end if;
  if not private.is_onboarded(p_other) then
    raise exception using
      errcode = 'CD060',
      message = 'Não encontramos esta pesquisadora. Confira o link ou procure no diretório.';
  end if;

  v_a := least(v_uid, p_other);
  v_b := greatest(v_uid, p_other);
  perform pg_advisory_xact_lock(hashtextextended('direct_conversation:' || v_a::text || ':' || v_b::text, 0));
  v_free := private.can_message_freely(v_uid, p_other);

  select * into v_conv from public.direct_conversations c where c.user_a = v_a and c.user_b = v_b;
  if found then
    if v_conv.status <> 'active' and v_free then
      update public.direct_conversations set status = 'active' where id = v_conv.id;
    end if;
    return v_conv.id;
  end if;

  if not v_free and private.is_high_school(p_other) then
    raise exception using
      errcode = 'CD084',
      message = 'Para proteger estudantes do ensino médio, só conexões mandam mensagem para elas. Envie um convite de conexão.';
  end if;

  perform private.enforce_rate_limit('direct_conversation', 20, interval '24 hours', 'CD089',
    'Você começou muitas conversas hoje. Tente de novo amanhã.');

  insert into public.direct_conversations (user_a, user_b, initiator_id, status)
  values (v_a, v_b, v_uid, case when v_free then 'active' else 'request' end::public.conversation_status)
  returning * into v_conv;
  return v_conv.id;
end;
$$;
comment on function public.start_direct_conversation(uuid) is
  'Acha ou cria a conversa direta com outra membra (docs/18 §2.5). Pedido de mensagem sem vínculo.';

-- Quem recebeu o pedido aceita ou recusa (recusado também pode ser aceito depois).
create function public.respond_conversation_request(p_conversation_id uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_conv public.direct_conversations%rowtype;
begin
  select * into v_conv from public.direct_conversations c where c.id = p_conversation_id for update;
  if not found or v_uid is null or v_uid not in (v_conv.user_a, v_conv.user_b) then
    raise exception using
      errcode = 'CD085',
      message = 'Não encontramos esta conversa. Confira o link ou volte para as suas mensagens.';
  end if;
  if v_uid = v_conv.initiator_id or v_conv.status = 'active' then
    return;
  end if;
  update public.direct_conversations
    set status = case when p_accept then 'active' else 'declined' end::public.conversation_status
  where id = v_conv.id;
end;
$$;

-- Marca a conversa como lida por quem chamou (e os avisos dela).
create function public.mark_conversation_read(p_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    return;
  end if;
  update public.direct_conversations c
    set user_a_read_at = case when c.user_a = v_uid then now() else c.user_a_read_at end,
        user_b_read_at = case when c.user_b = v_uid then now() else c.user_b_read_at end
  where c.id = p_conversation_id and v_uid in (c.user_a, c.user_b);

  update public.notifications n
    set read_at = now()
  where n.user_id = v_uid
    and n.type = 'direct_message'
    and n.link = '/mensagens/' || p_conversation_id::text
    and n.read_at is null;
end;
$$;

-- Caixa de entrada de quem chama (SECURITY INVOKER: o RLS vale).
create function public.list_my_conversations()
returns table (
  id uuid,
  status public.conversation_status,
  initiator_id uuid,
  last_message_at timestamptz,
  last_message_preview text,
  last_sender_id uuid,
  unread boolean,
  other_id uuid,
  other_name text,
  other_avatar_url text,
  other_headline text,
  other_career_stage public.career_stage,
  created_at timestamptz
)
language sql
stable
set search_path = ''
as $$
  select
    c.id, c.status, c.initiator_id, c.last_message_at, c.last_message_preview, c.last_sender_id,
    (c.last_message_at is not null
      and c.last_sender_id is distinct from (select auth.uid())
      and coalesce(
        c.last_message_at > case when c.user_a = (select auth.uid()) then c.user_a_read_at else c.user_b_read_at end,
        true
      )) as unread,
    p.id, coalesce(nullif(btrim(p.full_name), ''), 'Pesquisadora'), p.avatar_url, p.headline, p.career_stage,
    c.created_at
  from public.direct_conversations c
  join public.profiles p
    on p.id = case when c.user_a = (select auth.uid()) then c.user_b else c.user_a end
  where (select auth.uid()) in (c.user_a, c.user_b)
  order by coalesce(c.last_message_at, c.created_at) desc;
$$;

-- Conversas com mensagem nova da outra pessoa (selo do cabeçalho).
create function public.count_unread_conversations()
returns integer
language sql
stable
set search_path = ''
as $$
  select count(*)::integer
  from public.direct_conversations c
  where (select auth.uid()) in (c.user_a, c.user_b)
    and c.last_message_at is not null
    and c.last_sender_id is distinct from (select auth.uid())
    and coalesce(
      c.last_message_at > case when c.user_a = (select auth.uid()) then c.user_a_read_at else c.user_b_read_at end,
      true
    );
$$;

revoke all on function public.start_direct_conversation(uuid) from public, anon, authenticated;
revoke all on function public.respond_conversation_request(uuid, boolean) from public, anon, authenticated;
revoke all on function public.mark_conversation_read(uuid) from public, anon, authenticated;
revoke all on function public.list_my_conversations() from public, anon, authenticated;
revoke all on function public.count_unread_conversations() from public, anon, authenticated;
grant execute on function public.start_direct_conversation(uuid) to authenticated, service_role;
grant execute on function public.respond_conversation_request(uuid, boolean) to authenticated, service_role;
grant execute on function public.mark_conversation_read(uuid) to authenticated, service_role;
grant execute on function public.list_my_conversations() to authenticated, service_role;
grant execute on function public.count_unread_conversations() to authenticated, service_role;
