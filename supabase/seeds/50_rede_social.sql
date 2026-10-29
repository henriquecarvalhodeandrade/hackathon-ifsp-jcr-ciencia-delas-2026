-- =============================================================================
-- Artemis — seed da REDE SOCIAL (docs/18-rede-social.md)
-- =============================================================================
-- Roda DEPOIS de supabase/seed.sql (config.toml: sql_paths = ['./seed.sql', './seeds/*.sql']).
-- TUDO FICTÍCIO e idempotente (pode rodar de novo sem duplicar nada). Textos longos terminam com
-- "(demonstração)". NÃO rode este arquivo em produção.
--
-- O que cada persona do /demo encontra:
--   | Persona  | Rede                                   | Feed / portfólio / ICs / mensagens              |
--   | -------- | -------------------------------------- | ----------------------------------------------- |
--   | Larissa  | conectada à Marina e à Yasmin; convite | projeto e curso no portfólio; candidatura       |
--   |          | da Juliana para responder              | APROVADA na IC da Marina e ENVIADA na da Luiza;  |
--   |          |                                        | conversa com a Marina (não lida) e com a Yasmin; |
--   |          |                                        | pedido de mensagem da Renata                     |
--   | Marina   | conexões com Luiza, Tatiane, Juliana;  | publicou 2 vagas (uma com candidaturas para      |
--   |          | convite da Débora para responder       | responder); pedido de mensagem da Gabriela       |
--   | Débora   | conectada à Patrícia e à Carolina      | conquista no feed; conversa com a Patrícia       |
--
-- UUIDs fixos: f1… publicações · f2… portfólio · f3… oportunidades · f4… candidaturas ·
-- f5… conversas · f6… mensagens · f7… comentários · f8… conexões.
--
-- REPOSIÇÃO: rodar este arquivo de novo devolve a rede social ao estado da demonstração (ensaios e
-- apresentação, em que a plateia usa as mesmas personas): apaga o que foi criado nas contas
-- @demo.cienciadelas.dev fora destes UUIDs, refaz o conteúdo do seed que foi editado ou apagado,
-- volta convites, pedidos de mensagem e candidaturas ao estado inicial, restaura as leituras e os
-- avisos principais e zera os limites anti-spam dessas contas. Nada fora das contas de demonstração
-- é tocado.
-- Contexto confiável (postgres): os triggers não impõem autoria, datas nem limites, mas mantêm
-- contadores, o "seguir" das conexões aceitas, os resumos das conversas e os avisos.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. Reposição: o que a plateia (ou um ensaio) criou nas contas de demonstração sai
-- -----------------------------------------------------------------------------
delete from public.direct_conversations c
where c.id::text not like 'f5000000-%'
  and c.user_a in (select u.id from auth.users u where lower(u.email) like '%@demo.cienciadelas.dev')
  and c.user_b in (select u.id from auth.users u where lower(u.email) like '%@demo.cienciadelas.dev');

delete from public.direct_messages m
where m.id::text not like 'f6000000-%'
  and m.conversation_id::text like 'f5000000-%';

delete from public.posts p
where p.id::text not like 'f1000000-%'
  and p.author_id in (select u.id from auth.users u where lower(u.email) like '%@demo.cienciadelas.dev');

delete from public.post_comments c
where c.id::text not like 'f7000000-%'
  and c.author_id in (select u.id from auth.users u where lower(u.email) like '%@demo.cienciadelas.dev');

delete from public.portfolio_items i
where i.id::text not like 'f2000000-%'
  and i.owner_id in (select u.id from auth.users u where lower(u.email) like '%@demo.cienciadelas.dev');

delete from public.research_opportunities o
where o.id::text not like 'f3000000-%'
  and o.owner_id in (select u.id from auth.users u where lower(u.email) like '%@demo.cienciadelas.dev');

delete from public.opportunity_applications a
where a.id::text not like 'f4000000-%'
  and a.applicant_id in (select u.id from auth.users u where lower(u.email) like '%@demo.cienciadelas.dev');

delete from public.connections c
where c.id::text not like 'f8000000-%'
  and c.requester_id in (select u.id from auth.users u where lower(u.email) like '%@demo.cienciadelas.dev')
  and c.addressee_id in (select u.id from auth.users u where lower(u.email) like '%@demo.cienciadelas.dev');

-- Avisos de mudança de status das candidaturas do seed ("em análise", "não aprovada"…): o banco
-- refaz o certo quando o status volta ao do seed (e a seção 9 repõe o da aprovação).
delete from public.notifications n
where n.type = 'application_update'
  and n.link like '/ics/f3000000-%'
  and n.user_id in (select u.id from auth.users u where lower(u.email) like '%@demo.cienciadelas.dev');

-- O seguir mútuo criado quando a plateia aceita os convites pendentes da demonstração.
delete from public.follows f
where (f.follower_id, f.followee_id) in (
  ('d1000000-0000-4000-8000-000000000008'::uuid, 'd2000000-0000-4000-8000-000000000001'::uuid),
  ('d2000000-0000-4000-8000-000000000001'::uuid, 'd1000000-0000-4000-8000-000000000008'::uuid),
  ('d2000000-0000-4000-8000-000000000005'::uuid, 'd1000000-0000-4000-8000-000000000001'::uuid),
  ('d1000000-0000-4000-8000-000000000001'::uuid, 'd2000000-0000-4000-8000-000000000005'::uuid)
);

-- Publicação do seed que perdeu o anexo (item ou vaga apagados) sai inteira e é refeita abaixo
-- (o anexo de uma publicação não pode ser trocado depois).
delete from public.posts p
using (
  values
    ('f1000000-0000-4000-8000-000000000001'::uuid, null::uuid, 'f3000000-0000-4000-8000-000000000001'::uuid),
    ('f1000000-0000-4000-8000-000000000002'::uuid, 'f2000000-0000-4000-8000-000000000003'::uuid, null::uuid),
    ('f1000000-0000-4000-8000-000000000003'::uuid, 'f2000000-0000-4000-8000-000000000006'::uuid, null::uuid),
    ('f1000000-0000-4000-8000-000000000004'::uuid, 'f2000000-0000-4000-8000-000000000004'::uuid, null::uuid),
    ('f1000000-0000-4000-8000-000000000006'::uuid, 'f2000000-0000-4000-8000-000000000009'::uuid, null::uuid),
    ('f1000000-0000-4000-8000-000000000007'::uuid, 'f2000000-0000-4000-8000-000000000007'::uuid, null::uuid),
    ('f1000000-0000-4000-8000-000000000009'::uuid, null::uuid, 'f3000000-0000-4000-8000-000000000006'::uuid),
    ('f1000000-0000-4000-8000-000000000010'::uuid, 'f2000000-0000-4000-8000-000000000008'::uuid, null::uuid)
) as v (id, portfolio_item_id, opportunity_id)
where p.id = v.id
  and (p.portfolio_item_id is distinct from v.portfolio_item_id
       or p.opportunity_id is distinct from v.opportunity_id);

