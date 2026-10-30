-- =============================================================================
-- Artemis · 22 — encerramento com reconhecimento: retorno privado, declaração verificável e
-- impacto agregado (k ≥ 5)
--
--   Concluir a mentoria deixa de ser um beco sem saída. Cada participante pode deixar um retorno
--   curto e PRIVADO; juntas, as duas podem emitir uma "Declaração de participação em mentoria"
--   com código público de verificação (e QR code); a plataforma publica só números agregados,
--   e só a partir de 5 retornos. Regras (todas no banco, valem também pela API):
--
--   | Objeto                         | Quem lê                      | Quem escreve                     |
--   | ------------------------------ | ---------------------------- | -------------------------------- |
--   | mentorship_requests.completed_at | as participantes (como hoje) | só o banco (trigger); seeds     |
--   | mentorship_feedback (retorno)  | SÓ a autora (nem a outra     | a autora, uma vez por mentoria   |
--   |                                | participante, nem moderação, | concluída; ela pode apagar; não  |
--   |                                | nem admin)                   | há edição                        |
--   | mentorship_declarations        | as duas participantes        | pedido: uma participante (já com |
--   |                                |                              | a autorização dela); autorização |
--   |                                |                              | e revogação só pelas RPCs        |
--   | verify_mentorship_declaration  | qualquer pessoa (anon)       | —                                |
--   | get_mentorship_impact          | qualquer pessoa (anon)       | —                                |
--
--   - A declaração só fica pública depois das DUAS autorizações (issued_at). Código pendente e
--     código inexistente dão a mesma resposta (nenhuma linha). Revogada: sem nomes.
--   - A página pública mostra só nomes, papéis, período (meses) e temas. Nunca ids, e-mails,
--     instituição, mensagens ou retornos. Os nomes são lidos na hora: se uma das participantes
--     excluir a conta, o pedido e a declaração somem em cascata e o código passa a "não
--     encontrada".
--   - Impacto agregado: os resultados (opções marcadas e média de ajuda) só aparecem com pelo
--     menos K_MIN = 5 retornos de mentorandas e são atualizados em blocos de 5 (ninguém deduz
--     uma resposta comparando o antes e o depois); cada opção com menos de 3 marcações volta
--     NULL ("menos de 3").
--   - Códigos de erro: CD030–CD037 (docs/15-reconhecimento-da-mentoria.md). Reaproveita CD013
--     (autoria) e 42501 (permissão).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. mentorship_requests.completed_at — quando a mentoria foi concluída (hora do servidor)
--    Coluna nova, sem GRANT de escrita para membras (o UPDATE delas continua só de status e
--    response_message). Um trigger separado (o de máquina de estados não muda) carimba a data.
-- -----------------------------------------------------------------------------
alter table public.mentorship_requests add column completed_at timestamptz;
comment on column public.mentorship_requests.completed_at is
  'Quando a mentoria foi concluída (hora do servidor, gravada por trigger). Base do período da declaração.';

-- Mentorias já concluídas: a última atualização é a melhor estimativa. Sem disparar o trigger de
-- máquina de estados (ele trocaria updated_at por now()).
alter table public.mentorship_requests disable trigger mentorship_requests_before_update;
update public.mentorship_requests
set completed_at = updated_at
where status = 'completed' and completed_at is null;
alter table public.mentorship_requests enable trigger mentorship_requests_before_update;

-- Roda DEPOIS de mentorship_requests_before_update (ordem alfabética dos triggers BEFORE): a
-- transição já foi validada quando chega aqui.
--   - entrou em 'completed' → now(); contexto confiável (seed) pode informar outra data;
--   - nos demais casos mantém o valor antigo (contexto confiável pode ajustar uma data já
--     gravada — é assim que o seed de demonstração recua a conclusão).
create function private.mentorship_requests_set_completed_at()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_trusted boolean := private.is_trusted_context();
  v_explicit boolean := new.completed_at is distinct from old.completed_at;
