-- =============================================================================
-- Artemis · 33 — rede: avisos que deixam de ser verdade somem (docs/18-rede-social.md §2.1)
--
--   A auditoria de UX viu "começou a seguir você" e "aceitou o seu convite" continuarem no sininho
--   da outra pessoa depois de quem seguiu deixar de seguir, ou de a conexão ser removida.
--     * follows: apagar o "seguir" apaga o aviso `new_follower` ainda NÃO lido dessa pessoa;
--     * connections: além do convite pendente (que já levava o aviso do convite), uma conexão
--       aceita removida leva o aviso `connection_accepted` ainda não lido de quem convidou.
--   Avisos já lidos ficam: são histórico de quem os recebeu.
-- =============================================================================

create function private.follows_after_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.notifications n
  where n.user_id = old.followee_id
    and n.type = 'new_follower'
    and n.link = '/pesquisadoras/' || old.follower_id::text
    and n.read_at is null;
  return null;
end;
$$;
revoke all on function private.follows_after_delete() from public, anon, authenticated;

create trigger follows_after_delete
  after delete on public.follows
  for each row execute function private.follows_after_delete();

-- Corpo de 20261029000000_rede_social_base.sql + o caso da conexão aceita.
create or replace function private.connections_after_delete()
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
  elsif old.status = 'accepted' then
    delete from public.notifications n
    where n.user_id = old.requester_id
      and n.type = 'connection_accepted'
      and n.link = '/pesquisadoras/' || old.addressee_id::text
      and n.read_at is null;
  end if;
  return null;
end;
$$;
revoke all on function private.connections_after_delete() from public, anon, authenticated;
