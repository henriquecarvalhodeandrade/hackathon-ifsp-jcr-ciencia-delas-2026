-- ==============================================================================
-- ÁRTEMIS — SEED DE DADOS REALISTAS PARA DEMO DO HACKATHON
-- ==============================================================================

-- Obs: Em ambiente local ou de teste com Supabase CLI, IDs de auth.users podem ser vinculados.
-- Este script insere perfis de exemplo representativos com mulheres cientistas e estudantes em STEM.

-- 1. UUIDs fixos para referência cruzada na demonstração
do $$
declare
  u_dra_jaqueline uuid := 'a1111111-1111-1111-1111-111111111111';
  u_dra_marielle uuid  := 'b2222222-2222-2222-2222-222222222222';
  u_ana_estudante uuid := 'c3333333-3333-3333-3333-333333333333';
  u_julia_ads uuid     := 'd4444444-4444-4444-4444-444444444444';
  
  proj_ia uuid         := 'e5555555-5555-5555-5555-555555555555';
  proj_bio uuid        := 'f6666666-6666-6666-6666-666666666666';
begin

  -- Inserir Perfis se não existirem
  insert into public.profiles (id, email, username, full_name, account_type, bio, course_or_area, is_self_declared_woman, conduct_accepted_at, is_verified_scientist)
  values
    (u_dra_marielle, 'marielle.silva@exemplo.com', 'marielle_silva', 'Dra. Marielle Silva', 'scientist', 'Pesquisadora em IA Ética, Aprendizado de Máquina e mitigação de vieses algorítmicos. Coordenadora de laboratório.', 'Inteligência Artificial & Ciência da Computação', true, now(), true),
    (u_dra_jaqueline, 'jaqueline.costa@exemplo.com', 'jaqueline_costa', 'Dra. Jaqueline Costa', 'scientist', 'Pesquisadora em Bioinformática e Genômica Computacional. Mentora de jovens mulheres na ciência.', 'Biotecnologia & Bioinformática', true, now(), true),
    (u_ana_estudante, 'ana.beatriz@exemplo.com', 'ana_beatriz', 'Ana Beatriz Santos', 'student', 'Estudante de Ciência da Computação (4º período). Apaixonada por visão computacional e acessibilidade.', 'Ciência da Computação', true, now(), false),
    (u_julia_ads, 'julia.mendes@exemplo.com', 'julia_tech', 'Júlia Mendes', 'student', 'Desenvolvedora Full-Stack e graduanda em ADS. Criadora de projetos de extensão para meninas na programação.', 'Análise e Desenv. de Sistemas', true, now(), false)
  on conflict (id) do nothing;

  -- Inserir Projetos de Iniciação Científica
  insert into public.projects (id, creator_id, title, description, area, tags, slots, is_open)
  values
    (proj_ia, u_dra_marielle, 'Mitigação de Vieses de Gênero em Modelos de Linguagem (LLMs)', 'Projeto de Iniciação Científica com foco em auditoria algorítmica e curadoria de dados em português para modelos de linguagem. O plano envolve coleta, pré-processamento e fine-tuning com técnicas de desbias.', 'Inteligência Artificial', array['Python', 'NLP', 'Ética em IA', 'Deep Learning'], 2, true),
    (proj_bio, u_dra_jaqueline, 'Algoritmos Paralelos para Análise de Sequenciamento Genômico', 'Bolsa de IC com foco em pipelines computacionais de alto desempenho para identificação de variantes genéticas raras.', 'Bioinformática', array['Bioinformática', 'Python', 'Genômica', 'High Performance'], 3, true)
  on conflict (id) do nothing;

  -- Inserir Interesses / Participações em Projetos
  insert into public.project_interests (project_id, user_id, origin, message, status)
  values
    (proj_ia, u_ana_estudante, 'user_request', 'Olá professora! Tenho estudado NLP e adoraria contribuir com a avaliação dos benchmarks.', 'accepted'),
    (proj_bio, u_julia_ads, 'user_request', 'Tenho interesse na área de pipelines de dados em nuvem!', 'pending')
  on conflict (project_id, user_id) do nothing;

  -- Inserir Posts Iniciais no Feed
  insert into public.posts (author_id, content, created_at)
  values
    (u_dra_marielle, 'Abrimos hoje o processo seletivo para 2 novas bolsas de Iniciação Científica em nosso laboratório de IA Ética! Mulheres e meninas em STEM são fortemente encorajadas a se candidatar. confiram na aba Explorar!', now() - interval '2 hours'),
    (u_ana_estudante, 'Muito feliz em compartilhar que submetemos nosso primeiro artigo sobre redução de viés em datasets educacionais! Agradecimento especial à minha orientadora pela mentoria incrível.', now() - interval '1 hour'),
    (u_julia_ads, 'Participei hoje da oficina de computação quântica da semana de tecnologia. Incrível ver tantas alunas liderando as bancadas!', now() - interval '30 minutes');

  -- Inserir Conexões
  insert into public.connections (requester_id, addressee_id, status)
  values
    (u_ana_estudante, u_dra_marielle, 'accepted')
  on conflict do nothing;

  -- Inserir Follows
  insert into public.follows (follower_id, following_id)
  values
    (u_ana_estudante, u_dra_marielle),
    (u_julia_ads, u_dra_marielle),
    (u_ana_estudante, u_julia_ads)
  on conflict do nothing;

end $$;
