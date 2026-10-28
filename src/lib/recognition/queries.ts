import "server-only";
import { cache } from "react";
import { z } from "zod";
import {
  PERSON_COLUMNS,
  toPerson,
  type Person,
  type PersonRow,
  type ServerClient,
} from "@/lib/mentorship/queries";
import { createClient } from "@/lib/supabase/server";
import { isDeclarationCode } from "./code";
import { parseImpact, type ImpactData } from "./impact";
import type { FeedbackRole } from "./outcomes";
import {
  DECLARATION_COLUMNS,
  buildRecognitionStates,
  buildRecognitionTodos,
  latestDeclaration,
  toDeclarationView,
  type DeclarationRow,
  type DeclarationView,
  type RecognitionState,
  type RecognitionTarget,
  type RecognitionTodo,
} from "./state";

/**
 * Leituras do reconhecimento, sempre com o cliente da sessão (RLS): o retorno só volta para a
 * autora; declarações e pedidos, só para as participantes. A verificação pública e o impacto
 * agregado vêm de RPCs SECURITY DEFINER que devolvem apenas o que pode ser público.
 */

function warn(what: string, error: { code?: string; message: string }) {
  console.warn(`[reconhecimento] ${what} — ${error.code ?? ""} ${error.message.slice(0, 160)}`);
}

// ---------------------------------------------------------------------------
// Cartões de "Mentorias concluídas" (/mentoria?aba=ativas): duas consultas em lote
// ---------------------------------------------------------------------------

export async function loadRecognitionStates(
  supabase: ServerClient,
  targets: readonly RecognitionTarget[],
): Promise<Map<string, RecognitionState> | null> {
  const ids = [...new Set(targets.map((t) => t.id))];
  if (ids.length === 0) return new Map();
  const [feedback, declarations, dates] = await Promise.all([
    // RLS: só os retornos DELA voltam (o da outra participante nunca).
    supabase.from("mentorship_feedback").select("request_id").in("request_id", ids),
    supabase
      .from("mentorship_declarations")
      .select(DECLARATION_COLUMNS)
      .in("request_id", ids)
      .order("created_at", { ascending: false }),
    supabase.from("mentorship_requests").select("id, completed_at").in("id", ids),
  ]);
  if (feedback.error || declarations.error) {
    if (feedback.error) warn("retornos (lote)", feedback.error);
    if (declarations.error) warn("declarações (lote)", declarations.error);
    return null;
  }
  if (dates.error) warn("datas de conclusão (lote)", dates.error);
  return buildRecognitionStates(
    targets,
    (feedback.data ?? []).map((row) => row.request_id),
    (declarations.data ?? []) as DeclarationRow[],
    new Map((dates.data ?? []).map((row) => [row.id, row.completed_at])),
  );
}

// ---------------------------------------------------------------------------
// /mentoria/concluida/[id]
// ---------------------------------------------------------------------------

export interface MyFeedback {
  helpfulness: number;
  outcomes: string[];
  would_recommend: boolean | null;
  note: string | null;
  created_at: string;
}

export interface Completion {
  request: {
    id: string;
    responded_at: string | null;
    completed_at: string | null;
    created_at: string;
  };
  role: FeedbackRole;
  other: Person;
  feedback: MyFeedback | null;
  declaration: DeclarationView | null;
}

export type CompletionResult =
  | { kind: "ok"; completion: Completion }
  | { kind: "not-completed" }
  | { kind: "not-found" }
  | { kind: "error" };

