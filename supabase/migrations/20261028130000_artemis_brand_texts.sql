-- =============================================================================
-- Artemis · 12 — nova marca nos textos gerados pelo banco
-- =============================================================================
-- A plataforma passou a se chamar Artemis ("Ciência Delas" continua como o tema do
-- hackathon). O único texto visível produzido pelo banco que citava o nome é a
-- notificação de mentoria concluída: recria private.notify_mentorship_change() com o
-- MESMO corpo da migration 20261027120600 — só a frase final muda. As notificações já
-- gravadas não são alteradas aqui (o seed e o banco local de demonstração são
-- atualizados à parte).
-- =============================================================================

-- Pedido novo → mentora; mudança de status → a outra participante.
create or replace function private.notify_mentorship_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_recipient uuid;
begin
  if tg_op = 'INSERT' then
    perform private.notify(
      new.mentor_id,
      'mentorship_request',
      'Novo pedido de mentoria',
      format('%s gostaria da sua mentoria. Leia a mensagem e responda quando puder.', private.display_name(new.mentee_id)),
      '/mentoria',
      new.created_at
    );
    return null;
  end if;

  if new.status is not distinct from old.status then
    return null;
  end if;

  v_recipient := case
    when v_actor = new.mentor_id then new.mentee_id
    when v_actor = new.mentee_id then new.mentor_id
    when new.status in ('accepted', 'declined') then new.mentee_id
    else new.mentor_id
  end;

  perform private.notify(
    v_recipient,
    'mentorship_response',
    case new.status
      when 'accepted' then 'Seu pedido de mentoria foi aceito'
      when 'declined' then 'Seu pedido de mentoria não pôde ser aceito'
      when 'cancelled' then 'Uma mentoria foi cancelada'
      when 'completed' then 'Mentoria concluída'
      else 'Atualização no pedido de mentoria'
    end,
    case new.status
      when 'accepted' then format('%s aceitou ser sua mentora. Combinem o primeiro encontro!', private.display_name(new.mentor_id))
      when 'declined' then 'Não desanime: há outras mentoras na rede esperando por você.'
      when 'cancelled' then format('%s cancelou o pedido de mentoria.', private.display_name(coalesce(v_actor, new.mentee_id)))
      when 'completed' then 'Obrigada por fortalecer a rede da Artemis!'
      else null
    end,
    '/mentoria',
    case when new.status in ('accepted', 'declined') then new.responded_at end
  );
  return null;
end;
$$;
revoke all on function private.notify_mentorship_change() from public, anon, authenticated;
