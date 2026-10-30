-- =============================================================================
-- Artemis — seed do Pergunte a uma cientista (docs/16-pergunte-a-uma-cientista.md)
-- =============================================================================
-- Roda DEPOIS de supabase/seed.sql (config.toml: sql_paths = ['./seed.sql', './seeds/*.sql']).
-- TUDO FICTÍCIO e idempotente (pode rodar de novo sem duplicar nada). Toda pergunta termina com
-- "(pergunta fictícia de demonstração)". As respostas dão só conselhos gerais e acolhedores: sem
-- fatos, regras, datas, números nem nomes de programas, instituições ou pessoas reais.
--
--   | Pergunta (e3…)                                              | Estado     | Respostas (e4…)      |
--   | ----------------------------------------------------------- | ---------- | -------------------- |
--   | 01 Preciso ser muito boa em matemática… biologia?           | publicada  | 01 Fernanda (nome)   |
--   |                                                             |            | 02 Juliana (anônima) |
--   | 02 Como é o dia a dia de uma pesquisadora de computação?    | publicada  | 03 Marina (nome)     |
--   | 03 Dá para começar a pesquisar ainda no ensino técnico?     | publicada  | 04 Tatiane (anônima) |
--   | 04 Como conciliar pesquisa e trabalho durante a graduação?  | publicada  | 05 Patrícia (anônima)|
--   | 05 O que faz uma engenheira de materiais no laboratório?    | publicada  | — (esperando)        |
--   | 06 Tenho medo de não ser inteligente o suficiente…          | pendente   | —                    |
--
-- Link de acompanhamento da pergunta 06 (para o pitch; o banco guarda só o SHA-256):
--   <site>/pergunte/acompanhar/DemoPergunte-Artemis2026-IFSPjcr
-- As demais perguntas têm hashes de textos que não são tokens válidos (ninguém acompanha).
-- NÃO rode este arquivo em produção.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Perguntas (contexto confiável: o seed roda como postgres; a moderadora fictícia Priscila,
-- d0…02, aparece como quem revisou)
-- -----------------------------------------------------------------------------
insert into public.public_questions (
  id, body, stage, area_id, status, tracking_token_hash,
  created_at, reviewed_at, published_at, reviewed_by
)
select
  v.id, v.body, v.stage,
  (select a.id from public.research_areas a where a.name = v.big_area and a.big_area = v.big_area),
  v.status,
  encode(extensions.digest(v.token_source, 'sha256'), 'hex'),
  now() - make_interval(hours => v.hours_ago),
  case when v.status <> 'pending' then now() - make_interval(hours => v.hours_ago - 3) end,
  case when v.status = 'published' then now() - make_interval(hours => v.hours_ago - 3) end,
  case when v.status <> 'pending' and exists (
    select 1 from public.profiles p where p.id = 'd0000000-0000-4000-8000-000000000002'
  ) then 'd0000000-0000-4000-8000-000000000002'::uuid end
from (
  values
    ('e3000000-0000-4000-8000-000000000001'::uuid,
     'Preciso ser muito boa em matemática para fazer pesquisa em biologia? Adoro biologia, mas matemática sempre foi a matéria em que mais tive dificuldade na escola. (pergunta fictícia de demonstração)',
     'ensino_medio_tecnico', 'Ciências Biológicas', 'published', 'seed-pergunte-01', 240),
    ('e3000000-0000-4000-8000-000000000002'::uuid,
     'Como é o dia a dia de uma pesquisadora de computação? Faço o técnico em informática e queria entender o que se faz numa pesquisa, além de programar. (pergunta fictícia de demonstração)',
     'ensino_medio_tecnico', 'Ciências Exatas e da Terra', 'published', 'seed-pergunte-02', 200),
    ('e3000000-0000-4000-8000-000000000003'::uuid,
     'Dá para começar a pesquisar ainda no ensino técnico? Ou preciso esperar entrar na faculdade para participar de um projeto de pesquisa? (pergunta fictícia de demonstração)',
     'ensino_medio_tecnico', 'Multidisciplinar', 'published', 'seed-pergunte-03', 150),
    ('e3000000-0000-4000-8000-000000000004'::uuid,
     'Como conciliar pesquisa e trabalho durante a graduação? Trabalho meio período para ajudar em casa e tenho medo de não dar conta de uma iniciação científica. (pergunta fictícia de demonstração)',
     'graduacao', null, 'published', 'seed-pergunte-04', 100),
    ('e3000000-0000-4000-8000-000000000005'::uuid,
     'O que faz uma engenheira de materiais no laboratório? Vi esse curso numa feira de profissões e fiquei curiosa sobre como é o trabalho na prática. (pergunta fictícia de demonstração)',
     'ensino_medio_tecnico', 'Engenharias', 'published', 'seed-pergunte-05', 30),
    ('e3000000-0000-4000-8000-000000000006'::uuid,
     'Tenho medo de não ser inteligente o suficiente para a ciência. Isso é normal? Às vezes acho que todo mundo na sala entende tudo mais rápido do que eu. (pergunta fictícia de demonstração)',
     'graduacao', null, 'pending', 'DemoPergunte-Artemis2026-IFSPjcr', 5)
) as v (id, body, stage, big_area, status, token_source, hours_ago)
on conflict (id) do nothing;

