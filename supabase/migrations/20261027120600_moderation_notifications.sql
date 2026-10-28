-- =============================================================================
-- Artemis · 07 — moderação (denúncias) e notificações
-- =============================================================================

-- -----------------------------------------------------------------------------
-- reports — denúncias de conteúdo/perfil
-- -----------------------------------------------------------------------------
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  target_type public.report_target not null,
  target_id uuid not null,
  reason public.report_reason not null,
  details text check (char_length(details) <= 1000),
  status public.report_status not null default 'open',
  resolved_by uuid references public.profiles (id) on delete set null,
  resolution_note text check (char_length(resolution_note) <= 1000),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
comment on table public.reports is
  'Denúncias. A denunciante vê as próprias; moderadoras veem e resolvem todas.';

create index reports_reporter_id_idx on public.reports (reporter_id);
create index reports_resolved_by_idx on public.reports (resolved_by);
create index reports_status_created_idx on public.reports (status, created_at desc);
create index reports_target_idx on public.reports (target_type, target_id);

create function private.reports_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.details := nullif(btrim(new.details), '');
  new.resolution_note := nullif(btrim(new.resolution_note), '');

  if tg_op = 'INSERT' then
    if not private.is_trusted_context() then
      new.status := 'open';
      new.resolved_by := null;
      new.resolved_at := null;
      new.resolution_note := null;
    end if;
    return new;
  end if;

  -- UPDATE (somente moderação, garantido pelo RLS)
  if new.reporter_id is distinct from old.reporter_id
     or new.target_type is distinct from old.target_type
     or new.target_id is distinct from old.target_id
     or new.reason is distinct from old.reason then
    raise exception using errcode = 'CD002', message = 'Os dados da denúncia não podem ser alterados.';
  end if;

  if new.status = 'open' then
    new.resolved_at := null;
    new.resolved_by := null;
  elsif new.status is distinct from old.status then
    new.resolved_at := now();
    new.resolved_by := coalesce((select auth.uid()), new.resolved_by);
  elsif (select auth.uid()) is not null then
    -- Mesmo status: não deixa trocar quem resolveu por outra pessoa.
    new.resolved_at := old.resolved_at;
    -- Exceção: a FK `resolved_by ... on delete set null` (conta da moderadora
    -- excluída). Se o perfil antigo não existe mais, aceita o NULL; senão a
    -- exclusão da conta falharia com violação de FK sempre que rodasse numa
    -- sessão com JWT de usuária (ex.: "excluir minha conta").
    if new.resolved_by is not null
       or exists (select 1 from public.profiles p where p.id = old.resolved_by) then
      new.resolved_by := old.resolved_by;
    end if;
  end if;
  return new;
end;
$$;
revoke all on function private.reports_before_write() from public, anon, authenticated;

create trigger reports_before_write
  before insert or update on public.reports
  for each row execute function private.reports_before_write();

alter table public.reports enable row level security;

create policy "Membros denunciam em nome próprio"
  on public.reports for insert
  to authenticated
  with check (reporter_id = (select auth.uid()));

create policy "Denunciante e moderação veem a denúncia"
  on public.reports for select
  to authenticated
  using (reporter_id = (select auth.uid()) or (select private.is_moderator()));

create policy "Moderação resolve denúncias"
  on public.reports for update
  to authenticated
  using ((select private.is_moderator()))
  with check ((select private.is_moderator()));

revoke all on table public.reports from anon, authenticated;
grant select on table public.reports to authenticated;
grant insert (reporter_id, target_type, target_id, reason, details) on table public.reports to authenticated;
grant update (status, resolution_note, resolved_by, resolved_at) on table public.reports to authenticated;
grant all on table public.reports to service_role;

-- -----------------------------------------------------------------------------
-- notifications — criadas somente por triggers SECURITY DEFINER
-- -----------------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type public.notification_type not null,
  title text not null check (char_length(title) between 1 and 200),
  body text check (char_length(body) <= 1000),
  link text check (link ~ '^/' and link !~ '^//' and char_length(link) <= 500),
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_created_idx on public.notifications (user_id, created_at desc);
create index notifications_user_unread_idx on public.notifications (user_id) where read_at is null;

alter table public.notifications enable row level security;

create policy "Usuária vê as próprias notificações"
  on public.notifications for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "Usuária marca as próprias notificações como lidas"
  on public.notifications for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "Usuária apaga as próprias notificações"
  on public.notifications for delete
  to authenticated
  using (user_id = (select auth.uid()));

revoke all on table public.notifications from anon, authenticated;
grant select, delete on table public.notifications to authenticated;
grant update (read_at) on table public.notifications to authenticated;
grant all on table public.notifications to service_role;

