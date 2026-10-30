-- =============================================================================
-- Artemis · 05 — Vitrine de papers: papers, votos e comentários
-- =============================================================================

-- -----------------------------------------------------------------------------
-- papers
-- -----------------------------------------------------------------------------
create table public.papers (
  id uuid primary key default gen_random_uuid(),
  submitted_by uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 5 and 300),
  abstract text not null check (char_length(abstract) between 50 and 5000),
  authors text[] not null
    check (cardinality(authors) between 1 and 50 and private.text_array_ok(authors, 50, 200)),
  doi text unique check (doi ~ '^10\.\d{4,9}/\S+$' and char_length(doi) <= 255),
  url text check (url ~* '^https?://\S+$' and char_length(url) <= 1000),
  venue text check (char_length(venue) <= 300),
  year smallint check (year between 1900 and 2100),
  area_id smallint references public.research_areas (id) on delete set null,
  keywords text[] not null default '{}'
    check (private.text_array_ok(keywords, 15, 60) and keywords = private.normalize_tags(keywords)),
  submitter_relation text not null
    check (submitter_relation in ('author', 'coauthor', 'advisor', 'reader')),
  women_authorship_confirmed boolean not null check (women_authorship_confirmed = true),
  plain_summary text check (char_length(plain_summary) <= 1500),
  plain_summary_source text check (plain_summary_source in ('ai', 'author')),
  vote_count integer not null default 0 check (vote_count >= 0),
  comment_count integer not null default 0 check (comment_count >= 0),
  is_hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on column public.papers.women_authorship_confirmed is
  'Quem envia confirma que o trabalho tem autoria (ou coautoria de destaque) de mulheres.';
comment on column public.papers.is_hidden is
  'Ocultado pela moderação (RPC moderate_paper). Some da Vitrine e dos rankings.';

create index papers_submitted_by_idx on public.papers (submitted_by);
create index papers_area_id_idx on public.papers (area_id);
create index papers_created_at_idx on public.papers (created_at desc) where not is_hidden;
create index papers_vote_count_idx on public.papers (vote_count desc, created_at desc) where not is_hidden;
create index papers_keywords_idx on public.papers using gin (keywords);
create index papers_title_trgm_idx on public.papers using gin (title extensions.gin_trgm_ops);

-- Normalização: DOI sem prefixo de URL e em minúsculas (DOIs não diferenciam
-- maiúsculas), strings vazias → NULL, palavras-chave normalizadas.
create function private.papers_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.title := btrim(new.title);
  new.abstract := btrim(new.abstract);
  new.authors := array(select btrim(a) from unnest(new.authors) as a where btrim(coalesce(a, '')) <> '');
  new.doi := nullif(lower(regexp_replace(btrim(coalesce(new.doi, '')), '^(https?://(dx\.)?doi\.org/|doi:\s*)', '', 'i')), '');
  new.url := nullif(btrim(new.url), '');
  new.venue := nullif(btrim(new.venue), '');
  new.plain_summary := nullif(btrim(new.plain_summary), '');
  if new.plain_summary is null then
    new.plain_summary_source := null;
  end if;
  new.keywords := private.normalize_tags(new.keywords);
  -- Votos/comentários mudam só os contadores: isso não conta como edição.
  if tg_op = 'UPDATE'
     and (to_jsonb(new) - 'vote_count' - 'comment_count' - 'updated_at')
         is distinct from (to_jsonb(old) - 'vote_count' - 'comment_count' - 'updated_at') then
    new.updated_at := now();
  end if;
  return new;
end;
$$;

create trigger papers_before_write
  before insert or update on public.papers
  for each row execute function private.papers_before_write();

revoke all on function private.papers_before_write() from public, anon, authenticated;

alter table public.papers enable row level security;

create policy "Papers visíveis são públicos"
  on public.papers for select
  to anon, authenticated
  using (
    not is_hidden
    or submitted_by = (select auth.uid())
    or (select private.is_moderator())
  );

create policy "Membros enviam papers em nome próprio"
  on public.papers for insert
  to authenticated
  with check (submitted_by = (select auth.uid()));

create policy "Quem enviou edita o paper"
  on public.papers for update
  to authenticated
  using (submitted_by = (select auth.uid()))
  with check (submitted_by = (select auth.uid()));

create policy "Quem enviou ou a moderação apagam o paper"
  on public.papers for delete
  to authenticated
  using (submitted_by = (select auth.uid()) or (select private.is_moderator()));

revoke all on table public.papers from anon, authenticated;
grant select on table public.papers to anon, authenticated;
grant delete on table public.papers to authenticated;
grant insert (
  submitted_by, title, abstract, authors, doi, url, venue, year, area_id, keywords,
  submitter_relation, women_authorship_confirmed, plain_summary, plain_summary_source
) on table public.papers to authenticated;
grant update (
  title, abstract, authors, doi, url, venue, year, area_id, keywords,
  submitter_relation, women_authorship_confirmed, plain_summary, plain_summary_source
) on table public.papers to authenticated;
grant all on table public.papers to service_role;

