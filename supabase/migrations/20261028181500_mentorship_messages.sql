-- =============================================================================
-- Artemis · 21 — conversa da mentoria (mensagens entre mentora e mentoranda)
--
--   Depois do aceite, a dupla conversa pela própria plataforma (/mentoria/conversa/<pedido>),
--   sem depender só do e-mail. Regras (todas no banco, valem também pela API):
--
--   | Quem                      | Ler | Enviar                         | Alterar             | Apagar |
--   | ------------------------- | --- | ------------------------------ | ------------------- | ------ |
--   | as duas participantes     | sim | só com o pedido `accepted`     | `read_at` (só quem  | não    |
--   |                           |     | e em nome próprio              | recebeu a mensagem) |        |
--   | moderação / outras membras| não | não                            | não                 | não    |
--
--   - Conversa privada: nem a moderação lê (denúncias seguem pelo fluxo normal — docs/09).
--   - Concluída ou cancelada, a conversa fica guardada só para leitura (CD027).
--   - Anti-spam: 60 mensagens por hora por pessoa (CD026), no registro private.rate_limit_events.
--   - Aviso para a outra participante (notificação `mentorship_message`) agrupado: enquanto ela
--     tiver um aviso NÃO LIDO desta conversa, mensagens novas não criam outro.
--   - Exclusão de conta (LGPD): apagar o perfil apaga o pedido e as mensagens em cascata — e os
--     avisos desta conversa que ficaram com a outra participante.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Novo tipo de notificação. O valor só pode ser USADO depois do commit desta migration: aqui
--    ele aparece apenas dentro de corpos plpgsql, que são planejados na primeira execução.
-- -----------------------------------------------------------------------------
alter type public.notification_type add value if not exists 'mentorship_message';

-- -----------------------------------------------------------------------------
-- 2. Registro anti-spam: nova ação 'mentorship_message' (lista completa repetida de propósito —
--    quem acrescentar outra ação depois precisa manter esta).
-- -----------------------------------------------------------------------------
alter table private.rate_limit_events
  drop constraint rate_limit_events_action_check,
  add constraint rate_limit_events_action_check check (
    action in ('forum_thread', 'forum_post', 'paper_comment', 'paper', 'paper_vote', 'mentorship_message')
  );

-- -----------------------------------------------------------------------------
-- 3. Tabela
-- -----------------------------------------------------------------------------
create table public.mentorship_messages (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.mentorship_requests (id) on delete cascade,
  sender_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body text not null check (char_length(btrim(body, E' \t\r\n')) between 1 and 2000),
  created_at timestamptz not null default now(),
  read_at timestamptz
);
comment on table public.mentorship_messages is
  'Conversa privada da mentoria. Só as duas participantes leem; envio só com o pedido aceito; só read_at muda (por quem recebeu).';
comment on column public.mentorship_messages.read_at is
  'Quando a outra participante leu (hora do servidor). Só quem recebeu marca; não volta a NULL.';

create index mentorship_messages_request_created_idx
  on public.mentorship_messages (request_id, created_at);
create index mentorship_messages_sender_id_idx on public.mentorship_messages (sender_id);

-- -----------------------------------------------------------------------------
-- 4. Antes de inserir: participante, autoria, conversa aberta e limite anti-spam.
--    SECURITY DEFINER para ler o pedido e gravar no registro anti-spam; a ordem das checagens
--    não revela nada a quem não participa (pedido inexistente e pedido alheio dão o mesmo erro).
-- -----------------------------------------------------------------------------
create function private.mentorship_messages_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_trusted boolean := private.is_trusted_context();
  v_mentee uuid;
  v_mentor uuid;
  v_status public.mentorship_status;