begin
  if new.status = 'completed' and old.status is distinct from 'completed' then
    if not (v_trusted and v_explicit and new.completed_at is not null) then
      new.completed_at := now();
    end if;
  elsif not (v_trusted and v_explicit and new.status = 'completed') then
    new.completed_at := old.completed_at;
  end if;
  return new;
end;
$$;
revoke all on function private.mentorship_requests_set_completed_at() from public, anon, authenticated;

create trigger mentorship_requests_set_completed_at
  before update on public.mentorship_requests
  for each row execute function private.mentorship_requests_set_completed_at();

-- Aviso de conclusão: mesmo corpo da migration 20261028130000, só o caso 'completed' muda — o
-- link leva a outra participante direto para /mentoria/concluida/<pedido> (retorno + declaração).
create or replace function private.notify_mentorship_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_recipient uuid;
begin
  if tg_op = 'INSERT' then
    perform private.notify(
      new.mentor_id,
      'mentorship_request',
      'Novo pedido de mentoria',
      format('%s gostaria da sua mentoria. Leia a mensagem e responda quando puder.', private.display_name(new.mentee_id)),
      '/mentoria',
      new.created_at
    );
    return null;
  end if;

  if new.status is not distinct from old.status then
    return null;
  end if;

  v_recipient := case
    when v_actor = new.mentor_id then new.mentee_id
    when v_actor = new.mentee_id then new.mentor_id
    when new.status in ('accepted', 'declined') then new.mentee_id
    else new.mentor_id
  end;

  perform private.notify(
    v_recipient,
    'mentorship_response',
    case new.status
      when 'accepted' then 'Seu pedido de mentoria foi aceito'
      when 'declined' then 'Seu pedido de mentoria não pôde ser aceito'
      when 'cancelled' then 'Uma mentoria foi cancelada'
      when 'completed' then 'Mentoria concluída'
      else 'Atualização no pedido de mentoria'
    end,
    case new.status
      when 'accepted' then format('%s aceitou ser sua mentora. Combinem o primeiro encontro!', private.display_name(new.mentor_id))
      when 'declined' then 'Não desanime: há outras mentoras na rede esperando por você.'
      when 'cancelled' then format('%s cancelou o pedido de mentoria.', private.display_name(coalesce(v_actor, new.mentee_id)))
      when 'completed' then 'Obrigada por fortalecer a rede da Artemis! Se quiser, conte como foi (só você vê) e peçam juntas a declaração de participação.'
      else null
    end,
    case when new.status = 'completed' then '/mentoria/concluida/' || new.id::text else '/mentoria' end,
    case when new.status in ('accepted', 'declined') then new.responded_at end
  );
  return null;
end;
$$;
revoke all on function private.notify_mentorship_change() from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 2. Catálogo de resultados do retorno. Lista ÚNICA, idêntica a src/lib/recognition/outcomes.ts
--    (um teste do Vitest lê este arquivo e compara os dois conjuntos).
-- -----------------------------------------------------------------------------
create function private.mentorship_outcomes(p_role text)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select case p_role
    when 'mentee' then array['menos-sozinha', 'plano-definido', 'iniciacao-cientifica', 'candidatura', 'trabalho-apresentado', 'rede-ampliada']::text[]
    when 'mentor' then array['aprendi-tambem', 'quero-mentorar-mais']::text[]
    else '{}'::text[]
  end;
$$;
revoke all on function private.mentorship_outcomes(text) from public, anon, authenticated;
-- Usada no CHECK da tabela: quem insere precisa poder executá-la.
grant execute on function private.mentorship_outcomes(text) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 3. mentorship_feedback — o retorno privado de cada participante
-- -----------------------------------------------------------------------------
create table public.mentorship_feedback (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.mentorship_requests (id) on delete cascade,
  author_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  role text not null check (role in ('mentee', 'mentor')),
  helpfulness smallint not null check (helpfulness between 1 and 5),
  outcomes text[] not null default '{}'
    check (
      cardinality(outcomes) <= 6
      and outcomes <@ (private.mentorship_outcomes('mentee') || private.mentorship_outcomes('mentor'))
    ),
  would_recommend boolean,
  note text check (char_length(note) <= 500),
  created_at timestamptz not null default now(),
  constraint mentorship_feedback_one_per_author unique (request_id, author_id)
);
comment on table public.mentorship_feedback is
  'Retorno privado de uma participante sobre a mentoria concluída. Só a autora lê; publicamos apenas agregados com k ≥ 5.';