/** Mentoria concluída de uma participante (cache por requisição: metadata + página). */
export const getCompletion = cache(
  async (requestId: string, userId: string): Promise<CompletionResult> => {
    const supabase = await createClient();
    const { data: row, error } = await supabase
      .from("mentorship_requests")
      .select(
        `id, status, mentee_id, mentor_id, created_at, responded_at, completed_at,
         mentee:profiles!mentorship_requests_mentee_id_fkey(${PERSON_COLUMNS}),
         mentor:profiles!mentorship_requests_mentor_id_fkey(${PERSON_COLUMNS})`,
      )
      .eq("id", requestId)
      .maybeSingle();
    if (error) {
      warn("mentoria concluída", error);
      return { kind: "error" };
    }
    if (!row || (row.mentee_id !== userId && row.mentor_id !== userId)) {
      return { kind: "not-found" };
    }
    if (row.status !== "completed") return { kind: "not-completed" };

    const role: FeedbackRole = row.mentee_id === userId ? "mentee" : "mentor";
    const otherId = role === "mentee" ? row.mentor_id : row.mentee_id;
    const otherRow = (role === "mentee" ? row.mentor : row.mentee) as PersonRow | null;

    const [feedback, declarations] = await Promise.all([
      supabase
        .from("mentorship_feedback")
        .select("helpfulness, outcomes, would_recommend, note, created_at")
        .eq("request_id", requestId)
        .eq("author_id", userId)
        .maybeSingle(),
      supabase
        .from("mentorship_declarations")
        .select(DECLARATION_COLUMNS)
        .eq("request_id", requestId)
        .order("created_at", { ascending: false }),
    ]);
    if (feedback.error || declarations.error) {
      if (feedback.error) warn("retorno", feedback.error);
      if (declarations.error) warn("declarações", declarations.error);
      return { kind: "error" };
    }
    const latest = latestDeclaration((declarations.data ?? []) as DeclarationRow[]);
    return {
      kind: "ok",
      completion: {
        request: {
          id: row.id,
          responded_at: row.responded_at,
          completed_at: row.completed_at,
          created_at: row.created_at,
        },
        role,
        other: toPerson(otherRow, otherId),
        feedback: feedback.data
          ? {
              helpfulness: feedback.data.helpfulness,
              outcomes: feedback.data.outcomes ?? [],
              would_recommend: feedback.data.would_recommend,
              note: feedback.data.note,
              created_at: feedback.data.created_at,
            }
          : null,
        declaration: latest ? toDeclarationView(latest, role, otherId) : null,
      },
    };
  },
);

// ---------------------------------------------------------------------------
// Verificação pública (/verificar/[codigo]) e a folha da declaração
// ---------------------------------------------------------------------------

const verificationRow = z.object({
  status: z.enum(["valida", "revogada"]),
  mentee_name: z.string().nullable(),
  mentor_name: z.string().nullable(),
  period_start: z.string().nullable(),
  period_end: z.string().nullable(),
  themes: z.array(z.string()).nullable(),
  issued_at: z.string().nullable(),
});

export type Verification =
  | {
      status: "valida";
      menteeName: string;
      mentorName: string;
      periodStart: string | null;
      periodEnd: string | null;
      themes: string[];
      issuedAt: string | null;
    }
  | { status: "revogada"; issuedAt: string | null };

export type VerificationResult =
  { kind: "found"; verification: Verification } | { kind: "not-found" } | { kind: "error" };

