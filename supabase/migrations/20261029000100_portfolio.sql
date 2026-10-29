-- =============================================================================
-- Artemis · 27 — rede social, parte 2: portfólio (docs/18-rede-social.md §2.2)
--
--   Artigos, projetos, apresentações, pôsteres, TCC/dissertação/tese, prêmios e cursos de cada
--   membra, mostrados no perfil e anexáveis a publicações do feed.
--
--   | Quem            | Ler | Criar / editar / apagar |
--   | --------------- | --- | ----------------------- |
--   | dona do item    | sim | sim                     |
--   | outras membras  | sim | não                     |
--   | visitantes      | não | não                     |
--
--   Até 50 itens por pessoa (CD066) e 20 novos por hora (CD067).
-- =============================================================================

create type public.portfolio_kind as enum (
  'article', 'project', 'presentation', 'poster', 'thesis', 'award', 'course', 'other'
);

create table public.portfolio_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  kind public.portfolio_kind not null,
  title text not null check (char_length(title) between 3 and 200),
  description text check (char_length(description) <= 2000),
  url text check (char_length(url) <= 500 and url ~* '^https?://\S+$'),
  venue text check (char_length(venue) <= 160),
  year smallint check (year between 1950 and 2100),
  tags text[] not null default '{}'
    check (private.text_array_ok(tags, 8, 40) and tags = private.normalize_tags(tags)),
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.portfolio_items is
  'Portfólio de cada membra (docs/18 §2.2). Todas as membras leem; só a dona escreve.';
comment on column public.portfolio_items.venue is 'Onde: revista, evento, instituição ou programa.';
comment on column public.portfolio_items.pinned is 'Destaque: aparece primeiro no perfil.';

create index portfolio_items_owner_idx on public.portfolio_items (owner_id, pinned desc, year desc nulls last, created_at desc);

-- Normalização e regras antes de gravar: textos aparados, tags normalizadas, datas do servidor,
-- limite de itens e anti-spam na criação.
create function private.portfolio_items_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_trusted boolean := private.is_trusted_context();
begin
  new.title := btrim(new.title, E' \t\r\n');
  new.description := nullif(btrim(new.description, E' \t\r\n'), '');
  new.url := nullif(btrim(new.url), '');
  new.venue := nullif(btrim(new.venue), '');
  new.tags := private.normalize_tags(new.tags);

  if tg_op = 'INSERT' then
    if not v_trusted then
      if new.owner_id is distinct from (select auth.uid()) then
        raise exception using
          errcode = 'CD013',
          message = 'Autoria inválida: adicione itens sempre ao seu próprio portfólio.';
      end if;
      new.created_at := now();
      new.updated_at := now();

      perform pg_advisory_xact_lock(hashtextextended('portfolio:' || new.owner_id::text, 0));
      if (select count(*) from public.portfolio_items p where p.owner_id = new.owner_id) >= 50 then
        raise exception using
          errcode = 'CD066',
          message = 'Seu portfólio chegou a 50 itens. Apague ou junte alguns para adicionar outro.';
      end if;

      perform private.enforce_rate_limit('portfolio_item', 20, interval '1 hour', 'CD067',
        'Você adicionou muitos itens na última hora. Respire e tente de novo em alguns minutos.');
    end if;
  else
    if new.owner_id is distinct from old.owner_id or new.created_at is distinct from old.created_at then
      raise exception using
        errcode = 'CD002',
        message = 'A dona e a data de criação de um item do portfólio não mudam.';
    end if;
    new.updated_at := now();
  end if;
  return new;
end;
$$;
revoke all on function private.portfolio_items_before_write() from public, anon, authenticated;

create trigger portfolio_items_before_write
  before insert or update on public.portfolio_items
  for each row execute function private.portfolio_items_before_write();

alter table public.portfolio_items enable row level security;

create policy "Membros veem os portfólios"
  on public.portfolio_items for select
  to authenticated
  using (true);

create policy "Dona adiciona ao próprio portfólio"
  on public.portfolio_items for insert
  to authenticated
  with check (owner_id = (select auth.uid()));

create policy "Dona edita o próprio portfólio"
  on public.portfolio_items for update
  to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "Dona apaga do próprio portfólio"
  on public.portfolio_items for delete
  to authenticated
  using (owner_id = (select auth.uid()));

revoke all on table public.portfolio_items from anon, authenticated;
grant select, delete on table public.portfolio_items to authenticated;
grant insert (owner_id, kind, title, description, url, venue, year, tags, pinned)
  on table public.portfolio_items to authenticated;
grant update (kind, title, description, url, venue, year, tags, pinned)
  on table public.portfolio_items to authenticated;
grant all on table public.portfolio_items to service_role;
