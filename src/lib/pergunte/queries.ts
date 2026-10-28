import "server-only";
import { cache } from "react";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { CareerStage } from "@/lib/constants";
import type { Database } from "@/lib/database.types";
import { env } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { truncate } from "@/lib/utils";
import { isQuestionStage, isRejectReason, type QuestionStage, type RejectReason } from "./labels";
import { QUESTIONS_PAGE_SIZE } from "./params";
import { isTrackingToken } from "./token";

/**
 * Leituras do "Pergunte a uma cientista" (docs/16). Tudo passa pelo RLS e pelas RPCs
 * SECURITY DEFINER da migration 20261028190100_public_questions.sql:
 * - listas e respostas públicas: RPCs que nunca devolvem author_id;
 * - acompanhamento/exclusão pelo link: cliente SEM sessão (nem a conta de quem está logada
 *   chega ao banco junto com a pergunta);
 * - fila da moderação: cliente com a sessão (RLS: só moderação lê pendentes e respostas alheias).
 */

/**
 * Cliente anônimo (chave publicável, sem cookies e sem sessão). Usado para enviar, acompanhar e
 * apagar perguntas: o banco recebe a chamada do servidor do app, nunca da estudante — sem IP,
 * sem conta, sem nada que a identifique.
 */
export function createAnonymousClient() {
  return createSupabaseClient<Database>(env.supabaseUrl!, env.supabasePublishableKey!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

/** O gerador de tipos marca colunas de RPC como não nulas; aqui elas podem vir NULL. */
type Nullable<T> = { [K in keyof T]: T[K] | null };

function toStage(value: string | null | undefined): QuestionStage | null {
  return isQuestionStage(value) ? value : null;
}

// ---------------------------------------------------------------------------
// Áreas (grandes áreas do CNPq: linhas em que name = big_area)
// ---------------------------------------------------------------------------

export interface BigArea {
  id: number;
  name: string;
}

/** Grandes áreas para o formulário e os filtros (memoizado por requisição). */
export const listBigAreas = cache(async (): Promise<BigArea[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("research_areas")
    .select("id, name, big_area")
    .order("name");
  if (error) {
    console.error("[pergunte] falha ao listar áreas", error.code);
    return [];
  }
  return (data ?? [])
    .filter((area) => area.name === area.big_area)
    .map((area) => ({ id: area.id, name: area.name }));
});

function areaName(areas: readonly BigArea[], id: number | null): string | null {
  if (id == null) return null;
  return areas.find((area) => area.id === id)?.name ?? null;
}

// ---------------------------------------------------------------------------
// Listas públicas
// ---------------------------------------------------------------------------

export type QuestionListFilter = "respondidas" | "sem_resposta" | "todas";

export interface QuestionSummary {
  id: string;
  body: string;
  stage: QuestionStage | null;
  areaId: number | null;
  areaName: string | null;
  publishedAt: string;
  answerCount: number;
}

export interface QuestionsPage {
  questions: QuestionSummary[];
  total: number;
  totalPages: number;
  /** Página realmente exibida (uma página além do fim cai na última). */
  page: number;
  error: boolean;
}

type ListRow = Nullable<
  Database["public"]["Functions"]["list_public_questions"]["Returns"][number]
>;

export async function listPublicQuestions({
  filter,
  stage = null,
  areaId = null,
  page: requestedPage = 1,
  pageSize = QUESTIONS_PAGE_SIZE,
}: {
  filter: QuestionListFilter;
  stage?: QuestionStage | null;
  areaId?: number | null;
  page?: number;
  pageSize?: number;
}): Promise<QuestionsPage> {
  const supabase = await createClient();
  const areas = await listBigAreas();
  const run = (page: number) =>
    supabase.rpc("list_public_questions", {
      p_filter: filter,
      p_stage: stage ?? undefined,
      p_area_id: areaId ?? undefined,
      p_limit: pageSize,
      p_offset: (page - 1) * pageSize,
    });

  let page = Math.max(1, requestedPage);
  let result = await run(page);
  // Página além do fim (ex.: ?pagina=99): descobre o total e mostra a última.
  if (!result.error && (result.data ?? []).length === 0 && page > 1) {
    const probe = await run(1);
    const total = Number((probe.data as ListRow[] | null)?.[0]?.total_count ?? 0);
    page = Math.max(1, Math.ceil(total / pageSize));
    result = page === 1 ? probe : await run(page);
  }
  if (result.error) {
    console.error("[pergunte] falha ao listar perguntas", result.error.code);
    return { questions: [], total: 0, totalPages: 0, page, error: true };
  }

  const rows = (result.data ?? []) as ListRow[];
  const total = Number(rows[0]?.total_count ?? 0);
  return {
    questions: rows.map((row) => ({
      id: row.id ?? "",
      body: row.body ?? "",
      stage: toStage(row.stage),
      areaId: row.area_id ?? null,
      areaName: areaName(areas, row.area_id ?? null),
      publishedAt: row.published_at ?? "",
      answerCount: row.answer_count ?? 0,
    })),
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    page,
    error: false,
  };
}

/** Até `limit` perguntas publicadas ainda sem resposta (cartão do /painel e da /pergunte). */
export async function listAwaitingQuestions(limit = 3): Promise<QuestionSummary[] | null> {
  const result = await listPublicQuestions({ filter: "sem_resposta", pageSize: limit });
  return result.error ? null : result.questions;
}

// ---------------------------------------------------------------------------
// Uma pergunta publicada e as respostas
// ---------------------------------------------------------------------------

export interface PublishedQuestion {
  id: string;
  body: string;
  stage: QuestionStage | null;
  areaId: number | null;
  areaName: string | null;
  publishedAt: string;
}

/** Pergunta publicada (null quando não existe ou ainda não foi publicada — inclusive para a moderação). */
export const getPublishedQuestion = cache(async (id: string): Promise<PublishedQuestion | null> => {
  const supabase = await createClient();
  const [{ data, error }, areas] = await Promise.all([
    supabase
      .from("public_questions")
      .select("id, body, stage, area_id, published_at, status")
      .eq("id", id)
      .eq("status", "published")
      .maybeSingle(),
    listBigAreas(),
  ]);
  if (error) {
    console.error("[pergunte] falha ao carregar pergunta", error.code);
    return null;
  }
  if (!data || !data.published_at) return null;
  return {
    id: data.id,
    body: data.body,
    stage: toStage(data.stage),
    areaId: data.area_id,
    areaName: areaName(areas, data.area_id),
    publishedAt: data.published_at,
  };
});

export interface PublicAnswerView {
  id: string;
  body: string;
  createdAt: string;
  name: string | null;
  stage: CareerStage | null;
  isMentor: boolean | null;
  isMine: boolean;
}

type AnswerRow = Nullable<
  Database["public"]["Functions"]["list_public_answers"]["Returns"][number]
>;

/** Respostas visíveis (mais antigas primeiro). null = falha ao carregar. */
export async function listPublicAnswers(questionId: string): Promise<PublicAnswerView[] | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_public_answers", { p_question_id: questionId });
  if (error) {
    console.error("[pergunte] falha ao listar respostas", error.code);
    return null;
  }
  return ((data ?? []) as AnswerRow[]).map((row) => ({
    id: row.id ?? "",
    body: row.body ?? "",
    createdAt: row.created_at ?? "",
    name: row.author_name ?? null,
    stage: row.author_stage ?? null,
    isMentor: row.author_is_mentor ?? null,
    isMine: row.is_mine === true,
  }));
}

// ---------------------------------------------------------------------------
// Acompanhamento pelo link (cliente anônimo)
// ---------------------------------------------------------------------------

export type QuestionStatusView =
  | { kind: "not-found" }
  | { kind: "error" }
  | { kind: "pending"; body: string; createdAt: string }
  | { kind: "published"; body: string; createdAt: string; questionId: string; answerCount: number }
  | { kind: "rejected"; body: string; createdAt: string; reason: RejectReason | null };

type StatusRow = Nullable<
  Database["public"]["Functions"]["get_public_question_status"]["Returns"][number]
>;

/** Andamento da pergunta. Token em formato inválido nem chega ao banco. */
export async function getQuestionStatus(token: string): Promise<QuestionStatusView> {
  if (!isTrackingToken(token)) return { kind: "not-found" };
  const supabase = createAnonymousClient();
  const { data, error } = await supabase.rpc("get_public_question_status", { p_token: token });
  if (error) {
    console.error("[pergunte] falha ao consultar andamento", error.code);
    return { kind: "error" };
  }
  const row = ((data ?? []) as StatusRow[])[0];
  if (!row) return { kind: "not-found" };
  const base = { body: row.body ?? "", createdAt: row.created_at ?? "" };
  switch (row.status) {
    case "pending":
      return { kind: "pending", ...base };
    case "published":
      if (!row.question_id) return { kind: "pending", ...base };
      return {
        kind: "published",
        ...base,
        questionId: row.question_id,
        answerCount: row.answer_count ?? 0,
      };
    case "rejected":
      return {
        kind: "rejected",
        ...base,
        reason: isRejectReason(row.reject_reason) ? row.reject_reason : null,
      };
    default:
      return { kind: "not-found" };
  }
}

// ---------------------------------------------------------------------------
// Moderação (aba "Perguntas" do /admin — RLS: só moderação lê pendentes e respostas alheias)
// ---------------------------------------------------------------------------

export interface PendingQuestionView {
  id: string;
  body: string;
  stage: QuestionStage | null;
  areaName: string | null;
  createdAt: string;
}

export interface RecentAnswerView {
  id: string;
  body: string;
  createdAt: string;
  showIdentity: boolean;
  isHidden: boolean;
  hiddenAt: string | null;
  authorName: string;
  question: { id: string; excerpt: string; isPublished: boolean } | null;
}

export interface PerguntasAdminData {
  pending: PendingQuestionView[];
  answers: RecentAnswerView[];
  error: boolean;
  /** Momento da leitura (para "há 3 horas" estável entre servidor e cliente). */
  now: number;
}

/** Janela de "Respostas recentes" na fila da moderação. */
export const RECENT_ANSWERS_DAYS = 14;
const PENDING_LIMIT = 50;
const RECENT_ANSWERS_LIMIT = 100;

/** Perguntas esperando revisão (contagem da aba, mesmo fora dela). */
export async function countPendingQuestions(): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("public_questions")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");
  if (error) {
    console.error("[pergunte] falha ao contar pendentes", error.code);
    return 0;
  }
  return count ?? 0;
}

