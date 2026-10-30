-- =============================================================================
-- Artemis · 09 — RPCs públicas (supabase.rpc(...))
-- =============================================================================
-- Toda RPC: search_path vazio, nomes qualificados, EXECUTE revogado de PUBLIC e
-- concedido apenas aos papéis que precisam.

-- -----------------------------------------------------------------------------
-- Papel da usuária atual
-- -----------------------------------------------------------------------------
create function public.is_moderator()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_moderator();
$$;

create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_admin();
$$;

revoke all on function public.is_moderator() from public, anon, authenticated;
revoke all on function public.is_admin() from public, anon, authenticated;
-- anon recebe EXECUTE para páginas públicas poderem perguntar sem erro (retorna false).
grant execute on function public.is_moderator() to anon, authenticated, service_role;
grant execute on function public.is_admin() to anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- get_mentor_candidates — mentoras disponíveis para a usuária atual
-- similarity = similaridade de cosseno (0..1) entre os embeddings da mentoranda e
-- da mentora; NULL quando algum dos dois não existe.
-- -----------------------------------------------------------------------------
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
  existing_request_status public.mentorship_status
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
      end as candidate_similarity
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
    )
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

-- -----------------------------------------------------------------------------
-- get_mentorship_contact — e-mail da OUTRA participante, só em mentoria aceita
-- -----------------------------------------------------------------------------
create function public.get_mentorship_contact(p_request_id uuid)
returns table (email text, full_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select u.email::text, p.full_name
  from public.mentorship_requests r
  join public.profiles p
    on p.id = case when r.mentee_id = (select auth.uid()) then r.mentor_id else r.mentee_id end
  join auth.users u on u.id = p.id
  where r.id = p_request_id
    and r.status = 'accepted'
    and (select auth.uid()) in (r.mentee_id, r.mentor_id);
$$;

revoke all on function public.get_mentorship_contact(uuid) from public, anon, authenticated;
grant execute on function public.get_mentorship_contact(uuid) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- get_paper_ranking — ranking da Vitrine (público)
--   week/month/year: votos dados nos últimos 7/30/365 dias (period_votes);
--   all: vote_count; hot: vote_count / (idade_em_horas + 2)^1.5.
--   Desempate: vote_count desc, created_at desc. Papers ocultos ficam de fora.
--   p_area_slug de uma GRANDE área (name = big_area) inclui todas as subáreas dela.
-- -----------------------------------------------------------------------------
create function public.get_paper_ranking(
  p_period text default 'week',
  p_area_slug text default null,
  p_limit integer default 20,
  p_offset integer default 0
)
returns table (
  id uuid,
  title text,
  authors text[],
  venue text,
  year smallint,
  doi text,
  url text,
  area_id smallint,
  area_slug text,
  area_name text,
  plain_summary text,
  vote_count integer,
  period_votes bigint,
  comment_count integer,
  hot_score double precision,
  created_at timestamptz,
  submitted_by uuid
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_period text := lower(btrim(coalesce(p_period, 'week')));
  v_since timestamptz;
  v_big_area text;
begin
  if v_period not in ('week', 'month', 'year', 'all', 'hot') then
    raise exception using
      errcode = '22023',
      message = 'Período de ranking inválido. Use week, month, year, all ou hot.';
  end if;

  v_since := case v_period
    when 'week' then now() - interval '7 days'
    when 'month' then now() - interval '30 days'
    when 'year' then now() - interval '365 days'
    else null
  end;

  if p_area_slug is not null then
    select ra.big_area into v_big_area
    from public.research_areas ra
    where ra.slug = p_area_slug and ra.name = ra.big_area;
  end if;

  return query
  with ranked as (
    select
      p.id as paper_id,
      p.title as paper_title,
      p.authors as paper_authors,
      p.venue as paper_venue,
      p.year as paper_year,
      p.doi as paper_doi,
      p.url as paper_url,
      p.area_id as paper_area_id,
      ra.slug as paper_area_slug,
      ra.name as paper_area_name,
      p.plain_summary as paper_summary,
      p.vote_count as paper_votes,
      case
        when v_since is null then p.vote_count::bigint
        else (
          select count(*)
          from public.paper_votes v
          where v.paper_id = p.id and v.created_at >= v_since
        )
      end as paper_period_votes,
      p.comment_count as paper_comments,
      (
        p.vote_count::double precision
        / power(
            greatest(extract(epoch from (now() - p.created_at))::double precision / 3600.0, 0) + 2,
            1.5
          )
      ) as paper_hot_score,
      p.created_at as paper_created_at,
      p.submitted_by as paper_submitted_by
    from public.papers p
    left join public.research_areas ra on ra.id = p.area_id
    where not p.is_hidden
      and (
        p_area_slug is null
        or ra.slug = p_area_slug
        or (v_big_area is not null and ra.big_area = v_big_area)
      )
  )
  select
    r.paper_id,
    r.paper_title,
    r.paper_authors,
    r.paper_venue,
    r.paper_year,
    r.paper_doi,
    r.paper_url,
    r.paper_area_id,
    r.paper_area_slug,
    r.paper_area_name,
    r.paper_summary,
    r.paper_votes,
    r.paper_period_votes,
    r.paper_comments,
    r.paper_hot_score,
    r.paper_created_at,
    r.paper_submitted_by
  from ranked r
  order by
    case when v_period = 'hot' then r.paper_hot_score end desc nulls last,
    case when v_period in ('week', 'month', 'year') then r.paper_period_votes end desc nulls last,
    r.paper_votes desc,
    r.paper_created_at desc,
    r.paper_id
  limit least(greatest(coalesce(p_limit, 20), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

revoke all on function public.get_paper_ranking(text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.get_paper_ranking(text, text, integer, integer)
  to anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- get_community_leaderboard — reconhecimento de quem mais contribui (membros)
-- points = 10·papers + 2·votos recebidos + 5·soluções + 15·mentorias (aceitas
-- ou concluídas, como mentora) + 1·(tópicos + respostas).
-- Conteúdo anônimo NUNCA entra na contagem (não pode vazar autoria), e nenhuma
-- contagem depende de quem é a autora real de um tópico anônimo.
-- -----------------------------------------------------------------------------
create function public.get_community_leaderboard(p_limit integer default 20)
returns table (
  profile_id uuid,
  full_name text,
  avatar_url text,
  career_stage public.career_stage,
  points integer,
  papers integer,
  votes_received integer,
  solutions integer,
  mentorships integer,
  posts integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if (select auth.uid()) is null then
    raise exception using
      errcode = '42501',
      message = 'Entre na sua conta para ver o ranking da comunidade.';
  end if;

  return query
  with paper_stats as (
    select pa.submitted_by as pid, count(*)::integer as n_papers, coalesce(sum(pa.vote_count), 0)::integer as n_votes
    from public.papers pa
    where not pa.is_hidden
    group by pa.submitted_by
  ),
  -- Solução no próprio tópico não conta — mas só quando a autoria do tópico é
  -- pública. Em tópico anônimo a comparação NÃO pode usar a autoria real: se a
  -- autora anônima marcasse a própria resposta assinada como solução e ela não
  -- contasse, qualquer membro compararia este número com as soluções visíveis
  -- e descobriria quem escreveu o tópico anônimo.
  solution_stats as (
    select fp.author_id as pid, count(*)::integer as n
    from public.forum_threads t
    join public.forum_posts fp on fp.id = t.solution_post_id
    where fp.author_id is not null
      and fp.author_id is distinct from t.author_id
    group by fp.author_id
  ),
  mentorship_stats as (
    select r.mentor_id as pid, count(*)::integer as n
    from public.mentorship_requests r
    where r.status in ('accepted', 'completed')
    group by r.mentor_id
  ),
  thread_stats as (
    select t.author_id as pid, count(*)::integer as n
    from public.forum_threads t
    where t.author_id is not null
    group by t.author_id
  ),
  post_stats as (
    select fp.author_id as pid, count(*)::integer as n
    from public.forum_posts fp
    where fp.author_id is not null
    group by fp.author_id
  ),
  totals as (
    select
      pr.id as pid,
      pr.full_name as name,
      pr.avatar_url as avatar,
      pr.career_stage as stage,
      coalesce(ps.n_papers, 0) as n_papers,
      coalesce(ps.n_votes, 0) as n_votes,
      coalesce(ss.n, 0) as n_solutions,
      coalesce(ms.n, 0) as n_mentorships,
      coalesce(ts.n, 0) + coalesce(fs.n, 0) as n_posts
    from public.profiles pr
    left join paper_stats ps on ps.pid = pr.id
    left join solution_stats ss on ss.pid = pr.id
    left join mentorship_stats ms on ms.pid = pr.id
    left join thread_stats ts on ts.pid = pr.id
    left join post_stats fs on fs.pid = pr.id
    where pr.onboarded_at is not null
  ),
  scored as (
    select
      t.*,
      (10 * t.n_papers + 2 * t.n_votes + 5 * t.n_solutions + 15 * t.n_mentorships + t.n_posts)::integer as pts
    from totals t
  )
  select s.pid, s.name, s.avatar, s.stage, s.pts, s.n_papers, s.n_votes, s.n_solutions, s.n_mentorships, s.n_posts
  from scored s
  where s.pts > 0
  order by s.pts desc, s.name, s.pid
  limit least(greatest(coalesce(p_limit, 20), 1), 100);
end;
$$;

revoke all on function public.get_community_leaderboard(integer) from public, anon, authenticated;
grant execute on function public.get_community_leaderboard(integer) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- get_platform_stats — números agregados para a landing (público)
-- -----------------------------------------------------------------------------
create function public.get_platform_stats()
returns table (members integer, mentors integer, papers integer, threads integer, mentorships integer)
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select count(*) from public.profiles p where p.onboarded_at is not null)::integer,
    (select count(*) from public.profiles p where p.is_mentor and p.onboarded_at is not null)::integer,
    (select count(*) from public.papers pa where not pa.is_hidden)::integer,
    (select count(*) from public.forum_threads t)::integer,
    (select count(*) from public.mentorship_requests r where r.status in ('accepted', 'completed'))::integer;
$$;

revoke all on function public.get_platform_stats() from public, anon, authenticated;
grant execute on function public.get_platform_stats() to anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- reveal_anonymous_author — moderação revela a autoria real (casos graves)
-- -----------------------------------------------------------------------------
create function public.reveal_anonymous_author(p_thread_id uuid default null, p_post_id uuid default null)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not private.is_moderator() then
    raise exception using
      errcode = '42501',
      message = 'Apenas a moderação pode revelar a autoria de publicações anônimas.';
  end if;
  if num_nonnulls(p_thread_id, p_post_id) <> 1 then
    raise exception using
      errcode = '22023',
      message = 'Informe exatamente um tópico ou uma resposta.';
  end if;

  return (
    select a.user_id
    from public.forum_anonymous_authorship a
    where (p_thread_id is not null and a.thread_id = p_thread_id)
       or (p_post_id is not null and a.post_id = p_post_id)
  );
end;
$$;

revoke all on function public.reveal_anonymous_author(uuid, uuid) from public, anon, authenticated;
grant execute on function public.reveal_anonymous_author(uuid, uuid) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- moderate_thread — fixar/destrancar tópicos (NULL = não altera)
-- -----------------------------------------------------------------------------
create function public.moderate_thread(
  p_thread_id uuid,
  p_pinned boolean default null,
  p_locked boolean default null
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not private.is_moderator() then
    raise exception using
      errcode = '42501',
      message = 'Apenas a moderação pode fixar ou trancar tópicos.';
  end if;

  update public.forum_threads t
  set is_pinned = coalesce(p_pinned, t.is_pinned),
      is_locked = coalesce(p_locked, t.is_locked)
  where t.id = p_thread_id;

  if not found then
    raise exception using errcode = 'CD015', message = 'Tópico não encontrado.';
  end if;
end;
$$;

revoke all on function public.moderate_thread(uuid, boolean, boolean) from public, anon, authenticated;
grant execute on function public.moderate_thread(uuid, boolean, boolean) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- moderate_paper — ocultar/reexibir um paper da Vitrine (extra ao contrato)
-- -----------------------------------------------------------------------------
create function public.moderate_paper(p_paper_id uuid, p_hidden boolean)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not private.is_moderator() then
    raise exception using
      errcode = '42501',
      message = 'Apenas a moderação pode ocultar papers.';
  end if;

  update public.papers p set is_hidden = coalesce(p_hidden, p.is_hidden) where p.id = p_paper_id;

  if not found then
    raise exception using errcode = 'CD015', message = 'Paper não encontrado.';
  end if;
end;
$$;

revoke all on function public.moderate_paper(uuid, boolean) from public, anon, authenticated;
grant execute on function public.moderate_paper(uuid, boolean) to authenticated, service_role;
