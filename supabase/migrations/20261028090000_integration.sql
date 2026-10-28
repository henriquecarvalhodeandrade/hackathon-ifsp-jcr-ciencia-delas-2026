-- =============================================================================
-- Ciência Delas · 10 — rodada de integração
--   1. Revogar o consentimento de IA apaga também as sugestões de mentoras.
--   2. moderation_audit_log: registro das ações da moderação. revelar autoria exige
--      motivo (20–300 caracteres) e fica registrada na mesma transação; fixar/trancar
--      tópicos e ocultar papers também são registrados.
--   3. Quem denunciou é avisada quando a denúncia sai de "aberta" (resolvida ou
--      arquivada). reports.resolution_note é uma nota VISÍVEL para quem denunciou:
--      linhas antigas de auditoria ("[Auditoria] …") saem dela e vão para o registro.
--   4. Newsletter: limites de e-mails de confirmação (por endereço e por dia).
--   5. get_mentor_open_slots(p_ids): vagas abertas das mentoras exibidas no diretório.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 3a. Novo tipo de notificação (usado só dentro de funções plpgsql abaixo — o valor
--     não pode ser usado na mesma transação em que é criado).
-- -----------------------------------------------------------------------------
alter type public.notification_type add value if not exists 'report_resolved';

-- -----------------------------------------------------------------------------
-- 1. LGPD: revogar o consentimento de IA apaga o embedding E as sugestões calculadas
--    a partir do perfil. As sugestões heurísticas (sem IA) podem ser geradas de novo.
-- -----------------------------------------------------------------------------
create or replace function private.profiles_after_consent_revoked()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.profile_embeddings where profile_id = new.id;
  delete from public.mentor_suggestions where mentee_id = new.id;
  return null;
end;
$$;
revoke all on function private.profiles_after_consent_revoked() from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 2. Registro de auditoria da moderação
-- -----------------------------------------------------------------------------
create table public.moderation_audit_log (
  id bigint generated always as identity primary key,
  -- NULL só quando a conta de quem agiu foi excluída (ou em tarefas do servidor).
  actor_id uuid default auth.uid() references public.profiles (id) on delete set null,
  action text not null check (action in (
    'reveal_author', 'hide_paper', 'unhide_paper', 'lock_thread', 'unlock_thread',
    'pin_thread', 'unpin_thread', 'delete_content', 'resolve_report', 'dismiss_report',
    'change_role'
  )),
  target_type text check (target_type in ('thread', 'post', 'paper', 'paper_comment', 'profile', 'report')),
  target_id uuid,
  report_id uuid references public.reports (id) on delete set null,
  reason text check (char_length(reason) <= 500),
  created_at timestamptz not null default now()
);
comment on table public.moderation_audit_log is
  'Registro (somente inclusão) das ações da moderação. Leitura só para moderação; ninguém edita nem apaga pela API.';
comment on column public.moderation_audit_log.reason is
  'Motivo informado pela moderação (obrigatório ao revelar autoria). Nunca guarda o nome revelado.';

create index moderation_audit_log_created_at_idx on public.moderation_audit_log (created_at desc);
create index moderation_audit_log_actor_id_idx on public.moderation_audit_log (actor_id);
create index moderation_audit_log_report_id_idx on public.moderation_audit_log (report_id);
create index moderation_audit_log_target_idx on public.moderation_audit_log (target_type, target_id);

alter table public.moderation_audit_log enable row level security;

create policy "Moderação lê o registro de auditoria"
  on public.moderation_audit_log for select
  to authenticated
  using ((select private.is_moderator()));

create policy "Moderação registra as próprias ações"
  on public.moderation_audit_log for insert
  to authenticated
  with check ((select private.is_moderator()) and actor_id = (select auth.uid()));

-- Sem políticas de UPDATE/DELETE: o registro é imutável pela API (só service_role).
revoke all on table public.moderation_audit_log from anon, authenticated;
grant select on table public.moderation_audit_log to authenticated;
grant insert (actor_id, action, target_type, target_id, report_id, reason)
  on table public.moderation_audit_log to authenticated;
grant all on table public.moderation_audit_log to service_role;

