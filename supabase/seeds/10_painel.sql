-- =============================================================================
-- Artemis — seed do /painel e do modo demonstração (docs/14-painel-e-modo-demo.md)
-- =============================================================================
-- Roda DEPOIS de supabase/seed.sql (config.toml: sql_paths = ['./seed.sql', './seeds/*.sql']).
-- TUDO FICTÍCIO e idempotente (pode rodar de novo sem duplicar nada):
--   * 2 tópicos do fórum SEM resposta, para "Perguntas esperando por você" nunca ficar vazio
--     na demonstração (o da Yasmin combina com a palavra-chave "python" da Marina e da Larissa;
--     o da Manuela, com os temas "pós-graduação" e "carreira acadêmica" da Marina);
--   * 1 pedido de mentoria PENDENTE da Yasmin para a Marina, para a persona "mentora com
--     pedidos para responder" do /demo ser verdade.
-- UUIDs fixos: a1000000-…-0000000001xx tópicos · c1a00000-…-00000000000x pedidos (o prefixo
-- c1000000-…-0000000001xx é do 20_reconhecimento.sql).
-- Os textos terminam com "(demonstração)". NÃO rode este arquivo em produção.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Tópicos sem resposta (contexto confiável: o seed roda como postgres)
-- -----------------------------------------------------------------------------
insert into public.forum_threads (id, category_id, author_id, is_anonymous, title, body, tags, created_at, last_activity_at)
select v.id, c.id, v.author_id, false, v.title, v.body, v.tags,
       now() - make_interval(hours => v.hours_ago), now() - make_interval(hours => v.hours_ago)
from (
  values
    ('a1000000-0000-4000-8000-000000000101'::uuid, 'duvidas-pesquisa',
     'd2000000-0000-4000-8000-000000000004'::uuid,
     'Como começo a analisar meus dados em Python sem me perder?',
     E'Vou começar uma IC em catálise e já me avisaram que vou analisar planilhas enormes com os resultados dos ensaios. A futura orientadora sugeriu Python, mas eu nunca programei.\n\nPor onde vocês começariam: pandas, Jupyter, um curso específico? E como saber qual teste estatístico usar para comparar os catalisadores? (demonstração)',
     array['python', 'estatística', 'análise de dados'], 50),
    ('a1000000-0000-4000-8000-000000000102'::uuid, 'carreira',
     'd2000000-0000-4000-8000-000000000003'::uuid,
     'Vale a pena fazer o mestrado logo depois da graduação?',
     E'Coorientando duas estudantes de IC que terminam a graduação este ano, e as duas estão em dúvida: entrar direto na pós-graduação ou trabalhar um tempo antes?\n\nEu fui direto para o mestrado e não me arrependo, mas sei que cada caminho é um. Quem seguiu a carreira acadêmica por outro caminho pode contar como foi? (demonstração)',
     array['mestrado', 'carreira'], 76)
) as v (id, category_slug, author_id, title, body, tags, hours_ago)
join public.forum_categories c on c.slug = v.category_slug
where exists (select 1 from public.profiles p where p.id = v.author_id)
on conflict (id) do nothing;

-- -----------------------------------------------------------------------------
-- Pedido de mentoria pendente: Yasmin → Marina
-- Sem ON CONFLICT: o trigger BEFORE INSERT recusaria um par já aberto antes disso, então
-- conferimos tudo no WHERE (id novo, par sem pedido aberto, mentora recebendo pedidos).
-- -----------------------------------------------------------------------------
insert into public.mentorship_requests (id, mentee_id, mentor_id, message, match_score, match_reason, created_at)
select v.id, v.mentee_id, v.mentor_id, v.message, v.match_score, v.match_reason, v.created_at
from (values
  ('c1a00000-0000-4000-8000-000000000001'::uuid,
   'd2000000-0000-4000-8000-000000000004'::uuid,
   'd1000000-0000-4000-8000-000000000001'::uuid,
   'Oi, Marina! Vou começar uma IC e vou precisar analisar os dados dos ensaios em Python, mas nunca programei. Você toparia me ajudar a dar os primeiros passos? (demonstração)',
   78::smallint,
   'Interesse em programação e análise de dados; a mentora ajuda nos primeiros passos de pesquisa com dados.',
   now() - interval '2 days')
) as v (id, mentee_id, mentor_id, message, match_score, match_reason, created_at)
where not exists (select 1 from public.mentorship_requests r where r.id = v.id)
  and not exists (
    select 1 from public.mentorship_requests r
    where r.mentee_id = v.mentee_id and r.mentor_id = v.mentor_id
      and r.status in ('pending', 'accepted')
  )
  and exists (
    select 1 from public.profiles p
    where p.id = v.mentor_id and p.is_mentor and p.mentor_available and p.onboarded_at is not null
  )
  and exists (select 1 from public.profiles p where p.id = v.mentee_id);
