-- =============================================================================
-- Ciência Delas — seed (dados de referência + DEMONSTRAÇÃO)
-- =============================================================================
-- 1. Áreas de pesquisa (9 grandes áreas do CNPq + subáreas) e categorias do fórum.
-- 2. DADOS DE DEMONSTRAÇÃO, TODOS FICTÍCIOS: pessoas, tópicos, papers, votos,
--    mentorias e uma edição da newsletter. Nenhuma pessoa, paper ou DOI é real:
--      * e-mails em @demo.cienciadelas.dev, senha única `ciencia-delas-demo`;
--      * DOIs no prefixo de teste 10.5555/demo.* ;
--      * bios e resumos terminam com "(Perfil/Resumo fictício de demonstração.)".
--    NÃO rode este arquivo em produção (o `supabase db push` não aplica seed).
--
-- UUIDs fixos para o seed ser determinístico:
--   d0…  admin/moderação · d1… mentoras · d2… mentorandas · a1… tópicos ·
--   a2… respostas · b1… papers · b2… comentários · c1… pedidos de mentoria ·
--   e1… edição da newsletter
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Áreas de pesquisa
-- -----------------------------------------------------------------------------
insert into public.research_areas (slug, name, big_area) values
  -- Grandes áreas (name = big_area)
  ('ciencias-exatas-e-da-terra', 'Ciências Exatas e da Terra', 'Ciências Exatas e da Terra'),
  ('ciencias-biologicas', 'Ciências Biológicas', 'Ciências Biológicas'),
  ('engenharias', 'Engenharias', 'Engenharias'),
  ('ciencias-da-saude', 'Ciências da Saúde', 'Ciências da Saúde'),
  ('ciencias-agrarias', 'Ciências Agrárias', 'Ciências Agrárias'),
  ('ciencias-sociais-aplicadas', 'Ciências Sociais Aplicadas', 'Ciências Sociais Aplicadas'),
  ('ciencias-humanas', 'Ciências Humanas', 'Ciências Humanas'),
  ('linguistica-letras-e-artes', 'Linguística, Letras e Artes', 'Linguística, Letras e Artes'),
  ('multidisciplinar', 'Multidisciplinar', 'Multidisciplinar'),
  -- Ciências Exatas e da Terra
  ('matematica', 'Matemática', 'Ciências Exatas e da Terra'),
  ('matematica-aplicada', 'Matemática Aplicada', 'Ciências Exatas e da Terra'),
  ('probabilidade-e-estatistica', 'Probabilidade e Estatística', 'Ciências Exatas e da Terra'),
  ('ciencia-da-computacao', 'Ciência da Computação', 'Ciências Exatas e da Terra'),
  ('astronomia', 'Astronomia', 'Ciências Exatas e da Terra'),
  ('fisica', 'Física', 'Ciências Exatas e da Terra'),
  ('quimica', 'Química', 'Ciências Exatas e da Terra'),
  ('geociencias', 'Geociências', 'Ciências Exatas e da Terra'),
  ('oceanografia', 'Oceanografia', 'Ciências Exatas e da Terra'),
  -- Ciências Biológicas
  ('genetica', 'Genética', 'Ciências Biológicas'),
  ('bioquimica', 'Bioquímica', 'Ciências Biológicas'),
  ('microbiologia', 'Microbiologia', 'Ciências Biológicas'),
  ('ecologia', 'Ecologia', 'Ciências Biológicas'),
  ('botanica', 'Botânica', 'Ciências Biológicas'),
  ('zoologia', 'Zoologia', 'Ciências Biológicas'),
  ('imunologia', 'Imunologia', 'Ciências Biológicas'),
  -- Engenharias
  ('engenharia-civil', 'Engenharia Civil', 'Engenharias'),
  ('engenharia-de-materiais', 'Engenharia de Materiais e Metalúrgica', 'Engenharias'),
  ('engenharia-eletrica', 'Engenharia Elétrica', 'Engenharias'),
  ('engenharia-mecanica', 'Engenharia Mecânica', 'Engenharias'),
  ('engenharia-quimica', 'Engenharia Química', 'Engenharias'),
  ('engenharia-de-producao', 'Engenharia de Produção', 'Engenharias'),
  ('engenharia-biomedica', 'Engenharia Biomédica', 'Engenharias'),
  ('engenharia-aeroespacial', 'Engenharia Aeroespacial', 'Engenharias'),
  ('engenharia-ambiental', 'Engenharia Ambiental e Sanitária', 'Engenharias'),
  -- Ciências da Saúde
  ('medicina', 'Medicina', 'Ciências da Saúde'),
  ('enfermagem', 'Enfermagem', 'Ciências da Saúde'),
  ('saude-coletiva', 'Saúde Coletiva', 'Ciências da Saúde'),
  ('nutricao', 'Nutrição', 'Ciências da Saúde'),
  ('farmacia', 'Farmácia', 'Ciências da Saúde'),
  ('fisioterapia', 'Fisioterapia e Terapia Ocupacional', 'Ciências da Saúde'),
  -- Ciências Agrárias
  ('agronomia', 'Agronomia', 'Ciências Agrárias'),
  ('ciencia-e-tecnologia-de-alimentos', 'Ciência e Tecnologia de Alimentos', 'Ciências Agrárias'),
  ('medicina-veterinaria', 'Medicina Veterinária', 'Ciências Agrárias'),
  ('recursos-florestais', 'Recursos Florestais e Engenharia Florestal', 'Ciências Agrárias'),
  -- Ciências Sociais Aplicadas
  ('administracao', 'Administração', 'Ciências Sociais Aplicadas'),
  ('economia', 'Economia', 'Ciências Sociais Aplicadas'),
  ('direito', 'Direito', 'Ciências Sociais Aplicadas'),
  ('comunicacao', 'Comunicação', 'Ciências Sociais Aplicadas'),
  ('arquitetura-e-urbanismo', 'Arquitetura e Urbanismo', 'Ciências Sociais Aplicadas'),
  ('ciencia-da-informacao', 'Ciência da Informação', 'Ciências Sociais Aplicadas'),
  -- Ciências Humanas
  ('educacao', 'Educação', 'Ciências Humanas'),
  ('psicologia', 'Psicologia', 'Ciências Humanas'),
  ('sociologia', 'Sociologia', 'Ciências Humanas'),
  ('historia', 'História', 'Ciências Humanas'),
  ('filosofia', 'Filosofia', 'Ciências Humanas'),
  ('antropologia', 'Antropologia', 'Ciências Humanas'),
  ('geografia', 'Geografia', 'Ciências Humanas'),
  -- Linguística, Letras e Artes
  ('linguistica', 'Linguística', 'Linguística, Letras e Artes'),
  ('letras', 'Letras', 'Linguística, Letras e Artes'),
  ('artes', 'Artes', 'Linguística, Letras e Artes'),
  -- Multidisciplinar
  ('biotecnologia', 'Biotecnologia', 'Multidisciplinar'),
  ('ciencias-ambientais', 'Ciências Ambientais', 'Multidisciplinar'),
  ('ensino-de-ciencias', 'Ensino de Ciências e Matemática', 'Multidisciplinar'),
  ('materiais', 'Materiais e Nanotecnologia', 'Multidisciplinar')
on conflict (slug) do nothing;