-- -----------------------------------------------------------------------------
-- 1. Conexões (criadas pendentes e aceitas pelo fluxo normal → seguir nos dois sentidos)
-- -----------------------------------------------------------------------------
insert into public.connections (id, requester_id, addressee_id, message, created_at)
select v.id, v.requester_id, v.addressee_id, v.message, now() - make_interval(days => v.days_ago)
from (
  values
    -- aceitas
    ('f8000000-0000-4000-8000-000000000001'::uuid, 'd2000000-0000-4000-8000-000000000001'::uuid, 'd1000000-0000-4000-8000-000000000001'::uuid, 'Oi, Marina! Que bom ter você como mentora também por aqui.', 20),
    ('f8000000-0000-4000-8000-000000000002'::uuid, 'd2000000-0000-4000-8000-000000000004'::uuid, 'd2000000-0000-4000-8000-000000000001'::uuid, null, 15),
    ('f8000000-0000-4000-8000-000000000003'::uuid, 'd1000000-0000-4000-8000-000000000001'::uuid, 'd1000000-0000-4000-8000-000000000002'::uuid, null, 30),
    ('f8000000-0000-4000-8000-000000000004'::uuid, 'd1000000-0000-4000-8000-000000000010'::uuid, 'd1000000-0000-4000-8000-000000000001'::uuid, null, 25),
    ('f8000000-0000-4000-8000-000000000005'::uuid, 'd1000000-0000-4000-8000-000000000008'::uuid, 'd1000000-0000-4000-8000-000000000001'::uuid, null, 18),
    ('f8000000-0000-4000-8000-000000000006'::uuid, 'd2000000-0000-4000-8000-000000000005'::uuid, 'd1000000-0000-4000-8000-000000000006'::uuid, null, 40),
    ('f8000000-0000-4000-8000-000000000007'::uuid, 'd2000000-0000-4000-8000-000000000005'::uuid, 'd1000000-0000-4000-8000-000000000004'::uuid, null, 22),
    ('f8000000-0000-4000-8000-000000000008'::uuid, 'd2000000-0000-4000-8000-000000000002'::uuid, 'd1000000-0000-4000-8000-000000000003'::uuid, null, 28),
    ('f8000000-0000-4000-8000-000000000009'::uuid, 'd2000000-0000-4000-8000-000000000003'::uuid, 'd1000000-0000-4000-8000-000000000005'::uuid, null, 12),
    ('f8000000-0000-4000-8000-000000000010'::uuid, 'd1000000-0000-4000-8000-000000000009'::uuid, 'd1000000-0000-4000-8000-000000000003'::uuid, null, 35),
    -- pendentes (para responder na demonstração)
    ('f8000000-0000-4000-8000-000000000011'::uuid, 'd1000000-0000-4000-8000-000000000008'::uuid, 'd2000000-0000-4000-8000-000000000001'::uuid, 'Oi, Larissa! Vi seu projeto de visão computacional e adoraria acompanhar. Também trabalho com modelagem.', 1),
    ('f8000000-0000-4000-8000-000000000012'::uuid, 'd2000000-0000-4000-8000-000000000005'::uuid, 'd1000000-0000-4000-8000-000000000001'::uuid, 'Marina, gostei muito da sua fala sobre dados abertos no Boletim. Vamos nos conectar?', 1)
) as v (id, requester_id, addressee_id, message, days_ago)
where exists (select 1 from public.profiles p where p.id = v.requester_id and p.onboarded_at is not null)
  and exists (select 1 from public.profiles p where p.id = v.addressee_id and p.onboarded_at is not null)
  and not exists (
    select 1 from public.connections c
    where least(c.requester_id, c.addressee_id) = least(v.requester_id, v.addressee_id)
      and greatest(c.requester_id, c.addressee_id) = greatest(v.requester_id, v.addressee_id)
  )
on conflict do nothing;

update public.connections c
  set status = 'accepted', responded_at = c.created_at + interval '5 hours'
where c.id in (
  'f8000000-0000-4000-8000-000000000001', 'f8000000-0000-4000-8000-000000000002',
  'f8000000-0000-4000-8000-000000000003', 'f8000000-0000-4000-8000-000000000004',
  'f8000000-0000-4000-8000-000000000005', 'f8000000-0000-4000-8000-000000000006',
  'f8000000-0000-4000-8000-000000000007', 'f8000000-0000-4000-8000-000000000008',
  'f8000000-0000-4000-8000-000000000009', 'f8000000-0000-4000-8000-000000000010'
)
  and c.status = 'pending';

-- Os dois convites da demonstração (Juliana → Larissa, Débora → Marina) voltam a esperar resposta.
update public.connections c
  set status = 'pending', responded_at = null
where c.id in ('f8000000-0000-4000-8000-000000000011', 'f8000000-0000-4000-8000-000000000012')
  and c.status <> 'pending';

-- -----------------------------------------------------------------------------
-- 2. Seguir (de um lado só) — além do seguir mútuo das conexões
-- -----------------------------------------------------------------------------
insert into public.follows (follower_id, followee_id, created_at)
select v.follower_id, v.followee_id, now() - make_interval(days => v.days_ago)
from (
  values
    ('d2000000-0000-4000-8000-000000000001'::uuid, 'd1000000-0000-4000-8000-000000000002'::uuid, 10),
    ('d2000000-0000-4000-8000-000000000001'::uuid, 'd1000000-0000-4000-8000-000000000007'::uuid, 9),
    ('d2000000-0000-4000-8000-000000000001'::uuid, 'd1000000-0000-4000-8000-000000000009'::uuid, 6),
    ('d2000000-0000-4000-8000-000000000004'::uuid, 'd1000000-0000-4000-8000-000000000001'::uuid, 8),
    ('d2000000-0000-4000-8000-000000000004'::uuid, 'd1000000-0000-4000-8000-000000000011'::uuid, 8),
    ('d2000000-0000-4000-8000-000000000005'::uuid, 'd1000000-0000-4000-8000-000000000008'::uuid, 7),
    ('d2000000-0000-4000-8000-000000000003'::uuid, 'd1000000-0000-4000-8000-000000000001'::uuid, 5),
    ('d2000000-0000-4000-8000-000000000002'::uuid, 'd1000000-0000-4000-8000-000000000001'::uuid, 4),
    ('d1000000-0000-4000-8000-000000000007'::uuid, 'd2000000-0000-4000-8000-000000000001'::uuid, 3),
    ('d1000000-0000-4000-8000-000000000012'::uuid, 'd1000000-0000-4000-8000-000000000001'::uuid, 11),
    ('d1000000-0000-4000-8000-000000000006'::uuid, 'd1000000-0000-4000-8000-000000000008'::uuid, 14)
) as v (follower_id, followee_id, days_ago)
where exists (select 1 from public.profiles p where p.id = v.follower_id)
  and exists (select 1 from public.profiles p where p.id = v.followee_id)