begin
  new.body := btrim(new.body, E' \t\r\n');
  if not v_trusted then
    -- Data e leitura vêm do servidor: ninguém antedata mensagem nem a envia "já lida".
    new.created_at := now();
    new.read_at := null;
  end if;

  -- FOR SHARE: uma conclusão/cancelamento simultâneo espera esta mensagem (ou vice-versa) e a
  -- checagem de status abaixo enxerga o valor final.
  select r.mentee_id, r.mentor_id, r.status
    into v_mentee, v_mentor, v_status
  from public.mentorship_requests r
  where r.id = new.request_id
  for share;

  if not found or (not v_trusted and (v_uid is null or v_uid not in (v_mentee, v_mentor))) then
    raise exception using
      errcode = 'CD015',
      message = 'Não encontramos esta conversa. Confira o link ou volte para a sua página de mentoria.';
  end if;

  if not v_trusted and new.sender_id is distinct from v_uid then
    raise exception using
      errcode = 'CD013',
      message = 'Autoria inválida: envie mensagens sempre com a sua própria conta.';
  end if;

  if new.sender_id is null or new.sender_id not in (v_mentee, v_mentor) then
    raise exception using
      errcode = 'CD013',
      message = 'A mensagem precisa ser de uma das participantes da mentoria.';
  end if;

  if not v_trusted and v_status <> 'accepted' then
    raise exception using
      errcode = 'CD027',
      message = case v_status
        when 'completed' then 'Esta mentoria foi concluída: a conversa fica guardada só para leitura.'
        when 'cancelled' then 'Esta mentoria foi cancelada: a conversa fica guardada só para leitura.'
        else 'A conversa abre quando a mentora aceitar o pedido de mentoria.'
      end;
  end if;

  -- Por último: um envio recusado acima não gasta a cota (e qualquer erro desfaz o registro).
  perform private.enforce_rate_limit('mentorship_message', 60, interval '1 hour', 'CD026',
    'Você enviou muitas mensagens na última hora. Respire e tente de novo em alguns minutos.');

  return new;
end;
$$;
revoke all on function private.mentorship_messages_before_insert() from public, anon, authenticated;

create trigger mentorship_messages_before_insert
  before insert on public.mentorship_messages
  for each row execute function private.mentorship_messages_before_insert();

-- -----------------------------------------------------------------------------
-- 5. Antes de atualizar: só read_at muda (defesa em profundidade: o GRANT já é só de read_at).
--    A leitura vale uma vez, com a hora do servidor, e não pode ser desfeita.
-- -----------------------------------------------------------------------------
create function private.mentorship_messages_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if new.id is distinct from old.id
     or new.request_id is distinct from old.request_id
     or new.sender_id is distinct from old.sender_id
     or new.body is distinct from old.body
     or new.created_at is distinct from old.created_at then
    raise exception using
      errcode = 'CD002',
      message = 'As mensagens não podem ser editadas: só é possível marcá-las como lidas.';
  end if;

  if not private.is_trusted_context() then
    if v_uid is null or v_uid = old.sender_id then
      raise exception using
        errcode = 'CD002',
        message = 'Só quem recebeu a mensagem pode marcá-la como lida.';
    end if;
    if old.read_at is not null then
      new.read_at := old.read_at;
    elsif new.read_at is not null then
      new.read_at := now();
    end if;
  end if;
  return new;
end;
$$;
revoke all on function private.mentorship_messages_before_update() from public, anon, authenticated;

create trigger mentorship_messages_before_update
  before update on public.mentorship_messages
  for each row execute function private.mentorship_messages_before_update();

-- -----------------------------------------------------------------------------
-- 6. Aviso para a outra participante, agrupado por conversa: se ela já tem um aviso não lido
--    desta conversa, não cria outro (o link identifica a conversa).
-- -----------------------------------------------------------------------------
create function private.notify_mentorship_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_mentee uuid;
  v_mentor uuid;
  v_recipient uuid;
  v_link text := '/mentoria/conversa/' || new.request_id::text;