-- -----------------------------------------------------------------------------
-- 1b. Categorias do fórum (CONTRACT §7)
-- -----------------------------------------------------------------------------
insert into public.forum_categories (slug, name, description, icon, allow_anonymous, sort_order) values
  ('apresente-se', 'Apresente-se',
   'Chegou agora? Conte quem você é, o que pesquisa e o que procura na rede.',
   'hand-heart', false, 1),
  ('carreira', 'Carreira acadêmica',
   'Pós-graduação, concursos, docência, transição de carreira e tudo o que vem no caminho.',
   'graduation-cap', false, 2),
  ('bolsas-editais', 'Bolsas, editais e oportunidades',
   'Chamadas abertas, dicas de projeto, prazos e experiências com agências de fomento.',
   'badge-dollar-sign', false, 3),
  ('duvidas-pesquisa', 'Dúvidas de pesquisa',
   'Metodologia, análise de dados, escrita e ferramentas: pergunte sem medo.',
   'flask-conical', false, 4),
  ('maternidade', 'Maternidade e cuidado',
   'Conciliar pesquisa, maternidade e cuidado com quem amamos. Aceita publicações anônimas.',
   'baby', true, 5),
  ('apoio', 'Rede de apoio — assédio e desafios',
   'Espaço seguro para relatar situações difíceis e buscar acolhimento. Aceita publicações anônimas.',
   'shield-heart', true, 6),
  ('saude-mental', 'Saúde mental',
   'Ansiedade, síndrome da impostora, esgotamento: cuidar de si também é ciência. Aceita publicações anônimas.',
   'heart-pulse', true, 7),
  ('eventos', 'Eventos e divulgação',
   'Congressos, feiras, lives, chamadas para palestras e divulgação científica.',
   'calendar-heart', false, 8)
on conflict (slug) do nothing;

-- =============================================================================
-- 2. DEMONSTRAÇÃO (fictício)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 2a. Contas (auth.users + auth.identities) — senha: ciencia-delas-demo
-- -----------------------------------------------------------------------------
with demo (id, email, full_name, days_ago) as (
  values
    ('d0000000-0000-4000-8000-000000000001'::uuid, 'admin@demo.cienciadelas.dev', 'Helena Duarte', 120),
    ('d0000000-0000-4000-8000-000000000002'::uuid, 'moderacao@demo.cienciadelas.dev', 'Priscila Teixeira', 118),
    ('d1000000-0000-4000-8000-000000000001'::uuid, 'marina@demo.cienciadelas.dev', 'Marina Albuquerque', 110),
    ('d1000000-0000-4000-8000-000000000002'::uuid, 'luiza@demo.cienciadelas.dev', 'Luiza Fernandes', 105),
    ('d1000000-0000-4000-8000-000000000003'::uuid, 'beatriz@demo.cienciadelas.dev', 'Beatriz Nogueira', 100),
    ('d1000000-0000-4000-8000-000000000004'::uuid, 'carolina@demo.cienciadelas.dev', 'Carolina Mendes', 96),
    ('d1000000-0000-4000-8000-000000000005'::uuid, 'fernanda@demo.cienciadelas.dev', 'Fernanda Okabe', 90),
    ('d1000000-0000-4000-8000-000000000006'::uuid, 'patricia@demo.cienciadelas.dev', 'Patrícia Santos', 88),
    ('d1000000-0000-4000-8000-000000000007'::uuid, 'renata@demo.cienciadelas.dev', 'Renata Carvalho', 80),
    ('d1000000-0000-4000-8000-000000000008'::uuid, 'juliana@demo.cienciadelas.dev', 'Juliana Ribeiro', 75),
    ('d1000000-0000-4000-8000-000000000009'::uuid, 'aline@demo.cienciadelas.dev', 'Aline Barbosa', 70),
    ('d1000000-0000-4000-8000-000000000010'::uuid, 'tatiane@demo.cienciadelas.dev', 'Tatiane Moreira', 64),
    ('d1000000-0000-4000-8000-000000000011'::uuid, 'camila@demo.cienciadelas.dev', 'Camila Yamamoto', 60),
    ('d1000000-0000-4000-8000-000000000012'::uuid, 'isabela@demo.cienciadelas.dev', 'Isabela Prado', 55),
    ('d2000000-0000-4000-8000-000000000001'::uuid, 'larissa@demo.cienciadelas.dev', 'Larissa Gomes', 40),
    ('d2000000-0000-4000-8000-000000000002'::uuid, 'gabriela@demo.cienciadelas.dev', 'Gabriela Lima', 35),
    ('d2000000-0000-4000-8000-000000000003'::uuid, 'manuela@demo.cienciadelas.dev', 'Manuela Costa', 21),
    ('d2000000-0000-4000-8000-000000000004'::uuid, 'yasmin@demo.cienciadelas.dev', 'Yasmin Oliveira', 12),
    ('d2000000-0000-4000-8000-000000000005'::uuid, 'debora@demo.cienciadelas.dev', 'Débora Alves', 75)
)
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  raw_app_meta_data, raw_user_meta_data, is_super_admin, created_at, updated_at
)
select
  '00000000-0000-0000-0000-000000000000'::uuid,
  d.id,
  'authenticated',
  'authenticated',
  d.email,
  extensions.crypt('ciencia-delas-demo', extensions.gen_salt('bf')),
  now() - make_interval(days => d.days_ago),
  '', '', '', '',
  '{"provider": "email", "providers": ["email"]}'::jsonb,
  jsonb_build_object('full_name', d.full_name, 'demo', true),
  false,
  now() - make_interval(days => d.days_ago),
  now() - make_interval(days => d.days_ago)
from demo d
on conflict (id) do nothing;

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select
  u.id,
  u.id,
  u.id::text,
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true, 'phone_verified', false),
  'email',
  u.created_at,
  u.created_at,
  u.created_at
from auth.users u
where u.email like '%@demo.cienciadelas.dev'
on conflict (provider_id, provider) do nothing;

-- O trigger on_auth_user_created já criou os perfis; alinhamos created_at ao cadastro.
update public.profiles p
set created_at = u.created_at
from auth.users u
where u.id = p.id and u.email like '%@demo.cienciadelas.dev';

-- -----------------------------------------------------------------------------
-- 2b. Perfis completos
-- -----------------------------------------------------------------------------
update public.profiles p
set
  pronouns = d.pronouns,
  headline = d.headline,
  bio = d.bio || ' (Perfil fictício de demonstração.)',
  institution = d.institution,
  city = d.city,
  state = d.state,
  career_stage = d.career_stage,
  keywords = d.keywords,
  mentorship_topics = d.topics,
  is_mentor = d.is_mentor,
  seeks_mentorship = d.seeks,
  mentor_capacity = d.capacity,
  mentor_available = d.available,
  meeting_formats = d.formats,
  languages = d.languages,
  mentoring_goals = d.goals,
  mentoring_offer = d.offer,
  ai_consent = true,
  onboarded_at = p.created_at + interval '10 minutes'