type NamedProfile = { full_name: string } | null;

export async function loadPerguntasAdmin(now: number = Date.now()): Promise<PerguntasAdminData> {
  const supabase = await createClient();
  const since = new Date(now - RECENT_ANSWERS_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const [pending, answers, areas] = await Promise.all([
    supabase
      .from("public_questions")
      .select("id, body, stage, area_id, created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(PENDING_LIMIT),
    supabase
      .from("public_answers")
      .select(
        "id, body, created_at, show_identity, is_hidden, hidden_at, question_id, author:profiles!public_answers_author_id_fkey(full_name), question:public_questions(id, body, status)",
      )
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(RECENT_ANSWERS_LIMIT),
    listBigAreas(),
  ]);

  if (pending.error) console.error("[pergunte] falha ao listar pendentes", pending.error.code);
  if (answers.error) console.error("[pergunte] falha ao listar respostas", answers.error.code);

  return {
    pending: (pending.data ?? []).map((q) => ({
      id: q.id,
      body: q.body,
      stage: toStage(q.stage),
      areaName: areaName(areas, q.area_id),
      createdAt: q.created_at,
    })),
    answers: (answers.data ?? []).map((a) => {
      const author = (Array.isArray(a.author) ? a.author[0] : a.author) as NamedProfile;
      const question = Array.isArray(a.question) ? a.question[0] : a.question;
      return {
        id: a.id,
        body: a.body,
        createdAt: a.created_at,
        showIdentity: a.show_identity,
        isHidden: a.is_hidden,
        hiddenAt: a.hidden_at,
        authorName: author?.full_name?.trim() || "Membra sem nome",
        question: question
          ? {
              id: question.id,
              excerpt: truncate(question.body.replace(/\s+/g, " ").trim(), 160),
              isPublished: question.status === "published",
            }
          : null,
      };
    }),
    error: Boolean(pending.error || answers.error),
    now,
  };
}