-- -----------------------------------------------------------------------------
-- paper_votes — voto positivo único por pessoa
-- -----------------------------------------------------------------------------
create table public.paper_votes (
  paper_id uuid not null references public.papers (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (paper_id, user_id)
);
create index paper_votes_user_id_idx on public.paper_votes (user_id);
create index paper_votes_paper_created_idx on public.paper_votes (paper_id, created_at desc);
create index paper_votes_created_at_idx on public.paper_votes (created_at desc);

create function private.paper_votes_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_submitted_by uuid;
  v_hidden boolean;
begin
  select p.submitted_by, p.is_hidden into v_submitted_by, v_hidden
  from public.papers p where p.id = new.paper_id;
  if not found or v_hidden then
    raise exception using errcode = 'CD015', message = 'Paper não encontrado.';
  end if;
  if v_submitted_by = new.user_id then
    raise exception using
      errcode = 'CD012',
      message = 'Você não pode votar no paper que você mesma enviou.';
  end if;
  return new;
end;
$$;

create trigger paper_votes_before_insert
  before insert on public.paper_votes
  for each row execute function private.paper_votes_before_insert();

create function private.paper_votes_after_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.papers set vote_count = vote_count + 1 where id = new.paper_id;
  else
    update public.papers set vote_count = greatest(vote_count - 1, 0) where id = old.paper_id;
  end if;
  return null;
end;
$$;

create trigger paper_votes_after_insert
  after insert on public.paper_votes
  for each row execute function private.paper_votes_after_change();

create trigger paper_votes_after_delete
  after delete on public.paper_votes
  for each row execute function private.paper_votes_after_change();

revoke all on function private.paper_votes_before_insert() from public, anon, authenticated;
revoke all on function private.paper_votes_after_change() from public, anon, authenticated;

alter table public.paper_votes enable row level security;

create policy "Votos são públicos"
  on public.paper_votes for select
  to anon, authenticated
  using (true);

create policy "Membros votam em nome próprio, exceto no próprio paper"
  on public.paper_votes for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and not exists (
      select 1 from public.papers p
      where p.id = paper_id and p.submitted_by = (select auth.uid())
    )
  );

create policy "Membros retiram o próprio voto"
  on public.paper_votes for delete
  to authenticated
  using (user_id = (select auth.uid()));

revoke all on table public.paper_votes from anon, authenticated;
grant select on table public.paper_votes to anon, authenticated;
grant delete on table public.paper_votes to authenticated;
-- created_at fica de fora: ninguém "antedata" votos para mexer no ranking semanal.
grant insert (paper_id, user_id) on table public.paper_votes to authenticated;
grant all on table public.paper_votes to service_role;

-- -----------------------------------------------------------------------------
-- paper_comments
-- -----------------------------------------------------------------------------
create table public.paper_comments (
  id uuid primary key default gen_random_uuid(),
  paper_id uuid not null references public.papers (id) on delete cascade,
  author_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 2 and 3000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index paper_comments_paper_created_idx on public.paper_comments (paper_id, created_at);
create index paper_comments_author_id_idx on public.paper_comments (author_id);

create function private.paper_comments_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.paper_id is distinct from old.paper_id or new.author_id is distinct from old.author_id then
    raise exception using
      errcode = 'CD013',
      message = 'Não é possível mover ou trocar a autoria de um comentário.';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger paper_comments_before_update
  before update on public.paper_comments
  for each row execute function private.paper_comments_before_update();

create function private.paper_comments_after_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.papers set comment_count = comment_count + 1 where id = new.paper_id;
  else
    update public.papers set comment_count = greatest(comment_count - 1, 0) where id = old.paper_id;
  end if;
  return null;
end;
$$;

create trigger paper_comments_after_insert
  after insert on public.paper_comments
  for each row execute function private.paper_comments_after_change();

create trigger paper_comments_after_delete
  after delete on public.paper_comments
  for each row execute function private.paper_comments_after_change();

revoke all on function private.paper_comments_before_update() from public, anon, authenticated;
revoke all on function private.paper_comments_after_change() from public, anon, authenticated;

alter table public.paper_comments enable row level security;

create policy "Membros leem os comentários"
  on public.paper_comments for select
  to authenticated
  using (true);

create policy "Membros comentam em nome próprio"
  on public.paper_comments for insert
  to authenticated
  with check (
    author_id = (select auth.uid())
    and exists (
      select 1 from public.papers p
      where p.id = paper_id and (not p.is_hidden or (select private.is_moderator()))
    )
  );

create policy "Autora edita o próprio comentário"
  on public.paper_comments for update
  to authenticated
  using (author_id = (select auth.uid()))
  with check (author_id = (select auth.uid()));

create policy "Autora ou moderação apagam o comentário"
  on public.paper_comments for delete
  to authenticated
  using (author_id = (select auth.uid()) or (select private.is_moderator()));

revoke all on table public.paper_comments from anon, authenticated;
grant select, delete on table public.paper_comments to authenticated;
grant insert (paper_id, author_id, body) on table public.paper_comments to authenticated;
grant update (body) on table public.paper_comments to authenticated;
grant all on table public.paper_comments to service_role;