from (
  values
    -- Administração e moderação
    ('d0000000-0000-4000-8000-000000000001'::uuid, 'ela/dela',
     'Coordenadora da rede Ciência Delas',
     'Bióloga de formação, cuida da governança da comunidade e da newsletter semanal.',
     'IFSP — Câmpus Jacareí', 'Jacareí', 'SP', 'professor'::public.career_stage,
     array['gestão de comunidades', 'divulgação científica', 'equidade de gênero'],
     array['lideranca', 'divulgacao-cientifica'],
     false, false, 0::smallint, false, '{online}'::public.meeting_format[], array['pt', 'en'],
     null::text, null::text),
    ('d0000000-0000-4000-8000-000000000002'::uuid, 'ela/dela',
     'Moderadora voluntária · psicóloga',
     'Acompanha os espaços de apoio do fórum e ajuda a manter a comunidade acolhedora.',
     'Universidade Federal de São Paulo (UNIFESP)', 'São Paulo', 'SP', 'researcher'::public.career_stage,
     array['psicologia social', 'acolhimento', 'mediação de conflitos'],
     array['saude-mental'],
     false, false, 0::smallint, false, '{online}'::public.meeting_format[], array['pt'],
     null::text, null::text),
    -- Mentoras
    ('d1000000-0000-4000-8000-000000000001'::uuid, 'ela/dela',
     'Docente de computação · visão computacional e ensino de programação',
     'Coordena um grupo de iniciação científica em aprendizado de máquina aplicado ao agro do Vale do Paraíba.',
     'IFSP — Câmpus Jacareí', 'Jacareí', 'SP', 'professor'::public.career_stage,
     array['aprendizado de máquina', 'visão computacional', 'ensino de programação', 'python'],
     array['programacao-dados', 'carreira-academica', 'pos-graduacao', 'divulgacao-cientifica'],
     true, false, 3::smallint, true, '{online,in_person}'::public.meeting_format[], array['pt', 'en'],
     null::text,
     'Ajudo estudantes de graduação e técnico a dar os primeiros passos em pesquisa com dados: escolher um problema, montar o primeiro projeto de IC e se preparar para o mestrado.'),
    ('d1000000-0000-4000-8000-000000000002'::uuid, 'ela/dela',
     'Pesquisadora em sensoriamento remoto e clima',
     'Trabalha com séries temporais de satélite para monitorar queimadas e uso da terra.',
     'Instituto Nacional de Pesquisas Espaciais (INPE)', 'São José dos Campos', 'SP', 'researcher'::public.career_stage,
     array['sensoriamento remoto', 'séries temporais', 'queimadas', 'clima'],
     array['internacionalizacao', 'bolsas-editais', 'escrita-cientifica'],
     true, false, 2::smallint, true, '{online,hybrid}'::public.meeting_format[], array['pt', 'en', 'es'],
     null::text,
     'Posso orientar sobre doutorado sanduíche, bolsas no exterior e escrita de artigos em inglês.'),
    ('d1000000-0000-4000-8000-000000000003'::uuid, 'ela/dela',
     'Docente de engenharia de materiais · compósitos sustentáveis',
     'Desenvolve materiais compósitos com fibras vegetais em parceria com a indústria.',
     'Universidade Federal de São Paulo (UNIFESP)', 'São José dos Campos', 'SP', 'professor'::public.career_stage,
     array['compósitos', 'fibras naturais', 'materiais sustentáveis', 'caracterização mecânica'],
     array['industria-inovacao', 'lideranca', 'pos-graduacao'],
     true, false, 2::smallint, true, '{in_person,hybrid}'::public.meeting_format[], array['pt', 'en'],
     null::text,
     'Converso sobre parcerias universidade-empresa, liderança de laboratório e escolha de orientação no mestrado.'),
    ('d1000000-0000-4000-8000-000000000004'::uuid, 'ela/dela',
     'Pós-doutoranda em bioquímica · enzimas e biodegradação',
     'Mãe de dois, estuda enzimas de fungos capazes de degradar plásticos.',
     'Universidade de São Paulo (USP)', 'São Paulo', 'SP', 'postdoc'::public.career_stage,
     array['enzimologia', 'fungos', 'biodegradação', 'plásticos'],
     array['maternidade-ciencia', 'escrita-cientifica', 'metodologia'],
     true, false, 2::smallint, true, '{online}'::public.meeting_format[], array['pt', 'en'],
     null::text,
     'Divido o que aprendi conciliando maternidade e bancada, e ajudo a estruturar artigos experimentais.'),
    ('d1000000-0000-4000-8000-000000000005'::uuid, 'ela/dela',
     'Ecóloga · polinização e conservação na Amazônia',
     'Pesquisa a relação entre abelhas nativas e a produção de frutos amazônicos.',
     'Instituto Nacional de Pesquisas da Amazônia (INPA)', 'Manaus', 'AM', 'researcher'::public.career_stage,
     array['polinização', 'abelhas nativas', 'conservação', 'trabalho de campo'],
     array['divulgacao-cientifica', 'metodologia', 'networking'],
     true, false, 2::smallint, true, '{online}'::public.meeting_format[], array['pt', 'es'],
     null::text,
     'Ajudo a planejar trabalho de campo, desenho amostral e a comunicar ciência para comunidades locais.'),
    ('d1000000-0000-4000-8000-000000000006'::uuid, 'ela/dela',
     'Sanitarista · desigualdades em saúde',
     'Investiga como gênero e raça afetam o acesso a serviços de saúde no SUS.',
     'Fundação Oswaldo Cruz (Fiocruz)', 'Rio de Janeiro', 'RJ', 'professor'::public.career_stage,
     array['saúde coletiva', 'epidemiologia', 'equidade', 'sus'],
     array['saude-mental', 'bolsas-editais', 'lideranca'],
     true, false, 3::smallint, true, '{online}'::public.meeting_format[], array['pt'],
     null::text,
     'Apoio na escrita de projetos para editais e em como cuidar da saúde mental durante a pós.'),
    ('d1000000-0000-4000-8000-000000000007'::uuid, 'ela/dela',
     'Engenheira aeroespacial na indústria',
     'Lidera um time de projeto estrutural de satélites de pequeno porte.',
     'Indústria aeroespacial do Vale do Paraíba', 'São José dos Campos', 'SP', 'industry'::public.career_stage,
     array['estruturas aeroespaciais', 'otimização topológica', 'manufatura aditiva', 'satélites'],
     array['industria-inovacao', 'empreendedorismo', 'oratoria'],
     true, false, 1::smallint, true, '{online,in_person}'::public.meeting_format[], array['pt', 'en'],
     null::text,
     'Falo sobre transição da academia para a indústria, entrevistas técnicas e apresentações para clientes.'),
    ('d1000000-0000-4000-8000-000000000008'::uuid, 'ela/dela',
     'Matemática aplicada · modelagem epidemiológica',
     'Constrói modelos matemáticos de doenças infecciosas com dados de mobilidade.',
     'Universidade Estadual de Campinas (UNICAMP)', 'Campinas', 'SP', 'professor'::public.career_stage,
     array['modelagem matemática', 'epidemiologia', 'equações diferenciais', 'python'],
     array['carreira-academica', 'pos-graduacao', 'programacao-dados'],
     true, false, 2::smallint, true, '{online}'::public.meeting_format[], array['pt', 'en'],
     null::text,
     'Oriento sobre processos seletivos de pós em exatas e primeiros passos em programação científica.'),
    ('d1000000-0000-4000-8000-000000000009'::uuid, 'ela/dela',
     'Física experimental · matéria condensada',
     'Mede propriedades eletrônicas de materiais bidimensionais em baixas temperaturas.',
     'Centro Brasileiro de Pesquisas Físicas (CBPF)', 'Rio de Janeiro', 'RJ', 'researcher'::public.career_stage,
     array['grafeno', 'física experimental', 'materiais 2d', 'criogenia'],
     array['internacionalizacao', 'oratoria', 'carreira-academica'],
     true, false, 2::smallint, false, '{online}'::public.meeting_format[], array['pt', 'en', 'fr'],
     null::text,
     'No momento sem vagas novas, mas adoro conversar sobre carreira em física e pós no exterior.'),
    ('d1000000-0000-4000-8000-000000000010'::uuid, 'ela/dela',
     'Educadora · ensino de ciências e meninas na STEM',
     'Coordena oficinas de robótica para meninas de escolas públicas.',
     'Universidade Federal de São Carlos (UFSCar)', 'São Carlos', 'SP', 'professor'::public.career_stage,
     array['ensino de ciências', 'robótica educacional', 'gênero e ciência'],
     array['divulgacao-cientifica', 'maternidade-ciencia', 'saude-mental'],
     true, false, 2::smallint, true, '{online,hybrid}'::public.meeting_format[], array['pt', 'libras'],
     null::text,
     'Ajudo quem quer levar ciência para a escola e para as redes, e acolho dúvidas sobre conciliar carreira e família.'),
    ('d1000000-0000-4000-8000-000000000011'::uuid, 'ela/dela',
     'Química · catálise para energia limpa',
     'Desenvolve catalisadores baratos para produção de hidrogênio verde.',
     'Universidade Federal de Minas Gerais (UFMG)', 'Belo Horizonte', 'MG', 'postdoc'::public.career_stage,
     array['catálise', 'hidrogênio verde', 'eletroquímica', 'química de materiais'],
     array['escrita-cientifica', 'internacionalizacao', 'metodologia'],
     true, false, 2::smallint, true, '{online}'::public.meeting_format[], array['pt', 'en'],
     null::text,
     'Ajudo na escrita do primeiro artigo e na preparação para doutorado pleno no exterior.'),
    ('d1000000-0000-4000-8000-000000000012'::uuid, 'ela/dela',
     'Pesquisadora em ciência de alimentos · inovação',
     'Transforma resíduos agroindustriais em ingredientes funcionais.',
     'Empresa Brasileira de Pesquisa Agropecuária (Embrapa)', 'Campinas', 'SP', 'researcher'::public.career_stage,
     array['alimentos funcionais', 'resíduos agroindustriais', 'inovação', 'startups'],
     array['empreendedorismo', 'industria-inovacao', 'networking'],
     true, false, 2::smallint, true, '{online,in_person}'::public.meeting_format[], array['pt', 'en'],
     null::text,
     'Converso sobre empreendedorismo científico, patentes e como apresentar uma ideia para investidores.'),
    -- Mentorandas
    ('d2000000-0000-4000-8000-000000000001'::uuid, 'ela/dela',
     'Graduanda em ADS · iniciação científica em IA',
     'Estuda Análise e Desenvolvimento de Sistemas e faz IC com visão computacional.',
     'IFSP — Câmpus Jacareí', 'Jacareí', 'SP', 'undergraduate'::public.career_stage,
     array['visão computacional', 'python', 'aprendizado de máquina'],
     array['pos-graduacao', 'programacao-dados', 'escrita-cientifica'],
     false, true, 2::smallint, true, '{online,in_person}'::public.meeting_format[], array['pt', 'en'],
     'Quero me preparar para o mestrado em computação e publicar meu primeiro artigo da IC.',
     null::text),
    ('d2000000-0000-4000-8000-000000000002'::uuid, 'ela/dela',
     'Mestranda em engenharia de materiais',
     'Pesquisa compósitos com fibras naturais para construção civil.',
     'Universidade Federal de São Paulo (UNIFESP)', 'São José dos Campos', 'SP', 'masters'::public.career_stage,
     array['compósitos', 'fibras naturais', 'sustentabilidade'],
     array['industria-inovacao', 'carreira-academica', 'saude-mental'],
     false, true, 2::smallint, true, '{online}'::public.meeting_format[], array['pt'],
     'Estou em dúvida entre seguir para o doutorado ou ir para a indústria e queria conversar com quem já fez essa escolha.',
     null::text),
    ('d2000000-0000-4000-8000-000000000003'::uuid, 'ela/dela',
     'Doutoranda em ecologia',
     'Estuda interações planta-polinizador em fragmentos de Mata Atlântica.',
     'Universidade Estadual Paulista (UNESP)', 'Rio Claro', 'SP', 'phd'::public.career_stage,
     array['polinização', 'mata atlântica', 'estatística', 'r'],
     array['metodologia', 'divulgacao-cientifica', 'saude-mental'],
     false, true, 2::smallint, true, '{online}'::public.meeting_format[], array['pt', 'en'],
     'Busco ajuda com desenho amostral e com a ansiedade antes da qualificação.',
     null::text),
    ('d2000000-0000-4000-8000-000000000004'::uuid, 'ela/dela',
     'Graduanda em química',
     'Primeira da família na universidade, quer entrar em um projeto de iniciação científica.',
     'Universidade Federal de São Carlos (UFSCar)', 'São Carlos', 'SP', 'undergraduate'::public.career_stage,
     array['química verde', 'catálise', 'iniciação científica'],
     array['bolsas-editais', 'escrita-cientifica', 'internacionalizacao'],
     false, true, 2::smallint, true, '{online}'::public.meeting_format[], array['pt'],
     'Quero conseguir uma bolsa de IC e aprender a ler e escrever artigos científicos.',
     null::text),
    ('d2000000-0000-4000-8000-000000000005'::uuid, 'ela/dela',
     'Doutoranda em saúde coletiva · mãe recente',
     'Pesquisa saúde materna e acaba de voltar da licença-maternidade.',
     'Universidade de São Paulo (USP)', 'São Paulo', 'SP', 'phd'::public.career_stage,
     array['saúde materna', 'epidemiologia', 'políticas públicas'],
     array['maternidade-ciencia', 'saude-mental', 'bolsas-editais'],
     false, true, 2::smallint, true, '{online}'::public.meeting_format[], array['pt'],
     'Preciso reorganizar o cronograma do doutorado depois da licença e pedir prorrogação de bolsa.',
     null::text)
) as d (
  id, pronouns, headline, bio, institution, city, state, career_stage, keywords, topics,
  is_mentor, seeks, capacity, available, formats, languages, goals, offer
)
where p.id = d.id;

