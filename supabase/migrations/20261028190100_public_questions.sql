-- =============================================================================
-- Artemis · 23 — Pergunte a uma cientista (docs/16-pergunte-a-uma-cientista.md)
--
--   Porta de entrada SEM CONTA para quem ainda não pesquisa (ensino médio, técnico integrado,
--   começo da graduação): a estudante manda uma pergunta anônima, a moderação aprova antes de
--   qualquer coisa ficar pública, cientistas da rede respondem em público e a estudante
--   acompanha pelo link privado que recebeu ao enviar.
--
--   | Quem              | Perguntas (public_questions)            | Respostas (public_answers)                   |
--   | ----------------- | --------------------------------------- | -------------------------------------------- |
--   | visitante (anon)  | envia (RPC); lê só publicadas           | não lê a tabela; lê por list_public_answers  |
--   | quem tem o link   | vê o andamento e apaga (RPC, por token) | (as respostas somem junto, em cascata)       |
--   | membra            | lê só publicadas                        | responde se tiver cadastro completo, só em   |
--   |                   |                                         | publicadas; lê e apaga as próprias           |
--   | moderação/admin   | lê todas; publica, recusa ou remove     | lê todas; oculta e reexibe (RPC)             |
--   |                   | (RPC)                                   |                                              |
--
--   Proteção de quem pergunta (pode ter menos de 18 anos):
--   - nenhum identificador é guardado: nem auth.uid(), nem IP, nem navegador — a pergunta não
--     tem autora no banco. A hora exata do envio (created_at) não sai pela API: só a moderação a
--     vê, na fila. O link de acompanhamento leva um token aleatório de 192 bits que só
--     existe na tela de sucesso; o banco guarda apenas o SHA-256 dele (tracking_token_hash, que
--     nem anon nem membras conseguem ler);
--   - nada fica público antes da moderação publicar;
--   - dados pessoais são recusados no banco também (e-mail, telefone, CPF/RG, @ e links de redes
--     sociais, linktree e encurtadores de link, que escondem contatos, e endereços disfarçados com
--     %XX ou entidades HTML; na pergunta, qualquer link), com as MESMAS expressões do app
--     (src/lib/pergunte/pii.ts — um teste compara as duas listas);
--   - não existe canal privado entre quem responde e quem pergunta: respostas são públicas e
--     também não podem trazer contatos (CD047);
--   - a identidade de quem responde só aparece se ela marcar, resposta por resposta
--     (show_identity); author_id nunca sai do banco nas leituras públicas;
--   - perguntas recusadas são apagadas 30 dias depois da revisão; a moderação remove de vez uma
--     pergunta (publicada ou não) que identifique a estudante ou a pedido dela, sem o link.
--
--   Erros: CD040 fila cheia (50 pendentes) · CD041 dados pessoais na pergunta · CD042 tamanho,
--   etapa ou área inválidos · CD043 pergunta fechada para respostas · CD044 cadastro incompleto ·
--   CD045 limite de respostas (20/h) · CD046 pergunta já revisada · CD047 contato na resposta.
--   Reaproveita CD013 (autoria forjada), CD015 (não encontrada) e 42501 (não é moderação).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Registro anti-spam: nova ação 'public_answer' (lista COMPLETA repetida de propósito —
--    quem acrescentar outra ação depois precisa manter esta).
-- -----------------------------------------------------------------------------
alter table private.rate_limit_events
  drop constraint rate_limit_events_action_check,
  add constraint rate_limit_events_action_check check (
    action in (
      'forum_thread', 'forum_post', 'paper_comment', 'paper', 'paper_vote', 'mentorship_message',
      'public_answer'
    )
  );

-- -----------------------------------------------------------------------------
-- 2. Registro da moderação: novas ações e alvos (listas COMPLETAS repetidas de propósito).
-- -----------------------------------------------------------------------------
alter table public.moderation_audit_log
  drop constraint moderation_audit_log_action_check,
  add constraint moderation_audit_log_action_check check (action in (
    'reveal_author', 'hide_paper', 'unhide_paper', 'lock_thread', 'unlock_thread',
    'pin_thread', 'unpin_thread', 'delete_content', 'resolve_report', 'dismiss_report',
    'change_role',
    'publish_question', 'reject_question', 'hide_answer', 'unhide_answer'
  )),
  drop constraint moderation_audit_log_target_type_check,
  add constraint moderation_audit_log_target_type_check check (target_type in (
    'thread', 'post', 'paper', 'paper_comment', 'profile', 'report',
    'public_question', 'public_answer'
  ));