comment on column public.mentorship_feedback.role is
  'Papel da autora no pedido (mentee/mentor). Definido pelo trigger a partir do pedido, nunca pela cliente.';
comment on column public.mentorship_feedback.note is
  'Nota livre (até 500 caracteres). Só a autora vê: não entra em nenhum agregado.';

create index mentorship_feedback_author_id_idx on public.mentorship_feedback (author_id);

-- Antes de inserir: participante, mentoria concluída, autoria, duplicata e opções válidas.
-- SECURITY DEFINER para ler o pedido; pedido inexistente e pedido alheio dão o mesmo erro.
create function private.mentorship_feedback_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_trusted boolean := private.is_trusted_context();
  v_mentee uuid;
  v_mentor uuid;
  v_status public.mentorship_status;
begin
  select r.mentee_id, r.mentor_id, r.status
    into v_mentee, v_mentor, v_status
  from public.mentorship_requests r
  where r.id = new.request_id
  for share;

  if not found or (not v_trusted and (v_uid is null or v_uid not in (v_mentee, v_mentor))) then
    raise exception using
      errcode = 'CD031',
      message = 'Não encontramos esta mentoria.';
  end if;

  if v_status <> 'completed' then
    raise exception using
      errcode = 'CD030',
      message = 'Você poderá contar como foi quando a mentoria for concluída.';
  end if;

  if not v_trusted and new.author_id is distinct from v_uid then
    raise exception using
      errcode = 'CD013',
      message = 'Autoria inválida: envie o retorno sempre com a sua própria conta.';
  end if;
  if new.author_id is null or new.author_id not in (v_mentee, v_mentor) then
    raise exception using
      errcode = 'CD013',
      message = 'O retorno precisa ser de uma das participantes da mentoria.';
  end if;

  -- Serializa envios simultâneos da mesma pessoa para a mesma mentoria (a UNIQUE é a garantia
  -- final; aqui a mensagem é a amigável).
  perform pg_advisory_xact_lock(
    hashtextextended('mentorship_feedback:' || new.request_id::text || ':' || new.author_id::text, 0)
  );
  if exists (
    select 1 from public.mentorship_feedback f
    where f.request_id = new.request_id and f.author_id = new.author_id
  ) then
    raise exception using
      errcode = 'CD032',
      message = 'Você já contou como foi esta mentoria. Obrigada!';
  end if;

  new.role := case when new.author_id = v_mentee then 'mentee' else 'mentor' end;
  new.outcomes := private.normalize_tags(new.outcomes);
  if not (new.outcomes <@ private.mentorship_outcomes(new.role)) then
    raise exception using
      errcode = 'CD033',
      message = 'Uma das opções escolhidas não existe mais. Recarregue a página.';
  end if;

  new.note := nullif(btrim(new.note, E' \t\r\n'), '');
  if not v_trusted then
    new.created_at := now();
  end if;
  return new;
end;
$$;
revoke all on function private.mentorship_feedback_before_insert() from public, anon, authenticated;

create trigger mentorship_feedback_before_insert
  before insert on public.mentorship_feedback
  for each row execute function private.mentorship_feedback_before_insert();

alter table public.mentorship_feedback enable row level security;

create policy "Autora vê o próprio retorno"
  on public.mentorship_feedback for select
  to authenticated
  using (author_id = (select auth.uid()));

