-- =============================================================================
-- Artemis · 29 — rede social, parte 4: feed (docs/18-rede-social.md §2.4)
--
--   Publicações curtas sobre o dia a dia da pesquisa, com curtidas e comentários.
--
--   | Tabela        | Ler              | Escrever                                                  |
--   | ------------- | ---------------- | --------------------------------------------------------- |
--   | posts         | todas as membras | a autora publica, edita (tipo, texto, link) e apaga       |
--   | post_likes    | todas as membras | curte e descurte em nome próprio                          |
--   | post_comments | todas as membras | a autora comenta, edita e apaga; a autora da publicação   |
--   |               |                  | também apaga comentários na publicação dela               |
--
--   - Anexos (item do portfólio, oportunidade) só do que é da própria autora (CD080).
--   - like_count e comment_count são mantidos por trigger (ninguém grava neles).
--   - Anti-spam: 20 publicações/h (CD081), 30 comentários/h (CD082).
--   - Avisos para a autora da publicação, agrupados por publicação (um não lido por tipo).
--   - Publicação apagada leva curtidas, comentários e os avisos que apontavam para ela.
-- =============================================================================

create type public.post_kind as enum ('update', 'project', 'achievement', 'publication', 'event');

-- -----------------------------------------------------------------------------
-- 1. posts
-- -----------------------------------------------------------------------------
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  kind public.post_kind not null default 'update',
  body text not null check (char_length(body) between 1 and 3000),
  link_url text check (char_length(link_url) <= 500 and link_url ~* '^https?://\S+$'),
  portfolio_item_id uuid references public.portfolio_items (id) on delete set null,
  opportunity_id uuid references public.research_opportunities (id) on delete set null,
  like_count integer not null default 0 check (like_count >= 0),
  comment_count integer not null default 0 check (comment_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.posts is
  'Publicações do feed (docs/18 §2.4). Todas as membras leem; a autora escreve.';
comment on column public.posts.like_count is 'Curtidas (trigger). Ninguém grava direto.';
comment on column public.posts.comment_count is 'Comentários (trigger). Ninguém grava direto.';

create index posts_created_idx on public.posts (created_at desc);
create index posts_author_created_idx on public.posts (author_id, created_at desc);
create index posts_portfolio_item_idx on public.posts (portfolio_item_id) where portfolio_item_id is not null;
create index posts_opportunity_idx on public.posts (opportunity_id) where opportunity_id is not null;

create function private.posts_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_trusted boolean := private.is_trusted_context();
begin
  new.body := btrim(new.body, E' \t\r\n');
  new.link_url := nullif(btrim(new.link_url), '');

  if tg_op = 'INSERT' then
    if not v_trusted then
      if new.author_id is distinct from v_uid then
        raise exception using
          errcode = 'CD013',
          message = 'Autoria inválida: publique sempre com a sua própria conta.';
      end if;
      new.like_count := 0;
      new.comment_count := 0;
      new.created_at := now();
      new.updated_at := now();
    end if;

    if new.portfolio_item_id is not null and not exists (
      select 1 from public.portfolio_items p
      where p.id = new.portfolio_item_id and p.owner_id = new.author_id
    ) then
      raise exception using
        errcode = 'CD080',
        message = 'Só dá para anexar itens do seu próprio portfólio.';
    end if;
    if new.opportunity_id is not null and not exists (
      select 1 from public.research_opportunities o
      where o.id = new.opportunity_id and o.owner_id = new.author_id
    ) then
      raise exception using
        errcode = 'CD080',
        message = 'Só dá para anexar oportunidades que você publicou.';
    end if;

    if not v_trusted then
      perform private.enforce_rate_limit('feed_post', 20, interval '1 hour', 'CD081',
        'Você publicou muitas vezes na última hora. Respire e tente de novo em alguns minutos.');
    end if;
  else
    if new.author_id is distinct from old.author_id
       or new.created_at is distinct from old.created_at
       or new.portfolio_item_id is distinct from old.portfolio_item_id
          and new.portfolio_item_id is not null
       or new.opportunity_id is distinct from old.opportunity_id
          and new.opportunity_id is not null then
      raise exception using
        errcode = 'CD002',
        message = 'A autoria, a data e os anexos de uma publicação não mudam.';
    end if;
    -- Os contadores só mudam pelos triggers de curtidas e comentários (chamada aninhada).
    if pg_trigger_depth() = 1 and not v_trusted
       and (new.like_count is distinct from old.like_count
            or new.comment_count is distinct from old.comment_count) then
      raise exception using
        errcode = 'CD002',
        message = 'Curtidas e comentários são contados pela plataforma.';
    end if;
    if new.body is distinct from old.body or new.kind is distinct from old.kind
       or new.link_url is distinct from old.link_url then
      new.updated_at := now();
    end if;
  end if;
  return new;
end;
$$;
revoke all on function private.posts_before_write() from public, anon, authenticated;

create trigger posts_before_write
  before insert or update on public.posts
  for each row execute function private.posts_before_write();

-- Publicação apagada → somem os avisos que apontavam para ela.
create function private.posts_after_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.notifications n
  where n.type in ('post_like', 'post_comment')
    and n.link = '/feed/p/' || old.id::text;
  return null;
end;
$$;
revoke all on function private.posts_after_delete() from public, anon, authenticated;

create trigger posts_after_delete
  after delete on public.posts
  for each row execute function private.posts_after_delete();

alter table public.posts enable row level security;

create policy "Membros veem as publicações"
  on public.posts for select
  to authenticated
  using (true);

create policy "Membros publicam em nome próprio"
  on public.posts for insert
  to authenticated
  with check (author_id = (select auth.uid()));

create policy "Autora edita a própria publicação"
  on public.posts for update
  to authenticated
  using (author_id = (select auth.uid()))
  with check (author_id = (select auth.uid()));

create policy "Autora apaga a própria publicação"
  on public.posts for delete
  to authenticated
  using (author_id = (select auth.uid()));

revoke all on table public.posts from anon, authenticated;
grant select, delete on table public.posts to authenticated;
grant insert (author_id, kind, body, link_url, portfolio_item_id, opportunity_id)
  on table public.posts to authenticated;
grant update (kind, body, link_url) on table public.posts to authenticated;
grant all on table public.posts to service_role;

-- -----------------------------------------------------------------------------
-- 2. post_likes
-- -----------------------------------------------------------------------------
create table public.post_likes (
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
comment on table public.post_likes is 'Curtidas do feed: uma por pessoa e publicação.';

create index post_likes_user_idx on public.post_likes (user_id, created_at desc);

create function private.post_likes_before_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not private.is_trusted_context() then
    if new.user_id is distinct from (select auth.uid()) then
      raise exception using
        errcode = 'CD013',
        message = 'Autoria inválida: curta publicações sempre com a sua própria conta.';
    end if;
    new.created_at := now();
  end if;
  return new;
end;
$$;
revoke all on function private.post_likes_before_insert() from public, anon, authenticated;

create trigger post_likes_before_insert
  before insert on public.post_likes
  for each row execute function private.post_likes_before_insert();

-- Contador + aviso agrupado para a autora (nunca para quem curte a própria publicação).
create function private.post_likes_after_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_author uuid;
  v_body text;
  v_link text;
begin
  if tg_op = 'DELETE' then
    update public.posts set like_count = greatest(like_count - 1, 0) where id = old.post_id;
    return null;
  end if;

  update public.posts set like_count = like_count + 1 where id = new.post_id
  returning author_id, body into v_author, v_body;

  if v_author is null or v_author = new.user_id then
    return null;
  end if;
  v_link := '/feed/p/' || new.post_id::text;
  perform pg_advisory_xact_lock(hashtextextended('post_like_notify:' || v_author::text || ':' || v_link, 0));
  if exists (
    select 1 from public.notifications n
    where n.user_id = v_author and n.type = 'post_like' and n.link = v_link and n.read_at is null
  ) then
    return null;
  end if;
  perform private.notify(
    v_author,
    'post_like',
    format('%s curtiu a sua publicação', private.display_name(new.user_id)),
    left(regexp_replace(v_body, '\s+', ' ', 'g'), 160),
    v_link,
    new.created_at
  );
  return null;
end;
$$;
revoke all on function private.post_likes_after_change() from public, anon, authenticated;

create trigger post_likes_after_change
  after insert or delete on public.post_likes
  for each row execute function private.post_likes_after_change();

alter table public.post_likes enable row level security;

create policy "Membros veem as curtidas"
  on public.post_likes for select
  to authenticated
  using (true);

create policy "Membros curtem em nome próprio"
  on public.post_likes for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "Membros descurtem em nome próprio"
  on public.post_likes for delete
  to authenticated
  using (user_id = (select auth.uid()));

revoke all on table public.post_likes from anon, authenticated;
grant select, delete on table public.post_likes to authenticated;
grant insert (post_id, user_id) on table public.post_likes to authenticated;
grant all on table public.post_likes to service_role;

-- -----------------------------------------------------------------------------
-- 3. post_comments
-- -----------------------------------------------------------------------------
create table public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  author_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.post_comments is
  'Comentários do feed. A autora edita e apaga; a autora da publicação também apaga.';

create index post_comments_post_created_idx on public.post_comments (post_id, created_at);
create index post_comments_author_idx on public.post_comments (author_id);

create function private.post_comments_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.body := btrim(new.body, E' \t\r\n');
  if tg_op = 'INSERT' then
    if not private.is_trusted_context() then
      if new.author_id is distinct from (select auth.uid()) then
        raise exception using
          errcode = 'CD013',
          message = 'Autoria inválida: comente sempre com a sua própria conta.';
      end if;
      new.created_at := now();
      new.updated_at := now();
      if not exists (select 1 from public.posts p where p.id = new.post_id) then
        raise exception using
          errcode = 'CD083',
          message = 'Não encontramos esta publicação. Ela pode ter sido apagada.';
      end if;
      perform private.enforce_rate_limit('feed_comment', 30, interval '1 hour', 'CD082',
        'Você comentou muitas vezes na última hora. Respire e tente de novo em alguns minutos.');
    end if;
  else
    if new.post_id is distinct from old.post_id or new.author_id is distinct from old.author_id
       or new.created_at is distinct from old.created_at then
      raise exception using
        errcode = 'CD002',
        message = 'Só o texto do comentário pode ser editado.';
    end if;
    if new.body is distinct from old.body then
      new.updated_at := now();
    end if;
  end if;
  return new;
end;
$$;
revoke all on function private.post_comments_before_write() from public, anon, authenticated;

create trigger post_comments_before_write
  before insert or update on public.post_comments
  for each row execute function private.post_comments_before_write();

create function private.post_comments_after_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_author uuid;
  v_link text;
begin
  if tg_op = 'DELETE' then
    update public.posts set comment_count = greatest(comment_count - 1, 0) where id = old.post_id;
    return null;
  end if;

  update public.posts set comment_count = comment_count + 1 where id = new.post_id
  returning author_id into v_author;

  if v_author is null or v_author = new.author_id then
    return null;
  end if;
  v_link := '/feed/p/' || new.post_id::text;
  perform pg_advisory_xact_lock(hashtextextended('post_comment_notify:' || v_author::text || ':' || v_link, 0));
  if exists (
    select 1 from public.notifications n
    where n.user_id = v_author and n.type = 'post_comment' and n.link = v_link and n.read_at is null
  ) then
    return null;
  end if;
  perform private.notify(
    v_author,
    'post_comment',
    format('%s comentou a sua publicação', private.display_name(new.author_id)),
    left(regexp_replace(new.body, '\s+', ' ', 'g'), 200),
    v_link,
    new.created_at
  );
  return null;
end;
$$;
revoke all on function private.post_comments_after_change() from public, anon, authenticated;

create trigger post_comments_after_change
  after insert or delete on public.post_comments
  for each row execute function private.post_comments_after_change();

-- A usuária é a autora da publicação? (RLS de DELETE dos comentários)
create function private.owns_post(p_post_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.posts p where p.id = p_post_id and p.author_id = (select auth.uid()));
$$;
revoke all on function private.owns_post(uuid) from public, anon, authenticated;
grant execute on function private.owns_post(uuid) to authenticated, service_role;

alter table public.post_comments enable row level security;

create policy "Membros veem os comentários"
  on public.post_comments for select
  to authenticated
  using (true);

create policy "Membros comentam em nome próprio"
  on public.post_comments for insert
  to authenticated
  with check (author_id = (select auth.uid()));

create policy "Autora edita o próprio comentário"
  on public.post_comments for update
  to authenticated
  using (author_id = (select auth.uid()))
  with check (author_id = (select auth.uid()));

create policy "Autora do comentário ou da publicação apaga"
  on public.post_comments for delete
  to authenticated
  using (author_id = (select auth.uid()) or private.owns_post(post_id));

revoke all on table public.post_comments from anon, authenticated;
grant select, delete on table public.post_comments to authenticated;
grant insert (post_id, author_id, body) on table public.post_comments to authenticated;
grant update (body) on table public.post_comments to authenticated;
grant all on table public.post_comments to service_role;