update public.profiles set role = 'admin' where id = 'd0000000-0000-4000-8000-000000000001';
update public.profiles set role = 'moderator' where id = 'd0000000-0000-4000-8000-000000000002';

-- Áreas de cada perfil
insert into public.profile_research_areas (profile_id, area_id)
select v.profile_id, ra.id
from (
  values
    ('d0000000-0000-4000-8000-000000000001'::uuid, 'ciencias-biologicas'),
    ('d0000000-0000-4000-8000-000000000001'::uuid, 'ensino-de-ciencias'),
    ('d0000000-0000-4000-8000-000000000002'::uuid, 'psicologia'),
    ('d1000000-0000-4000-8000-000000000001'::uuid, 'ciencia-da-computacao'),
    ('d1000000-0000-4000-8000-000000000001'::uuid, 'ensino-de-ciencias'),
    ('d1000000-0000-4000-8000-000000000002'::uuid, 'geociencias'),
    ('d1000000-0000-4000-8000-000000000002'::uuid, 'ciencias-ambientais'),
    ('d1000000-0000-4000-8000-000000000003'::uuid, 'engenharia-de-materiais'),
    ('d1000000-0000-4000-8000-000000000003'::uuid, 'materiais'),
    ('d1000000-0000-4000-8000-000000000004'::uuid, 'bioquimica'),
    ('d1000000-0000-4000-8000-000000000004'::uuid, 'biotecnologia'),
    ('d1000000-0000-4000-8000-000000000005'::uuid, 'ecologia'),
    ('d1000000-0000-4000-8000-000000000005'::uuid, 'ciencias-ambientais'),
    ('d1000000-0000-4000-8000-000000000006'::uuid, 'saude-coletiva'),
    ('d1000000-0000-4000-8000-000000000007'::uuid, 'engenharia-aeroespacial'),
    ('d1000000-0000-4000-8000-000000000007'::uuid, 'engenharia-mecanica'),
    ('d1000000-0000-4000-8000-000000000008'::uuid, 'matematica-aplicada'),
    ('d1000000-0000-4000-8000-000000000008'::uuid, 'saude-coletiva'),
    ('d1000000-0000-4000-8000-000000000009'::uuid, 'fisica'),
    ('d1000000-0000-4000-8000-000000000009'::uuid, 'materiais'),
    ('d1000000-0000-4000-8000-000000000010'::uuid, 'educacao'),
    ('d1000000-0000-4000-8000-000000000010'::uuid, 'ensino-de-ciencias'),
    ('d1000000-0000-4000-8000-000000000011'::uuid, 'quimica'),
    ('d1000000-0000-4000-8000-000000000011'::uuid, 'engenharia-quimica'),
    ('d1000000-0000-4000-8000-000000000012'::uuid, 'ciencia-e-tecnologia-de-alimentos'),
    ('d1000000-0000-4000-8000-000000000012'::uuid, 'biotecnologia'),
    ('d2000000-0000-4000-8000-000000000001'::uuid, 'ciencia-da-computacao'),
    ('d2000000-0000-4000-8000-000000000002'::uuid, 'engenharia-de-materiais'),
    ('d2000000-0000-4000-8000-000000000002'::uuid, 'engenharia-civil'),
    ('d2000000-0000-4000-8000-000000000003'::uuid, 'ecologia'),
    ('d2000000-0000-4000-8000-000000000003'::uuid, 'botanica'),
    ('d2000000-0000-4000-8000-000000000004'::uuid, 'quimica'),
    ('d2000000-0000-4000-8000-000000000005'::uuid, 'saude-coletiva')
) as v (profile_id, slug)
join public.research_areas ra on ra.slug = v.slug
on conflict do nothing;

