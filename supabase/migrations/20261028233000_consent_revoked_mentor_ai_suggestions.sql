-- =============================================================================
-- Artemis · 25 — revogar o consentimento de IA apaga também as explicações por IA SOBRE ela
--                (docs/04-mentoria-com-ia.md §6.2; auditoria da IA real, out/2026)
--
--   Antes: o trigger profiles_after_consent_revoked apagava o embedding e as sugestões DA
--   mentoranda (mentee_id = ela). Mas, como mentora, o texto que ela escreveu (oferta, frase de
--   apresentação, palavras-chave) também foi para a IA, e as explicações geradas a partir dele
--   ficavam salvas nas sugestões de OUTRAS mentorandas (mentor_id = ela, source = 'ai') — e
--   continuavam aparecendo depois da revogação. O texto de consentimento promete: "a análise do
--   meu perfil e as sugestões já geradas são apagadas".
--
--   Agora também saem as linhas source = 'ai' em que ela é a mentora. As linhas heurísticas sobre
--   ela ficam (não usam IA), e a mentoranda recebe sugestões novas na próxima geração.
--   A definição abaixo é a de 20261028090000_integration.sql com um DELETE a mais.
-- =============================================================================

create or replace function private.profiles_after_consent_revoked()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.profile_embeddings where profile_id = new.id;
  delete from public.mentor_suggestions where mentee_id = new.id;
  -- Explicações por IA que usaram o texto dela como mentora, nas listas de outras mentorandas.
  delete from public.mentor_suggestions where mentor_id = new.id and source = 'ai';
  return null;
end;
$$;
revoke all on function private.profiles_after_consent_revoked() from public, anon, authenticated;
