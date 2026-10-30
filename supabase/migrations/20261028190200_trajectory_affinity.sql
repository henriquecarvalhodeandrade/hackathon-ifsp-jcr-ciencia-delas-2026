-- =============================================================================
-- Artemis · 24 — afinidade de trajetória (docs/17-afinidade-de-trajetoria.md)
--
--   Marcas OPCIONAIS e autodeclaradas no perfil ("fui a primeira da família na universidade",
--   "estudei em escola pública"…), de um catálogo fechado de 8 opções. Elas viram:
--     * um pequeno bônus explicado no matching heurístico ("Vocês têm em comum: …");
--     * um filtro no diretório /pesquisadoras;
--     * uma seção "Trajetória" no perfil de membras.
--
--   | Quem                 | Ler                          | Alterar                            |
--   | -------------------- | ---------------------------- | ---------------------------------- |
--   | a própria membra     | sim                          | sim (GRANT de coluna + RLS: dona)  |
--   | outras membras       | sim (como o resto do perfil) | não (RLS: 0 linhas)                |
--   | visitantes (anon)    | não (sem SELECT em profiles) | não                                |
--
--   - Catálogo FECHADO e sem dados sensíveis do art. 11 da LGPD (raça/etnia, saúde/deficiência,
--     religião, orientação sexual, identidade de gênero) nem renda. Os slugs se repetem em
--     src/lib/trajectory/catalog.ts (o teste catalog.test.ts confere a paridade).
--   - Marca desconhecida → CD050 (antes do CHECK); repetidas saem e a lista fica em ordem.
--   - Nenhuma função para visitantes (estatísticas da landing, ranking, Pergunte, verificação de
--     declaração) nem o Boletim/OG leem esta coluna; a IA nunca a recebe (pseudonymize.ts).
--   - A RPC get_mentor_candidates passa a devolver trajectory_tags (última coluna) para o
--     cálculo do bônus. A definição abaixo é a de 20261027120800_rpc.sql, igual linha a linha,
--     com a coluna nova no fim.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Coluna + CHECK do catálogo
-- -----------------------------------------------------------------------------
alter table public.profiles
  add column trajectory_tags text[] not null default '{}';

alter table public.profiles
  add constraint profiles_trajectory_tags_catalog check (
    cardinality(trajectory_tags) <= 8
    and trajectory_tags <@ array[
      'primeira-geracao', 'escola-publica', 'ensino-tecnico', 'mae-cuidadora',
      'trabalha-e-estuda', 'retorno-aos-estudos', 'mudanca-de-area', 'fora-das-capitais'
    ]::text[]
  );

comment on column public.profiles.trajectory_tags is
  'Marcas de trajetória autodeclaradas e opcionais (catálogo fechado de 8, docs/17). Visíveis só para membras; nunca enviadas à IA; nunca em páginas públicas.';

-- Filtro do diretório: .contains('trajectory_tags', [slug]) → trajectory_tags @> '{slug}'.
create index profiles_trajectory_tags_idx on public.profiles using gin (trajectory_tags);

-- -----------------------------------------------------------------------------
-- 2. Normalização (trigger próprio; profiles_before_write fica intacto)
--    minúsculas e sem espaços nas pontas → recusa o que não é do catálogo (CD050) → sem
--    repetição e em ordem alfabética. NULL vira lista vazia.
-- -----------------------------------------------------------------------------
create function private.profiles_normalize_trajectory()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_catalog constant text[] := array[
    'primeira-geracao', 'escola-publica', 'ensino-tecnico', 'mae-cuidadora',
    'trabalha-e-estuda', 'retorno-aos-estudos', 'mudanca-de-area', 'fora-das-capitais'
  ];
begin
  if new.trajectory_tags is null then
    new.trajectory_tags := '{}';
    return new;
  end if;

  if exists (
    select 1
    from unnest(new.trajectory_tags) as t (tag)
    where t.tag is null or not (lower(btrim(t.tag)) = any (v_catalog))
  ) then
    raise exception using
      errcode = 'CD050',
      message = 'Uma das opções de trajetória não existe mais. Recarregue a página e escolha de novo.';
  end if;

  new.trajectory_tags := coalesce(
    (
      select array_agg(distinct lower(btrim(t.tag)) order by lower(btrim(t.tag)))
      from unnest(new.trajectory_tags) as t (tag)
    ),
    '{}'::text[]
  );
  return new;
end;
$$;

comment on function private.profiles_normalize_trajectory() is
  'Normaliza profiles.trajectory_tags (minúsculas, sem repetição, em ordem) e recusa marca fora do catálogo com CD050.';

revoke all on function private.profiles_normalize_trajectory() from public, anon, authenticated;

create trigger profiles_normalize_trajectory
  before insert or update of trajectory_tags on public.profiles
  for each row execute function private.profiles_normalize_trajectory();

