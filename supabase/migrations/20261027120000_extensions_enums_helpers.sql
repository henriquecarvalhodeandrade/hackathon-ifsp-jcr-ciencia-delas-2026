-- =============================================================================
-- Artemis · 01 — extensões, enums, schema private e funções utilitárias
-- =============================================================================
-- Convenções de todo o banco (ver docs/03-banco-de-dados.md):
--   * toda função usa `set search_path = ''` e nomes totalmente qualificados;
--   * nada é exposto por padrão: cada migration faz REVOKE e depois GRANT explícito;
--   * funções auxiliares de políticas RLS vivem no schema `private` (fora da API);
--   * erros de regra de negócio usam SQLSTATE próprios (CDxxx) com mensagem pt-BR.

-- -----------------------------------------------------------------------------
-- Extensões (sempre no schema `extensions`)
-- -----------------------------------------------------------------------------
create extension if not exists citext with schema extensions;
create extension if not exists vector with schema extensions;
create extension if not exists pg_trgm with schema extensions;
create extension if not exists pgcrypto with schema extensions;

-- -----------------------------------------------------------------------------
-- Endurecimento de privilégios padrão
-- Objetos criados daqui em diante pelo papel das migrations (postgres) NÃO ficam
-- acessíveis a anon/authenticated sem GRANT explícito — inclusive funções
-- (o Postgres concede EXECUTE a PUBLIC por padrão).
-- -----------------------------------------------------------------------------
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Schema private: funções usadas por políticas/triggers. Não fica exposto pelo
-- PostgREST; anon/authenticated só recebem USAGE + EXECUTE nas funções que as
-- políticas RLS precisam avaliar.
-- -----------------------------------------------------------------------------
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated, service_role;
alter default privileges in schema private revoke execute on functions from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------
create type public.career_stage as enum (
  'high_school', 'undergraduate', 'masters', 'phd', 'postdoc', 'researcher', 'professor', 'industry'
);
create type public.user_role as enum ('member', 'moderator', 'admin');
create type public.meeting_format as enum ('online', 'in_person', 'hybrid');
create type public.mentorship_status as enum ('pending', 'accepted', 'declined', 'cancelled', 'completed');
create type public.reaction_kind as enum ('support', 'useful', 'celebrate');
create type public.report_target as enum ('thread', 'post', 'paper', 'paper_comment', 'profile');
create type public.report_reason as enum (
  'harassment', 'spam', 'misinformation', 'offensive', 'plagiarism', 'other'
);
create type public.report_status as enum ('open', 'resolved', 'dismissed');
create type public.subscriber_status as enum ('pending', 'active', 'unsubscribed');
create type public.edition_status as enum ('draft', 'published', 'sent');
create type public.notification_type as enum (
  'mentorship_request', 'mentorship_response', 'thread_reply', 'solution_marked', 'paper_comment'
);

-- -----------------------------------------------------------------------------
-- Funções utilitárias genéricas
-- -----------------------------------------------------------------------------

-- Trigger: mantém updated_at.
create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Normaliza listas de palavras-chave/tags: trim, minúsculas, sem vazios, sem
-- duplicadas (preserva a ordem da primeira ocorrência).
create function private.normalize_tags(p_items text[])
returns text[]
language sql
immutable
set search_path = ''
as $$
  select coalesce(array_agg(item order by first_pos), '{}'::text[])
  from (
    select lower(btrim(x)) as item, min(pos) as first_pos
    from unnest(coalesce(p_items, '{}'::text[])) with ordinality as u(x, pos)
    where btrim(coalesce(x, '')) <> ''
    group by lower(btrim(x))
  ) s;
$$;

-- Usada em CHECKs: no máximo p_max_items itens, nenhum nulo/vazio e cada um com
-- até p_max_len caracteres.
create function private.text_array_ok(p_items text[], p_max_items integer, p_max_len integer)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_items is not null
    and coalesce(array_length(p_items, 1), 0) <= p_max_items
    and not exists (
      select 1 from unnest(p_items) as x
      where x is null or btrim(x) = '' or char_length(x) > p_max_len
    );
$$;

-- Verdadeiro quando a requisição vem de um contexto confiável (service_role ou
-- conexão direta ao banco, ex.: seed/migrations) e não de uma usuária da API.
create function private.is_trusted_context()
returns boolean
language sql
stable
set search_path = ''
as $$
  select (select auth.uid()) is null
    and coalesce((select auth.role()), 'service_role') not in ('anon', 'authenticated');
$$;

revoke all on function private.set_updated_at() from public, anon, authenticated;
revoke all on function private.normalize_tags(text[]) from public, anon, authenticated;
revoke all on function private.text_array_ok(text[], integer, integer) from public, anon, authenticated;
revoke all on function private.is_trusted_context() from public, anon, authenticated;
grant execute on function private.normalize_tags(text[]) to anon, authenticated, service_role;
grant execute on function private.text_array_ok(text[], integer, integer) to anon, authenticated, service_role;
grant execute on function private.is_trusted_context() to anon, authenticated, service_role;