create policy "Participante envia o próprio retorno da mentoria concluída"
  on public.mentorship_feedback for insert
  to authenticated
  with check (
    author_id = (select auth.uid())
    and exists (
      select 1 from public.mentorship_requests r
      where r.id = request_id
        and r.status = 'completed'
        and (select auth.uid()) in (r.mentee_id, r.mentor_id)
    )
  );

create policy "Autora apaga o próprio retorno"
  on public.mentorship_feedback for delete
  to authenticated
  using (author_id = (select auth.uid()));

-- Sem UPDATE: o retorno não é editado (para mudar, ela apaga e envia outro).
revoke all on table public.mentorship_feedback from anon, authenticated;
grant select, delete on table public.mentorship_feedback to authenticated;
grant insert (request_id, helpfulness, outcomes, would_recommend, note)
  on table public.mentorship_feedback to authenticated;
grant all on table public.mentorship_feedback to service_role;

-- -----------------------------------------------------------------------------
-- 4. Códigos de verificação: 'ART-' + 3 grupos de 4 caracteres Crockford base32 (sem I, L, O, U)
--    = 60 bits aleatórios (extensions.gen_random_bytes). Normalização tolerante para quem digita:
--    maiúsculas, sem espaços/hífens, O → 0, I/L → 1; com ou sem o prefixo ART.
-- -----------------------------------------------------------------------------
create function private.declaration_code_alphabet()
returns text
language sql
immutable
set search_path = ''
as $$ select '0123456789ABCDEFGHJKMNPQRSTVWXYZ'::text; $$;
revoke all on function private.declaration_code_alphabet() from public, anon, authenticated;

create function private.new_declaration_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_alphabet constant text := private.declaration_code_alphabet();
  v_bytes bytea := extensions.gen_random_bytes(12);
  v_chars text := '';
  i integer;
begin
  -- 256 é múltiplo de 32: os 5 bits baixos de cada byte são uniformes (12 × 5 = 60 bits).
  for i in 0..11 loop
    v_chars := v_chars || substr(v_alphabet, (get_byte(v_bytes, i) & 31) + 1, 1);
  end loop;
  return 'ART-' || substr(v_chars, 1, 4) || '-' || substr(v_chars, 5, 4) || '-' || substr(v_chars, 9, 4);
end;
$$;
revoke all on function private.new_declaration_code() from public, anon, authenticated;

