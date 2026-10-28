-- =============================================================================
-- Artemis — seed de RECONHECIMENTO DA MENTORIA (demonstração, tudo fictício)
--
-- Roda depois de supabase/seed.sql (config.toml → [db.seed] sql_paths = ['./seed.sql',
-- './seeds/*.sql']). Idempotente: pode rodar de novo sem duplicar nada. Não toca nas mentorias
-- da Larissa nem da Marina (outras partes da demonstração usam essas duas).
--
--   | O quê                                         | Para quê na apresentação                  |
--   | --------------------------------------------- | ----------------------------------------- |
--   | c1…005 (Débora → Patrícia) concluída há ~10 d | retornos das duas + declaração emitida    |
--   | declaração ART-7K2M-Q9XD-4HNP                 | código fixo do slide: /verificar/<código> |
--   | c1…101–104: 4 mentorias concluídas antigas    | 5 retornos de mentorandas → impacto (k=5) |
--
-- Código da declaração para o slide do pitch: ART-7K2M-Q9XD-4HNP
-- (página pública: <site>/verificar/ART-7K2M-Q9XD-4HNP — mostra "Declaração válida").
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. (demonstração) Débora → Patrícia: concluída há cerca de 10 dias
--    O seed.sql já conclui esta mentoria; aqui só recuamos a data (contexto confiável).
-- -----------------------------------------------------------------------------
update public.mentorship_requests
set completed_at = now() - interval '10 days'
where id = 'c1000000-0000-4000-8000-000000000005'
  and status = 'completed'
  and (completed_at is null or completed_at > now() - interval '9 days');

-- -----------------------------------------------------------------------------
-- 2. (demonstração) Mais 4 mentorias concluídas, criadas há 60–150 dias, pelo fluxo normal:
--    pedido (pending) → aceite → conclusão. Nenhuma dupla tem pedido em aberto e cada mentora
--    tem vaga (capacidade 2, nenhuma mentoria aceita) no momento do aceite.
--      101 Gabriela → Luiza · 102 Manuela → Carolina · 103 Yasmin → Tatiane · 104 Débora → Isabela
-- -----------------------------------------------------------------------------
insert into public.mentorship_requests (id, mentee_id, mentor_id, message, match_score, match_reason, created_at)
select v.id, v.mentee_id, v.mentor_id, v.message, v.match_score, v.match_reason, now() - make_interval(days => v.days_ago)
from (values
  ('c1000000-0000-4000-8000-000000000101'::uuid, 'd2000000-0000-4000-8000-000000000002'::uuid, 'd1000000-0000-4000-8000-000000000002'::uuid,
   'Luiza, quero me candidatar a uma bolsa sanduíche e não sei por onde começar o plano de trabalho. Pode me ajudar?',
   84, 'Interesse em internacionalização e bolsas; a mentora apoia escrita de projetos.', 150),
  ('c1000000-0000-4000-8000-000000000102', 'd2000000-0000-4000-8000-000000000003', 'd1000000-0000-4000-8000-000000000004',
   'Carolina, estou escrevendo meu primeiro resumo para congresso e queria ajuda com a metodologia e o texto.',
   86, 'Metodologia de pesquisa e escrita científica em comum.', 120),
  ('c1000000-0000-4000-8000-000000000103', 'd2000000-0000-4000-8000-000000000004', 'd1000000-0000-4000-8000-000000000010',
   'Tatiane, quero entrar em um grupo de pesquisa e divulgar ciência para meninas da minha cidade. Topa conversar?',
   81, 'Divulgação científica e apoio no início da trajetória.', 100),
  ('c1000000-0000-4000-8000-000000000104', 'd2000000-0000-4000-8000-000000000005', 'd1000000-0000-4000-8000-000000000012',
   'Isabela, penso em levar minha pesquisa em saúde para um projeto aplicado. Podemos falar sobre inovação?',
   78, 'Interesse em inovação a partir da pesquisa acadêmica.', 70)
) as v (id, mentee_id, mentor_id, message, match_score, match_reason, days_ago)
where not exists (select 1 from public.mentorship_requests r where r.id = v.id);

update public.mentorship_requests
set status = 'accepted',
    responded_at = created_at + interval '2 days',
    response_message = 'Vamos juntas! Marque um horário na minha agenda e traga suas dúvidas.'
where id in ('c1000000-0000-4000-8000-000000000101', 'c1000000-0000-4000-8000-000000000102',
             'c1000000-0000-4000-8000-000000000103', 'c1000000-0000-4000-8000-000000000104')
  and status = 'pending';

-- Data da conclusão no MESMO update que conclui (o trigger aceita a data explícita do seed).
update public.mentorship_requests
set status = 'completed',
    completed_at = created_at + interval '50 days'
where id in ('c1000000-0000-4000-8000-000000000101', 'c1000000-0000-4000-8000-000000000102',
             'c1000000-0000-4000-8000-000000000103', 'c1000000-0000-4000-8000-000000000104')
  and status = 'accepted';