on conflict do nothing;

-- -----------------------------------------------------------------------------
-- 3. Portfólio
-- -----------------------------------------------------------------------------
insert into public.portfolio_items (id, owner_id, kind, title, description, url, venue, year, tags, pinned, created_at, updated_at)
select v.id, v.owner_id, v.kind::public.portfolio_kind, v.title, v.description, v.url, v.venue, v.year::smallint, v.tags,
       v.pinned, now() - make_interval(days => v.days_ago), now() - make_interval(days => v.days_ago)
from (
  values
    ('f2000000-0000-4000-8000-000000000001'::uuid, 'd1000000-0000-4000-8000-000000000001'::uuid, 'article',
     'Detecção de pragas em folhas de café com redes neurais leves',
     'Modelo que roda num celular simples, treinado com fotos de produtores do Vale do Paraíba. (demonstração)',
     'https://example.org/demo/artigo-cafe', 'Revista Brasileira de Computação Aplicada', 2025,
     array['visão computacional', 'agro', 'aprendizado de máquina'], true, 40),
    ('f2000000-0000-4000-8000-000000000002'::uuid, 'd1000000-0000-4000-8000-000000000001'::uuid, 'project',
     'Meninas no Código — oficinas no IFSP Jacareí',
     'Projeto de extensão que leva programação a estudantes do ensino médio da rede pública. (demonstração)',
     null, 'IFSP — Câmpus Jacareí', 2024, array['extensão', 'ensino de programação'], false, 60),
    ('f2000000-0000-4000-8000-000000000003'::uuid, 'd1000000-0000-4000-8000-000000000002'::uuid, 'article',
     'Séries temporais de satélite para prever focos de queimada no Cerrado',
     'Comparação de modelos com dados abertos do INPE entre 2015 e 2024. (demonstração)',
     'https://example.org/demo/artigo-queimadas', 'Simpósio Brasileiro de Sensoriamento Remoto', 2025,
     array['sensoriamento remoto', 'queimadas'], true, 6),
    ('f2000000-0000-4000-8000-000000000004'::uuid, 'd2000000-0000-4000-8000-000000000001'::uuid, 'project',
     'Classificador de folhas de café doentes (IC)',
     'Minha iniciação científica: coleta de fotos, rotulagem e primeiros testes com uma CNN pequena. (demonstração)',
     null, 'IFSP — Câmpus Jacareí', 2026, array['python', 'visão computacional'], true, 3),
    ('f2000000-0000-4000-8000-000000000005'::uuid, 'd2000000-0000-4000-8000-000000000001'::uuid, 'course',
     'Introdução à ciência de dados com Python',
     'Curso de 40 horas com projeto final sobre dados de chuva da região. (demonstração)',
     null, 'Curso livre on-line', 2025, array['python', 'dados'], false, 45),
    ('f2000000-0000-4000-8000-000000000006'::uuid, 'd2000000-0000-4000-8000-000000000005'::uuid, 'thesis',
     'Qualificação: cuidado materno e permanência na pós-graduação',
     'Texto de qualificação do doutorado, com entrevistas com mães pesquisadoras. (demonstração)',
     null, 'Faculdade de Saúde Pública — USP', 2026, array['saúde coletiva', 'maternidade'], true, 2),
    ('f2000000-0000-4000-8000-000000000007'::uuid, 'd1000000-0000-4000-8000-000000000009'::uuid, 'poster',
     'Filmes finos de óxido de zinco para sensores de baixo custo',
     'Pôster aceito no Encontro de Física da Matéria Condensada. (demonstração)',
     null, 'Encontro de Física da Matéria Condensada', 2026, array['materiais', 'física'], true, 4),
    ('f2000000-0000-4000-8000-000000000008'::uuid, 'd1000000-0000-4000-8000-000000000004'::uuid, 'award',
     'Prêmio Jovem Pesquisadora em Biotecnologia',
     'Reconhecimento pelo trabalho com enzimas para reciclagem de plástico. (demonstração)',
     null, 'Sociedade Brasileira de Bioquímica', 2026, array['biotecnologia', 'enzimas'], true, 5),
    ('f2000000-0000-4000-8000-000000000009'::uuid, 'd1000000-0000-4000-8000-000000000007'::uuid, 'project',
     'CubeSat universitário: subsistema de energia',
     'Coordeno a equipe de estudantes que projeta o painel solar do nanossatélite. (demonstração)',
     null, 'Indústria aeroespacial do Vale do Paraíba', 2026, array['aeroespacial', 'satélites'], true, 7)
) as v (id, owner_id, kind, title, description, url, venue, year, tags, pinned, days_ago)
where exists (select 1 from public.profiles p where p.id = v.owner_id)
on conflict (id) do update set
  kind = excluded.kind, title = excluded.title, description = excluded.description,
  url = excluded.url, venue = excluded.venue, year = excluded.year, tags = excluded.tags,
  pinned = excluded.pinned;

-- -----------------------------------------------------------------------------
-- 4. Oportunidades (Explorar ICs)
-- -----------------------------------------------------------------------------
insert into public.research_opportunities (
  id, owner_id, kind, title, description, requirements, area_id, keywords, institution, city, state,
  modality, has_scholarship, scholarship_info, weekly_hours, vacancies, target_stages, deadline, status,
  created_at, updated_at, closed_at
)
select v.id, v.owner_id, v.kind::public.opportunity_kind, v.title, v.description, v.requirements,
       (select a.id from public.research_areas a where a.slug = v.area_slug),
       v.keywords, v.institution, v.city, v.state, v.modality::public.meeting_format, v.has_scholarship,
       v.scholarship_info, v.weekly_hours::smallint, v.vacancies::smallint, v.target_stages::public.career_stage[],
       case when v.deadline_days is null then null else (now() at time zone 'America/Sao_Paulo')::date + v.deadline_days end,
       v.status::public.opportunity_status,
       now() - make_interval(days => v.days_ago), now() - make_interval(days => v.days_ago),
       case when v.status = 'closed' then now() - make_interval(days => v.days_ago - 1) end