-- Grava uma linha de auditoria com quem está agindo (auth.uid()).
create function private.log_moderation(
  p_action text,
  p_target_type text,
  p_target_id uuid,
  p_report_id uuid default null,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.moderation_audit_log (actor_id, action, target_type, target_id, report_id, reason)
  values (
    (select auth.uid()), p_action, p_target_type, p_target_id, p_report_id,
    nullif(left(btrim(coalesce(p_reason, '')), 500), '')
  );
end;
$$;
revoke all on function private.log_moderation(text, text, uuid, uuid, text) from public, anon, authenticated;

-- reveal_anonymous_author: agora exige motivo e registra a revelação na mesma transação.
drop function public.reveal_anonymous_author(uuid, uuid);

create function public.reveal_anonymous_author(
  p_thread_id uuid default null,
  p_post_id uuid default null,
  p_reason text default null,
  p_report_id uuid default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_reason text := btrim(coalesce(p_reason, ''));
  v_target_type public.report_target;
  v_user uuid;
begin
  if not private.is_moderator() then
    raise exception using
      errcode = '42501',
      message = 'Apenas a moderação pode revelar a autoria de publicações anônimas.';
  end if;
  if num_nonnulls(p_thread_id, p_post_id) <> 1 then
    raise exception using
      errcode = '22023',
      message = 'Informe exatamente um tópico ou uma resposta.';
  end if;
  if char_length(v_reason) < 20 or char_length(v_reason) > 300 then
    raise exception using
      errcode = 'CD016',
      message = 'Explique o motivo da revelação com 20 a 300 caracteres: ele fica registrado na auditoria.';
  end if;

  v_target_type := case when p_thread_id is not null then 'thread' else 'post' end;
  if p_report_id is not null and not exists (
    select 1 from public.reports r
    where r.id = p_report_id
      and r.target_type = v_target_type
      and r.target_id = coalesce(p_thread_id, p_post_id)
  ) then
    raise exception using
      errcode = 'CD017',
      message = 'A denúncia informada não é sobre esta publicação.';
  end if;

  select a.user_id into v_user
  from public.forum_anonymous_authorship a
  where (p_thread_id is not null and a.thread_id = p_thread_id)
     or (p_post_id is not null and a.post_id = p_post_id);

  -- Só há o que registrar quando alguém foi revelado. O nome revelado nunca é gravado.
  if v_user is not null then
    perform private.log_moderation(
      'reveal_author', v_target_type::text, coalesce(p_thread_id, p_post_id), p_report_id, v_reason
    );
  end if;
  return v_user;
end;
$$;

revoke all on function public.reveal_anonymous_author(uuid, uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.reveal_anonymous_author(uuid, uuid, text, uuid) to authenticated, service_role;

-- moderate_thread: registra fixar/desafixar e trancar/destrancar (só o que mudou).
drop function public.moderate_thread(uuid, boolean, boolean);

create function public.moderate_thread(
  p_thread_id uuid,
  p_pinned boolean default null,
  p_locked boolean default null,
  p_reason text default null,
  p_report_id uuid default null
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_was_pinned boolean;
  v_was_locked boolean;
begin
  if not private.is_moderator() then
    raise exception using
      errcode = '42501',
      message = 'Apenas a moderação pode fixar ou trancar tópicos.';
  end if;

  select t.is_pinned, t.is_locked into v_was_pinned, v_was_locked
  from public.forum_threads t
  where t.id = p_thread_id
  for update;
  if not found then
    raise exception using errcode = 'CD015', message = 'Tópico não encontrado.';
  end if;

  update public.forum_threads t
  set is_pinned = coalesce(p_pinned, t.is_pinned),
      is_locked = coalesce(p_locked, t.is_locked)
  where t.id = p_thread_id;

  if p_pinned is not null and p_pinned is distinct from v_was_pinned then
    perform private.log_moderation(
      case when p_pinned then 'pin_thread' else 'unpin_thread' end, 'thread', p_thread_id, p_report_id, p_reason
    );
  end if;
  if p_locked is not null and p_locked is distinct from v_was_locked then
    perform private.log_moderation(
      case when p_locked then 'lock_thread' else 'unlock_thread' end, 'thread', p_thread_id, p_report_id, p_reason
    );
  end if;
end;
$$;

revoke all on function public.moderate_thread(uuid, boolean, boolean, text, uuid) from public, anon, authenticated;
grant execute on function public.moderate_thread(uuid, boolean, boolean, text, uuid) to authenticated, service_role;

-- moderate_paper: registra ocultar/reexibir (só quando muda).
drop function public.moderate_paper(uuid, boolean);

create function public.moderate_paper(
  p_paper_id uuid,
  p_hidden boolean,
  p_reason text default null,
  p_report_id uuid default null
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_was_hidden boolean;
begin
  if not private.is_moderator() then
    raise exception using
      errcode = '42501',
      message = 'Apenas a moderação pode ocultar papers.';
  end if;

  select p.is_hidden into v_was_hidden from public.papers p where p.id = p_paper_id for update;
  if not found then
    raise exception using errcode = 'CD015', message = 'Paper não encontrado.';
  end if;

  update public.papers p set is_hidden = coalesce(p_hidden, p.is_hidden) where p.id = p_paper_id;

  if p_hidden is not null and p_hidden is distinct from v_was_hidden then
    perform private.log_moderation(
      case when p_hidden then 'hide_paper' else 'unhide_paper' end, 'paper', p_paper_id, p_report_id, p_reason
    );
  end if;
end;
$$;

revoke all on function public.moderate_paper(uuid, boolean, text, uuid) from public, anon, authenticated;
grant execute on function public.moderate_paper(uuid, boolean, text, uuid) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 3b. Denúncia resolvida/arquivada → auditoria + aviso para quem denunciou.
--     O aviso não diz quem moderou; a nota (resolution_note) é a única coisa escrita
--     pela moderação que a denunciante vê.
-- -----------------------------------------------------------------------------
create function private.reports_after_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target text := case new.target_type
    when 'thread' then 'um tópico do fórum'
    when 'post' then 'uma resposta no fórum'
    when 'paper' then 'um paper da Vitrine'
    when 'paper_comment' then 'um comentário em paper'
    else 'um perfil'
  end;
  v_body text;
begin
  perform private.log_moderation(
    case when new.status = 'resolved' then 'resolve_report' else 'dismiss_report' end,
    new.target_type::text, new.target_id, new.id, null
  );

  if new.reporter_id is not distinct from (select auth.uid()) then
    return null;
  end if;

  v_body := case when new.status = 'resolved'
    then format('A moderação analisou sua denúncia sobre %s e tomou as providências necessárias. Obrigada por ajudar a cuidar da comunidade.', v_target)
    else format('A moderação analisou sua denúncia sobre %s e não encontrou violação do código de conduta. Obrigada por avisar: se algo continuar incomodando, você pode denunciar de novo.', v_target)
  end;
  if new.resolution_note is not null then
    v_body := v_body || ' Nota da moderação: ' || new.resolution_note;
  end if;

  perform private.notify(
    new.reporter_id,
    'report_resolved',
    case when new.status = 'resolved' then 'Sua denúncia foi resolvida' else 'Sua denúncia foi analisada' end,
    v_body,
    '/notificacoes'
  );
  return null;
end;
$$;
revoke all on function private.reports_after_status_change() from public, anon, authenticated;

create trigger reports_after_status_change
  after update of status on public.reports
  for each row
  when (old.status = 'open' and new.status in ('resolved', 'dismissed'))
  execute function private.reports_after_status_change();

comment on column public.reports.resolution_note is
  'Nota da moderação VISÍVEL para quem denunciou (vai também no aviso). Registros internos ficam em moderation_audit_log.';

-- 3c. Linhas "[Auditoria] …" gravadas pelo painel antigo em resolution_note (que a
--     denunciante consegue ler) vão para o registro de auditoria e saem da nota.
insert into public.moderation_audit_log (actor_id, action, target_type, target_id, report_id, reason)
select null, 'reveal_author', r.target_type::text, r.target_id, r.id, left(btrim(l.line), 500)
from public.reports r
cross join lateral regexp_split_to_table(r.resolution_note, E'\n') with ordinality as l (line, ord)
where r.resolution_note like '%[Auditoria]%'
  and btrim(l.line) like '[Auditoria]%'
order by r.id, l.ord;

update public.reports r
set resolution_note = nullif(btrim(regexp_replace(r.resolution_note, E'^[ \t]*\\[Auditoria\\][^\n]*\n?', '', 'gn')), '')
where r.resolution_note like '%[Auditoria]%';

-- -----------------------------------------------------------------------------
-- 4. Newsletter: limites de e-mails de confirmação
--    confirmation_sent_at = último e-mail de confirmação; confirmation_sent_count = e-mails
--    desde que a janela começou (zera quando o último envio tem mais de 24 h).
-- -----------------------------------------------------------------------------
alter table public.newsletter_subscribers
  add column confirmation_sent_count integer not null default 0 check (confirmation_sent_count >= 0),
  add column confirmation_sent_at timestamptz;

comment on column public.newsletter_subscribers.confirmation_sent_count is
  'E-mails de confirmação enviados na janela atual (zera quando o último envio tem mais de 24 h).';
comment on column public.newsletter_subscribers.confirmation_sent_at is
  'Quando o último e-mail de confirmação foi enviado.';

create index newsletter_subscribers_confirmation_sent_at_idx
  on public.newsletter_subscribers (confirmation_sent_at)
  where confirmation_sent_at is not null;

-- Reserva (atomicamente) o envio de um e-mail de confirmação para a inscrita.
-- Devolve 'ok' (e conta o envio), 'address_limit', 'daily_limit' ou 'not_found'.
-- O teto diário soma as janelas ativas — nunca conta menos envios do que houve nas últimas 24 h.
create function public.newsletter_reserve_confirmation(
  p_subscriber_id uuid,
  p_max_per_address integer default 3,
  p_max_per_day integer default 80
)
returns text
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_since timestamptz := now() - interval '24 hours';
  v_count integer;
  v_sent_at timestamptz;
  v_daily bigint;
begin
  -- Serializa as reservas: o teto diário é uma soma sobre a tabela inteira.
  perform pg_catalog.pg_advisory_xact_lock(4207202610280001);

  select s.confirmation_sent_count, s.confirmation_sent_at into v_count, v_sent_at
  from public.newsletter_subscribers s
  where s.id = p_subscriber_id
  for update;
  if not found then
    return 'not_found';
  end if;

  if v_sent_at >= v_since and v_count >= greatest(coalesce(p_max_per_address, 3), 0) then
    return 'address_limit';
  end if;

  select coalesce(sum(s.confirmation_sent_count), 0) into v_daily
  from public.newsletter_subscribers s
  where s.confirmation_sent_at >= v_since;
  if v_daily >= greatest(coalesce(p_max_per_day, 80), 0) then
    return 'daily_limit';
  end if;

  update public.newsletter_subscribers s
  set confirmation_sent_count = case when s.confirmation_sent_at >= v_since then s.confirmation_sent_count + 1 else 1 end,
      confirmation_sent_at = now()
  where s.id = p_subscriber_id;
  return 'ok';
end;
$$;

revoke all on function public.newsletter_reserve_confirmation(uuid, integer, integer) from public, anon, authenticated;
grant execute on function public.newsletter_reserve_confirmation(uuid, integer, integer) to service_role;

-- -----------------------------------------------------------------------------
-- 5. get_mentor_open_slots — vagas abertas (capacidade − mentorias aceitas) das
--    mentoras indicadas (até 200 ids). Inclui mentoras pausadas e sem vagas (0);
--    perfis que não são mentoras ou sem onboarding ficam de fora.
-- -----------------------------------------------------------------------------
create function public.get_mentor_open_slots(p_ids uuid[])
returns table (mentor_id uuid, open_slots integer)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.id,
    greatest(
      p.mentor_capacity - (
        select count(*)
        from public.mentorship_requests r
        where r.mentor_id = p.id and r.status = 'accepted'
      ),
      0
    )::integer
  from public.profiles p
  where p.id = any ((coalesce(p_ids, '{}'::uuid[]))[1:200])
    and p.is_mentor
    and p.onboarded_at is not null;
$$;

revoke all on function public.get_mentor_open_slots(uuid[]) from public, anon, authenticated;
grant execute on function public.get_mentor_open_slots(uuid[]) to authenticated, service_role;
