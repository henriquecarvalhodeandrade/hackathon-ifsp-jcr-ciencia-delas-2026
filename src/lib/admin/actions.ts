"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentProfile, type Profile } from "@/lib/auth";
import { isAdminConfigured } from "@/lib/env";
import { generateWeeklyEdition, publishEdition, sendEdition } from "@/lib/newsletter/service";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { actionError, NOT_ALLOWED, SESSION_EXPIRED, type ActionState } from "./action-state";
import { appendAuditLine, buildAuditLine, mergeResolutionNote, splitResolutionNote } from "./audit";
import { friendlyDbError } from "./errors";
import { ROLE_LABELS } from "./params";

/**
 * Server Actions do painel de moderação (/admin).
 *
 * Toda action confere a sessão e o papel ANTES de tocar no banco (o proxy é só
 * uma checagem otimista). As escritas usam o cliente com a sessão — o RLS e as
 * RPCs de moderação (`moderate_thread`, `moderate_paper`, `reveal_anonymous_author`)
 * validam de novo no Postgres. O cliente admin (service role) só é usado para
 * trocar papéis (a coluna `role` não tem GRANT de UPDATE para ninguém) e pela
 * newsletter, sempre depois de confirmar que quem pediu é admin.
 */

type Gate = { profile: Profile; error?: undefined } | { profile?: undefined; error: { ok: false; error: string } };

async function gate(level: "moderator" | "admin"): Promise<Gate> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: actionError(SESSION_EXPIRED) };
  const allowed = level === "admin" ? profile.role === "admin" : profile.role === "moderator" || profile.role === "admin";
  if (!allowed) {
    return {
      error: actionError(level === "admin" ? "Apenas administradoras podem fazer isso." : NOT_ALLOWED),
    };
  }
  return { profile };
}

const uuid = (label: string) => z.uuid({ error: `${label} inválido. Recarregue a página e tente de novo.` });
const optionalNote = z
  .string()
  .trim()
  .max(800, { error: "Use no máximo 800 caracteres na nota." })
  .optional()
  .transform((v) => (v ? v : undefined));

function fieldErrors(error: z.ZodError) {
  return z.flattenError(error).fieldErrors as Record<string, string[] | undefined>;
}

function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Dados inválidos. Recarregue a página e tente de novo.";
}

function revalidateAdmin() {
  revalidatePath("/admin");
}

// ---------------------------------------------------------------------------
// Denúncias
// ---------------------------------------------------------------------------

const resolveSchema = z.object({
  id: uuid("Denúncia"),
  status: z.enum(["open", "resolved", "dismissed"], { error: "Escolha resolver, arquivar ou reabrir." }),
  note: optionalNote,
});

const STATUS_MESSAGES = {
  resolved: "Denúncia marcada como resolvida.",
  dismissed: "Denúncia arquivada.",
  open: "Denúncia reaberta.",
} as const;

export async function resolveReport(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { error: denied } = await gate("moderator");
  if (denied) return denied;

  const parsed = resolveSchema.safeParse({
    id: formData.get("id"),
    status: formData.get("status"),
    note: formData.get("note") ?? undefined,
  });
  if (!parsed.success) return actionError(firstIssue(parsed.error), fieldErrors(parsed.error));
  const { id, status, note } = parsed.data;

  const supabase = await createClient();
  const current = await supabase.from("reports").select("id, status, resolution_note").eq("id", id).maybeSingle();
  if (current.error) return actionError(friendlyDbError(current.error));
  if (!current.data) return actionError("Denúncia não encontrada. Ela pode ter sido removida.");

  const { data, error } = await supabase
    .from("reports")
    .update({
      status,
      // Reabrir sem nota mantém a nota anterior; nas demais, a nota nova substitui o texto livre.
      resolution_note:
        status === "open" && !note ? current.data.resolution_note : mergeResolutionNote(current.data.resolution_note, note),
    })
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) return actionError(friendlyDbError(error));
  if (!data) return actionError(NOT_ALLOWED);

  revalidateAdmin();
  return { ok: true, message: STATUS_MESSAGES[status] };
}

type ServerClient = Awaited<ReturnType<typeof createClient>>;
type DeletableTarget = "thread" | "post" | "paper" | "paper_comment";

