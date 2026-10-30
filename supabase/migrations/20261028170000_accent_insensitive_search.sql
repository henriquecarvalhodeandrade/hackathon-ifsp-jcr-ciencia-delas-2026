-- =============================================================================
-- Artemis · 14 — busca sem acento e sem diferença de maiúsculas
--   "Jacarei" encontra "Jacareí", "REVISAO" encontra "revisão".
--
--   * private.unaccent_immutable(text): wrapper IMMUTABLE de extensions.unaccent com o
--     dicionário fixado ('extensions.unaccent'::regdictionary, resolvido para um OID quando a
--     função é criada — não depende do search_path, que é '' em todas as funções do banco).
--     unaccent() é STABLE porque o dicionário PODERIA ser reconfigurado; aqui ele é fixo. Se as
--     regras do unaccent mudarem algum dia, basta um UPDATE qualquer nas linhas para recalcular.
--   * private.search_text(text[]): lower(unaccent(<partes unidas por espaço>)), espaços colapsados.
--     concat_ws/array_to_string são STABLE e não podem aparecer direto numa coluna gerada; dentro
--     de uma função IMMUTABLE com entradas só de texto o resultado é determinístico.
--   * Colunas geradas `search_text` (STORED) + índices GIN de trigramas em:
--       profiles      → full_name, institution, headline, city, keywords
--       forum_threads → title, body, tags (NUNCA a autoria: tópicos anônimos continuam anônimos)
--       papers        → title, abstract, authors, keywords, venue
--   * GRANTs: as três tabelas têm SELECT de tabela inteira (profiles e forum_threads: só
--     authenticated; papers: anon + authenticated), então a coluna nova segue exatamente o acesso
--     que já existia. Ninguém escreve nela (coluna gerada; os GRANTs de INSERT/UPDATE são por
--     coluna e não a incluem). As funções precisam de EXECUTE para quem grava as linhas
--     (authenticated/service_role), porque a expressão roda com o papel de quem escreve.
--
--   O app normaliza o termo do mesmo jeito (src/lib/search/normalize.ts) e filtra com
--   .ilike('search_text', '%termo%').
-- =============================================================================

create extension if not exists unaccent with schema extensions;

-- -----------------------------------------------------------------------------
-- Funções
-- -----------------------------------------------------------------------------
create function private.unaccent_immutable(p_text text)
returns text
language sql
immutable
strict
parallel safe
set search_path = ''
return extensions.unaccent('extensions.unaccent'::regdictionary, p_text);

comment on function private.unaccent_immutable(text) is
  'unaccent() com dicionário fixo, IMMUTABLE (pode ser usado em colunas geradas e índices).';

create function private.search_text(p_parts text[])
returns text
language sql
immutable
parallel safe
set search_path = ''
return btrim(regexp_replace(
  lower(private.unaccent_immutable(array_to_string(p_parts, ' '))),
  '\s+', ' ', 'g'
));

comment on function private.search_text(text[]) is
  'Texto de busca: partes não nulas unidas por espaço, sem acentos, em minúsculas e com espaços colapsados.';

revoke all on function private.unaccent_immutable(text) from public, anon, authenticated;
revoke all on function private.search_text(text[]) from public, anon, authenticated;
grant execute on function private.unaccent_immutable(text) to authenticated, service_role;
grant execute on function private.search_text(text[]) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Colunas geradas
-- -----------------------------------------------------------------------------
alter table public.profiles
  add column search_text text generated always as (
    private.search_text(array[full_name, institution, headline, city] || keywords)
  ) stored;
comment on column public.profiles.search_text is
  'Gerada: nome, instituição, título, cidade e palavras-chave sem acento e em minúsculas (busca do diretório).';

alter table public.forum_threads
  add column search_text text generated always as (
    private.search_text(array[title, body] || tags)
  ) stored;
comment on column public.forum_threads.search_text is
  'Gerada: título, corpo e tags sem acento e em minúsculas (busca do fórum). Não inclui a autoria.';

alter table public.papers
  add column search_text text generated always as (
    private.search_text(array[title, abstract] || authors || keywords || array[venue])
  ) stored;
comment on column public.papers.search_text is
  'Gerada: título, resumo, autoras, palavras-chave e veículo sem acento e em minúsculas (busca da Vitrine).';

-- -----------------------------------------------------------------------------
-- Índices de trigramas (ILIKE '%termo%' com 3+ caracteres usa o índice)
-- -----------------------------------------------------------------------------
create index profiles_search_text_trgm_idx on public.profiles
  using gin (search_text extensions.gin_trgm_ops);
create index forum_threads_search_text_trgm_idx on public.forum_threads
  using gin (search_text extensions.gin_trgm_ops);
create index papers_search_text_trgm_idx on public.papers
  using gin (search_text extensions.gin_trgm_ops);