from (
  values
    ('f3000000-0000-4000-8000-000000000001'::uuid, 'd1000000-0000-4000-8000-000000000001'::uuid, 'ic',
     'IC em visão computacional para o agro do Vale do Paraíba',
     E'Vamos treinar modelos leves que identificam pragas em folhas de café e de hortaliças a partir de fotos tiradas com o celular dos produtores.\n\nVocê vai participar da coleta e rotulagem das imagens, dos experimentos em Python e da apresentação dos resultados no congresso de iniciação científica do IFSP. (demonstração)',
     'Estar matriculada em curso superior ou técnico do IFSP; noções de programação ajudam, mas não são obrigatórias.',
     'ciencia-da-computacao', array['visão computacional', 'python', 'agro'], 'IFSP — Câmpus Jacareí', 'Jacareí', 'SP',
     'in_person', true, 'PIBIC/CNPq — R$ 700 por mês', 12, 2, array['undergraduate'], 20, 'open', 8),
    ('f3000000-0000-4000-8000-000000000002'::uuid, 'd1000000-0000-4000-8000-000000000001'::uuid, 'ic_junior',
     'IC Júnior: robótica com sucata no IFSP',
     E'Projeto para estudantes do ensino médio e técnico: construir robôs simples com material reciclado e ensinar programação em escolas públicas da cidade. (demonstração)',
     null, 'ensino-de-ciencias', array['robótica', 'divulgação científica'], 'IFSP — Câmpus Jacareí', 'Jacareí', 'SP',
     'in_person', false, null, 6, 4, array['high_school'], 30, 'open', 4),
    ('f3000000-0000-4000-8000-000000000003'::uuid, 'd1000000-0000-4000-8000-000000000002'::uuid, 'ic',
     'IC em sensoriamento remoto de queimadas',
     E'Análise de séries temporais de imagens de satélite para identificar padrões de queimadas no Cerrado e na Mata Atlântica, com dados abertos do INPE. (demonstração)',
     'Interesse por geociências ou computação; disponibilidade para reuniões quinzenais em São José dos Campos.',
     'geociencias', array['sensoriamento remoto', 'queimadas', 'python'], 'Instituto Nacional de Pesquisas Espaciais (INPE)',
     'São José dos Campos', 'SP', 'hybrid', true, 'Bolsa CNPq — R$ 700 por mês', 16, 1, array['undergraduate'], 12, 'open', 5),
    ('f3000000-0000-4000-8000-000000000004'::uuid, 'd1000000-0000-4000-8000-000000000006'::uuid, 'extension',
     'Extensão: saúde da mulher nas unidades básicas',
     E'Rodas de conversa sobre saúde da mulher em unidades básicas de saúde, com produção de materiais educativos acessíveis. (demonstração)',
     null, 'saude-coletiva', array['saúde da mulher', 'extensão'], 'Fundação Oswaldo Cruz (Fiocruz)', 'Rio de Janeiro', 'RJ',
     'in_person', false, null, 8, 5, array['undergraduate', 'masters'], null, 'open', 9),
    ('f3000000-0000-4000-8000-000000000005'::uuid, 'd1000000-0000-4000-8000-000000000004'::uuid, 'tcc',
     'TCC em enzimas para reciclagem de plástico',
     E'Orientação de TCC sobre a caracterização de enzimas que degradam PET, no laboratório de bioquímica da USP. (demonstração)',
     'Ter cursado bioquímica básica.', 'biotecnologia', array['enzimas', 'reciclagem', 'biotecnologia'],
     'Universidade de São Paulo (USP)', 'São Paulo', 'SP', 'in_person', false, null, 10, 1, array['undergraduate'], 25, 'open', 3),
    ('f3000000-0000-4000-8000-000000000006'::uuid, 'd1000000-0000-4000-8000-000000000008'::uuid, 'volunteer',
     'Voluntariado: monitoria da olimpíada de matemática',
     E'Monitoria on-line para estudantes de escolas públicas que vão participar da olimpíada de matemática. (demonstração)',
     null, 'matematica-aplicada', array['matemática', 'olimpíadas'], 'Universidade Estadual de Campinas (UNICAMP)',
     'Campinas', 'SP', 'online', false, null, 4, 10, array['undergraduate', 'masters', 'phd'], 15, 'open', 2),
    ('f3000000-0000-4000-8000-000000000007'::uuid, 'd1000000-0000-4000-8000-000000000009'::uuid, 'ic',
     'IC em física de materiais (turma 2026.1)',
     E'Síntese e caracterização de filmes finos de óxido de zinco para sensores de gás. Vagas preenchidas para este semestre. (demonstração)',
     null, 'fisica', array['materiais', 'filmes finos'], 'Centro Brasileiro de Pesquisas Físicas (CBPF)', 'Rio de Janeiro', 'RJ',
     'in_person', true, 'PIBIC — R$ 700 por mês', 20, 1, array['undergraduate'], null, 'closed', 40)
) as v (id, owner_id, kind, title, description, requirements, area_slug, keywords, institution, city, state,
        modality, has_scholarship, scholarship_info, weekly_hours, vacancies, target_stages, deadline_days, status, days_ago)
where exists (select 1 from public.profiles p where p.id = v.owner_id)
on conflict (id) do update set
  kind = excluded.kind, title = excluded.title, description = excluded.description,
  requirements = excluded.requirements, area_id = excluded.area_id, keywords = excluded.keywords,
  institution = excluded.institution, city = excluded.city, state = excluded.state,
  modality = excluded.modality, has_scholarship = excluded.has_scholarship,
  scholarship_info = excluded.scholarship_info, weekly_hours = excluded.weekly_hours,
  vacancies = excluded.vacancies, target_stages = excluded.target_stages,
  deadline = excluded.deadline, status = excluded.status;

-- -----------------------------------------------------------------------------
-- 5. Candidaturas (enviadas e respondidas pelo fluxo normal)
-- -----------------------------------------------------------------------------
insert into public.opportunity_applications (id, opportunity_id, applicant_id, message, created_at, updated_at)
select v.id, v.opportunity_id, v.applicant_id, v.message,
       now() - make_interval(hours => v.hours_ago), now() - make_interval(hours => v.hours_ago)
from (
  values
    ('f4000000-0000-4000-8000-000000000001'::uuid, 'f3000000-0000-4000-8000-000000000001'::uuid, 'd2000000-0000-4000-8000-000000000001'::uuid,
     'Olá, Marina! Já comecei a estudar visão computacional no curso de Python e adoraria aplicar isso no agro da nossa região. Tenho tardes livres.', 150),
    ('f4000000-0000-4000-8000-000000000002'::uuid, 'f3000000-0000-4000-8000-000000000001'::uuid, 'd2000000-0000-4000-8000-000000000004'::uuid,
     'Oi, Marina! Estou começando em análise de dados para a minha IC em catálise e queria muito aprender visão computacional também.', 20),
    ('f4000000-0000-4000-8000-000000000003'::uuid, 'f3000000-0000-4000-8000-000000000003'::uuid, 'd2000000-0000-4000-8000-000000000001'::uuid,
     'Olá, Luiza! Os dados de queimadas me interessam muito, e eu já trabalho com Python e imagens na minha IC atual.', 30)
) as v (id, opportunity_id, applicant_id, message, hours_ago)
where exists (select 1 from public.research_opportunities o where o.id = v.opportunity_id)
  and exists (select 1 from public.profiles p where p.id = v.applicant_id)
  -- O trigger recusa a candidatura repetida (CD073) antes do ON CONFLICT: confere antes.
  and not exists (
    select 1 from public.opportunity_applications a
    where a.opportunity_id = v.opportunity_id and a.applicant_id = v.applicant_id
  )