-- Realtime (se a publicação existir): o sininho pode ouvir novas notificações.
-- O Realtime respeita o RLS acima.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
     ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end
$$;

-- -----------------------------------------------------------------------------
-- Criação de notificações
-- -----------------------------------------------------------------------------
create function private.notify(
  p_user_id uuid,
  p_type public.notification_type,
  p_title text,
  p_body text default null,
  p_link text default null,
  p_created_at timestamptz default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_user_id is null then
    return;
  end if;
  insert into public.notifications (user_id, type, title, body, link, created_at)
  values (
    p_user_id, p_type, left(p_title, 200), left(p_body, 1000), p_link,
    least(coalesce(p_created_at, now()), now())
  );
end;
$$;
revoke all on function private.notify(uuid, public.notification_type, text, text, text, timestamptz)
  from public, anon, authenticated;

create function private.display_name(p_profile_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select nullif(btrim(p.full_name), '') from public.profiles p where p.id = p_profile_id),
    'Uma pesquisadora'
  );
$$;
revoke all on function private.display_name(uuid) from public, anon, authenticated;

-- Pedido novo → mentora; mudança de status → a outra participante.
create function private.notify_mentorship_change()
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
      when 'completed' then 'Obrigada por fortalecer a rede Ciência Delas!'
      else null
    end,
    '/mentoria',
    case when new.status in ('accepted', 'declined') then new.responded_at end
  );
  return null;
end;
$$;
revoke all on function private.notify_mentorship_change() from public, anon, authenticated;

create trigger mentorship_requests_notify_insert
  after insert on public.mentorship_requests
  for each row execute function private.notify_mentorship_change();

create trigger mentorship_requests_notify_update
  after update of status on public.mentorship_requests
  for each row execute function private.notify_mentorship_change();

-- Resposta nova → autora do tópico (inclusive anônima, via autoria registrada).
create function private.notify_thread_reply()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_thread_author uuid := private.thread_real_author(new.thread_id);
  v_post_author uuid := coalesce(
    new.author_id,
    (select a.user_id from public.forum_anonymous_authorship a where a.post_id = new.id)
  );
  v_title text;
begin
  if v_thread_author is null or v_thread_author = v_post_author then
    return null;
  end if;
  select t.title into v_title from public.forum_threads t where t.id = new.thread_id;
  perform private.notify(
    v_thread_author,
    'thread_reply',
    'Nova resposta no seu tópico',
    left(v_title, 160),
    format('/forum/t/%s#post-%s', new.thread_id, new.id),
    new.created_at
  );
  return null;
end;
$$;
revoke all on function private.notify_thread_reply() from public, anon, authenticated;

create trigger forum_posts_notify_reply
  after insert on public.forum_posts
  for each row execute function private.notify_thread_reply();

-- Resposta marcada como solução → autora da resposta.
create function private.notify_solution_marked()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_post_author uuid;
begin
  if new.solution_post_id is null or new.solution_post_id is not distinct from old.solution_post_id then
    return null;
  end if;
  v_post_author := private.post_real_author(new.solution_post_id);
  if v_post_author is null or v_post_author = coalesce((select auth.uid()), private.thread_real_author(new.id)) then
    return null;
  end if;
  perform private.notify(
    v_post_author,
    'solution_marked',
    'Sua resposta foi marcada como solução',
    left(new.title, 160),
    format('/forum/t/%s#post-%s', new.id, new.solution_post_id)
  );
  return null;
end;
$$;
revoke all on function private.notify_solution_marked() from public, anon, authenticated;

create trigger forum_threads_notify_solution
  after update of solution_post_id on public.forum_threads
  for each row execute function private.notify_solution_marked();

-- Comentário novo → quem enviou o paper.
create function private.notify_paper_comment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_submitted_by uuid;
  v_title text;
begin
  select p.submitted_by, p.title into v_submitted_by, v_title from public.papers p where p.id = new.paper_id;
  if v_submitted_by is null or v_submitted_by = new.author_id then
    return null;
  end if;
  perform private.notify(
    v_submitted_by,
    'paper_comment',
    'Novo comentário no seu paper',
    format('%s comentou em “%s”.', private.display_name(new.author_id), left(v_title, 140)),
    format('/papers/%s#comentarios', new.paper_id),
    new.created_at
  );
  return null;
end;
$$;
revoke all on function private.notify_paper_comment() from public, anon, authenticated;

create trigger paper_comments_notify
  after insert on public.paper_comments
  for each row execute function private.notify_paper_comment();