/**
 * Fecha as denúncias abertas dos alvos depois que a moderação agiu sobre eles.
 * A nota automática é ACRESCENTADA ao texto que já existia (e a auditoria é preservada).
 * Busca as abertas do tipo e filtra os ids aqui (a fila aberta é pequena; evita URLs enormes
 * quando um tópico apagado tinha centenas de respostas).
 */
async function resolveOpenReportsFor(
  supabase: ServerClient,
  targetType: DeletableTarget,
  targetIds: readonly string[],
  note: string,
): Promise<number> {
  if (targetIds.length === 0) return 0;
  const wanted = new Set(targetIds);
  const { data } = await supabase
    .from("reports")
    .select("id, target_id, resolution_note")
    .eq("target_type", targetType)
    .eq("status", "open")
    .limit(1000);
  const open = (data ?? []).filter((report) => wanted.has(report.target_id));
  let closed = 0;
  for (const report of open) {
    const { error } = await supabase
      .from("reports")
      .update({
        status: "resolved",
        resolution_note: mergeResolutionNote(
          report.resolution_note,
          [splitResolutionNote(report.resolution_note).text, note].filter(Boolean).join("\n"),
        ),
      })
      .eq("id", report.id);
    if (!error) closed += 1;
  }
  return closed;
}

// ---------------------------------------------------------------------------
// Conteúdo: fixar/trancar, ocultar paper, excluir
// ---------------------------------------------------------------------------

const threadSchema = z.object({
  threadId: uuid("Tópico"),
  op: z.enum(["pin", "unpin", "lock", "unlock"], { error: "Ação inválida." }),
});

const THREAD_MESSAGES = {
  pin: "Tópico fixado no topo do fórum.",
  unpin: "Tópico desafixado.",
  lock: "Tópico trancado: ninguém além da moderação pode responder.",
  unlock: "Tópico destrancado: as respostas estão liberadas de novo.",
} as const;

export async function moderateThreadAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { error: denied } = await gate("moderator");
  if (denied) return denied;

  const parsed = threadSchema.safeParse({ threadId: formData.get("threadId"), op: formData.get("op") });
  if (!parsed.success) return actionError(firstIssue(parsed.error));
  const { threadId, op } = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.rpc("moderate_thread", {
    p_thread_id: threadId,
    ...(op === "pin" || op === "unpin" ? { p_pinned: op === "pin" } : { p_locked: op === "lock" }),
  });
  if (error) return actionError(friendlyDbError(error, "Não conseguimos alterar o tópico. Tente de novo."));

  revalidateAdmin();
  revalidatePath("/forum", "layout");
  return { ok: true, message: THREAD_MESSAGES[op] };
}

const paperSchema = z.object({
  paperId: uuid("Paper"),
  hidden: z.enum(["true", "false"], { error: "Ação inválida." }).transform((v) => v === "true"),
});

export async function setPaperVisibility(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { error: denied } = await gate("moderator");
  if (denied) return denied;

  const parsed = paperSchema.safeParse({ paperId: formData.get("paperId"), hidden: formData.get("hidden") });
  if (!parsed.success) return actionError(firstIssue(parsed.error));
  const { paperId, hidden } = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.rpc("moderate_paper", { p_paper_id: paperId, p_hidden: hidden });
  if (error) return actionError(friendlyDbError(error, "Não conseguimos alterar a visibilidade do paper."));

  revalidateAdmin();
  revalidatePath("/papers", "layout");
  revalidatePath("/ranking");
  revalidatePath("/");
  return {
    ok: true,
    message: hidden
      ? "Paper ocultado da Vitrine e dos rankings. Quem enviou ainda consegue vê-lo."
      : "Paper visível de novo na Vitrine.",
  };
}

const deleteSchema = z.object({
  targetType: z.enum(["thread", "post", "paper", "paper_comment"], { error: "Tipo de conteúdo inválido." }),
  targetId: uuid("Conteúdo"),
  note: optionalNote,
});

const DELETE_LABELS = {
  thread: { table: "forum_threads", done: "Tópico excluído (as respostas também)." },
  post: { table: "forum_posts", done: "Resposta excluída." },
  paper: { table: "papers", done: "Paper excluído da Vitrine." },
  paper_comment: { table: "paper_comments", done: "Comentário excluído." },
} as const;

