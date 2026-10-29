/**
 * Registro de auditoria da moderação (`public.moderation_audit_log`) — rótulos e regras puras.
 *
 * O registro é gravado pelo banco nas RPCs de moderação (revelar autoria, fixar/trancar,
 * ocultar paper, publicar/recusar perguntas e ocultar/reexibir respostas do Pergunte a uma
 * cientista) e ao resolver/arquivar denúncias (trigger), e pelo painel ao excluir
 * conteúdo e trocar papéis. Só moderadoras e admins leem; ninguém edita nem apaga pela API.
 * Ele substitui as antigas linhas "[Auditoria] …" em `reports.resolution_note`, que é uma
 * nota VISÍVEL para quem denunciou.
 */

export const AUDIT_ACTIONS = [
  "reveal_author",
  "hide_paper",
  "unhide_paper",
  "lock_thread",
  "unlock_thread",
  "pin_thread",
  "unpin_thread",
  "delete_content",
  "resolve_report",
  "dismiss_report",
  "change_role",
  // Pergunte a uma cientista (migration 20261028190100_public_questions.sql)
  "publish_question",
  "reject_question",
  "hide_answer",
  "unhide_answer",
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const AUDIT_TARGET_TYPES = [
  "thread",
  "post",
  "paper",
  "paper_comment",
  "profile",
  "report",
  "public_question",
  "public_answer",
  "feed_post",
  "feed_comment",
  "opportunity",
] as const;

export type AuditTargetType = (typeof AUDIT_TARGET_TYPES)[number];

/** Frase curta no passado, usada como "<quem> <ação>". */
export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  reveal_author: "revelou a autoria",
  hide_paper: "ocultou o paper",
  unhide_paper: "reexibiu o paper",
  lock_thread: "trancou o tópico",
  unlock_thread: "destrancou o tópico",
  pin_thread: "fixou o tópico",
  unpin_thread: "desafixou o tópico",
  delete_content: "excluiu o conteúdo",
  resolve_report: "resolveu a denúncia",
  dismiss_report: "arquivou a denúncia",
  change_role: "alterou o papel",
  publish_question: "publicou a pergunta",
  reject_question: "não publicou a pergunta",
  hide_answer: "ocultou a resposta",
  unhide_answer: "reexibiu a resposta",
};

export const AUDIT_TARGET_LABELS: Record<AuditTargetType, string> = {
  thread: "Tópico do fórum",
  post: "Resposta no fórum",
  paper: "Paper da Vitrine",
  paper_comment: "Comentário em paper",
  profile: "Perfil",
  report: "Denúncia",
  public_question: "Pergunta pública",
  public_answer: "Resposta pública",
  feed_post: "Publicação do feed",
  feed_comment: "Comentário no feed",
  opportunity: "Vaga de IC",
};

/** Ações que merecem destaque visual (afetam a privacidade ou o papel de alguém). */
export const SENSITIVE_AUDIT_ACTIONS: ReadonlySet<AuditAction> = new Set([
  "reveal_author",
  "change_role",
]);

export function isAuditAction(value: unknown): value is AuditAction {
  return typeof value === "string" && (AUDIT_ACTIONS as readonly string[]).includes(value);
}

export function isAuditTargetType(value: unknown): value is AuditTargetType {
  return typeof value === "string" && (AUDIT_TARGET_TYPES as readonly string[]).includes(value);
}

/**
 * Link para o alvo (quando existe uma página dele). Respostas e comentários não têm página
 * própria sem o id do tópico/paper, então ficam sem link. Uma pergunta pública leva à página dela
 * (404 se ainda não foi publicada ou se quem perguntou a apagou); uma resposta pública leva à fila
 * da moderação, onde aparece com a autora.
 */
export function auditTargetHref(type: AuditTargetType | null, id: string | null): string | null {
  if (!type || !id) return null;
  switch (type) {
    case "thread":
      return `/forum/t/${id}`;
    case "paper":
      return `/papers/${id}`;
    case "profile":
      return `/pesquisadoras/${id}`;
    case "public_question":
      return `/pergunte/${id}`;
    case "public_answer":
      return "/admin?aba=perguntas";
    case "feed_post":
      return `/feed/p/${id}`;
    case "opportunity":
      return `/ics/${id}`;
    default:
      return null;
  }
}

/** Limite da coluna `moderation_audit_log.reason`. */
export const AUDIT_REASON_MAX = 500;

/** Motivo pronto para gravar: espaços normalizados, cortado no limite; vazio → null. */
export function cleanAuditReason(
  reason: string | null | undefined,
  max: number = AUDIT_REASON_MAX,
): string | null {
  const text = (reason ?? "").replace(/\s+/g, " ").trim();
  if (!text) return null;
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

/** Limite da coluna `reports.resolution_note` (check no banco). */
export const RESOLUTION_NOTE_MAX = 1000;

/**
 * Acrescenta uma frase à nota visível para quem denunciou (ex.: fechamento automático depois
 * de excluir o conteúdo), sem repetir a mesma frase e respeitando o limite da coluna.
 */
export function appendToResolutionNote(
  existing: string | null | undefined,
  addition: string,
  max: number = RESOLUTION_NOTE_MAX,
): string | null {
  const current = (existing ?? "").trim();
  const extra = addition.trim();
  if (!extra) return current || null;
  if (current.split(/\r?\n/).some((line) => line.trim() === extra)) return current;
  const merged = current ? `${current}\n${extra}` : extra;
  return merged.length > max ? `${merged.slice(0, max - 1).trimEnd()}…` : merged;
}