-- -----------------------------------------------------------------------------
-- 3. (demonstração) Retornos privados: as duas da mentoria Débora–Patrícia e a mentoranda de
--    cada uma das outras 4 → 5 retornos de mentorandas (o mínimo para o impacto aparecer).
--    Sem ON CONFLICT: o trigger recusa a duplicata (CD032) antes disso.
-- -----------------------------------------------------------------------------
insert into public.mentorship_feedback
  (id, request_id, author_id, helpfulness, outcomes, would_recommend, note, created_at)
select v.id, v.request_id, v.author_id, v.helpfulness, v.outcomes, v.would_recommend, v.note,
  r.completed_at + make_interval(hours => v.hours_after)
from (values
  ('c1f00000-0000-4000-8000-000000000001'::uuid, 'c1000000-0000-4000-8000-000000000005'::uuid,
   'd2000000-0000-4000-8000-000000000005'::uuid, 5::smallint,
   array['menos-sozinha', 'plano-definido', 'candidatura']::text[], true,
   'Voltei a escrever a tese com um cronograma possível depois da licença. (demonstração)', 2),
  ('c1f00000-0000-4000-8000-000000000002', 'c1000000-0000-4000-8000-000000000005',
   'd1000000-0000-4000-8000-000000000006', 5,
   array['aprendi-tambem', 'quero-mentorar-mais'], true, null, 20),
  ('c1f00000-0000-4000-8000-000000000003', 'c1000000-0000-4000-8000-000000000101',
   'd2000000-0000-4000-8000-000000000002', 4,
   array['plano-definido', 'rede-ampliada', 'menos-sozinha'], true, null, 5),
  ('c1f00000-0000-4000-8000-000000000004', 'c1000000-0000-4000-8000-000000000102',
   'd2000000-0000-4000-8000-000000000003', 5,
   array['menos-sozinha', 'trabalho-apresentado', 'plano-definido'], true, null, 30),
  ('c1f00000-0000-4000-8000-000000000005', 'c1000000-0000-4000-8000-000000000103',
   'd2000000-0000-4000-8000-000000000004', 4,
   array['iniciacao-cientifica', 'menos-sozinha', 'rede-ampliada'], null, null, 8),
  ('c1f00000-0000-4000-8000-000000000006', 'c1000000-0000-4000-8000-000000000104',
   'd2000000-0000-4000-8000-000000000005', 5,
   array['plano-definido', 'candidatura', 'rede-ampliada'], true, null, 12)
) as v (id, request_id, author_id, helpfulness, outcomes, would_recommend, note, hours_after)
join public.mentorship_requests r on r.id = v.request_id and r.status = 'completed'
where not exists (
  select 1 from public.mentorship_feedback f
  where f.request_id = v.request_id and f.author_id = v.author_id
);

-- -----------------------------------------------------------------------------
-- 4. (demonstração) Declaração emitida da mentoria Débora–Patrícia, com o código FIXO do slide
--    (contexto confiável informa o código e as duas autorizações; issued_at = a segunda).
-- -----------------------------------------------------------------------------
insert into public.mentorship_declarations
  (id, request_id, code, requested_by, mentee_consented_at, mentor_consented_at, issued_at, created_at)
select
  'c1d00000-0000-4000-8000-000000000001',
  r.id,
  'ART-7K2M-Q9XD-4HNP',
  r.mentee_id,
  r.completed_at + interval '1 day',
  r.completed_at + interval '2 days',
  r.completed_at + interval '2 days',
  r.completed_at + interval '1 day'
from public.mentorship_requests r
where r.id = 'c1000000-0000-4000-8000-000000000005'
  and r.status = 'completed'
  and not exists (select 1 from public.mentorship_declarations d where d.code = 'ART-7K2M-Q9XD-4HNP')
  and not exists (
    select 1 from public.mentorship_declarations d where d.request_id = r.id and d.revoked_at is null
  );

-- -----------------------------------------------------------------------------
-- 5. (demonstração) Avisos: os de conclusão nascem com a hora do seed; levamos cada um para a
--    data da conclusão e marcamos como lido. Os avisos antigos (pedido, aceite) ficam lidos
--    como no seed.sql.
-- -----------------------------------------------------------------------------
update public.notifications n
set created_at = r.completed_at,
    read_at = r.completed_at + interval '3 hours'
from public.mentorship_requests r
where r.id in ('c1000000-0000-4000-8000-000000000005', 'c1000000-0000-4000-8000-000000000101',
               'c1000000-0000-4000-8000-000000000102', 'c1000000-0000-4000-8000-000000000103',
               'c1000000-0000-4000-8000-000000000104')
  and r.completed_at is not null
  and n.user_id in (r.mentee_id, r.mentor_id)
  and n.type = 'mentorship_response'
  and n.title = 'Mentoria concluída'
  and n.read_at is null
  and (
    n.link = '/mentoria/concluida/' || r.id::text
    -- banco criado antes desta migration: o aviso da Débora–Patrícia apontava para /mentoria
    or (r.id = 'c1000000-0000-4000-8000-000000000005' and n.link = '/mentoria')
  );

update public.notifications n
set read_at = n.created_at + interval '3 hours'
where n.read_at is null
  and n.created_at < now() - interval '3 days'
  and n.user_id in (select u.id from auth.users u where u.email like '%@demo.cienciadelas.dev');