-- -----------------------------------------------------------------------------
-- 3. Detector de dados pessoais (mesmas expressões de src/lib/pergunte/pii.ts)
--    Antes de comparar: NFKC (＠ e dígitos largos viram ASCII), sem caracteres invisíveis, sem
--    barras invertidas (no Markdown das respostas, "9\-9876" aparece como "9-9876") e com o ponto
--    ideográfico (。, que o navegador lê como "." num endereço) trocado por ".".
--    Sem \b (no Postgres é \y): as fronteiras usam (?<![0-9]) e (?![0-9]), iguais nos dois lados.
-- -----------------------------------------------------------------------------
create function private.detect_personal_data(p_text text, p_allow_links boolean default false)
returns text[]
language plpgsql
immutable
parallel safe
set search_path = ''
as $$
declare
  v_text text := translate(
    regexp_replace(normalize(coalesce(p_text, ''), nfkc), '[​-‍⁠﻿­]', '', 'g'),
    '。\', '.');
  v_kinds text[] := '{}';
  r record;
begin
  -- PII_PATTERNS (início) — cada linha: (tipo, expressão). Mantenha igual a src/lib/pergunte/pii.ts.
  for r in
    select k.kind, k.pattern from (values
      ('email', '[a-z0-9._%+-]+\s*(?:@|\(at\)|\[at\])\s*[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}'),
      ('email', '[a-z0-9._%+-]+\s*(?:\(?\s*arroba\s*\)?|@|\(at\)|\[at\])\s*[a-z0-9-]+\s*(?:\.|ponto)\s*[a-z]{2,}'),
      ('telefone', '(?<![0-9])(?:\+?55[\s.-]*)?(?:\(?[1-9][0-9]\)?[\s.-]*)?9[\s.-]?[0-9]{4}[\s.-]?[0-9]{4}(?![0-9])'),
      ('telefone', '(?<![0-9])(?:\+?55[\s.-]*)?\(?[1-9][0-9]\)?[\s.-]*[2-5][0-9]{3}[\s.-]?[0-9]{4}(?![0-9])'),
      ('documento', '(?<![0-9])[0-9]{3}\.?[0-9]{3}\.?[0-9]{3}-?[0-9]{2}(?![0-9])'),
      ('documento', '(?<![0-9])[0-9]{1,2}\.[0-9]{3}\.[0-9]{3}-[0-9xX](?![0-9])'),
      ('rede_social', '(?<![a-z0-9._%+-])@[a-z0-9_][a-z0-9_.]{1,29}'),
      ('rede_social', '(?<![a-z0-9-])(?:instagram\.com|instagr\.am|tiktok\.com|facebook\.com|fb\.com|fb\.me|m\.me|twitter\.com|x\.com|linkedin\.com|wa\.me|api\.whatsapp\.com|chat\.whatsapp\.com|t\.me|telegram\.me|discord\.gg|discord\.com|snapchat\.com|threads\.net|bsky\.app|kwai\.com|linktr\.ee|bit\.ly|tinyurl\.com|cutt\.ly|is\.gd|encurtador\.com\.br)'),
      -- Contato disfarçado: endereço com %XX no nome do site (https://%69nstagram.com) ou
      -- entidade HTML (&commat;, &#64;), que o Markdown das respostas transforma em @, ponto etc.
      ('rede_social', '(?://|www\.)[^\s/?#]*%[0-9a-f]{2}|&#?[a-z0-9]{2,31};'),
      ('link', 'https?://\S+'),
      ('link', '(?<![a-z0-9@.-])www\.\S+'),
      ('link', '(?<![a-z0-9@-])[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|net|org|br|io|me|app|dev|info|xyz|site|link|ly|gl|gg)(?![a-z0-9])')
    ) as k (kind, pattern)
  -- PII_PATTERNS (fim)
  loop
    if r.kind = 'link' and p_allow_links then
      continue;
    end if;
    if not (r.kind = any (v_kinds)) and v_text ~* r.pattern then
      v_kinds := v_kinds || r.kind;
    end if;
  end loop;
  return v_kinds;
end;
$$;
comment on function private.detect_personal_data(text, boolean) is
  'Tipos de dado pessoal encontrados no texto (email, telefone, documento, rede_social, link). Mesmas expressões de src/lib/pergunte/pii.ts.';
revoke all on function private.detect_personal_data(text, boolean) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 4. Perguntas
-- -----------------------------------------------------------------------------
create table public.public_questions (
  id uuid primary key default gen_random_uuid(),
  body text not null check (char_length(btrim(body, E' \t\r\n')) between 30 and 800),
  stage text check (stage in ('ensino_medio_tecnico', 'graduacao', 'outro')),
  area_id smallint references public.research_areas (id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'published', 'rejected')),
  reject_reason text check (reject_reason in ('fora_do_tema', 'dados_pessoais', 'conteudo_improprio', 'duplicada')),
  tracking_token_hash text not null unique check (tracking_token_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  published_at timestamptz,
  reviewed_by uuid references public.profiles (id) on delete set null,
  constraint public_questions_reject_reason_iff_rejected check ((status = 'rejected') = (reject_reason is not null)),
  constraint public_questions_published_at_iff_published check ((status = 'published') = (published_at is not null)),
  constraint public_questions_reviewed_when_not_pending check ((status = 'pending') = (reviewed_at is null))
);
comment on table public.public_questions is
  'Pergunte a uma cientista: perguntas anônimas de estudantes. Sem autora: nenhum identificador de quem pergunta é guardado. Escrita só pelas RPCs.';
comment on column public.public_questions.tracking_token_hash is
  'SHA-256 (hex) do token do link de acompanhamento. O token em si nunca é guardado. Ninguém lê pela API.';
comment on column public.public_questions.reviewed_by is
  'Moderadora que publicou ou recusou (só a moderação lê).';

create index public_questions_status_created_idx on public.public_questions (status, created_at);
create index public_questions_published_idx on public.public_questions (published_at desc)
  where status = 'published';
create index public_questions_area_id_idx on public.public_questions (area_id);
create index public_questions_reviewed_by_idx on public.public_questions (reviewed_by);

alter table public.public_questions enable row level security;

create policy "Perguntas publicadas são públicas"
  on public.public_questions for select
  to anon, authenticated
  using (status = 'published');

create policy "Moderação lê todas as perguntas"
  on public.public_questions for select
  to authenticated
  using ((select private.is_moderator()));

-- Sem INSERT/UPDATE/DELETE pela API: toda escrita passa pelas RPCs abaixo.
-- created_at fica FORA da leitura: a hora exata do envio, cruzada com um registro de rede (da
-- escola, do roteador de casa), poderia apontar quem perguntou. O público vê published_at (a hora
-- da moderação); a fila da moderação lê created_at por list_pending_public_questions.
revoke all on table public.public_questions from anon, authenticated;
grant select (id, body, stage, area_id, status, published_at)
  on table public.public_questions to anon, authenticated;
grant all on table public.public_questions to service_role;

-- -----------------------------------------------------------------------------
-- 5. Respostas
-- -----------------------------------------------------------------------------
create table public.public_answers (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.public_questions (id) on delete cascade,
  author_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body text not null check (char_length(btrim(body, E' \t\r\n')) between 20 and 3000),
  show_identity boolean not null default false,
  is_hidden boolean not null default false,
  hidden_at timestamptz,
  hidden_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint public_answers_hidden_at_iff_hidden check (is_hidden = (hidden_at is not null))
);
comment on table public.public_answers is
  'Respostas públicas às perguntas de estudantes. A leitura pública é só por list_public_answers (sem author_id; nome só com show_identity).';
comment on column public.public_answers.show_identity is
  'A autora escolheu mostrar nome e etapa da carreira nesta resposta (padrão: não).';

create index public_answers_question_created_idx on public.public_answers (question_id, created_at);
create index public_answers_author_id_idx on public.public_answers (author_id);
create index public_answers_created_at_idx on public.public_answers (created_at desc);
create index public_answers_hidden_by_idx on public.public_answers (hidden_by);

-- Antes de inserir: autoria, cadastro completo, pergunta publicada, sem contatos e anti-spam.
-- SECURITY DEFINER para ler a pergunta (status) e gravar no registro anti-spam.
create function private.public_answers_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_trusted boolean := private.is_trusted_context();
  v_status text;
begin
  new.body := btrim(new.body, E' \t\r\n');
  if not v_trusted then
    -- Visibilidade e data vêm do servidor.
    new.is_hidden := false;
    new.hidden_at := null;
    new.hidden_by := null;
    new.created_at := now();
  end if;

  if not v_trusted and (v_uid is null or new.author_id is distinct from v_uid) then
    raise exception using
      errcode = 'CD013',
      message = 'Autoria inválida: responda sempre com a sua própria conta.';
  end if;

  if not v_trusted and not exists (
    select 1 from public.profiles p where p.id = v_uid and p.onboarded_at is not null
  ) then
    raise exception using
      errcode = 'CD044',
      message = 'Complete seu cadastro na Artemis para responder.';
  end if;

  -- FOR SHARE: uma exclusão (pelo link) ou revisão simultânea espera esta resposta.
  select q.status into v_status
  from public.public_questions q
  where q.id = new.question_id
  for share;

  if v_status is distinct from 'published' then
    raise exception using
      errcode = 'CD043',
      message = 'Esta pergunta não está aberta para respostas.';
  end if;

  if cardinality(private.detect_personal_data(new.body, true)) > 0 then
    raise exception using
      errcode = 'CD047',
      message = 'Para a segurança de quem perguntou, não compartilhe e-mail, telefone ou redes sociais. Indique caminhos públicos, como sites oficiais.';
  end if;

  -- Por último: um envio recusado acima não gasta a cota (e qualquer erro desfaz o registro).
  perform private.enforce_rate_limit('public_answer', 20, interval '1 hour', 'CD045',
    'Você respondeu muitas perguntas na última hora. Obrigada! Tente de novo em alguns minutos.');

  return new;
end;
$$;
revoke all on function private.public_answers_before_insert() from public, anon, authenticated;

create trigger public_answers_before_insert
  before insert on public.public_answers
  for each row execute function private.public_answers_before_insert();

alter table public.public_answers enable row level security;

create policy "Autora e moderação leem respostas"
  on public.public_answers for select
  to authenticated
  using (author_id = (select auth.uid()) or (select private.is_moderator()));

create policy "Membras respondem em nome próprio"
  on public.public_answers for insert
  to authenticated
  with check (author_id = (select auth.uid()));

create policy "Autora apaga a própria resposta"
  on public.public_answers for delete
  to authenticated
  using (author_id = (select auth.uid()));

-- author_id entra no GRANT de INSERT (como sender_id em mentorship_messages) só para que uma
-- autoria forjada receba a mensagem CD013 do trigger; o padrão é auth.uid() e o RLS confere.
-- SELECT por coluna: hidden_by (QUEM da moderação ocultou) fica fora — a autora vê que a resposta
-- foi ocultada (is_hidden, hidden_at), não por quem. Quem agiu fica no moderation_audit_log.
revoke all on table public.public_answers from anon, authenticated;
grant select (id, question_id, author_id, body, show_identity, is_hidden, hidden_at, created_at)
  on table public.public_answers to authenticated;
grant delete on table public.public_answers to authenticated;
grant insert (question_id, author_id, body, show_identity) on table public.public_answers to authenticated;
grant all on table public.public_answers to service_role;

-- -----------------------------------------------------------------------------
-- 6. RPCs (todas SECURITY DEFINER, search_path vazio, nomes qualificados)
-- -----------------------------------------------------------------------------

-- Envia uma pergunta anônima. Devolve o token do link de acompanhamento (o banco guarda só o
-- hash). Nada de quem enviou é registrado.
create function public.submit_public_question(
  p_body text,
  p_stage text default null,
  p_area_id smallint default null
)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_body text := btrim(coalesce(p_body, ''), E' \t\r\n');
  v_stage text := nullif(btrim(coalesce(p_stage, '')), '');
  v_token text;
begin
  if char_length(v_body) not between 30 and 800 then
    raise exception using
      errcode = 'CD042',
      message = 'Sua pergunta precisa ter entre 30 e 800 caracteres.';
  end if;

  if v_stage is not null and v_stage not in ('ensino_medio_tecnico', 'graduacao', 'outro') then
    raise exception using
      errcode = 'CD042',
      message = 'Escolha uma etapa da lista: ensino médio ou técnico, graduação ou outro.';
  end if;

  -- Só grandes áreas (as linhas em que name = big_area).
  if p_area_id is not null and not exists (
    select 1 from public.research_areas a where a.id = p_area_id and a.name = a.big_area
  ) then
    raise exception using
      errcode = 'CD042',
      message = 'Escolha uma das grandes áreas da lista.';
  end if;

  if cardinality(private.detect_personal_data(v_body, false)) > 0 then
    raise exception using
      errcode = 'CD041',
      message = 'Para proteger você, tire da pergunta e-mails, telefones, documentos, links e @ de redes sociais.';
  end if;

  -- Fila da moderação: no máximo 50 pendentes (serializado: a contagem vale em paralelo).
  perform pg_advisory_xact_lock(hashtextextended('public_questions:pending_cap', 0));
  if (select count(*) from public.public_questions q where q.status = 'pending') >= 50 then
    raise exception using
      errcode = 'CD040',
      message = 'Recebemos muitas perguntas agora e a moderação está dando conta delas. Tente de novo mais tarde.';
  end if;

  -- Limpeza oportunista: recusadas há mais de 30 dias somem de vez.
  delete from public.public_questions q
  where q.status = 'rejected' and q.reviewed_at < now() - interval '30 days';

  -- 24 bytes aleatórios → base64url sem preenchimento (32 caracteres).
  v_token := translate(encode(extensions.gen_random_bytes(24), 'base64'), '+/', '-_');

  insert into public.public_questions (body, stage, area_id, tracking_token_hash)
  values (v_body, v_stage, p_area_id, encode(extensions.digest(v_token, 'sha256'), 'hex'));

  return v_token;
end;
$$;

-- Andamento da pergunta, para quem tem o link. Token em formato inválido ou desconhecido →
-- nenhuma linha (sem diferenciar os dois casos).
create function public.get_public_question_status(p_token text)
returns table (
  status text,
  question_id uuid,
  answer_count integer,
  reject_reason text,
  created_at timestamptz,
  body text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    q.status,
    case when q.status = 'published' then q.id end,
    case when q.status = 'published' then (
      select count(*)::integer from public.public_answers a
      where a.question_id = q.id and not a.is_hidden
    ) else 0 end,
    case when q.status = 'rejected' then q.reject_reason end,
    q.created_at,
    q.body
  from public.public_questions q
  where coalesce(p_token, '') ~ '^[A-Za-z0-9_-]{32}$'
    and q.tracking_token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex');
$$;

-- Quem tem o link apaga a própria pergunta (em qualquer status); as respostas vão junto.
create function public.delete_public_question_by_token(p_token text)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if coalesce(p_token, '') !~ '^[A-Za-z0-9_-]{32}$' then
    return false;
  end if;
  delete from public.public_questions q
  where q.tracking_token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex');
  get diagnostics v_count = row_count;
  return v_count > 0;
end;
$$;

-- Perguntas publicadas, mais recentes primeiro. p_filter: 'respondidas' | 'sem_resposta' |
-- 'todas'. Conta só respostas visíveis. total_count = total do filtro (para a paginação).
create function public.list_public_questions(
  p_filter text default 'respondidas',
  p_stage text default null,
  p_area_id smallint default null,
  p_limit integer default 10,
  p_offset integer default 0
)
returns table (
  id uuid,
  body text,
  stage text,
  area_id smallint,
  published_at timestamptz,
  answer_count integer,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if coalesce(p_filter, '') not in ('respondidas', 'sem_resposta', 'todas') then
    raise exception using errcode = '22023', message = 'Filtro de perguntas inválido.';
  end if;

  return query
  with counted as (
    select q.id, q.body, q.stage, q.area_id, q.published_at,
      (select count(*)::integer from public.public_answers a
       where a.question_id = q.id and not a.is_hidden) as answer_count
    from public.public_questions q
    where q.status = 'published'
      and (p_stage is null or q.stage = p_stage)
      and (p_area_id is null or q.area_id = p_area_id)
  ), filtered as (
    select c.* from counted c
    where p_filter = 'todas'
      or (p_filter = 'respondidas' and c.answer_count > 0)
      or (p_filter = 'sem_resposta' and c.answer_count = 0)
  )
  select f.id, f.body, f.stage, f.area_id, f.published_at, f.answer_count,
    count(*) over () as total_count
  from filtered f
  order by f.published_at desc, f.id desc
  limit least(greatest(coalesce(p_limit, 10), 1), 50)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

-- Respostas visíveis de uma pergunta publicada, mais antigas primeiro. Nome, etapa e "mentora"
-- só quando a autora escolheu se identificar; author_id nunca sai daqui.
create function public.list_public_answers(p_question_id uuid)
returns table (
  id uuid,
  body text,
  created_at timestamptz,
  author_name text,
  author_stage public.career_stage,
  author_is_mentor boolean,
  is_mine boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    a.id,
    a.body,
    a.created_at,
    case when a.show_identity then nullif(btrim(p.full_name), '') end,
    case when a.show_identity then p.career_stage end,
    case when a.show_identity then p.is_mentor end,
    coalesce(a.author_id = (select auth.uid()), false)
  from public.public_answers a
  join public.public_questions q on q.id = a.question_id and q.status = 'published'
  join public.profiles p on p.id = a.author_id
  where a.question_id = p_question_id
    and not a.is_hidden
  order by a.created_at, a.id;
$$;

-- Moderação: publica ou recusa uma pergunta pendente (registra no moderation_audit_log).
create function public.review_public_question(
  p_question_id uuid,
  p_decision text,
  p_reason text default null
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_status text;
  v_label text;
begin
  if not private.is_moderator() then
    raise exception using errcode = '42501', message = 'Só a moderação pode revisar perguntas.';
  end if;

  if p_decision is null or p_decision not in ('publish', 'reject') then
    raise exception using errcode = '22023', message = 'Decisão inválida: publique ou recuse.';
  end if;

  if p_decision = 'reject' then
    v_label := case p_reason
      when 'fora_do_tema' then 'Fora do tema'
      when 'dados_pessoais' then 'Dados pessoais'
      when 'conteudo_improprio' then 'Conteúdo impróprio'
      when 'duplicada' then 'Pergunta duplicada'
    end;
    if v_label is null then
      raise exception using errcode = '22023', message = 'Escolha o motivo para não publicar a pergunta.';
    end if;
  end if;

  select q.status into v_status
  from public.public_questions q
  where q.id = p_question_id
  for update;

  if not found then
    raise exception using errcode = 'CD015', message = 'Não encontramos esta pergunta. Talvez quem perguntou já a tenha apagado.';
  end if;
  if v_status <> 'pending' then
    raise exception using errcode = 'CD046', message = 'Esta pergunta já foi revisada por outra moderadora.';
  end if;

  update public.public_questions q
  set status = case when p_decision = 'publish' then 'published' else 'rejected' end,
      reviewed_by = (select auth.uid()),
      reviewed_at = now(),
      published_at = case when p_decision = 'publish' then now() end,
      reject_reason = case when p_decision = 'reject' then p_reason end
  where q.id = p_question_id;

  perform private.log_moderation(
    case when p_decision = 'publish' then 'publish_question' else 'reject_question' end,
    'public_question', p_question_id, null, v_label
  );
end;
$$;

-- Moderação: oculta ou reexibe uma resposta (registra no moderation_audit_log). Devolve false
-- quando a resposta já estava no estado pedido (nada muda, nada é registrado).
create function public.set_public_answer_hidden(
  p_answer_id uuid,
  p_hidden boolean,
  p_reason text default null
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_hidden boolean;
begin
  if not private.is_moderator() then
    raise exception using errcode = '42501', message = 'Só a moderação pode ocultar respostas.';
  end if;
  if p_hidden is null then
    raise exception using errcode = '22023', message = 'Informe se a resposta deve ficar oculta.';
  end if;

  select a.is_hidden into v_hidden
  from public.public_answers a
  where a.id = p_answer_id
  for update;

  if not found then
    raise exception using errcode = 'CD015', message = 'Não encontramos esta resposta. Talvez ela já tenha sido apagada.';
  end if;
  if v_hidden = p_hidden then
    return false;
  end if;

  update public.public_answers a
  set is_hidden = p_hidden,
      hidden_at = case when p_hidden then now() end,
      hidden_by = case when p_hidden then (select auth.uid()) end
  where a.id = p_answer_id;

  perform private.log_moderation(
    case when p_hidden then 'hide_answer' else 'unhide_answer' end,
    'public_answer', p_answer_id, null, p_reason
  );
  return true;
end;
$$;

-- Moderação: fila de perguntas pendentes, mais antigas primeiro (com created_at, que a API não
-- expõe a mais ninguém).
create function public.list_pending_public_questions(p_limit integer default 50)
returns table (
  id uuid,
  body text,
  stage text,
  area_id smallint,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_moderator() then
    raise exception using errcode = '42501', message = 'Só a moderação vê a fila de perguntas.';
  end if;

  return query
  select q.id, q.body, q.stage, q.area_id, q.created_at
  from public.public_questions q
  where q.status = 'pending'
  order by q.created_at, q.id
  limit least(greatest(coalesce(p_limit, 50), 1), 100);
end;
$$;

-- Moderação: remove de vez uma pergunta (em qualquer status) e as respostas dela. Para quando algo
-- que identifica a estudante passou na revisão, ou quando ela pede a exclusão sem ter o link
-- (LGPD, art. 18). Motivo obrigatório; registra 'delete_content' no moderation_audit_log.
create function public.remove_public_question(p_question_id uuid, p_reason text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_reason text := btrim(coalesce(p_reason, ''));
begin
  if not private.is_moderator() then
    raise exception using errcode = '42501', message = 'Só a moderação pode remover perguntas.';
  end if;
  if char_length(v_reason) not between 10 and 500 then
    raise exception using
      errcode = '22023',
      message = 'Explique o motivo da remoção com 10 a 500 caracteres: ele fica no registro da moderação.';
  end if;

  -- Uma resposta sendo enviada agora (FOR SHARE no trigger) termina antes; depois, CD043.
  delete from public.public_questions q where q.id = p_question_id;
  if not found then
    raise exception using errcode = 'CD015', message = 'Não encontramos esta pergunta. Talvez quem perguntou já a tenha apagado.';
  end if;

  perform private.log_moderation('delete_content', 'public_question', p_question_id, null, v_reason);
end;
$$;

revoke all on function public.submit_public_question(text, text, smallint) from public, anon, authenticated;
revoke all on function public.get_public_question_status(text) from public, anon, authenticated;
revoke all on function public.delete_public_question_by_token(text) from public, anon, authenticated;
revoke all on function public.list_public_questions(text, text, smallint, integer, integer) from public, anon, authenticated;
revoke all on function public.list_public_answers(uuid) from public, anon, authenticated;
revoke all on function public.review_public_question(uuid, text, text) from public, anon, authenticated;
revoke all on function public.set_public_answer_hidden(uuid, boolean, text) from public, anon, authenticated;
revoke all on function public.remove_public_question(uuid, text) from public, anon, authenticated;
revoke all on function public.list_pending_public_questions(integer) from public, anon, authenticated;

grant execute on function public.submit_public_question(text, text, smallint) to anon, authenticated, service_role;
grant execute on function public.get_public_question_status(text) to anon, authenticated, service_role;
grant execute on function public.delete_public_question_by_token(text) to anon, authenticated, service_role;
grant execute on function public.list_public_questions(text, text, smallint, integer, integer) to anon, authenticated, service_role;
grant execute on function public.list_public_answers(uuid) to anon, authenticated, service_role;
grant execute on function public.review_public_question(uuid, text, text) to authenticated, service_role;
grant execute on function public.set_public_answer_hidden(uuid, boolean, text) to authenticated, service_role;
grant execute on function public.remove_public_question(uuid, text) to authenticated, service_role;
grant execute on function public.list_pending_public_questions(integer) to authenticated, service_role;
