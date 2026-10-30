-- =============================================================================
-- Artemis · 17 — search_text não conta como edição
--   Num trigger BEFORE UPDATE, colunas geradas STORED ainda não foram calculadas: NEW.search_text
--   chega NULL (OLD.search_text tem o valor antigo). Os triggers abaixo comparam a linha inteira
--   (to_jsonb(new) vs to_jsonb(old)) para decidir se updated_at muda — com a coluna nova
--   (migration 20261028170000_accent_insensitive_search.sql) toda resposta nova (reply_count) e
--   todo destaque (vote_count) passavam a contar como edição. Agora search_text fica fora da
--   comparação: ela só muda quando título/corpo/resumo... mudam, e esses já entram na comparação.
--   Corpos iguais aos das migrations 20261027120300_forum.sql e 20261027120400_papers.sql, salvo
--   o `- 'search_text'`.
-- =============================================================================

create or replace function private.forum_threads_before_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.is_anonymous is distinct from old.is_anonymous or new.author_id is distinct from old.author_id then
    raise exception using
      errcode = 'CD013',
      message = 'Não é possível alterar a autoria ou o anonimato de uma publicação.';
  end if;

  if new.solution_post_id is distinct from old.solution_post_id and new.solution_post_id is not null
     and not exists (
       select 1 from public.forum_posts p
       where p.id = new.solution_post_id and p.thread_id = new.id
     ) then
    raise exception using
      errcode = 'CD014',
      message = 'A resposta escolhida como solução não pertence a este tópico.';
  end if;

  new.title := btrim(new.title);
  new.tags := private.normalize_tags(new.tags);
  if new.title is distinct from old.title or new.body is distinct from old.body then
    new.edited_at := now();
  end if;
  -- Novas respostas mudam só contadores/atividade: isso não conta como edição. search_text é
  -- gerada (NULL aqui, calculada depois deste trigger) e segue título/corpo/tags.
  if (to_jsonb(new) - 'reply_count' - 'last_activity_at' - 'updated_at' - 'search_text')
     is distinct from (to_jsonb(old) - 'reply_count' - 'last_activity_at' - 'updated_at' - 'search_text') then
    new.updated_at := now();
  end if;
  return new;
end;
$$;
revoke all on function private.forum_threads_before_update() from public, anon, authenticated;

create or replace function private.papers_before_write()
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
  -- Votos/comentários mudam só os contadores: isso não conta como edição. search_text é gerada
  -- (NULL aqui, calculada depois deste trigger) e segue os campos editoriais.
  if tg_op = 'UPDATE'
     and (to_jsonb(new) - 'vote_count' - 'comment_count' - 'updated_at' - 'search_text')
         is distinct from (to_jsonb(old) - 'vote_count' - 'comment_count' - 'updated_at' - 'search_text') then
    new.updated_at := now();
  end if;
  return new;
end;
$$;
revoke all on function private.papers_before_write() from public, anon, authenticated;