export async function deleteReportedContent(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { error: denied } = await gate("moderator");
  if (denied) return denied;

  const parsed = deleteSchema.safeParse({
    targetType: formData.get("targetType"),
    targetId: formData.get("targetId"),
    note: formData.get("note") ?? undefined,
  });
  if (!parsed.success) return actionError(firstIssue(parsed.error));
  const { targetType, targetId, note } = parsed.data;

  const supabase = await createClient();
  const table = DELETE_LABELS[targetType].table;

  // Para revalidar a página certa depois.
  let parentPath: string | null = null;
  // Conteúdo apagado em cascata junto com o alvo (respostas do tópico, comentários do paper):
  // as denúncias abertas sobre ele também são encerradas.
  let cascade: { type: DeletableTarget; ids: string[] } | null = null;
  if (targetType === "post") {
    const { data } = await supabase.from("forum_posts").select("thread_id").eq("id", targetId).maybeSingle();
    if (data) parentPath = `/forum/t/${data.thread_id}`;
  } else if (targetType === "paper_comment") {
    const { data } = await supabase.from("paper_comments").select("paper_id").eq("id", targetId).maybeSingle();
    if (data) parentPath = `/papers/${data.paper_id}`;
  } else if (targetType === "thread") {
    const { data } = await supabase.from("forum_posts").select("id").eq("thread_id", targetId);
    cascade = { type: "post", ids: (data ?? []).map((p) => p.id) };
  } else {
    const { data } = await supabase.from("paper_comments").select("id").eq("paper_id", targetId);
    cascade = { type: "paper_comment", ids: (data ?? []).map((c) => c.id) };
  }

  const { error, count } = await supabase.from(table).delete({ count: "exact" }).eq("id", targetId);
  if (error) return actionError(friendlyDbError(error, "Não conseguimos excluir o conteúdo. Tente de novo."));

  let closed = await resolveOpenReportsFor(
    supabase,
    targetType,
    [targetId],
    note ?? "Conteúdo excluído pela moderação.",
  );
  if (count && cascade) {
    closed += await resolveOpenReportsFor(
      supabase,
      cascade.type,
      cascade.ids,
      targetType === "thread"
        ? "Resposta removida junto com o tópico excluído pela moderação."
        : "Comentário removido junto com o paper excluído pela moderação.",
    );
  }

  revalidateAdmin();
  if (targetType === "thread" || targetType === "post") revalidatePath("/forum", "layout");
  if (targetType === "paper" || targetType === "paper_comment") {
    revalidatePath("/papers", "layout");
    revalidatePath("/ranking");
    revalidatePath("/");
  }
  if (parentPath) revalidatePath(parentPath);

  if (!count) {
    return {
      ok: true,
      message:
        closed > 0
          ? "O conteúdo já tinha sido removido. As denúncias abertas sobre ele foram encerradas."
          : "O conteúdo já tinha sido removido.",
    };
  }
  return {
    ok: true,
    message: `${DELETE_LABELS[targetType].done}${closed > 0 ? ` ${closed === 1 ? "A denúncia foi encerrada." : `${closed} denúncias foram encerradas.`}` : ""}`,
  };
}

// ---------------------------------------------------------------------------
// Revelar autoria anônima (somente admin, com justificativa auditada)
// ---------------------------------------------------------------------------

const revealSchema = z.object({
  reportId: uuid("Denúncia"),
  targetType: z.enum(["thread", "post"], { error: "Só é possível revelar autoria de tópicos e respostas." }),
  targetId: uuid("Conteúdo"),
  reason: z
    .string()
    .trim()
    .min(20, { error: "Explique o motivo com pelo menos 20 caracteres — ele fica registrado na denúncia." })
    .max(300, { error: "Use no máximo 300 caracteres." }),
  confirm: z.literal("on", { error: "Confirme que este é um caso grave e que o motivo ficará registrado." }),
});

export type RevealResult = { profileId: string; name: string };