-- -----------------------------------------------------------------------------
-- 2c. Fórum: tópicos, respostas (uma conversa anônima em "apoio") e reações
-- -----------------------------------------------------------------------------
insert into public.forum_threads (id, category_id, author_id, is_anonymous, title, body, tags, is_pinned, created_at, last_activity_at)
select v.id, c.id, v.author_id, v.is_anonymous, v.title, v.body, v.tags, v.is_pinned,
       now() - make_interval(hours => v.hours_ago), now() - make_interval(hours => v.hours_ago)
from (
  values
    ('a1000000-0000-4000-8000-000000000001'::uuid, 'apresente-se', 'd2000000-0000-4000-8000-000000000001'::uuid, false,
     'Oi! Sou a Larissa, do IFSP Jacareí',
     E'Olá, pessoal! Sou estudante de ADS no IFSP Jacareí e faço iniciação científica com visão computacional.\n\nEntrei na rede para encontrar outras mulheres na computação e aprender sobre o caminho até o mestrado. Alguém mais por aqui do Vale do Paraíba?',
     array['demo', 'computação', 'vale do paraíba'], false, 900),
    ('a1000000-0000-4000-8000-000000000002'::uuid, 'carreira', 'd2000000-0000-4000-8000-000000000002'::uuid, false,
     'Doutorado ou indústria depois do mestrado?',
     E'Estou terminando o mestrado em materiais e recebi uma proposta de estágio numa empresa. Ao mesmo tempo, minha orientadora quer que eu continue no doutorado.\n\nComo vocês tomaram essa decisão? O que pesou mais?',
     array['demo', 'carreira', 'indústria'], false, 700),
    ('a1000000-0000-4000-8000-000000000003'::uuid, 'bolsas-editais', 'd2000000-0000-4000-8000-000000000004'::uuid, false,
     'Dicas para o plano de trabalho da IC',
     E'Vou concorrer à minha primeira bolsa de iniciação científica. O que não pode faltar no plano de trabalho? Cronograma mensal ou por etapas?',
     array['demo', 'iniciação científica', 'bolsas'], false, 260),
    ('a1000000-0000-4000-8000-000000000004'::uuid, 'duvidas-pesquisa', 'd2000000-0000-4000-8000-000000000003'::uuid, false,
     'Como organizar uma revisão sistemática sem se perder?',
     E'Comecei uma revisão sistemática e já tenho mais de 800 artigos na triagem. Vocês usam alguma ferramenta gratuita? Como registram os critérios de inclusão?',
     array['demo', 'metodologia', 'revisão sistemática'], false, 200),
    ('a1000000-0000-4000-8000-000000000005'::uuid, 'maternidade', 'd2000000-0000-4000-8000-000000000005'::uuid, false,
     'Voltando da licença-maternidade no meio do doutorado',
     E'Acabei de voltar da licença e sinto que perdi o ritmo. Alguém já pediu prorrogação de bolsa por maternidade? Como foi o processo?',
     array['demo', 'maternidade', 'bolsas'], false, 90),
    ('a1000000-0000-4000-8000-000000000006'::uuid, 'apoio', 'd2000000-0000-4000-8000-000000000002'::uuid, true,
     'Comentários constrangedores no laboratório — como agir?',
     E'Um colega do laboratório faz comentários sobre a minha aparência na frente dos outros e todo mundo ri. Já pedi para parar, mas continua.\n\nTenho medo de falar com a coordenação e isso atrapalhar minha pesquisa. O que vocês fariam?',
     array['demo', 'assédio', 'acolhimento'], false, 120),
    ('a1000000-0000-4000-8000-000000000007'::uuid, 'saude-mental', 'd2000000-0000-4000-8000-000000000003'::uuid, false,
     'Síndrome da impostora antes da qualificação',
     E'Minha qualificação é daqui a três semanas e sinto que não sei nada. Como vocês lidaram com isso?',
     array['demo', 'síndrome da impostora', 'qualificação'], false, 48),
    ('a1000000-0000-4000-8000-000000000008'::uuid, 'eventos', 'd1000000-0000-4000-8000-000000000001'::uuid, false,
     'Semana de Ciência e Tecnologia no IFSP Jacareí',
     E'Vamos ter uma mesa só com pesquisadoras do Vale do Paraíba na semana de C&T do câmpus. Quem quiser apresentar pôster, comente aqui que eu passo as informações!',
     array['demo', 'eventos', 'vale do paraíba'], true, 30)
) as v (id, category_slug, author_id, is_anonymous, title, body, tags, is_pinned, hours_ago)
join public.forum_categories c on c.slug = v.category_slug
on conflict (id) do nothing;

insert into public.forum_posts (id, thread_id, author_id, is_anonymous, body, created_at)
select v.id, v.thread_id, v.author_id, v.is_anonymous, v.body, now() - make_interval(hours => v.hours_ago)
from (
  values
    ('a2000000-0000-4000-8000-000000000001'::uuid, 'a1000000-0000-4000-8000-000000000001'::uuid,
     'd1000000-0000-4000-8000-000000000001'::uuid, false,
     'Bem-vinda, Larissa! Também sou do IFSP Jacareí. Passa no laboratório na quinta que te apresento o grupo.', 880),
    ('a2000000-0000-4000-8000-000000000002'::uuid, 'a1000000-0000-4000-8000-000000000001'::uuid,
     'd0000000-0000-4000-8000-000000000001'::uuid, false,
     'Que bom ter você aqui! Dá uma olhada na aba de mentoria: tem várias mentoras de computação na rede.', 860),
    ('a2000000-0000-4000-8000-000000000003'::uuid, 'a1000000-0000-4000-8000-000000000002'::uuid,
     'd1000000-0000-4000-8000-000000000003'::uuid, false,
     E'Eu fiz o caminho inverso: fui para a indústria e voltei para o doutorado depois de três anos.\n\nA experiência prática mudou totalmente minhas perguntas de pesquisa. Não existe escolha errada.', 650),
    ('a2000000-0000-4000-8000-000000000004'::uuid, 'a1000000-0000-4000-8000-000000000002'::uuid,
     'd1000000-0000-4000-8000-000000000007'::uuid, false,
     E'Uma dica prática: converse com pessoas que estão nos dois lugares e pergunte como é a rotina delas. Faça uma lista do que te dá energia no dia a dia.\n\nSe quiser, marcamos uma conversa pela mentoria.', 600),
    ('a2000000-0000-4000-8000-000000000005'::uuid, 'a1000000-0000-4000-8000-000000000003'::uuid,
     'd1000000-0000-4000-8000-000000000002'::uuid, false,
     'Cronograma por etapas, com entregas claras por trimestre. E mostre que você leu o edital: use as mesmas palavras dos critérios de avaliação.', 240),
    ('a2000000-0000-4000-8000-000000000006'::uuid, 'a1000000-0000-4000-8000-000000000003'::uuid,
     'd1000000-0000-4000-8000-000000000011'::uuid, false,
     'Concordo com a Luiza! E peça para alguém de fora da área ler: se ela entender o objetivo, a banca também vai.', 230),
    ('a2000000-0000-4000-8000-000000000007'::uuid, 'a1000000-0000-4000-8000-000000000004'::uuid,
     'd1000000-0000-4000-8000-000000000004'::uuid, false,
     'Uso o Rayyan (gratuito) para a triagem e registro o protocolo no PROSPERO antes de começar. Isso salva a sua vida na hora de escrever o método.', 190),
    ('a2000000-0000-4000-8000-000000000008'::uuid, 'a1000000-0000-4000-8000-000000000004'::uuid,
     'd1000000-0000-4000-8000-000000000005'::uuid, false,
     'Outra dica: faça a triagem em dupla em pelo menos 10% dos artigos e calcule a concordância. Revisoras adoram ver isso.', 180),
    ('a2000000-0000-4000-8000-000000000009'::uuid, 'a1000000-0000-4000-8000-000000000005'::uuid,
     'd1000000-0000-4000-8000-000000000004'::uuid, false,
     'Pedi sim! A maioria das agências prevê prorrogação por maternidade. Junte a certidão de nascimento e uma carta da orientadora. Força, você não está sozinha.', 80),
    ('a2000000-0000-4000-8000-000000000010'::uuid, 'a1000000-0000-4000-8000-000000000005'::uuid,
     'd1000000-0000-4000-8000-000000000010'::uuid, false,
     'Recomeçar devagar também é produtividade. Que tal metas semanais pequenas no primeiro mês?', 70),
    ('a2000000-0000-4000-8000-000000000011'::uuid, 'a1000000-0000-4000-8000-000000000006'::uuid,
     'd0000000-0000-4000-8000-000000000002'::uuid, false,
     E'Sinto muito que você esteja passando por isso. O que você descreveu não é brincadeira: é assédio, e não é culpa sua.\n\nAnote datas, horários e quem estava presente. A ouvidoria da instituição pode receber o relato de forma sigilosa. Se quiser, posso te ajudar a montar o relato por mensagem privada.', 110),
    ('a2000000-0000-4000-8000-000000000012'::uuid, 'a1000000-0000-4000-8000-000000000006'::uuid,
     'd2000000-0000-4000-8000-000000000004'::uuid, true,
     'Passei por algo parecido no meu curso. Ter uma colega como testemunha fez toda a diferença quando fui à ouvidoria. Estamos com você.', 100),
    ('a2000000-0000-4000-8000-000000000013'::uuid, 'a1000000-0000-4000-8000-000000000006'::uuid,
     'd1000000-0000-4000-8000-000000000006'::uuid, false,
     'Converse também com a sua orientadora, se você se sentir segura. A responsabilidade de manter um ambiente saudável é da instituição.', 95),
    ('a2000000-0000-4000-8000-000000000014'::uuid, 'a1000000-0000-4000-8000-000000000007'::uuid,
     'd1000000-0000-4000-8000-000000000006'::uuid, false,
     'Quase todo mundo sente isso antes da qualificação. Ensaie a apresentação com colegas e lembre que a banca está lá para ajudar o trabalho a melhorar.', 40),
    ('a2000000-0000-4000-8000-000000000015'::uuid, 'a1000000-0000-4000-8000-000000000008'::uuid,
     'd2000000-0000-4000-8000-000000000001'::uuid, false,
     'Eu quero apresentar o pôster da minha IC! Como faço a inscrição?', 20)
) as v (id, thread_id, author_id, is_anonymous, body, hours_ago)
on conflict (id) do nothing;

