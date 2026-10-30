-- =============================================================================
-- Artemis · 32 — sugestões de conexão sem as contas da equipe (docs/18-rede-social.md §2.1)
--
--   A auditoria de UX viu "Helena Duarte · Coordenadora da rede Artemis" sugerida para a Larissa:
--   contas com papel de moderação/administração continuam membras (seguir, conectar e conversar
--   funcionam), mas não aparecem em "Pessoas que você talvez conheça". Corpo igual ao de
--   20261029000000_rede_social_base.sql, com `p.role = 'member'` no filtro.
-- =============================================================================

-- Pessoas que você talvez conheça: áreas em comum (peso 3), conexões em comum (2), mesma
-- instituição (2). Sem quem já tem convite/conexão comigo, sem eu mesma, só cadastro completo e
-- sem as contas da equipe (coordenação e moderação).
create or replace function public.get_connection_suggestions(p_limit integer default 8)
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
      and p.role = 'member'
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