-- NULL quando o texto não vira um código bem formado (mesma regra de src/lib/recognition/code.ts).
create function private.normalize_declaration_code(p_code text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v text;
begin
  if p_code is null or char_length(p_code) > 64 then
    return null;
  end if;
  v := regexp_replace(upper(p_code), '[^0-9A-Z]', '', 'g');
  if char_length(v) = 15 and left(v, 3) = 'ART' then
    v := substr(v, 4);
  end if;
  v := translate(v, 'OIL', '011');
  if v !~ '^[0-9A-HJKMNP-TV-Z]{12}$' then
    return null;
  end if;
  return 'ART-' || substr(v, 1, 4) || '-' || substr(v, 5, 4) || '-' || substr(v, 9, 4);
end;
$$;
revoke all on function private.normalize_declaration_code(text) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 5. mentorship_declarations — declaração de participação (pedido → 2 autorizações → emitida)
-- -----------------------------------------------------------------------------
create table public.mentorship_declarations (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.mentorship_requests (id) on delete cascade,
  code text not null unique
    check (code ~ '^ART-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$'),
  requested_by uuid default auth.uid() references public.profiles (id) on delete set null,
  mentee_consented_at timestamptz,
  mentor_consented_at timestamptz,
  issued_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid references public.profiles (id) on delete set null,
  revoke_reason text check (char_length(revoke_reason) <= 300),
  created_at timestamptz not null default now(),
  constraint mentorship_declarations_issued_needs_both
    check (issued_at is null or (mentee_consented_at is not null and mentor_consented_at is not null)),
  constraint mentorship_declarations_revoke_fields
    check ((revoked_by is null or revoked_at is not null) and (revoke_reason is null or revoked_at is not null))
);
comment on table public.mentorship_declarations is
  'Declaração de participação em mentoria. Pública (por código) só depois das duas autorizações; pode ser revogada por qualquer das duas.';
comment on column public.mentorship_declarations.code is
  'Código público de verificação (ART-XXXX-XXXX-XXXX, Crockford base32, 60 bits). Gerado pelo banco.';
comment on column public.mentorship_declarations.issued_at is
  'Quando a segunda participante autorizou. Antes disso o código não aparece em /verificar.';

-- No máximo uma declaração ativa (não revogada) por mentoria.
create unique index mentorship_declarations_active_request_idx
  on public.mentorship_declarations (request_id) where revoked_at is null;
create index mentorship_declarations_request_created_idx
  on public.mentorship_declarations (request_id, created_at desc);
create index mentorship_declarations_requested_by_idx on public.mentorship_declarations (requested_by);
create index mentorship_declarations_revoked_by_idx on public.mentorship_declarations (revoked_by);

-- Antes de inserir: participante de mentoria concluída, uma ativa por vez, limite de pedidos,
-- autorização de quem pede e código gerado pelo banco.
create function private.mentorship_declarations_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_trusted boolean := private.is_trusted_context();
  v_mentee uuid;
  v_mentor uuid;
  v_status public.mentorship_status;
  v_attempt integer := 0;
begin
  select r.mentee_id, r.mentor_id, r.status
    into v_mentee, v_mentor, v_status
  from public.mentorship_requests r
  where r.id = new.request_id
  for share;

  if not found or (not v_trusted and (v_uid is null or v_uid not in (v_mentee, v_mentor))) then
    raise exception using
      errcode = 'CD031',
      message = 'Não encontramos esta mentoria.';
  end if;

  if v_status <> 'completed' then
    raise exception using
      errcode = 'CD030',
      message = 'A declaração pode ser pedida quando a mentoria for concluída.';
  end if;

  -- Serializa pedidos da mesma mentoria (as duas pedindo ao mesmo tempo → uma recebe CD034).
  perform pg_advisory_xact_lock(hashtextextended('mentorship_declaration:' || new.request_id::text, 0));

  if exists (
    select 1 from public.mentorship_declarations d
    where d.request_id = new.request_id and d.revoked_at is null
  ) then
    raise exception using
      errcode = 'CD034',
      message = 'Já existe uma declaração para esta mentoria.';
  end if;

  if not v_trusted and (
    select count(*) from public.mentorship_declarations d where d.request_id = new.request_id
  ) >= 5 then
    raise exception using
      errcode = 'CD036',
      message = 'Esta mentoria já teve 5 pedidos de declaração. Se precisarem de outra, fale com a equipe da Artemis.';
  end if;

  if not v_trusted then
    -- Quem pede já autoriza o próprio nome (a interface exige a caixa marcada antes do envio).
    -- Datas, código e revogação vêm sempre do servidor.
    new.requested_by := v_uid;
    new.mentee_consented_at := case when v_uid = v_mentee then now() end;
    new.mentor_consented_at := case when v_uid = v_mentor then now() end;
    new.issued_at := null;
    new.revoked_at := null;
    new.revoked_by := null;
    new.revoke_reason := null;
    new.created_at := now();
    new.code := null;
  else
    -- Seed/service role: pode informar código e datas; emitida quando as duas autorizaram.
    if new.issued_at is null and new.mentee_consented_at is not null and new.mentor_consented_at is not null then
      new.issued_at := greatest(new.mentee_consented_at, new.mentor_consented_at);
    end if;
    new.code := private.normalize_declaration_code(new.code);
  end if;

  if new.code is null then
    loop
      v_attempt := v_attempt + 1;
      new.code := private.new_declaration_code();
      exit when not exists (select 1 from public.mentorship_declarations d where d.code = new.code);
      if v_attempt >= 5 then
        raise exception 'mentorship_declarations: não foi possível gerar um código único';
      end if;
    end loop;
  end if;

  return new;
end;
$$;
revoke all on function private.mentorship_declarations_before_insert() from public, anon, authenticated;

create trigger mentorship_declarations_before_insert
  before insert on public.mentorship_declarations
  for each row execute function private.mentorship_declarations_before_insert();

-- Antes de atualizar (só as RPCs abaixo e a service role atualizam): o que foi registrado não
-- volta atrás. Código, mentoria e datas de autorização/emissão/revogação são definitivos;
-- quem pediu/revogou só pode virar NULL (exclusão da conta, ON DELETE SET NULL).
create function private.mentorship_declarations_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id is distinct from old.id
     or new.request_id is distinct from old.request_id
     or new.code is distinct from old.code
     or new.created_at is distinct from old.created_at
     or (new.requested_by is distinct from old.requested_by and new.requested_by is not null)
     or (old.mentee_consented_at is not null and new.mentee_consented_at is distinct from old.mentee_consented_at)
     or (old.mentor_consented_at is not null and new.mentor_consented_at is distinct from old.mentor_consented_at)
     or (old.issued_at is not null and new.issued_at is distinct from old.issued_at)
     or (old.revoked_at is not null and (
       new.revoked_at is distinct from old.revoked_at
       or new.revoke_reason is distinct from old.revoke_reason
       or (new.revoked_by is distinct from old.revoked_by and new.revoked_by is not null)
     )) then
    raise exception using
      errcode = 'CD037',
      message = 'A declaração não pode ser editada: só é possível autorizar ou revogar.';
  end if;
  return new;
end;
$$;
revoke all on function private.mentorship_declarations_before_update() from public, anon, authenticated;

create trigger mentorship_declarations_before_update
  before update on public.mentorship_declarations
  for each row execute function private.mentorship_declarations_before_update();

alter table public.mentorship_declarations enable row level security;

create policy "Participantes veem as declarações da mentoria"
  on public.mentorship_declarations for select
  to authenticated
  using (
    exists (
      select 1 from public.mentorship_requests r
      where r.id = request_id
        and (select auth.uid()) in (r.mentee_id, r.mentor_id)
    )
  );

create policy "Participante pede a declaração da mentoria concluída"
  on public.mentorship_declarations for insert
  to authenticated
  with check (
    requested_by = (select auth.uid())
    and exists (
      select 1 from public.mentorship_requests r
      where r.id = request_id
        and r.status = 'completed'
        and (select auth.uid()) in (r.mentee_id, r.mentor_id)
    )
  );

-- Sem UPDATE nem DELETE: autorizar e revogar só pelas RPCs; a declaração some com a mentoria.
revoke all on table public.mentorship_declarations from anon, authenticated;
grant select on table public.mentorship_declarations to authenticated;
grant insert (request_id) on table public.mentorship_declarations to authenticated;
grant all on table public.mentorship_declarations to service_role;

-- -----------------------------------------------------------------------------
-- 6. RPCs da declaração (membras)
-- -----------------------------------------------------------------------------

-- A participante que ainda não autorizou carimba a própria autorização. Com as duas, emite.
-- Devolve issued_at (NULL enquanto falta a outra).
create function public.consent_mentorship_declaration(p_declaration_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_decl public.mentorship_declarations%rowtype;
  v_mentee uuid;
  v_mentor uuid;
begin
  select d.* into v_decl
  from public.mentorship_declarations d
  where d.id = p_declaration_id
  for update;

  if found then
    select r.mentee_id, r.mentor_id into v_mentee, v_mentor
    from public.mentorship_requests r
    where r.id = v_decl.request_id;
  end if;

  if not found or v_uid is null or v_uid not in (v_mentee, v_mentor) then
    raise exception using
      errcode = 'CD031',
      message = 'Não encontramos esta mentoria.';
  end if;

  if v_decl.revoked_at is not null then
    raise exception using
      errcode = 'CD035',
      message = 'Esta declaração foi revogada. Peça uma nova, se quiserem.';
  end if;

  if v_uid = v_mentee and v_decl.mentee_consented_at is null then
    v_decl.mentee_consented_at := now();
  elsif v_uid = v_mentor and v_decl.mentor_consented_at is null then
    v_decl.mentor_consented_at := now();
  else
    -- Já tinha autorizado: nada muda.
    return v_decl.issued_at;
  end if;

  if v_decl.mentee_consented_at is not null and v_decl.mentor_consented_at is not null then
    v_decl.issued_at := now();
  end if;

  update public.mentorship_declarations d
  set mentee_consented_at = v_decl.mentee_consented_at,
      mentor_consented_at = v_decl.mentor_consented_at,
      issued_at = v_decl.issued_at
  where d.id = v_decl.id;

  return v_decl.issued_at;
end;
$$;

-- Qualquer das duas revoga, uma vez (pedido pendente revogado = pedido cancelado).
create function public.revoke_mentorship_declaration(p_declaration_id uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_decl public.mentorship_declarations%rowtype;
  v_mentee uuid;
  v_mentor uuid;
  v_reason text := nullif(btrim(p_reason, E' \t\r\n'), '');
begin
  select d.* into v_decl
  from public.mentorship_declarations d
  where d.id = p_declaration_id
  for update;

  if found then
    select r.mentee_id, r.mentor_id into v_mentee, v_mentor
    from public.mentorship_requests r
    where r.id = v_decl.request_id;
  end if;

  if not found or v_uid is null or v_uid not in (v_mentee, v_mentor) then
    raise exception using
      errcode = 'CD031',
      message = 'Não encontramos esta mentoria.';
  end if;

  if v_decl.revoked_at is not null then
    raise exception using
      errcode = 'CD035',
      message = 'Esta declaração já foi revogada.';
  end if;

  update public.mentorship_declarations d
  set revoked_at = now(),
      revoked_by = v_uid,
      revoke_reason = left(v_reason, 300)
  where d.id = v_decl.id;
end;
$$;

revoke all on function public.consent_mentorship_declaration(uuid) from public, anon, authenticated;
revoke all on function public.revoke_mentorship_declaration(uuid, text) from public, anon, authenticated;
grant execute on function public.consent_mentorship_declaration(uuid) to authenticated, service_role;
grant execute on function public.revoke_mentorship_declaration(uuid, text) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 7. Verificação pública (/verificar/<código>) — anon e membras
--    0 linhas para código desconhecido E para declaração ainda não emitida (indistinguíveis).
--    Revogada: status 'revogada' sem nomes, temas nem período. Nada de ids, e-mails,
--    instituição, mensagens ou retornos. Período em meses, no fuso de São Paulo.
-- -----------------------------------------------------------------------------
create function public.verify_mentorship_declaration(p_code text)
returns table (
  status text,
  mentee_name text,
  mentor_name text,
  period_start date,
  period_end date,
  themes text[],
  issued_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    case when d.revoked_at is null then 'valida' else 'revogada' end,
    case when d.revoked_at is null then private.display_name(r.mentee_id) end,
    case when d.revoked_at is null then private.display_name(r.mentor_id) end,
    case when d.revoked_at is null then
      date_trunc('month', coalesce(r.responded_at, r.created_at) at time zone 'America/Sao_Paulo')::date
    end,
    case when d.revoked_at is null then
      date_trunc('month', coalesce(r.completed_at, r.updated_at) at time zone 'America/Sao_Paulo')::date
    end,
    case when d.revoked_at is null then coalesce(mentor.mentorship_topics, '{}'::text[]) end,
    d.issued_at
  from public.mentorship_declarations d
  join public.mentorship_requests r on r.id = d.request_id
  left join public.profiles mentor on mentor.id = r.mentor_id
  where d.code = private.normalize_declaration_code(p_code)
    and d.issued_at is not null
  limit 1;
$$;
revoke all on function public.verify_mentorship_declaration(text) from public, anon, authenticated;
grant execute on function public.verify_mentorship_declaration(text) to anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 8. Impacto agregado (landing e /mentoria/concluida) — anon e membras
--    { completed, mentee_feedback, published_feedback, outcomes: [{slug, count}] | null,
--      helpfulness_avg | null, declarations_issued, k_min, is_demo }
--    outcomes e helpfulness_avg só com published_feedback ≥ K_MIN (5); count < 3 → null.
--
--    Publicação EM BLOCOS de 5: os resultados usam só os floor(n / 5) × 5 retornos mais antigos
--    (published_feedback). Sem isso, quem comparasse os números antes e depois de UM retorno novo
--    (ex.: a mentora, logo depois de concluir) deduziria a nota e as opções da mentoranda dela —
--    a média e as células "menos de 3" mudariam só por causa daquela resposta. Com blocos, cada
--    mudança nos resultados mistura pelo menos 5 retornos novos. mentee_feedback (o total) segue
--    público: diz que alguém respondeu, nunca o quê.
-- -----------------------------------------------------------------------------
create function public.get_mentorship_impact()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with
    mentee_feedback as (
      select f.helpfulness, f.outcomes,
        row_number() over (order by f.created_at, f.id) as seq
      from public.mentorship_feedback f
      join public.mentorship_requests r on r.id = f.request_id
      where f.role = 'mentee' and r.status = 'completed'
    ),
    totals as (
      select count(*)::integer as n from mentee_feedback
    ),
    published as (
      select m.helpfulness, m.outcomes
      from mentee_feedback m, totals t
      where m.seq <= (t.n / 5) * 5
    ),
    published_totals as (
      select count(*)::integer as n, round(avg(helpfulness)::numeric, 1)::numeric(2, 1) as avg
      from published
    ),
    per_outcome as (
      select c.slug, c.ord,
        (select count(*) from published m where c.slug = any (m.outcomes))::integer as n
      from unnest(private.mentorship_outcomes('mentee')) with ordinality as c (slug, ord)
    )
  select jsonb_build_object(
    'completed', (select count(*) from public.mentorship_requests r where r.status = 'completed'),
    'mentee_feedback', t.n,
    'published_feedback', pt.n,
    'outcomes', case when pt.n >= 5 then (
      select jsonb_agg(
        jsonb_build_object('slug', p.slug, 'count', case when p.n >= 3 then p.n end)
        order by p.ord
      )
      from per_outcome p
    ) end,
    'helpfulness_avg', case when pt.n >= 5 then pt.avg end,
    'declarations_issued', (
      select count(*) from public.mentorship_declarations d
      where d.issued_at is not null and d.revoked_at is null
    ),
    'k_min', 5,
    'is_demo', exists (
      select 1 from auth.users u
      join public.profiles p on p.id = u.id
      where lower(u.email) like '%@demo.cienciadelas.dev'
    )
  )
  from totals t, published_totals pt;
$$;
revoke all on function public.get_mentorship_impact() from public, anon, authenticated;
grant execute on function public.get_mentorship_impact() to anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 9. LGPD: pedido apagado (em geral, em cascata pela exclusão de uma conta) → apaga também o
--    aviso de conclusão que aponta para /mentoria/concluida/<pedido> (o link levaria a uma
--    página que não existe mais). Retornos e declarações já somem pela FK.
-- -----------------------------------------------------------------------------
create function private.mentorship_requests_after_delete_recognition()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.notifications n
  where n.user_id in (old.mentee_id, old.mentor_id)
    and n.link = '/mentoria/concluida/' || old.id::text;
  return null;
end;
$$;
revoke all on function private.mentorship_requests_after_delete_recognition() from public, anon, authenticated;

create trigger mentorship_requests_after_delete_recognition
  after delete on public.mentorship_requests
  for each row execute function private.mentorship_requests_after_delete_recognition();