on conflict do nothing;

-- Estado do seed: a da Larissa na vaga da Marina aprovada (com recado); as outras enviadas. A troca
-- de status marca responded_at; as enviadas voltam sem resposta.
update public.opportunity_applications a
  set status = v.status::public.application_status, owner_note = v.owner_note
from (
  values
    ('f4000000-0000-4000-8000-000000000001'::uuid, 'accepted',
     'Que alegria! Começamos na próxima segunda, às 14h, no laboratório 3. Traga o seu notebook.'),
    ('f4000000-0000-4000-8000-000000000002'::uuid, 'submitted', null::text),
    ('f4000000-0000-4000-8000-000000000003'::uuid, 'submitted', null::text)
) as v (id, status, owner_note)
where a.id = v.id
  and (a.status::text <> v.status or a.owner_note is distinct from v.owner_note);

update public.opportunity_applications a
  set responded_at = case when a.status = 'submitted' then null else a.created_at + interval '1 day' end
where a.id::text like 'f4000000-%';

-- -----------------------------------------------------------------------------
-- 6. Publicações, curtidas e comentários
-- -----------------------------------------------------------------------------
insert into public.posts (id, author_id, kind, body, link_url, portfolio_item_id, opportunity_id, created_at, updated_at)
select v.id, v.author_id, v.kind::public.post_kind, v.body, v.link_url,
       (select p.id from public.portfolio_items p where p.id = v.portfolio_item_id),
       (select o.id from public.research_opportunities o where o.id = v.opportunity_id),
       now() - make_interval(hours => v.hours_ago), now() - make_interval(hours => v.hours_ago)
from (
  values
    ('f1000000-0000-4000-8000-000000000001'::uuid, 'd1000000-0000-4000-8000-000000000001'::uuid, 'update',
     E'Abri duas vagas de iniciação científica em visão computacional para o agro! Bolsa PIBIC, 12 horas por semana, aqui no IFSP Jacareí. Se você nunca programou, tudo bem: a gente aprende junto. (demonstração)',
     null::text, null::uuid, 'f3000000-0000-4000-8000-000000000001'::uuid, 190),
    ('f1000000-0000-4000-8000-000000000002'::uuid, 'd1000000-0000-4000-8000-000000000002'::uuid, 'publication',
     E'Saiu o nosso artigo sobre previsão de focos de queimada com séries temporais de satélite. Todos os dados e o código são abertos: quem quiser reproduzir, me chama! (demonstração)',
     null, 'f2000000-0000-4000-8000-000000000003'::uuid, null, 140),
    ('f1000000-0000-4000-8000-000000000003'::uuid, 'd2000000-0000-4000-8000-000000000005'::uuid, 'achievement',
     E'Qualifiquei o doutorado! Dois anos conciliando a pesquisa com a maternidade, e a banca elogiou justamente as entrevistas com mães pesquisadoras. Obrigada à Patrícia e a todas que me apoiaram aqui na rede. (demonstração)',
     null, 'f2000000-0000-4000-8000-000000000006'::uuid, null, 46),
    ('f1000000-0000-4000-8000-000000000004'::uuid, 'd2000000-0000-4000-8000-000000000001'::uuid, 'project',
     E'Primeira semana de IC: 600 fotos de folhas de café rotuladas e o primeiro modelo rodando no notebook. A acurácia ainda está em 71%, mas já é um começo! (demonstração)',
     null, 'f2000000-0000-4000-8000-000000000004'::uuid, null, 30),
    ('f1000000-0000-4000-8000-000000000005'::uuid, 'd1000000-0000-4000-8000-000000000006'::uuid, 'event',
     E'Semana que vem tem a Semana de Saúde Coletiva na Fiocruz, com mesa só de pesquisadoras sobre saúde da mulher. Transmissão aberta e gratuita. (demonstração)',
     'https://example.org/demo/semana-saude-coletiva', null, null, 70),
    ('f1000000-0000-4000-8000-000000000006'::uuid, 'd1000000-0000-4000-8000-000000000007'::uuid, 'project',
     E'O painel solar do nosso CubeSat universitário passou no teste de vibração! Equipe de 8 estudantes, 6 delas mulheres. Orgulho enorme dessa turma. (demonstração)',
     null, 'f2000000-0000-4000-8000-000000000009'::uuid, null, 95),
    ('f1000000-0000-4000-8000-000000000007'::uuid, 'd1000000-0000-4000-8000-000000000009'::uuid, 'publication',
     E'Pôster aceito no Encontro de Física da Matéria Condensada! Filmes finos de óxido de zinco para sensores de gás que custam uma fração dos comerciais. (demonstração)',
     null, 'f2000000-0000-4000-8000-000000000007'::uuid, null, 100),
    ('f1000000-0000-4000-8000-000000000008'::uuid, 'd2000000-0000-4000-8000-000000000004'::uuid, 'update',
     E'Pergunta para quem já passou por isso: como vocês aprenderam a ler artigos em inglês sem travar em cada parágrafo? Estou começando a revisão bibliográfica da minha IC. (demonstração)',
     null, null, null, 20),
    ('f1000000-0000-4000-8000-000000000009'::uuid, 'd1000000-0000-4000-8000-000000000008'::uuid, 'event',
     E'Estamos montando a monitoria on-line da olimpíada de matemática para escolas públicas. Precisamos de voluntárias da graduação e da pós, 4 horas por semana. (demonstração)',
     null, null, 'f3000000-0000-4000-8000-000000000006'::uuid, 50),
    ('f1000000-0000-4000-8000-000000000010'::uuid, 'd1000000-0000-4000-8000-000000000004'::uuid, 'achievement',
     E'Recebi o Prêmio Jovem Pesquisadora em Biotecnologia! O trabalho com enzimas que degradam PET começou numa conversa de corredor e virou a minha tese. (demonstração)',
     null, 'f2000000-0000-4000-8000-000000000008'::uuid, null, 120),
    ('f1000000-0000-4000-8000-000000000011'::uuid, 'd1000000-0000-4000-8000-000000000010'::uuid, 'update',
     E'Hoje levamos o projeto de divulgação científica para três escolas de São Carlos. A pergunta que mais ouvi: "professora, mulher pode ser cientista?". Pode, e vai. (demonstração)',
     null, null, null, 12),
    ('f1000000-0000-4000-8000-000000000012'::uuid, 'd1000000-0000-4000-8000-000000000005'::uuid, 'project',
     E'De volta da expedição no Rio Negro: 14 dias, 3 mil amostras de folhiço e uma equipe 100% feminina no barco. Agora começa a parte de laboratório. (demonstração)',
     null, null, null, 160)
) as v (id, author_id, kind, body, link_url, portfolio_item_id, opportunity_id, hours_ago)
where exists (select 1 from public.profiles p where p.id = v.author_id)
on conflict (id) do update set kind = excluded.kind, body = excluded.body, link_url = excluded.link_url;

