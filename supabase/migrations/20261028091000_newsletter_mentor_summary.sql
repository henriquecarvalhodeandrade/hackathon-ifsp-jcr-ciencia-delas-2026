-- =============================================================================
-- Ciência Delas · 11 — newsletter: mentoras só em agregado no arquivo público
-- =============================================================================
-- Edições publicadas são legíveis por visitantes (anon) pela API, então o `content`
-- não pode levar nomes/perfis de mentoras (o diretório é exclusivo para membras).
-- O formato passa a ser `mentors: []` (mantido por compatibilidade) +
-- `mentor_summary: { total, areas }`. Esta migration converte as edições antigas:
-- conta as mentoras listadas e guarda só os nomes das áreas delas (até 8, das mais
-- frequentes para as menos). Edições já no formato novo não são tocadas.
update public.newsletter_editions e
set content = jsonb_set(
  jsonb_set(e.content, '{mentors}', '[]'::jsonb),
  '{mentor_summary}',
  jsonb_build_object(
    'total', jsonb_array_length(e.content -> 'mentors'),
    'areas', coalesce((
      select jsonb_agg(a.name order by a.n desc, a.name)
      from (
        select ra.name, count(*) as n
        from jsonb_array_elements(e.content -> 'mentors') as m (item)
        join public.profile_research_areas pra on pra.profile_id::text = m.item ->> 'id'
        join public.research_areas ra on ra.id = pra.area_id
        group by ra.name
        order by count(*) desc, ra.name
        limit 8
      ) a
    ), '[]'::jsonb)
  )
)
where jsonb_typeof(e.content -> 'mentors') = 'array'
  and jsonb_array_length(e.content -> 'mentors') > 0;