export async function revealAnonymousAuthor(
  _prev: ActionState<RevealResult>,
  formData: FormData,
): Promise<ActionState<RevealResult>> {
  const { profile, error: denied } = await gate("admin");
  if (denied) return denied;

  const parsed = revealSchema.safeParse({
    reportId: formData.get("reportId"),
    targetType: formData.get("targetType"),
    targetId: formData.get("targetId"),
    reason: formData.get("reason") ?? "",
    confirm: formData.get("confirm") ?? undefined,
  });
  if (!parsed.success) {
    return actionError("Confira os campos destacados.", fieldErrors(parsed.error));
  }
  const { reportId, targetType, targetId, reason } = parsed.data;

  const supabase = await createClient();

  // A revelação precisa estar ligada a uma denúncia sobre ESTE conteúdo (trilha de auditoria).
  const report = await supabase
    .from("reports")
    .select("id, target_type, target_id, resolution_note")
    .eq("id", reportId)
    .maybeSingle();
  if (report.error) return actionError(friendlyDbError(report.error));
  if (!report.data || report.data.target_type !== targetType || report.data.target_id !== targetId) {
    return actionError("A denúncia não corresponde a este conteúdo. Recarregue a página.");
  }

  const { data: authorId, error: revealError } = await supabase.rpc(
    "reveal_anonymous_author",
    targetType === "thread" ? { p_thread_id: targetId } : { p_post_id: targetId },
  );
  if (revealError) return actionError(friendlyDbError(revealError, "Não conseguimos revelar a autoria."));
  if (!authorId) return actionError("Esta publicação não é anônima ou já foi removida.");

  // Registra a auditoria ANTES de mostrar a identidade: sem registro, nada é exibido.
  const auditLine = buildAuditLine({
    actorName: profile.full_name || "Administradora",
    action: targetType === "thread" ? "revelou a autoria do tópico anônimo" : "revelou a autoria da resposta anônima",
    reason,
  });
  const audit = await supabase
    .from("reports")
    .update({ resolution_note: appendAuditLine(report.data.resolution_note, auditLine) })
    .eq("id", reportId)
    .select("id")
    .maybeSingle();
  if (audit.error || !audit.data) {
    return actionError("Não conseguimos registrar a auditoria, então a autoria não foi exibida. Tente de novo.");
  }

  // Log do servidor sem nomes nem texto do motivo (só ids), para rastreabilidade.
  console.info("[moderacao] autoria anônima revelada", {
    report: reportId,
    target: `${targetType}:${targetId}`,
    by: profile.id,
    at: new Date().toISOString(),
  });

  const { data: author } = await supabase.from("profiles").select("id, full_name").eq("id", authorId).maybeSingle();
  revalidateAdmin();
  return {
    ok: true,
    message: "Autoria revelada e registrada na denúncia.",
    data: { profileId: authorId, name: author?.full_name?.trim() || "Perfil sem nome" },
  };
}

// ---------------------------------------------------------------------------
// Membros: troca de papel (somente admin)
// ---------------------------------------------------------------------------

const roleSchema = z.object({
  profileId: uuid("Perfil"),
  role: z.enum(["member", "moderator", "admin"], { error: "Escolha um papel válido." }),
});

export async function changeMemberRole(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { profile, error: denied } = await gate("admin");
  if (denied) return denied;

  const parsed = roleSchema.safeParse({ profileId: formData.get("profileId"), role: formData.get("role") });
  if (!parsed.success) return actionError(firstIssue(parsed.error));
  const { profileId, role } = parsed.data;

  if (profileId === profile.id) {
    return actionError("Você não pode alterar o seu próprio papel. Peça para outra administradora.");
  }
  if (!isAdminConfigured()) {
    return actionError("A chave de servidor do Supabase (SUPABASE_SECRET_KEY) não está configurada.");
  }

  const admin = createAdminClient();
  const target = await admin.from("profiles").select("id, full_name, role").eq("id", profileId).maybeSingle();
  if (target.error) return actionError(friendlyDbError(target.error));
  if (!target.data) return actionError("Perfil não encontrado.");
  if (target.data.role === role) return { ok: true, message: "Nada mudou: esse já era o papel dela." };

  if (target.data.role === "admin" && role !== "admin") {
    const { count } = await admin.from("profiles").select("id", { count: "exact", head: true }).eq("role", "admin");
    if ((count ?? 0) <= 1) return actionError("A plataforma precisa de pelo menos uma administradora.");
  }

  const { error } = await admin.from("profiles").update({ role }).eq("id", profileId);
  if (error) return actionError(friendlyDbError(error, "Não conseguimos alterar o papel. Tente de novo."));

  console.info("[admin] papel alterado", { profile: profileId, from: target.data.role, to: role, by: profile.id });
  revalidateAdmin();
  const name = target.data.full_name?.trim() || "A membra";
  return { ok: true, message: `${name} agora é ${ROLE_LABELS[role].toLowerCase()}.` };
}