insert into public.post_likes (post_id, user_id, created_at)
select v.post_id, v.user_id, now() - make_interval(hours => v.hours_ago)
from (
  values
    ('f1000000-0000-4000-8000-000000000001'::uuid, 'd2000000-0000-4000-8000-000000000001'::uuid, 180),
    ('f1000000-0000-4000-8000-000000000001'::uuid, 'd2000000-0000-4000-8000-000000000004'::uuid, 170),
    ('f1000000-0000-4000-8000-000000000001'::uuid, 'd1000000-0000-4000-8000-000000000010'::uuid, 160),
    ('f1000000-0000-4000-8000-000000000001'::uuid, 'd1000000-0000-4000-8000-000000000002'::uuid, 150),
    ('f1000000-0000-4000-8000-000000000002'::uuid, 'd1000000-0000-4000-8000-000000000001'::uuid, 130),
    ('f1000000-0000-4000-8000-000000000002'::uuid, 'd2000000-0000-4000-8000-000000000001'::uuid, 120),
    ('f1000000-0000-4000-8000-000000000002'::uuid, 'd2000000-0000-4000-8000-000000000003'::uuid, 110),
    ('f1000000-0000-4000-8000-000000000003'::uuid, 'd1000000-0000-4000-8000-000000000006'::uuid, 44),
    ('f1000000-0000-4000-8000-000000000003'::uuid, 'd1000000-0000-4000-8000-000000000004'::uuid, 40),
    ('f1000000-0000-4000-8000-000000000003'::uuid, 'd1000000-0000-4000-8000-000000000001'::uuid, 30),
    ('f1000000-0000-4000-8000-000000000003'::uuid, 'd2000000-0000-4000-8000-000000000001'::uuid, 25),
    ('f1000000-0000-4000-8000-000000000003'::uuid, 'd1000000-0000-4000-8000-000000000008'::uuid, 20),
    ('f1000000-0000-4000-8000-000000000004'::uuid, 'd1000000-0000-4000-8000-000000000001'::uuid, 28),
    ('f1000000-0000-4000-8000-000000000004'::uuid, 'd2000000-0000-4000-8000-000000000004'::uuid, 26),
    ('f1000000-0000-4000-8000-000000000004'::uuid, 'd1000000-0000-4000-8000-000000000007'::uuid, 5),
    ('f1000000-0000-4000-8000-000000000006'::uuid, 'd2000000-0000-4000-8000-000000000001'::uuid, 90),
    ('f1000000-0000-4000-8000-000000000006'::uuid, 'd1000000-0000-4000-8000-000000000002'::uuid, 85),
    ('f1000000-0000-4000-8000-000000000007'::uuid, 'd1000000-0000-4000-8000-000000000003'::uuid, 98),
    ('f1000000-0000-4000-8000-000000000008'::uuid, 'd2000000-0000-4000-8000-000000000001'::uuid, 18),
    ('f1000000-0000-4000-8000-000000000010'::uuid, 'd2000000-0000-4000-8000-000000000005'::uuid, 115),
    ('f1000000-0000-4000-8000-000000000010'::uuid, 'd1000000-0000-4000-8000-000000000011'::uuid, 110),
    ('f1000000-0000-4000-8000-000000000011'::uuid, 'd1000000-0000-4000-8000-000000000001'::uuid, 10),
    ('f1000000-0000-4000-8000-000000000011'::uuid, 'd1000000-0000-4000-8000-000000000008'::uuid, 9),
    ('f1000000-0000-4000-8000-000000000012'::uuid, 'd2000000-0000-4000-8000-000000000003'::uuid, 150)
) as v (post_id, user_id, hours_ago)
where exists (select 1 from public.posts p where p.id = v.post_id)
  and exists (select 1 from public.profiles p where p.id = v.user_id)
on conflict do nothing;

insert into public.post_comments (id, post_id, author_id, body, created_at, updated_at)
select v.id, v.post_id, v.author_id, v.body, now() - make_interval(hours => v.hours_ago), now() - make_interval(hours => v.hours_ago)
from (
  values
    ('f7000000-0000-4000-8000-000000000001'::uuid, 'f1000000-0000-4000-8000-000000000001'::uuid, 'd2000000-0000-4000-8000-000000000004'::uuid,
     'Que demais! Vale para quem é de outro câmpus?', 175),
    ('f7000000-0000-4000-8000-000000000002'::uuid, 'f1000000-0000-4000-8000-000000000001'::uuid, 'd1000000-0000-4000-8000-000000000001'::uuid,
     'Vale sim, Yasmin! As reuniões presenciais são às quintas, mas dá para combinar.', 172),
    ('f7000000-0000-4000-8000-000000000003'::uuid, 'f1000000-0000-4000-8000-000000000003'::uuid, 'd1000000-0000-4000-8000-000000000006'::uuid,
     'Muito merecido, Débora! Foi um prazer acompanhar essa caminhada.', 43),
    ('f7000000-0000-4000-8000-000000000004'::uuid, 'f1000000-0000-4000-8000-000000000003'::uuid, 'd1000000-0000-4000-8000-000000000004'::uuid,
     'Parabéns! As entrevistas ficaram lindas.', 38),
    ('f7000000-0000-4000-8000-000000000005'::uuid, 'f1000000-0000-4000-8000-000000000004'::uuid, 'd1000000-0000-4000-8000-000000000001'::uuid,
     '71% na primeira semana é ótimo! Na reunião de quinta a gente olha o aumento de dados.', 27),
    ('f7000000-0000-4000-8000-000000000006'::uuid, 'f1000000-0000-4000-8000-000000000008'::uuid, 'd1000000-0000-4000-8000-000000000002'::uuid,
     'Leia primeiro o resumo, as figuras e a conclusão. Só depois o texto todo. E tudo bem usar o tradutor no começo!', 16),
    ('f7000000-0000-4000-8000-000000000007'::uuid, 'f1000000-0000-4000-8000-000000000008'::uuid, 'd2000000-0000-4000-8000-000000000001'::uuid,
     'Eu faço um glossário com as palavras que se repetem. Ajudou muito!', 14),
    ('f7000000-0000-4000-8000-000000000008'::uuid, 'f1000000-0000-4000-8000-000000000011'::uuid, 'd1000000-0000-4000-8000-000000000001'::uuid,
     'Pode, e vai! Que trabalho bonito, Tatiane.', 9)
) as v (id, post_id, author_id, body, hours_ago)
where exists (select 1 from public.posts p where p.id = v.post_id)
  and exists (select 1 from public.profiles p where p.id = v.author_id)
on conflict (id) do update set body = excluded.body;

