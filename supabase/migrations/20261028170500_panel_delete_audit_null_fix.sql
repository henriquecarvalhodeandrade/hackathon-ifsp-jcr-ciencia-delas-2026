-- =============================================================================
-- Artemis · 19 — correção da migration 20261028170400 (exclusões fora do painel)
--   Em 20261028170400_panel_delete_audit_anonymity.sql, `v_via_panel` ficava NULL quando a
--   configuração `artemis.moderation_target` não existe (toda exclusão fora do painel), e
--   `v_is_author and not v_via_panel` virava NULL: a autora (moderadora/admin) apagando o próprio
--   conteúdo direto no fórum ou na Vitrine passava a gerar `delete_content` — e, no conteúdo
--   anônimo, isso também apontaria a autoria. Agora `v_via_panel` é sempre true/false.
--   Corpo igual ao da migration 20261028170400, salvo o `coalesce`.
-- =============================================================================

create or replace function private.audit_moderator_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_old jsonb := to_jsonb(old);
  v_target_type text;
  v_is_author boolean;
  v_parent_gone boolean := false;
  v_via_panel boolean;
  v_reason text;
  v_report_text text;
  v_report uuid;
begin
  if v_uid is null or not private.is_moderator() then
    return old;
  end if;

  case tg_table_name
    when 'forum_threads' then
      v_target_type := 'thread';
      v_is_author := (v_old ->> 'author_id')::uuid is not distinct from v_uid
        or ((v_old ->> 'is_anonymous')::boolean and private.is_anonymous_thread_author(old.id));
    when 'forum_posts' then
      v_target_type := 'post';
      v_is_author := (v_old ->> 'author_id')::uuid is not distinct from v_uid
        or ((v_old ->> 'is_anonymous')::boolean and private.is_anonymous_post_author(old.id));
      v_parent_gone := not exists (
        select 1 from public.forum_threads t where t.id = (v_old ->> 'thread_id')::uuid
      );
    when 'papers' then
      v_target_type := 'paper';
      v_is_author := (v_old ->> 'submitted_by')::uuid is not distinct from v_uid;
    when 'paper_comments' then
      v_target_type := 'paper_comment';
      v_is_author := (v_old ->> 'author_id')::uuid is not distinct from v_uid;
      v_parent_gone := not exists (
        select 1 from public.papers p where p.id = (v_old ->> 'paper_id')::uuid
      );
    else
      return old;
  end case;

  -- Alvo da RPC do painel (moderate_delete_content): sempre registrado, mesmo da própria autora.
  -- coalesce: sem a RPC a configuração não existe (NULL) e a comparação daria NULL.
  v_via_panel := coalesce(current_setting('artemis.moderation_target', true) = old.id::text, false);

  if v_parent_gone or (v_is_author and not v_via_panel) then
    return old;
  end if;

  -- Motivo e denúncia informados pelo painel, só para este alvo.
  if v_via_panel then
    v_reason := nullif(current_setting('artemis.moderation_reason', true), '');
    v_report_text := nullif(current_setting('artemis.moderation_report', true), '');
    if v_report_text ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      select r.id into v_report from public.reports r where r.id = v_report_text::uuid;
    end if;
  end if;

  perform private.log_moderation('delete_content', v_target_type, old.id, v_report, v_reason);
  return old;
end;
$$;
revoke all on function private.audit_moderator_delete() from public, anon, authenticated;
