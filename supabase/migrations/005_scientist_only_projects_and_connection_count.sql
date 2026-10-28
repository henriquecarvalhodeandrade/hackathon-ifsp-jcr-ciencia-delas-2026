-- ==============================================================================
-- ÁRTEMIS — MIGRATION 005: Restrição de IC para cientistas + contador de conexões
--
-- 1. Apenas contas com account_type = 'scientist' podem criar projetos de IC
--    (reforço no RLS — a Server Action também valida, regra em dois lugares).
-- 2. Função security definer connection_count(p_user_id): contagem de conexões
--    aceitas de um usuário, visível no perfil mesmo para terceiros (a policy
--    connections_select_involved só mostra conexões envolvendo o próprio
--    observador; um COUNT de terceiros retornaria 0/1 incorreto).
--
-- ATENÇÃO: migration sequencial (005). Não alterar arquivos já executados.
-- ==============================================================================

-- 1. SOMENTE CIENTISTAS CRIAM PROJETOS DE IC
drop policy if exists "projects_insert_auth" on public.projects;

create policy "projects_insert_auth" on public.projects
  for insert to authenticated
  with check (
    creator_id = (select auth.uid())
    and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and p.account_type = 'scientist'
    )
  );

-- 2. CONTAGEM DE CONEXÕES ACEITAS (visível no perfil para qualquer autenticado)
create or replace function public.connection_count(p_user_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
  from public.connections c
  where c.status = 'accepted'
    and (c.requester_id = p_user_id or c.addressee_id = p_user_id);
$$;

revoke all on function public.connection_count(uuid) from public;
grant execute on function public.connection_count(uuid) to authenticated;