begin
  select r.mentee_id, r.mentor_id into v_mentee, v_mentor
  from public.mentorship_requests r
  where r.id = new.request_id;

  v_recipient := case when new.sender_id = v_mentee then v_mentor else v_mentee end;
  if v_recipient is null or v_recipient = new.sender_id then
    return null;
  end if;

  -- Serializa avisos da mesma conversa para a mesma pessoa (duas mensagens ao mesmo tempo não
  -- criam dois avisos).
  perform pg_advisory_xact_lock(
    hashtextextended('mentorship_message_notify:' || v_recipient::text || ':' || new.request_id::text, 0)
  );

  if exists (
    select 1 from public.notifications n
    where n.user_id = v_recipient
      and n.type = 'mentorship_message'
      and n.link = v_link
      and n.read_at is null
  ) then
    return null;
  end if;

  perform private.notify(
    v_recipient,
    'mentorship_message',
    format('Nova mensagem de %s', private.display_name(new.sender_id)),
    'Abra a conversa da mentoria para ler e responder.',
    v_link,
    new.created_at
  );
  return null;
end;
$$;
revoke all on function private.notify_mentorship_message() from public, anon, authenticated;

create trigger mentorship_messages_notify
  after insert on public.mentorship_messages
  for each row execute function private.notify_mentorship_message();

-- -----------------------------------------------------------------------------
-- 7. LGPD: pedido apagado (em geral, em cascata pela exclusão de uma conta) → apaga também os
--    avisos desta conversa que ficaram com a outra participante (o título traz o nome de quem
--    saiu e o link levaria a uma conversa que não existe mais). As mensagens já somem pela FK.
-- -----------------------------------------------------------------------------
create function private.mentorship_requests_after_delete_messages()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.notifications n
  where n.user_id in (old.mentee_id, old.mentor_id)
    and n.type = 'mentorship_message'
    and n.link = '/mentoria/conversa/' || old.id::text;
  return null;
end;
$$;
revoke all on function private.mentorship_requests_after_delete_messages() from public, anon, authenticated;

create trigger mentorship_requests_after_delete_messages
  after delete on public.mentorship_requests
  for each row execute function private.mentorship_requests_after_delete_messages();

-- -----------------------------------------------------------------------------
-- 8. RLS + GRANTs (só colunas necessárias; nada de DELETE para membras)
-- -----------------------------------------------------------------------------
alter table public.mentorship_messages enable row level security;

create policy "Participantes leem a conversa da mentoria"
  on public.mentorship_messages for select
  to authenticated
  using (
    exists (
      select 1 from public.mentorship_requests r
      where r.id = request_id
        and (select auth.uid()) in (r.mentee_id, r.mentor_id)
    )
  );

create policy "Participantes escrevem na conversa da mentoria aceita"
  on public.mentorship_messages for insert
  to authenticated
  with check (
    sender_id = (select auth.uid())
    and exists (
      select 1 from public.mentorship_requests r
      where r.id = request_id
        and r.status = 'accepted'
        and (select auth.uid()) in (r.mentee_id, r.mentor_id)
    )
  );

create policy "Quem recebeu marca a mensagem como lida"
  on public.mentorship_messages for update
  to authenticated
  using (
    sender_id <> (select auth.uid())
    and exists (
      select 1 from public.mentorship_requests r
      where r.id = request_id
        and (select auth.uid()) in (r.mentee_id, r.mentor_id)
    )
  )
  with check (
    sender_id <> (select auth.uid())
    and exists (
      select 1 from public.mentorship_requests r
      where r.id = request_id
        and (select auth.uid()) in (r.mentee_id, r.mentor_id)
    )
  );

revoke all on table public.mentorship_messages from anon, authenticated;
grant select on table public.mentorship_messages to authenticated;
grant insert (request_id, sender_id, body) on table public.mentorship_messages to authenticated;
grant update (read_at) on table public.mentorship_messages to authenticated;
grant all on table public.mentorship_messages to service_role;