-- -----------------------------------------------------------------------------
-- 7. Mensagens diretas
-- -----------------------------------------------------------------------------
insert into public.direct_conversations (id, user_a, user_b, initiator_id, status, created_at)
select v.id, least(v.initiator_id, v.other_id), greatest(v.initiator_id, v.other_id), v.initiator_id,
       v.status::public.conversation_status, now() - make_interval(hours => v.hours_ago)
from (
  values
    ('f5000000-0000-4000-8000-000000000001'::uuid, 'd1000000-0000-4000-8000-000000000001'::uuid, 'd2000000-0000-4000-8000-000000000001'::uuid, 'active', 26),
    ('f5000000-0000-4000-8000-000000000002'::uuid, 'd2000000-0000-4000-8000-000000000004'::uuid, 'd2000000-0000-4000-8000-000000000001'::uuid, 'active', 19),
    ('f5000000-0000-4000-8000-000000000003'::uuid, 'd1000000-0000-4000-8000-000000000007'::uuid, 'd2000000-0000-4000-8000-000000000001'::uuid, 'request', 4),
    ('f5000000-0000-4000-8000-000000000004'::uuid, 'd2000000-0000-4000-8000-000000000002'::uuid, 'd1000000-0000-4000-8000-000000000001'::uuid, 'request', 6),
    ('f5000000-0000-4000-8000-000000000005'::uuid, 'd2000000-0000-4000-8000-000000000005'::uuid, 'd1000000-0000-4000-8000-000000000006'::uuid, 'active', 40)
) as v (id, initiator_id, other_id, status, hours_ago)
where exists (select 1 from public.profiles p where p.id = v.initiator_id)
  and exists (select 1 from public.profiles p where p.id = v.other_id)
on conflict do nothing;

insert into public.direct_messages (id, conversation_id, sender_id, body, created_at)
select v.id, v.conversation_id, v.sender_id, v.body, now() - make_interval(mins => v.mins_ago)
from (
  values
    -- Marina ↔ Larissa (a última, da Marina, fica sem ler)
    ('f6000000-0000-4000-8000-000000000001'::uuid, 'f5000000-0000-4000-8000-000000000001'::uuid, 'd1000000-0000-4000-8000-000000000001'::uuid,
     'Larissa, aprovei sua candidatura na IC do agro! Vi que você também se candidatou na vaga da Luiza.', 1550),
    ('f6000000-0000-4000-8000-000000000002'::uuid, 'f5000000-0000-4000-8000-000000000001'::uuid, 'd2000000-0000-4000-8000-000000000001'::uuid,
     'Obrigada, Marina!! Sim, mandei antes de saber do resultado. Tudo bem eu manter as duas?', 1500),
    ('f6000000-0000-4000-8000-000000000003'::uuid, 'f5000000-0000-4000-8000-000000000001'::uuid, 'd1000000-0000-4000-8000-000000000001'::uuid,
     'Claro! Inclusive os temas conversam. Se a Luiza te chamar, a gente vê juntas como dividir as horas.', 1440),
    ('f6000000-0000-4000-8000-000000000004'::uuid, 'f5000000-0000-4000-8000-000000000001'::uuid, 'd1000000-0000-4000-8000-000000000001'::uuid,
     'Ah, e traga as fotos novas na quinta: quero ver o aumento de dados que você testou.', 95),
    -- Yasmin ↔ Larissa
    ('f6000000-0000-4000-8000-000000000005'::uuid, 'f5000000-0000-4000-8000-000000000002'::uuid, 'd2000000-0000-4000-8000-000000000004'::uuid,
     'Lari, você usa Jupyter ou VS Code para os experimentos?', 1140),
    ('f6000000-0000-4000-8000-000000000006'::uuid, 'f5000000-0000-4000-8000-000000000002'::uuid, 'd2000000-0000-4000-8000-000000000001'::uuid,
     'Jupyter para explorar e VS Code quando o código cresce. Te mando o tutorial que me ajudou!', 1100),
    ('f6000000-0000-4000-8000-000000000007'::uuid, 'f5000000-0000-4000-8000-000000000002'::uuid, 'd2000000-0000-4000-8000-000000000004'::uuid,
     'Valeuu! Vou testar hoje à noite.', 1080),
    -- Pedido de mensagem: Renata → Larissa
    ('f6000000-0000-4000-8000-000000000008'::uuid, 'f5000000-0000-4000-8000-000000000003'::uuid, 'd1000000-0000-4000-8000-000000000007'::uuid,
     'Oi, Larissa! Vi seu projeto de visão computacional no feed. Estamos procurando alguém para ajudar a classificar imagens do CubeSat. Topa conversar?', 230),
    -- Pedido de mensagem: Gabriela → Marina
    ('f6000000-0000-4000-8000-000000000009'::uuid, 'f5000000-0000-4000-8000-000000000004'::uuid, 'd2000000-0000-4000-8000-000000000002'::uuid,
     'Olá, Marina! Sou mestranda em engenharia civil e queria usar visão computacional para detectar fissuras em concreto. Você teria 15 minutos para me indicar por onde começar?', 350),
    -- Débora ↔ Patrícia
    ('f6000000-0000-4000-8000-000000000010'::uuid, 'f5000000-0000-4000-8000-000000000005'::uuid, 'd2000000-0000-4000-8000-000000000005'::uuid,
     'Patrícia, qualifiquei! Queria te agradecer de novo por tudo.', 2390),
    ('f6000000-0000-4000-8000-000000000011'::uuid, 'f5000000-0000-4000-8000-000000000005'::uuid, 'd1000000-0000-4000-8000-000000000006'::uuid,
     'Que notícia boa, Débora! Vamos marcar um café para comemorar e pensar no artigo da tese?', 2300),
    ('f6000000-0000-4000-8000-000000000012'::uuid, 'f5000000-0000-4000-8000-000000000005'::uuid, 'd2000000-0000-4000-8000-000000000005'::uuid,
     'Vamos! Quinta à tarde fica bom para você?', 2280)
) as v (id, conversation_id, sender_id, body, mins_ago)
where exists (select 1 from public.direct_conversations c where c.id = v.conversation_id)
on conflict (id) do nothing;