-- -----------------------------------------------------------------------------
-- 3. GRANT por coluna (as colunas editáveis de profiles são explícitas — 20261027120100)
--    SELECT já vem do GRANT de tabela para authenticated; anon continua sem nada.
-- -----------------------------------------------------------------------------
grant insert (trajectory_tags), update (trajectory_tags) on table public.profiles to authenticated;

-- -----------------------------------------------------------------------------
-- 4. get_mentor_candidates — mesma definição de 20261027120800_rpc.sql + trajectory_tags no fim
--    (o tipo de retorno muda, então é DROP + CREATE; EXECUTE e comentário reaplicados).
-- -----------------------------------------------------------------------------
drop function public.get_mentor_candidates(integer);

create function public.get_mentor_candidates(p_limit integer default 30)
returns table (
  mentor_id uuid,
  full_name text,
  avatar_url text,
  headline text,
  institution text,
  state text,
  career_stage public.career_stage,
  keywords text[],
  mentorship_topics text[],
  meeting_formats public.meeting_format[],
  languages text[],
  mentoring_offer text,
  area_ids smallint[],
  similarity double precision,
  open_slots integer,
  existing_request_status public.mentorship_status,
  trajectory_tags text[]
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid uuid := (select auth.uid());
  v_embedding extensions.vector;
begin
  if v_uid is null then
    raise exception using
      errcode = '42501',
      message = 'Entre na sua conta para ver sugestões de mentoras.';
  end if;

  select e.embedding into v_embedding
  from public.profile_embeddings e
  where e.profile_id = v_uid;

  return query
  with accepted as (
    select r.mentor_id as accepted_mentor_id, count(*)::integer as total
    from public.mentorship_requests r
    where r.status = 'accepted'
    group by r.mentor_id
  ),
  candidates as (
    select
      p.id as candidate_id,
      p.full_name as candidate_name,
      p.avatar_url as candidate_avatar,
      p.headline as candidate_headline,
      p.institution as candidate_institution,
      p.state::text as candidate_state,
      p.career_stage as candidate_stage,
      p.keywords as candidate_keywords,
      p.mentorship_topics as candidate_topics,
      p.meeting_formats as candidate_formats,
      p.languages as candidate_languages,
      p.mentoring_offer as candidate_offer,
      (p.mentor_capacity - coalesce(a.total, 0))::integer as candidate_slots,
      case
        when v_embedding is null or pe.embedding is null then null::double precision
        else greatest(0::double precision, least(1::double precision,
          1 - (pe.embedding operator(extensions.<=>) v_embedding)))
      end as candidate_similarity,
      p.trajectory_tags as candidate_trajectory
    from public.profiles p
    left join accepted a on a.accepted_mentor_id = p.id
    left join public.profile_embeddings pe on pe.profile_id = p.id
    where p.is_mentor
      and p.mentor_available
      and p.onboarded_at is not null
      and p.id <> v_uid
      and p.mentor_capacity - coalesce(a.total, 0) > 0
  )
  select
    c.candidate_id,
    c.candidate_name,
    c.candidate_avatar,
    c.candidate_headline,
    c.candidate_institution,
    c.candidate_state,
    c.candidate_stage,
    c.candidate_keywords,
    c.candidate_topics,
    c.candidate_formats,
    c.candidate_languages,
    c.candidate_offer,
    coalesce(areas.ids, '{}'::smallint[]),
    c.candidate_similarity,
    c.candidate_slots,
    (
      select r.status
      from public.mentorship_requests r
      where r.mentee_id = v_uid
        and r.mentor_id = c.candidate_id
        and r.status in ('pending', 'accepted')
      order by r.created_at desc
      limit 1
    ),
    c.candidate_trajectory
  from candidates c
  left join lateral (
    select
      array_agg(pra.area_id order by pra.area_id)::smallint[] as ids,
      count(*) filter (
        where pra.area_id in (
          select mine.area_id from public.profile_research_areas mine where mine.profile_id = v_uid
        )
      ) as shared
    from public.profile_research_areas pra
    where pra.profile_id = c.candidate_id
  ) areas on true
  order by
    c.candidate_similarity desc nulls last,
    areas.shared desc nulls last,
    c.candidate_slots desc,
    c.candidate_name
  limit least(greatest(coalesce(p_limit, 30), 1), 100);
end;
$$;

revoke all on function public.get_mentor_candidates(integer) from public, anon, authenticated;
grant execute on function public.get_mentor_candidates(integer) to authenticated, service_role;

comment on function public.get_mentor_candidates(integer) is
  'Mentoras disponíveis (com vaga e recebendo pedidos) para a usuária logada, sem ela mesma: perfil público, áreas, similaridade de cosseno dos embeddings (NULL sem embedding), vagas, pedido em aberto e marcas de trajetória. Só para membras (SECURITY DEFINER).';
