-- =============================================================================
-- Artemis — seed da AFINIDADE DE TRAJETÓRIA (docs/17-afinidade-de-trajetoria.md)
-- =============================================================================
-- Roda DEPOIS de supabase/seed.sql (config.toml: sql_paths = ['./seed.sql', './seeds/*.sql']).
-- TUDO FICTÍCIO e idempotente: só UPDATEs por UUID fixo das personas de demonstração
-- (@demo.cienciadelas.dev). Rodar de novo deixa exatamente as mesmas marcas.
--
--   | Persona                     | Marcas                                              |
--   | --------------------------- | --------------------------------------------------- |
--   | Larissa (mentoranda)        | primeira-geracao, escola-publica, ensino-tecnico    |
--   | Marina (mentora)            | primeira-geracao, escola-publica                    |
--   | Juliana (mentora)           | primeira-geracao, escola-publica, fora-das-capitais |
--   | Luiza (mentora)             | primeira-geracao, ensino-tecnico, fora-das-capitais |
--   | Tatiane (mentora)           | escola-publica, fora-das-capitais                   |
--   | Débora (mentoranda)         | mae-cuidadora, retorno-aos-estudos                  |
--   | Patrícia (mentora)          | mae-cuidadora                                       |
--   | Carolina (mentora)          | mae-cuidadora                                       |
--   | Yasmin (mentoranda)         | primeira-geracao, ensino-tecnico, trabalha-e-estuda |
--   | Gabriela (mentoranda)       | trabalha-e-estuda                                   |
--   | Camila (mentora)            | mudanca-de-area                                     |
--   | Beatriz (mentora)           | mudanca-de-area, fora-das-capitais                  |
--
-- Para a apresentação: a Larissa já está em mentoria com a Marina (por isso a Marina não volta
-- nas sugestões dela). Juliana e Luiza — mesma grande área (Exatas), com vagas — compartilham
-- duas marcas com ela, então os dois primeiros cartões de "Encontrar mentoras" mostram
-- "Vocês têm em comum: as duas foram as primeiras da família na universidade e …".
-- Yasmin e Carolina recebem marcas coerentes com a bio do seed.sql ("Primeira da família na
-- universidade", "Mãe de dois"). Ninguém mais é marcada: não declarar é o padrão.
-- NÃO rode este arquivo em produção.
-- =============================================================================

update public.profiles p
set trajectory_tags = v.tags
from (
  values
    ('d2000000-0000-4000-8000-000000000001'::uuid, array['primeira-geracao', 'escola-publica', 'ensino-tecnico']),
    ('d1000000-0000-4000-8000-000000000001'::uuid, array['primeira-geracao', 'escola-publica']),
    ('d1000000-0000-4000-8000-000000000008'::uuid, array['primeira-geracao', 'escola-publica', 'fora-das-capitais']),
    ('d1000000-0000-4000-8000-000000000002'::uuid, array['primeira-geracao', 'ensino-tecnico', 'fora-das-capitais']),
    ('d1000000-0000-4000-8000-000000000010'::uuid, array['escola-publica', 'fora-das-capitais']),
    ('d2000000-0000-4000-8000-000000000005'::uuid, array['mae-cuidadora', 'retorno-aos-estudos']),
    ('d1000000-0000-4000-8000-000000000006'::uuid, array['mae-cuidadora']),
    ('d1000000-0000-4000-8000-000000000004'::uuid, array['mae-cuidadora']),
    ('d2000000-0000-4000-8000-000000000004'::uuid, array['primeira-geracao', 'ensino-tecnico', 'trabalha-e-estuda']),
    ('d2000000-0000-4000-8000-000000000002'::uuid, array['trabalha-e-estuda']),
    ('d1000000-0000-4000-8000-000000000011'::uuid, array['mudanca-de-area']),
    ('d1000000-0000-4000-8000-000000000003'::uuid, array['mudanca-de-area', 'fora-das-capitais'])
) as v (id, tags)
where p.id = v.id
  -- O trigger profiles_normalize_trajectory ordena as marcas; compara já normalizado para
  -- não regravar (nem mexer em updated_at) quando nada mudou.
  and p.trajectory_tags is distinct from (
    select array_agg(distinct t order by t) from unnest(v.tags) as t
  );