-- Solução marcada no tópico de carreira
update public.forum_threads
set solution_post_id = 'a2000000-0000-4000-8000-000000000004'
where id = 'a1000000-0000-4000-8000-000000000002' and solution_post_id is null;

insert into public.forum_reactions (user_id, thread_id, post_id, kind)
values
  ('d1000000-0000-4000-8000-000000000003', 'a1000000-0000-4000-8000-000000000001', null, 'celebrate'),
  ('d1000000-0000-4000-8000-000000000008', 'a1000000-0000-4000-8000-000000000001', null, 'celebrate'),
  ('d2000000-0000-4000-8000-000000000003', 'a1000000-0000-4000-8000-000000000006', null, 'support'),
  ('d1000000-0000-4000-8000-000000000004', 'a1000000-0000-4000-8000-000000000006', null, 'support'),
  ('d1000000-0000-4000-8000-000000000010', 'a1000000-0000-4000-8000-000000000006', null, 'support'),
  ('d2000000-0000-4000-8000-000000000002', null, 'a2000000-0000-4000-8000-000000000004', 'useful'),
  ('d2000000-0000-4000-8000-000000000004', null, 'a2000000-0000-4000-8000-000000000005', 'useful'),
  ('d2000000-0000-4000-8000-000000000003', null, 'a2000000-0000-4000-8000-000000000007', 'useful'),
  ('d2000000-0000-4000-8000-000000000005', null, 'a2000000-0000-4000-8000-000000000009', 'support')
on conflict on constraint forum_reactions_unique do nothing;

-- -----------------------------------------------------------------------------
-- 2d. Vitrine: papers fictícios (DOIs 10.5555/demo.*)
-- -----------------------------------------------------------------------------
insert into public.papers (
  id, submitted_by, title, abstract, authors, doi, url, venue, year, area_id, keywords,
  submitter_relation, women_authorship_confirmed, plain_summary, plain_summary_source, created_at
)
select
  v.id, v.submitted_by, v.title, v.abstract || ' (Resumo fictício de demonstração.)', v.authors, v.doi,
  null, v.venue, v.year, ra.id, v.keywords, v.relation, true, v.plain_summary, v.summary_source,
  now() - make_interval(days => v.days_ago)