// ---------------------------------------------------------------------------
// Newsletter (somente admin) — usa o serviço compartilhado com o cron (CONTRACT §11)
// ---------------------------------------------------------------------------

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "erro desconhecido";
}

export async function generateEditionAction(): Promise<ActionState> {
  const { error: denied } = await gate("admin");
  if (denied) return denied;

  try {
    const { edition, created } = await generateWeeklyEdition({ publish: true });
    revalidateAdmin();
    revalidatePath("/newsletter", "layout");
    revalidatePath("/");
    const title = edition?.title ? `“${edition.title}”` : "da semana";
    return {
      ok: true,
      message: created
        ? `Edição ${title} gerada e publicada. Revise antes de enviar.`
        : `A edição ${title} já existia — nada foi duplicado.`,
    };
  } catch (error) {
    console.error("[admin] falha ao gerar edição", errorMessage(error));
    return actionError("Não conseguimos gerar a edição agora. Confira os logs do servidor e tente de novo.");
  }
}

const editionSchema = z.object({ editionId: uuid("Edição") });

/** Publica um rascunho (ex.: de uma semana anterior), que passa a aparecer no arquivo e pode ser enviado. */
export async function publishEditionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { error: denied } = await gate("admin");
  if (denied) return denied;

  const parsed = editionSchema.safeParse({ editionId: formData.get("editionId") });
  if (!parsed.success) return actionError(firstIssue(parsed.error));

  // RLS: admins leem todas as edições. Só rascunhos são publicados (nunca "desenvia" uma edição enviada).
  const supabase = await createClient();
  const current = await supabase
    .from("newsletter_editions")
    .select("id, status")
    .eq("id", parsed.data.editionId)
    .maybeSingle();
  if (current.error) return actionError(friendlyDbError(current.error));
  if (!current.data) return actionError("Edição não encontrada. Recarregue a página.");
  if (current.data.status !== "draft") return { ok: true, message: "Esta edição já estava publicada." };

  try {
    const edition = await publishEdition(parsed.data.editionId);
    revalidateAdmin();
    revalidatePath("/newsletter", "layout");
    revalidatePath("/");
    return { ok: true, message: `Edição “${edition.title}” publicada no arquivo. Agora você pode enviá-la.` };
  } catch (error) {
    console.error("[admin] falha ao publicar edição", errorMessage(error));
    return actionError("Não conseguimos publicar a edição agora. Tente de novo em instantes.");
  }
}

export type SendSummary = { dryRun: boolean; sent: number; skipped: number; failed: number; reason?: string };

const sendSchema = z.object({
  editionId: uuid("Edição"),
  mode: z.enum(["preview", "send"], { error: "Ação inválida." }),
});

export async function sendEditionAction(
  _prev: ActionState<SendSummary>,
  formData: FormData,
): Promise<ActionState<SendSummary>> {
  const { error: denied } = await gate("admin");
  if (denied) return denied;

  const parsed = sendSchema.safeParse({ editionId: formData.get("editionId"), mode: formData.get("mode") });
  if (!parsed.success) return actionError(firstIssue(parsed.error));
  const { editionId, mode } = parsed.data;
  const dryRun = mode === "preview";

  try {
    const result = await sendEdition(editionId, { dryRun });
    const summary: SendSummary = {
      dryRun,
      sent: result.sent,
      skipped: result.skipped,
      failed: result.failed,
      reason: result.reason,
    };
    if (!dryRun) {
      revalidateAdmin();
      revalidatePath("/newsletter", "layout");
    }
    const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
    const message = dryRun
      ? summary.sent > 0
        ? `Prévia: ${plural(summary.sent, "e-mail seria enviado", "e-mails seriam enviados")}.`
        : "Prévia: nenhuma inscrita receberia esta edição agora."
      : `Envio concluído: ${plural(summary.sent, "enviado", "enviados")}, ${plural(summary.skipped, "pulado", "pulados")}, ${plural(summary.failed, "falha", "falhas")}.`;
    return { ok: true, message, data: summary };
  } catch (error) {
    console.error("[admin] falha no envio da edição", errorMessage(error));
    return actionError(
      "O envio foi interrompido. Tente de novo: quem já recebeu esta edição não recebe outra vez.",
    );
  }
}