/** Só aceita códigos canônicos (a página normaliza antes; formato inválido nem chega aqui). */
export const verifyDeclaration = cache(async (code: string): Promise<VerificationResult> => {
  if (!isDeclarationCode(code)) return { kind: "not-found" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("verify_mentorship_declaration", { p_code: code });
  if (error) {
    warn("verificação", error);
    return { kind: "error" };
  }
  const parsed = verificationRow.safeParse((data ?? [])[0]);
  if (!parsed.success) return { kind: "not-found" };
  const row = parsed.data;
  if (row.status === "revogada") {
    return { kind: "found", verification: { status: "revogada", issuedAt: row.issued_at } };
  }
  return {
    kind: "found",
    verification: {
      status: "valida",
      menteeName: row.mentee_name ?? "",
      mentorName: row.mentor_name ?? "",
      periodStart: row.period_start,
      periodEnd: row.period_end,
      themes: row.themes ?? [],
      issuedAt: row.issued_at,
    },
  };
});

export interface DeclarationSheet {
  id: string;
  code: string;
  requestId: string;
  role: FeedbackRole;
  menteeName: string;
  mentorName: string;
  periodStart: string | null;
  periodEnd: string | null;
  themes: string[];
  issuedAt: string;
}

export type DeclarationSheetResult =
  { kind: "ok"; sheet: DeclarationSheet } | { kind: "not-found" } | { kind: "error" };

/**
 * A declaração emitida (e não revogada) de uma participante. O conteúdo vem da MESMA RPC da
 * verificação pública: o que se imprime é exatamente o que /verificar mostra.
 */
export const getDeclarationSheet = cache(
  async (declarationId: string, userId: string): Promise<DeclarationSheetResult> => {
    const supabase = await createClient();
    const { data: row, error } = await supabase
      .from("mentorship_declarations")
      .select(
        "id, code, request_id, issued_at, revoked_at, request:mentorship_requests(mentee_id, mentor_id)",
      )
      .eq("id", declarationId)
      .maybeSingle();
    if (error) {
      warn("declaração", error);
      return { kind: "error" };
    }
    const request = row?.request as { mentee_id: string; mentor_id: string } | null | undefined;
    if (!row || !request || (request.mentee_id !== userId && request.mentor_id !== userId)) {
      return { kind: "not-found" };
    }
    if (!row.issued_at || row.revoked_at) return { kind: "not-found" };

    const verification = await verifyDeclaration(row.code);
    if (verification.kind === "error") return { kind: "error" };
    if (verification.kind !== "found" || verification.verification.status !== "valida") {
      return { kind: "not-found" };
    }
    const v = verification.verification;
    return {
      kind: "ok",
      sheet: {
        id: row.id,
        code: row.code,
        requestId: row.request_id,
        role: request.mentee_id === userId ? "mentee" : "mentor",
        menteeName: v.menteeName,
        mentorName: v.mentorName,
        periodStart: v.periodStart,
        periodEnd: v.periodEnd,
        themes: v.themes,
        issuedAt: v.issuedAt ?? row.issued_at,
      },
    };
  },
);

// ---------------------------------------------------------------------------
// Impacto agregado (landing, /mentoria/concluida)
// ---------------------------------------------------------------------------

export async function loadImpact(): Promise<ImpactData | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_mentorship_impact");
  if (error) {
    warn("impacto", error);
    return null;
  }
  return parseImpact(data);
}

// ---------------------------------------------------------------------------
// Pendências do /painel
// ---------------------------------------------------------------------------

const TODO_LIMIT = 50;

export async function loadRecognitionTodos(
  supabase: ServerClient,
  userId: string,
  now: Date = new Date(),
): Promise<RecognitionTodo[]> {
  // O id entra num filtro .or() do PostgREST: só um UUID de verdade (nada de vírgulas/parênteses).
  if (!z.guid().safeParse(userId).success) return [];
  const { data: rows, error } = await supabase
    .from("mentorship_requests")
    .select(
      `id, mentee_id, mentor_id, completed_at,
       mentee:profiles!mentorship_requests_mentee_id_fkey(full_name),
       mentor:profiles!mentorship_requests_mentor_id_fkey(full_name)`,
    )
    .eq("status", "completed")
    .or(`mentee_id.eq.${userId},mentor_id.eq.${userId}`)
    .order("completed_at", { ascending: false, nullsFirst: false })
    .limit(TODO_LIMIT);
  if (error) {
    warn("pendências (mentorias)", error);
    return [];
  }
  const completed = (rows ?? []).map((row) => {
    const role: FeedbackRole = row.mentee_id === userId ? "mentee" : "mentor";
    const other = (role === "mentee" ? row.mentor : row.mentee) as { full_name: string } | null;
    return {
      id: row.id,
      role,
      otherId: role === "mentee" ? row.mentor_id : row.mentee_id,
      otherName: other?.full_name?.trim() || "Pesquisadora",
      completedAt: row.completed_at,
    };
  });
  if (completed.length === 0) return [];

  const ids = completed.map((c) => c.id);
  const [feedback, declarations] = await Promise.all([
    supabase
      .from("mentorship_feedback")
      .select("request_id")
      .eq("author_id", userId)
      .in("request_id", ids),
    supabase
      .from("mentorship_declarations")
      .select(DECLARATION_COLUMNS)
      .in("request_id", ids)
      .is("revoked_at", null),
  ]);
  if (feedback.error || declarations.error) {
    if (feedback.error) warn("pendências (retornos)", feedback.error);
    if (declarations.error) warn("pendências (declarações)", declarations.error);
    return [];
  }
  return buildRecognitionTodos({
    completed,
    feedbackRequestIds: (feedback.data ?? []).map((row) => row.request_id),
    declarations: (declarations.data ?? []) as DeclarationRow[],
    now,
  });
}