from (
  values
    ('b1000000-0000-4000-8000-000000000001'::uuid, 'd2000000-0000-4000-8000-000000000001'::uuid,
     'Redes neurais leves para detectar doenças em folhas de café com celulares de baixo custo',
     'Propomos uma rede neural convolucional compacta, treinada com imagens coletadas por produtoras do Vale do Paraíba, capaz de identificar ferrugem e cercosporiose em folhas de café diretamente no celular, sem conexão com a internet.',
     array['Larissa Gomes', 'Marina Albuquerque'], '10.5555/demo.2026.001',
     'Anais do Simpósio de Computação Aplicada (demo)', 2026::smallint, 'ciencia-da-computacao',
     array['visão computacional', 'agricultura', 'redes neurais'], 'coauthor',
     'Criamos um aplicativo que reconhece doenças do café por foto, mesmo sem internet, para ajudar pequenas produtoras a agir mais cedo.',
     'author', 100),
    ('b1000000-0000-4000-8000-000000000002'::uuid, 'd1000000-0000-4000-8000-000000000002'::uuid,
     'Monitoramento de queimadas no Vale do Paraíba com séries temporais de satélite',
     'Combinamos índices espectrais e modelos de séries temporais para detectar áreas queimadas em pastagens e fragmentos florestais, com validação em campo em 14 municípios.',
     array['Luiza Fernandes', 'Ana Paula Rocha', 'Marcos Vieira'], '10.5555/demo.2026.002',
     'Revista Brasileira de Sensoriamento Remoto (demo)', 2026::smallint, 'geociencias',
     array['sensoriamento remoto', 'queimadas', 'séries temporais'], 'author',
     'Usamos imagens de satélite para descobrir onde e quando o fogo atingiu a região, ajudando defesa civil e produtores a prevenir novos incêndios.',
     'ai', 6),
    ('b1000000-0000-4000-8000-000000000003'::uuid, 'd2000000-0000-4000-8000-000000000002'::uuid,
     'Compósitos de fibra de bananeira para painéis de isolamento acústico',
     'Avaliamos painéis de resina vegetal reforçados com fibra de pseudocaule de bananeira. Os painéis atingiram coeficientes de absorção sonora comparáveis aos de lã de rocha, com menor custo e pegada de carbono.',
     array['Gabriela Lima', 'Beatriz Nogueira'], '10.5555/demo.2026.003',
     'Congresso Brasileiro de Materiais Sustentáveis (demo)', 2026::smallint, 'engenharia-de-materiais',
     array['compósitos', 'fibras naturais', 'acústica'], 'coauthor',
     null, null, 25),
    ('b1000000-0000-4000-8000-000000000004'::uuid, 'd1000000-0000-4000-8000-000000000004'::uuid,
     'Enzimas de fungos do Cerrado na degradação de plástico PET',
     'Isolamos três linhagens de fungos do Cerrado com atividade de cutinases sobre PET pós-consumo e caracterizamos as condições ótimas de temperatura e pH para a degradação.',
     array['Carolina Mendes', 'Joana Prates', 'Rita Okada'], '10.5555/demo.2025.004',
     'Jornal de Bioquímica Aplicada (demo)', 2025::smallint, 'bioquimica',
     array['enzimas', 'fungos', 'biodegradação', 'pet'], 'author',
     'Encontramos fungos brasileiros capazes de "comer" garrafas plásticas mais rápido, o que pode ajudar na reciclagem.',
     'author', 40),
    ('b1000000-0000-4000-8000-000000000005'::uuid, 'd1000000-0000-4000-8000-000000000005'::uuid,
     'Abelhas nativas e a produtividade do açaí em várzeas amazônicas',
     'Em 36 açaizais de várzea, a riqueza de abelhas sem ferrão explicou 41% da variação na produção de frutos, mais do que a adubação ou a densidade de plantio.',
     array['Fernanda Okabe', 'Raimunda Souza'], '10.5555/demo.2025.005',
     'Ecologia Brasiliensis (demo)', 2025::smallint, 'ecologia',
     array['polinização', 'açaí', 'abelhas sem ferrão'], 'author',
     null, null, 60),
    ('b1000000-0000-4000-8000-000000000006'::uuid, 'd1000000-0000-4000-8000-000000000006'::uuid,
     'Desigualdades de gênero e raça no acesso ao pré-natal em municípios paulistas',
     'Estudo transversal com dados de 2015 a 2024 mostrando que mulheres negras de municípios pequenos iniciam o pré-natal, em média, três semanas mais tarde que mulheres brancas.',
     array['Patrícia Santos', 'Débora Alves', 'Lúcia Ferraz'], '10.5555/demo.2026.006',
     'Cadernos de Saúde Coletiva (demo)', 2026::smallint, 'saude-coletiva',
     array['pré-natal', 'equidade', 'sus'], 'author',
     'Mostramos que mulheres negras de cidades pequenas começam o pré-natal mais tarde e sugerimos ações para o SUS corrigir essa diferença.',
     'ai', 15),
    ('b1000000-0000-4000-8000-000000000007'::uuid, 'd1000000-0000-4000-8000-000000000007'::uuid,
     'Otimização topológica de suportes estruturais para nanossatélites',
     'Aplicamos otimização topológica e manufatura aditiva em titânio para reduzir em 38% a massa de suportes de painéis solares de nanossatélites, mantendo as margens de segurança em vibração.',
     array['Renata Carvalho', 'Paula Mendonça'], '10.5555/demo.2025.007',
     'Revista de Engenharia Aeroespacial (demo)', 2025::smallint, 'engenharia-aeroespacial',
     array['otimização topológica', 'manufatura aditiva', 'satélites'], 'author',
     null, null, 200),
    ('b1000000-0000-4000-8000-000000000008'::uuid, 'd1000000-0000-4000-8000-000000000008'::uuid,
     'Modelos epidemiológicos com mobilidade urbana no Vale do Paraíba',
     'Acoplamos um modelo SEIR metapopulacional a dados agregados de mobilidade para estimar o efeito de corredores de transporte na propagação de arboviroses entre cidades da região.',
     array['Juliana Ribeiro', 'Clara Batista'], '10.5555/demo.2026.008',
     'Matemática Aplicada e Computacional (demo)', 2026::smallint, 'matematica-aplicada',
     array['modelagem', 'epidemiologia', 'mobilidade'], 'author',
     null, null, 10),
    ('b1000000-0000-4000-8000-000000000009'::uuid, 'd1000000-0000-4000-8000-000000000009'::uuid,
     'Medidas de alta precisão do efeito Hall quântico em grafeno bicamada torcida',
     'Relatamos platôs de Hall quantizados com precisão de partes por bilhão em amostras de grafeno bicamada torcida, abrindo caminho para padrões de resistência em temperaturas mais altas.',
     array['Aline Barbosa', 'Sofia Lemos', 'Teresa Gomes'], '10.5555/demo.2025.009',
     'Física Brasileira Letters (demo)', 2025::smallint, 'fisica',
     array['grafeno', 'efeito hall quântico', 'metrologia'], 'author',
     'Medimos com enorme precisão como a eletricidade flui em camadas de grafeno, o que pode criar padrões de medida mais baratos.',
     'author', 300),
    ('b1000000-0000-4000-8000-000000000010'::uuid, 'd1000000-0000-4000-8000-000000000010'::uuid,
     'Meninas na robótica: efeitos de oficinas no interesse por carreiras de exatas',
     'Acompanhamos 240 estudantes de escolas públicas por dois anos. Participar de oficinas de robótica com mentoras mulheres dobrou a intenção declarada de cursar engenharia ou computação.',
     array['Tatiane Moreira', 'Helena Duarte'], '10.5555/demo.2026.010',
     'Revista de Ensino de Ciências (demo)', 2026::smallint, 'educacao',
     array['robótica educacional', 'gênero', 'stem'], 'author',
     null, null, 3),
    ('b1000000-0000-4000-8000-000000000011'::uuid, 'd1000000-0000-4000-8000-000000000011'::uuid,
     'Catalisadores de ferro para produção de hidrogênio verde em meio aquoso',
     'Sintetizamos catalisadores à base de ferro e nitrogênio que atingem 85% da eficiência da platina na reação de evolução de hidrogênio, a uma fração do custo.',
     array['Camila Yamamoto', 'Beatriz Alencar'], '10.5555/demo.2026.011',
     'Química Nova Demo', 2026::smallint, 'quimica',
     array['catálise', 'hidrogênio verde', 'eletroquímica'], 'author',
     null, null, 50),
    ('b1000000-0000-4000-8000-000000000012'::uuid, 'd1000000-0000-4000-8000-000000000012'::uuid,
     'Farinha de casca de jabuticaba como ingrediente funcional em pães',
     'A substituição de 10% da farinha de trigo por farinha de casca de jabuticaba aumentou o teor de fibras e compostos fenólicos dos pães sem prejudicar a aceitação sensorial.',
     array['Isabela Prado', 'Marta Lins'], '10.5555/demo.2026.012',
     'Ciência de Alimentos em Foco (demo)', 2026::smallint, 'ciencia-e-tecnologia-de-alimentos',
     array['alimentos funcionais', 'jabuticaba', 'resíduos'], 'author',
     'Aproveitamos a casca da jabuticaba, que normalmente vai para o lixo, para deixar o pão mais nutritivo.',
     'author', 30)
) as v (
  id, submitted_by, title, abstract, authors, doi, venue, year, area_slug, keywords, relation,
  plain_summary, summary_source, days_ago
)
left join public.research_areas ra on ra.slug = v.area_slug
on conflict (id) do nothing;

-- Votos espalhados no tempo para que semana, mês e "todos os tempos" tenham
-- líderes diferentes: semana → paper 2; mês → paper 3; todos os tempos → paper 1.
-- (n votos, a partir de "dias atrás", 7h entre um voto e o seguinte)
insert into public.paper_votes (paper_id, user_id, created_at)
select plan.paper_id, voter.id,
       now() - make_interval(days => plan.start_days_ago) + (voter.rn * interval '7 hours')
from (
  values
    ('b1000000-0000-4000-8000-000000000001'::uuid, 11, 80),
    ('b1000000-0000-4000-8000-000000000002'::uuid, 6, 4),
    ('b1000000-0000-4000-8000-000000000003'::uuid, 8, 20),
    ('b1000000-0000-4000-8000-000000000004'::uuid, 4, 2),
    ('b1000000-0000-4000-8000-000000000005'::uuid, 7, 45),
    ('b1000000-0000-4000-8000-000000000006'::uuid, 5, 6),
    ('b1000000-0000-4000-8000-000000000007'::uuid, 3, 150),
    ('b1000000-0000-4000-8000-000000000008'::uuid, 3, 2),
    ('b1000000-0000-4000-8000-000000000009'::uuid, 9, 250),
    ('b1000000-0000-4000-8000-000000000010'::uuid, 2, 1),
    ('b1000000-0000-4000-8000-000000000012'::uuid, 2, 20)
) as plan (paper_id, n, start_days_ago)
join public.papers pa on pa.id = plan.paper_id
cross join lateral (
  select pr.id, row_number() over (order by pr.id) - 1 as rn
  from public.profiles pr
  join auth.users u on u.id = pr.id and u.email like '%@demo.cienciadelas.dev'
  where pr.id <> pa.submitted_by
  order by pr.id
  limit plan.n
) as voter
on conflict (paper_id, user_id) do nothing;