-- -----------------------------------------------------------------------------
-- Respostas das mentoras fictícias (só se a pergunta existe, está publicada e a mentora existe)
-- -----------------------------------------------------------------------------
insert into public.public_answers (id, question_id, author_id, body, show_identity, created_at)
select v.id, v.question_id, v.author_id, v.body, v.show_identity,
       now() - make_interval(hours => v.hours_ago)
from (
  values
    ('e4000000-0000-4000-8000-000000000001'::uuid, 'e3000000-0000-4000-8000-000000000001'::uuid,
     'd1000000-0000-4000-8000-000000000005'::uuid, true, 230,
     E'Não precisa ser a melhor da turma em matemática para pesquisar em biologia. Na ecologia, usamos matemática e estatística como ferramentas, e a gente aprende aos poucos, conforme a pesquisa pede.\n\nNo começo, o que mais conta é curiosidade, atenção aos detalhes e coragem de perguntar. Se puder, converse com uma professora de biologia da sua escola e pergunte se há algum projeto em que você possa ajudar: é um ótimo jeito de ver a pesquisa de perto.'),
    ('e4000000-0000-4000-8000-000000000002'::uuid, 'e3000000-0000-4000-8000-000000000001'::uuid,
     'd1000000-0000-4000-8000-000000000008'::uuid, false, 210,
     E'Trabalho com matemática aplicada e convivo com muitas biólogas: várias me contam que tinham medo de números na escola. A matemática da pesquisa é diferente da prova: você tem tempo, usa o computador, pede ajuda às colegas e aprende o que o seu problema precisa.\n\nAchar matemática difícil não é sinal de que a ciência não é para você. É só um assunto que pede paciência, como qualquer outro.'),
    ('e4000000-0000-4000-8000-000000000003'::uuid, 'e3000000-0000-4000-8000-000000000002'::uuid,
     'd1000000-0000-4000-8000-000000000001'::uuid, true, 180,
     E'O dia a dia muda bastante, e essa é uma das partes boas. Tem dias de programar e testar ideias, dias de ler artigos para entender o que outras pessoas já fizeram, dias de reunião com o grupo para discutir resultados e dias de escrever.\n\nTambém passo um bom tempo orientando estudantes e explicando o que descobrimos para quem não é da área. Se você gosta de resolver problemas e de aprender coisas novas o tempo todo, vai se sentir em casa.'),
    ('e4000000-0000-4000-8000-000000000004'::uuid, 'e3000000-0000-4000-8000-000000000003'::uuid,
     'd1000000-0000-4000-8000-000000000010'::uuid, false, 120,
     E'Dá, sim! Muita gente começa no ensino técnico, em projetos da própria escola, feiras de ciências ou grupos orientados por professoras.\n\nConverse com as professoras das disciplinas de que você mais gosta e pergunte se elas têm projetos ou conhecem algum. E anote tudo o que fizer num caderno: perguntas, tentativas e erros. Isso já é pesquisa.'),
    ('e4000000-0000-4000-8000-000000000005'::uuid, 'e3000000-0000-4000-8000-000000000004'::uuid,
     'd1000000-0000-4000-8000-000000000006'::uuid, false, 80,
     E'Conciliar é possível, mas pede combinados claros. Converse com quem orienta você sobre o tempo que você tem de verdade e montem juntas um plano realista.\n\nReserve momentos fixos na semana para a pesquisa, mesmo que curtos, e cuide do descanso: cansaço demais atrapalha os dois lados. O seu caminho não precisa ser igual ao de quem só estuda, e continua sendo pesquisa de verdade.')
) as v (id, question_id, author_id, show_identity, hours_ago, body)
where exists (select 1 from public.profiles p where p.id = v.author_id)
  and exists (
    select 1 from public.public_questions q where q.id = v.question_id and q.status = 'published'
  )
on conflict (id) do nothing;
