/**
 * Estado do reconhecimento de cada mentoria concluída, do ponto de vista da usuária logada
 * (puro, testado): retorno enviado? e em que pé está a declaração? Também monta as pendências
 * do /painel (retornos a contar e declarações esperando a autorização dela).
 */
import type { FeedbackRole } from "./outcomes";

/** Colunas lidas de mentorship_declarations (o RLS só devolve as das participantes). */
export const DECLARATION_COLUMNS =
  "id, request_id, code, requested_by, mentee_consented_at, mentor_consented_at, issued_at, revoked_at, revoked_by, revoke_reason, created_at";

export interface DeclarationRow {
  id: string;
  request_id: string;
  code: string;
  requested_by: string | null;
  mentee_consented_at: string | null;
  mentor_consented_at: string | null;
  issued_at: string | null;
  revoked_at: string | null;
  revoked_by: string | null;
  revoke_reason: string | null;
  created_at: string;
}

/**
 * - `awaiting-me`: a outra pediu; falta a autorização dela (usuária logada);
 * - `awaiting-other`: ela já autorizou; falta a outra;
 * - `issued`: emitida (pública em /verificar);
 * - `revoked`: revogada depois de emitida;
 * - `cancelled`: pedido revogado antes de ser emitido.
 */
export type DeclarationStatus =
  "awaiting-me" | "awaiting-other" | "issued" | "revoked" | "cancelled";

export interface DeclarationView {
  id: string;
  code: string;
  status: DeclarationStatus;
  requestedByMe: boolean;
  revokedByMe: boolean;
  issuedAt: string | null;
  revokedAt: string | null;
  revokeReason: string | null;
  createdAt: string;
}

export interface RecognitionState {
  /** Quando a mentoria foi concluída (null se não deu para saber). */
  completedAt: string | null;
  feedbackSent: boolean;
  /** A declaração mais recente da mentoria (ou null se nunca pediram). */
  declaration: DeclarationView | null;
}

/** Visão da declaração para quem está logada (`role` = papel dela; `otherId` = a outra). */
export function toDeclarationView(
  row: DeclarationRow,
  role: FeedbackRole,
  otherId: string,
): DeclarationView {
  const mine = role === "mentee" ? row.mentee_consented_at : row.mentor_consented_at;
  let status: DeclarationStatus;
  if (row.revoked_at) status = row.issued_at ? "revoked" : "cancelled";
  else if (row.issued_at) status = "issued";
  else status = mine ? "awaiting-other" : "awaiting-me";
  return {
    id: row.id,
    code: row.code,
    status,
    requestedByMe: row.requested_by !== null && row.requested_by !== otherId,
    revokedByMe: row.revoked_by !== null && row.revoked_by !== otherId,
    issuedAt: row.issued_at,
    revokedAt: row.revoked_at,
    revokeReason: row.revoke_reason,
    createdAt: row.created_at,
  };
}

/** A mais recente (created_at) entre as declarações de uma mentoria. */
export function latestDeclaration<T extends Pick<DeclarationRow, "created_at" | "revoked_at">>(
  rows: readonly T[],
): T | null {
  let best: T | null = null;
  for (const row of rows) {
    // Uma ativa (não revogada) sempre ganha; entre iguais, a mais nova.
    if (
      !best ||
      (best.revoked_at !== null && row.revoked_at === null) ||
      ((best.revoked_at === null) === (row.revoked_at === null) && row.created_at > best.created_at)
    ) {
      best = row;
    }
  }
  return best;
}

export interface RecognitionTarget {
  id: string;
  role: FeedbackRole;
  otherId: string;
}

/** Junta as duas consultas em lote (retornos dela + declarações) por mentoria. */
export function buildRecognitionStates(
  targets: readonly RecognitionTarget[],
  feedbackRequestIds: Iterable<string>,
  declarations: readonly DeclarationRow[],
  completedAt: ReadonlyMap<string, string | null> = new Map(),
): Map<string, RecognitionState> {
  const sent = new Set(feedbackRequestIds);
  const byRequest = new Map<string, DeclarationRow[]>();
  for (const row of declarations) {
    const list = byRequest.get(row.request_id) ?? [];
    list.push(row);
    byRequest.set(row.request_id, list);
  }
  const out = new Map<string, RecognitionState>();
  for (const target of targets) {
    const latest = latestDeclaration(byRequest.get(target.id) ?? []);
    out.set(target.id, {
      completedAt: completedAt.get(target.id) ?? null,
      feedbackSent: sent.has(target.id),
      declaration: latest ? toDeclarationView(latest, target.role, target.otherId) : null,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Pendências (/painel)
// ---------------------------------------------------------------------------

/** O lembrete de retorno some depois deste prazo: o retorno é opcional, não uma cobrança. */
export const FEEDBACK_REMINDER_DAYS = 30;

export interface CompletedMentorshipRow {
  id: string;
  role: FeedbackRole;
  otherId: string;
  otherName: string;
  completedAt: string | null;
}

export type RecognitionTodo =
  | { kind: "feedback"; requestId: string; otherName: string; completedAt: string | null }
  | { kind: "consent"; requestId: string; declarationId: string; otherName: string };

export function buildRecognitionTodos(input: {
  completed: readonly CompletedMentorshipRow[];
  feedbackRequestIds: Iterable<string>;
  declarations: readonly DeclarationRow[];
  now: Date;
}): RecognitionTodo[] {
  const sent = new Set(input.feedbackRequestIds);
  const cutoff = input.now.getTime() - FEEDBACK_REMINDER_DAYS * 24 * 60 * 60 * 1000;
  const consents: RecognitionTodo[] = [];
  const feedback: RecognitionTodo[] = [];
  const states = buildRecognitionStates(
    input.completed.map((c) => ({ id: c.id, role: c.role, otherId: c.otherId })),
    [],
    input.declarations,
  );
  for (const mentorship of input.completed) {
    const declaration = states.get(mentorship.id)?.declaration;
    if (declaration?.status === "awaiting-me") {
      consents.push({
        kind: "consent",
        requestId: mentorship.id,
        declarationId: declaration.id,
        otherName: mentorship.otherName,
      });
    }
    const completedAt = mentorship.completedAt ? Date.parse(mentorship.completedAt) : NaN;
    if (!sent.has(mentorship.id) && Number.isFinite(completedAt) && completedAt >= cutoff) {
      feedback.push({
        kind: "feedback",
        requestId: mentorship.id,
        otherName: mentorship.otherName,
        completedAt: mentorship.completedAt,
      });
    }
  }
  // Autorizações primeiro: alguém está esperando por ela.
  return [...consents, ...feedback];
}