insert into public.paper_comments (id, paper_id, author_id, body, created_at)
values
  ('b2000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001',
   'd1000000-0000-4000-8000-000000000008',
   'Trabalho lindo! Vocês testaram a rede em celulares com pouca memória?', now() - interval '20 days'),
  ('b2000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000002',
   'd2000000-0000-4000-8000-000000000003',
   'Adoraria usar essa metodologia nos fragmentos de Mata Atlântica que estudo.', now() - interval '2 days'),
  ('b2000000-0000-4000-8000-000000000003', 'b1000000-0000-4000-8000-000000000006',
   'd2000000-0000-4000-8000-000000000005',
   'Resultado muito importante para quem pesquisa saúde materna. Obrigada por compartilhar!', now() - interval '5 days')
on conflict (id) do nothing;

-- -----------------------------------------------------------------------------
-- 2e. Mentorias (criadas como "pending" e respondidas pelo fluxo normal)
-- -----------------------------------------------------------------------------
-- (sem ON CONFLICT: o trigger BEFORE INSERT recusaria o par repetido antes disso)
insert into public.mentorship_requests (id, mentee_id, mentor_id, message, match_score, match_reason, created_at)
select v.id, v.mentee_id, v.mentor_id, v.message, v.match_score, v.match_reason, v.created_at
from (values
  ('c1000000-0000-4000-8000-000000000001'::uuid, 'd2000000-0000-4000-8000-000000000001'::uuid, 'd1000000-0000-4000-8000-000000000001'::uuid,
   'Oi, Marina! Faço IC em visão computacional e queria ajuda para planejar o mestrado e escrever meu primeiro artigo.',
   92, 'Mesma instituição e área; a mentora oferece apoio para ingresso na pós-graduação.', now() - interval '30 days'),
  ('c1000000-0000-4000-8000-000000000002', 'd2000000-0000-4000-8000-000000000002', 'd1000000-0000-4000-8000-000000000003',
   'Beatriz, estou entre o doutorado e a indústria e sua experiência nos dois mundos me ajudaria muito.',
   88, 'Áreas em comum (materiais) e experiência em indústria e inovação.', now() - interval '20 days'),
  ('c1000000-0000-4000-8000-000000000003', 'd2000000-0000-4000-8000-000000000003', 'd1000000-0000-4000-8000-000000000005',
   'Fernanda, estudo polinização na Mata Atlântica e queria conversar sobre desenho amostral e divulgação.',
   90, 'Mesma área (ecologia) e interesse em metodologia de campo.', now() - interval '3 days'),
  ('c1000000-0000-4000-8000-000000000004', 'd2000000-0000-4000-8000-000000000004', 'd1000000-0000-4000-8000-000000000011',
   'Camila, quero entrar em um projeto de IC em catálise e aprender a escrever artigos. Topa me orientar?',
   85, 'Interesse em catálise e química verde; mentora apoia escrita científica.', now() - interval '1 day'),
  ('c1000000-0000-4000-8000-000000000005', 'd2000000-0000-4000-8000-000000000005', 'd1000000-0000-4000-8000-000000000006',
   'Patrícia, preciso reorganizar meu doutorado depois da licença-maternidade. Podemos conversar?',
   87, 'Mesma área (saúde coletiva) e apoio em bolsas e saúde mental.', now() - interval '60 days'),
  ('c1000000-0000-4000-8000-000000000006', 'd2000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000007',
   'Renata, tenho curiosidade sobre carreira na indústria aeroespacial depois da graduação.',
   61, 'Interesse em indústria; áreas diferentes.', now() - interval '25 days')
) as v (id, mentee_id, mentor_id, message, match_score, match_reason, created_at)
where not exists (select 1 from public.mentorship_requests r where r.id = v.id);

update public.mentorship_requests
set status = 'accepted',
    responded_at = created_at + interval '1 day',
    response_message = 'Vai ser um prazer! Vamos marcar nossa primeira conversa.'
where id in ('c1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000002', 'c1000000-0000-4000-8000-000000000005')
  and status = 'pending';

update public.mentorship_requests
set status = 'declined',
    responded_at = created_at + interval '2 days',
    response_message = 'Estou sem vagas neste semestre, mas a Isabela é ótima para falar de indústria e inovação!'
where id = 'c1000000-0000-4000-8000-000000000006' and status = 'pending';

update public.mentorship_requests
set status = 'completed'
where id = 'c1000000-0000-4000-8000-000000000005' and status = 'accepted';

-- Notificações antigas já lidas (as dos últimos 3 dias ficam como novas).
update public.notifications n
set read_at = n.created_at + interval '3 hours'
where n.read_at is null
  and n.created_at < now() - interval '3 days'
  and n.user_id in (select u.id from auth.users u where u.email like '%@demo.cienciadelas.dev');

-- -----------------------------------------------------------------------------
-- 2f. Moderação: uma denúncia aberta para a fila do /admin
-- -----------------------------------------------------------------------------
insert into public.reports (id, reporter_id, target_type, target_id, reason, details, created_at)
values
  ('c2000000-0000-4000-8000-000000000001', 'd2000000-0000-4000-8000-000000000003', 'post',
   'a2000000-0000-4000-8000-000000000015', 'spam',
   'Denúncia de demonstração para testar a fila de moderação.', now() - interval '6 hours')
on conflict (id) do nothing;

-- -----------------------------------------------------------------------------
-- 2g. Newsletter: uma edição publicada da semana anterior (CONTRACT §9)
-- -----------------------------------------------------------------------------
insert into public.newsletter_editions (
  id, slug, title, summary, content, status, period_start, period_end, published_at, created_at
)
select
  'e1000000-0000-4000-8000-000000000001',
  to_char(w.period_start, 'IYYY') || '-s' || to_char(w.period_start, 'IW'),
  'Ciência Delas #' || to_char(w.period_start, 'IW') || ' — satélites, café e saúde materna (edição de demonstração)',
  'Nesta semana, a rede celebrou papers sobre queimadas no Vale do Paraíba e diagnóstico de doenças do café pelo celular, '
    || 'acolheu novas pesquisadoras e abriu três novas mentorias. Obrigada por fazer parte! (Edição fictícia de demonstração.)',
  jsonb_build_object(
    'papers', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', p.id, 'title', p.title, 'authors', to_jsonb(p.authors), 'votes', p.vote_count,
        'plain_summary', p.plain_summary, 'url', '/papers/' || p.id
      ) order by p.vote_count desc), '[]'::jsonb)
      from public.papers p
      where p.id in ('b1000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000001',
                     'b1000000-0000-4000-8000-000000000006')
    ),
    'threads', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', t.id, 'title', t.title, 'category', c.name, 'replies', t.reply_count, 'url', '/forum/t/' || t.id
      ) order by t.reply_count desc, t.id), '[]'::jsonb)
      from public.forum_threads t
      join public.forum_categories c on c.id = t.category_id
      where t.id in ('a1000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000004',
                     'a1000000-0000-4000-8000-000000000003')
    ),
    -- Arquivo público: mentoras só em agregado (quantas e de quais áreas), nunca nomes.
    'mentors', '[]'::jsonb,
    'mentor_summary', jsonb_build_object(
      'total', 2,
      'areas', (
        select coalesce(jsonb_agg(a.name order by a.n desc, a.name), '[]'::jsonb)
        from (
          select ra.name, count(*) as n
          from public.profile_research_areas pra
          join public.research_areas ra on ra.id = pra.area_id
          where pra.profile_id in ('d1000000-0000-4000-8000-000000000005', 'd1000000-0000-4000-8000-000000000012')
          group by ra.name
          order by count(*) desc, ra.name
          limit 8
        ) a
      )
    ),
    'stats', jsonb_build_object('new_members', 3, 'new_papers', 2, 'mentorships', 3)
  ),
  'published',
  w.period_start,
  w.period_start + 6,
  w.period_start + 7 + time '09:00',
  w.period_start + 7 + time '08:00'
from (select (date_trunc('week', now())::date - 7) as period_start) as w
on conflict (id) do nothing;