-- Estado das conversas, resumo da última mensagem e leituras do seed: tudo lido, menos o que a
-- demonstração mostra como novo — as duas últimas da Marina para a Larissa (#1) e os dois pedidos
-- de mensagem (#3 para a Larissa, #4 para a Marina).
update public.direct_conversations c
  set status = v.status::public.conversation_status
from (
  values
    ('f5000000-0000-4000-8000-000000000001'::uuid, 'active'),
    ('f5000000-0000-4000-8000-000000000002'::uuid, 'active'),
    ('f5000000-0000-4000-8000-000000000003'::uuid, 'request'),
    ('f5000000-0000-4000-8000-000000000004'::uuid, 'request'),
    ('f5000000-0000-4000-8000-000000000005'::uuid, 'active')
) as v (id, status)
where c.id = v.id and c.status::text <> v.status;

update public.direct_conversations c
  set last_message_at = m.created_at,
      last_message_preview = left(regexp_replace(m.body, '\s+', ' ', 'g'), 140),
      last_sender_id = m.sender_id,
      user_a_read_at = m.created_at,
      user_b_read_at = m.created_at
from (
  select distinct on (dm.conversation_id) dm.conversation_id, dm.created_at, dm.body, dm.sender_id
  from public.direct_messages dm
  where dm.conversation_id::text like 'f5000000-%'
  order by dm.conversation_id, dm.created_at desc
) as m
where c.id = m.conversation_id;

-- #1: a Larissa leu até a resposta dela; #3 e #4: quem recebeu o pedido ainda não abriu.
update public.direct_conversations c
  set user_a_read_at = case when c.user_a = v.reader then v.read_at else c.user_a_read_at end,
      user_b_read_at = case when c.user_b = v.reader then v.read_at else c.user_b_read_at end
from (
  select 'f5000000-0000-4000-8000-000000000001'::uuid as id,
         'd2000000-0000-4000-8000-000000000001'::uuid as reader,
         (select m.created_at from public.direct_messages m
           where m.id = 'f6000000-0000-4000-8000-000000000002') as read_at
  union all
  select 'f5000000-0000-4000-8000-000000000003'::uuid, 'd2000000-0000-4000-8000-000000000001'::uuid, null::timestamptz
  union all
  select 'f5000000-0000-4000-8000-000000000004'::uuid, 'd1000000-0000-4000-8000-000000000001'::uuid, null::timestamptz
) as v
where c.id = v.id;

-- Avisos de mensagem de conversas que a pessoa já leu até o fim ficam lidos.
update public.notifications n
  set read_at = n.created_at + interval '10 minutes'
from public.direct_conversations c
where n.read_at is null
  and n.type = 'direct_message'
  and n.link = '/mensagens/' || c.id::text
  and c.last_message_at <= case when n.user_id = c.user_a then c.user_a_read_at else c.user_b_read_at end;

-- -----------------------------------------------------------------------------
-- 8. Avisos: os da rede social com mais de 2 dias ficam lidos (os recentes seguem como novos)
-- -----------------------------------------------------------------------------
update public.notifications n
  set read_at = n.created_at + interval '2 hours'
where n.read_at is null
  and n.created_at < now() - interval '2 days'
  and n.type in (
    'new_follower', 'connection_request', 'connection_accepted', 'post_like', 'post_comment',
    'opportunity_application', 'application_update', 'direct_message'
  );

-- -----------------------------------------------------------------------------
-- 9. Reposição dos avisos que a demonstração mostra como novos (refeitos se a plateia os apagou)
-- -----------------------------------------------------------------------------
select private.notify(v.user_id, v.type::public.notification_type, v.title, v.body, v.link, now() - interval '1 hour')
from (
  values
    ('d2000000-0000-4000-8000-000000000001'::uuid, 'connection_request',
     'Juliana Ribeiro quer se conectar com você',
     'Oi, Larissa! Vi seu projeto de visão computacional e adoraria acompanhar. Também trabalho com modelagem.',
     '/pesquisadoras/d1000000-0000-4000-8000-000000000008'),
    ('d2000000-0000-4000-8000-000000000001'::uuid, 'direct_message', 'Nova mensagem de Marina Albuquerque',
     'Abra a conversa para ler e responder.', '/mensagens/f5000000-0000-4000-8000-000000000001'),
    ('d2000000-0000-4000-8000-000000000001'::uuid, 'direct_message', 'Renata Carvalho quer conversar com você',
     'É um pedido de mensagem: responda para aceitar ou recuse, se preferir.',
     '/mensagens/f5000000-0000-4000-8000-000000000003'),
    ('d2000000-0000-4000-8000-000000000001'::uuid, 'application_update',
     'Sua candidatura para “IC em visão computacional para o agro do Vale do Paraíba” foi aprovada!',
     'Que alegria! Começamos na próxima segunda, às 14h, no laboratório 3. Traga o seu notebook.',
     '/ics/f3000000-0000-4000-8000-000000000001'),
    ('d1000000-0000-4000-8000-000000000001'::uuid, 'connection_request', 'Débora Alves quer se conectar com você',
     'Marina, gostei muito da sua fala sobre dados abertos no Boletim. Vamos nos conectar?',
     '/pesquisadoras/d2000000-0000-4000-8000-000000000005'),
    ('d1000000-0000-4000-8000-000000000001'::uuid, 'direct_message', 'Gabriela Lima quer conversar com você',
     'É um pedido de mensagem: responda para aceitar ou recuse, se preferir.',
     '/mensagens/f5000000-0000-4000-8000-000000000004'),
    ('d1000000-0000-4000-8000-000000000001'::uuid, 'opportunity_application',
     'Nova candidatura para “IC em visão computacional para o agro do Vale do Paraíba”',
     'Yasmin Oliveira se candidatou. Abra para ler a carta de apresentação.',
     '/ics/f3000000-0000-4000-8000-000000000001/candidaturas')
) as v (user_id, type, title, body, link)
where exists (select 1 from public.profiles p where p.id = v.user_id)
  and not exists (
    select 1 from public.notifications n
    where n.user_id = v.user_id and n.type::text = v.type and n.link = v.link
  );

update public.notifications n
  set read_at = null
where n.read_at is not null
  and (n.user_id, n.type::text, n.link) in (
    ('d2000000-0000-4000-8000-000000000001'::uuid, 'connection_request', '/pesquisadoras/d1000000-0000-4000-8000-000000000008'),
    ('d2000000-0000-4000-8000-000000000001'::uuid, 'direct_message', '/mensagens/f5000000-0000-4000-8000-000000000001'),
    ('d2000000-0000-4000-8000-000000000001'::uuid, 'direct_message', '/mensagens/f5000000-0000-4000-8000-000000000003'),
    ('d2000000-0000-4000-8000-000000000001'::uuid, 'application_update', '/ics/f3000000-0000-4000-8000-000000000001'),
    ('d1000000-0000-4000-8000-000000000001'::uuid, 'connection_request', '/pesquisadoras/d2000000-0000-4000-8000-000000000005'),
    ('d1000000-0000-4000-8000-000000000001'::uuid, 'direct_message', '/mensagens/f5000000-0000-4000-8000-000000000004'),
    ('d1000000-0000-4000-8000-000000000001'::uuid, 'opportunity_application', '/ics/f3000000-0000-4000-8000-000000000001/candidaturas')
  );

-- -----------------------------------------------------------------------------
-- 10. Limites anti-spam das contas de demonstração zerados (a plateia usa as mesmas contas)
-- -----------------------------------------------------------------------------
delete from private.rate_limit_events e
using auth.users u
where u.id = e.user_id and lower(u.email) like '%@demo.cienciadelas.dev';
