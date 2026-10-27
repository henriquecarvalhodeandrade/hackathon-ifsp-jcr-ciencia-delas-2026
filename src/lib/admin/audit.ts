import { formatDateTime } from "@/lib/utils";

/**
 * Trilha de auditoria guardada na própria denúncia (`reports.resolution_note`).
 *
 * Ações sensíveis da moderação — como revelar a autoria de uma publicação anônima —
 * acrescentam uma linha "[Auditoria] …" na nota da denúncia. Essas linhas são
 * preservadas quando a moderação reescreve a nota ao resolver/arquivar.
 * (Proposta de tabela dedicada `moderation_audit_log` em docs/09.)
 */

export const AUDIT_PREFIX = "[Auditoria]";
/** Limite da coluna `reports.resolution_note` (check no banco). */
export const RESOLUTION_NOTE_MAX = 1000;

export interface AuditLineInput {
  actorName: string;
  action: string;
  reason: string;
  at?: Date;
}

/** Ex.: "[Auditoria] 27/10/2026, 14:05 — Helena Duarte: revelou a autoria do tópico. Motivo: …" */
export function buildAuditLine({ actorName, action, reason, at = new Date() }: AuditLineInput): string {
  const clean = (text: string) => text.replace(/\s+/g, " ").trim();
  const actor = clean(actorName) || "Moderação";
  return `${AUDIT_PREFIX} ${formatDateTime(at)} — ${actor}: ${clean(action)}. Motivo: ${clean(reason)}`;
}

export function splitResolutionNote(note: string | null | undefined): { audit: string[]; text: string } {
  const lines = (note ?? "").split(/\r?\n/);
  const audit: string[] = [];
  const text: string[] = [];
  for (const line of lines) {
    if (line.trimStart().startsWith(AUDIT_PREFIX)) audit.push(line.trim());
    else text.push(line);
  }
  return { audit, text: text.join("\n").trim() };
}

function fit(audit: string[], text: string, max: number): string | null {
  // Mantém as linhas de auditoria mais recentes que couberem.
  const kept = [...audit];
  while (kept.join("\n").length > max && kept.length > 0) kept.shift();
  const auditBlock = kept.join("\n");
  const room = max - auditBlock.length - (auditBlock && text ? 2 : 0);
  const body = room > 0 ? (text.length > room ? `${text.slice(0, Math.max(0, room - 1)).trimEnd()}…` : text) : "";
  const result = [body, auditBlock].filter(Boolean).join("\n\n");
  return result || null;
}

/** Nova nota escrita pela moderação + linhas de auditoria já existentes (sempre no fim). */
export function mergeResolutionNote(
  existing: string | null | undefined,
  nextText: string | null | undefined,
  max: number = RESOLUTION_NOTE_MAX,
): string | null {
  const { audit } = splitResolutionNote(existing);
  return fit(audit, (nextText ?? "").trim(), max);
}

/** Acrescenta uma linha de auditoria, preservando o texto livre da nota. */
export function appendAuditLine(
  existing: string | null | undefined,
  line: string,
  max: number = RESOLUTION_NOTE_MAX,
): string {
  const { audit, text } = splitResolutionNote(existing);
  return fit([...audit, line.trim()], text, max) ?? line.slice(0, max);
}
