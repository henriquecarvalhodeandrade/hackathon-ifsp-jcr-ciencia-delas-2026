"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentProfile, isModerator } from "@/lib/auth";
import {
  actionError,
  NOT_ALLOWED,
  SESSION_EXPIRED,
  type ActionState,
} from "@/lib/admin/action-state";
import { cleanAuditReason } from "@/lib/admin/audit";
import { friendlyDbError, type DbErrorLike } from "@/lib/forum/errors";
import { createClient } from "@/lib/supabase/server";
import { REJECT_REASON_LABELS } from "./labels";
import { createAnonymousClient } from "./queries";
import {
  answerSchema,
  deleteAnswerSchema,
  hideAnswerSchema,
  isChecked,
  questionSchema,
  readAnswerForm,
  readFormString,
  readQuestionForm,
  reviewSchema,
  type AnswerFormValues,
  type QuestionFormValues,
} from "./schemas";
import { isTrackingToken } from "./token";

/*
 * Server Actions do "Pergunte a uma cientista" (docs/16). Regras:
 * - perguntas vão ao banco pelo cliente ANÔNIMO (sem sessão): nada liga a pergunta a uma conta,
 *   e o banco nunca vê o IP de quem pergunta (a chamada sai do servidor do app);
 * - o token do link volta só no estado da action (nunca numa URL de redirect);
 * - respostas e moderação usam a sessão (RLS + triggers são a autorização de verdade);
 * - erros CDxxx do banco têm mensagem pt-BR pronta; os demais viram texto genérico.
 */

type FieldErrors<K extends string> = Partial<Record<K, string[]>>;

/** Chave nova para remontar os campos com os valores devolvidos (o React 19 reseta o form). */
const nonce = () => crypto.randomUUID();

/** Falha "anti-robô" (campo-armadilha preenchido ou envio rápido demais): sem detalhes. */
const GENERIC_SUBMIT_ERROR =
  "Não conseguimos enviar sua pergunta agora. Espere alguns segundos e tente de novo — seu texto continua aqui.";

/** Envio mais rápido do que isso (desde que o formulário apareceu) parece robô. */
const MIN_FILL_MS = 3000;

/** Mensagens pt-BR das RPCs (CDxxx e 22023, que só as nossas RPCs usam aqui). */
function dbMessage(error: DbErrorLike, fallback: string): string {
  if (error?.code === "22023" && error.message) return error.message.trim();
  return friendlyDbError(error, fallback);
}

// ---------------------------------------------------------------------------
// Pergunta anônima
// ---------------------------------------------------------------------------

export type QuestionFormState =
  | { ok: true; token: string; nonce: string }
  | {
      ok: false;
      error: string;
      fieldErrors?: FieldErrors<keyof QuestionFormValues>;
      values: QuestionFormValues;
      nonce: string;
    }
  | null;

export async function submitQuestion(
  _prev: QuestionFormState,
  formData: FormData,
): Promise<QuestionFormState> {
  const values = readQuestionForm(formData);
  const fail = (
    error: string,
    fieldErrors?: FieldErrors<keyof QuestionFormValues>,
  ): QuestionFormState => ({ ok: false, error, fieldErrors, values, nonce: nonce() });

  // Campo-armadilha (invisível para pessoas) e tempo mínimo de preenchimento.
  if (readFormString(formData, "site").trim() !== "") return fail(GENERIC_SUBMIT_ERROR);
  const renderedAt = Number(readFormString(formData, "renderedAt"));
  const elapsed = Date.now() - renderedAt;
  if (!Number.isFinite(renderedAt) || renderedAt <= 0 || elapsed < MIN_FILL_MS) {
    return fail(GENERIC_SUBMIT_ERROR);
  }

  const parsed = questionSchema.safeParse(values);
  if (!parsed.success) {
    const fieldErrors = z.flattenError(parsed.error).fieldErrors;
    return fail(fieldErrors.body?.[0] ?? "Confira os campos destacados.", fieldErrors);
  }

  const supabase = createAnonymousClient();
  const { data, error } = await supabase.rpc("submit_public_question", {
    p_body: parsed.data.body,
    p_stage: parsed.data.stage,
    p_area_id: parsed.data.areaId,
  });
  if (error || typeof data !== "string" || !isTrackingToken(data)) {
    const message = dbMessage(
      error,
      "Não conseguimos enviar sua pergunta agora. Tente de novo em instantes — seu texto continua aqui.",
    );
    if (error?.code === "CD041") return fail(message, { body: [message] });
    if (error?.code === "CD042") {
      if (/etapa/i.test(message)) return fail(message, { stage: [message] });
      if (/área/i.test(message)) return fail(message, { areaId: [message] });
      return fail(message, { body: [message] });
    }
    if (error) console.error("[pergunte] falha ao enviar pergunta", error.code);
    return fail(message);
  }

  return { ok: true, token: data, nonce: nonce() };
}

/** Quem tem o link apaga a pergunta; volta para /pergunte (sem o token na barra de endereço). */
export async function deleteQuestionByToken(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const token = readFormString(formData, "token");
  if (!isTrackingToken(token)) {
    return actionError("Este link de acompanhamento não é válido.");
  }
  const supabase = createAnonymousClient();
  const { data, error } = await supabase.rpc("delete_public_question_by_token", {
    p_token: token,
  });
  if (error) {
    console.error("[pergunte] falha ao apagar pergunta", error.code);
    return actionError(
      dbMessage(error, "Não conseguimos apagar sua pergunta agora. Tente de novo em instantes."),
    );
  }
  if (!data) {
    return actionError("Não encontramos esta pergunta. Talvez ela já tenha sido apagada.");
  }
  revalidatePath("/pergunte", "layout");
  redirect("/pergunte?pergunta=apagada");
}

// ---------------------------------------------------------------------------
// Respostas (membras com cadastro completo)
// ---------------------------------------------------------------------------

export type AnswerFormState =
  | { ok: true; message: string; answerId: string; nonce: string }
  | {
      ok: false;
      error: string;
      fieldErrors?: FieldErrors<keyof AnswerFormValues>;
      values: AnswerFormValues;
      nonce: string;
    }
  | null;

const ANSWER_SESSION_ERROR =
  "Sua sessão expirou. Entre novamente para responder — seu texto continua aqui.";
const ANSWER_ONBOARDING_ERROR = "Complete seu cadastro na Artemis para responder.";

export async function submitAnswer(
  _prev: AnswerFormState,
  formData: FormData,
): Promise<AnswerFormState> {
  const { questionId, ...values } = readAnswerForm(formData);
  const fail = (
    error: string,
    fieldErrors?: FieldErrors<keyof AnswerFormValues>,
  ): AnswerFormState => ({ ok: false, error, fieldErrors, values, nonce: nonce() });

  const parsed = answerSchema.safeParse({ ...values, questionId });
  if (!parsed.success) {
    const fieldErrors = z.flattenError(parsed.error).fieldErrors;
    return fail(fieldErrors.body?.[0] ?? fieldErrors.questionId?.[0] ?? "Confira sua resposta.", {
      body: fieldErrors.body,
    });
  }

  const profile = await getCurrentProfile();
  if (!profile) return fail(ANSWER_SESSION_ERROR);
  if (!profile.onboarded_at) return fail(ANSWER_ONBOARDING_ERROR);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("public_answers")
    .insert({
      question_id: parsed.data.questionId,
      body: parsed.data.body,
      show_identity: parsed.data.showIdentity,
    })
    .select("id")
    .single();
  if (error || !data) {
    const message = friendlyDbError(
      error,
      "Não conseguimos publicar sua resposta agora. Tente de novo — seu texto continua aqui.",
    );
    if (error?.code === "CD047") return fail(message, { body: [message] });
    if (error && !error.code?.startsWith("CD")) {
      console.error("[pergunte] falha ao publicar resposta", error.code);
    }
    return fail(message);
  }

  revalidatePath(`/pergunte/${parsed.data.questionId}`);
  revalidatePath("/pergunte");
  return {
    ok: true,
    message: "Resposta publicada. Obrigada por abrir caminho para uma estudante!",
    answerId: data.id,
    nonce: nonce(),
  };
}

export async function deleteAnswer(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = deleteAnswerSchema.safeParse({
    answerId: readFormString(formData, "answerId"),
    questionId: readFormString(formData, "questionId"),
  });
  if (!parsed.success) return actionError("Não encontramos esta resposta.");

  const profile = await getCurrentProfile();
  if (!profile) return actionError(SESSION_EXPIRED);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("public_answers")
    .delete()
    .eq("id", parsed.data.answerId)
    .select("id");
  if (error) {
    console.error("[pergunte] falha ao apagar resposta", error.code);
    return actionError(
      friendlyDbError(error, "Não conseguimos apagar sua resposta agora. Tente de novo."),
    );
  }
  // RLS: só a autora apaga; 0 linhas = não é dela ou já foi apagada.
  if (!data || data.length === 0) {
    return actionError("Não encontramos esta resposta. Talvez ela já tenha sido apagada.");
  }

  revalidatePath(`/pergunte/${parsed.data.questionId}`);
  revalidatePath("/pergunte");
  return { ok: true, message: "Sua resposta foi apagada." };
}

// ---------------------------------------------------------------------------
// Moderação (aba "Perguntas" do /admin)
// ---------------------------------------------------------------------------

type ModeratorCheck = { ok: true } | { ok: false; error: string };

async function checkModerator(): Promise<ModeratorCheck> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: SESSION_EXPIRED };
  if (!isModerator(profile)) return { ok: false, error: NOT_ALLOWED };
  return { ok: true };
}

function revalidateModeration(questionId?: string) {
  revalidatePath("/admin");
  revalidatePath("/pergunte");
  if (questionId) revalidatePath(`/pergunte/${questionId}`);
}

export async function reviewQuestion(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = reviewSchema.safeParse({
    questionId: readFormString(formData, "questionId"),
    decision: readFormString(formData, "decision"),
    reason: readFormString(formData, "reason"),
  });
  if (!parsed.success) {
    const fieldErrors = z.flattenError(parsed.error).fieldErrors;
    return actionError(
      fieldErrors.reason?.[0] ?? fieldErrors.decision?.[0] ?? "Não encontramos esta pergunta.",
      fieldErrors,
    );
  }

  const check = await checkModerator();
  if (!check.ok) return actionError(check.error);

  const { questionId, decision, reason } = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("review_public_question", {
    p_question_id: questionId,
    p_decision: decision,
    p_reason: decision === "reject" ? reason : undefined,
  });
  if (error) {
    if (!error.code?.startsWith("CD")) {
      console.error("[pergunte] falha ao revisar pergunta", error.code);
    }
    return actionError(dbMessage(error, "Não conseguimos registrar a revisão. Tente de novo."));
  }

  revalidateModeration(questionId);
  return {
    ok: true,
    message:
      decision === "publish"
        ? "Pergunta publicada. Ela já aparece em Pergunte a uma cientista, esperando respostas."
        : `Pergunta não publicada (${REJECT_REASON_LABELS[reason!].toLowerCase()}). Quem perguntou verá o motivo no link de acompanhamento.`,
  };
}

export async function setAnswerHidden(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = hideAnswerSchema.safeParse({
    answerId: readFormString(formData, "answerId"),
    hidden: isChecked(readFormString(formData, "hidden")),
    reason: readFormString(formData, "reason"),
  });
  if (!parsed.success) {
    const fieldErrors = z.flattenError(parsed.error).fieldErrors;
    return actionError(fieldErrors.reason?.[0] ?? "Não encontramos esta resposta.", fieldErrors);
  }

  const check = await checkModerator();
  if (!check.ok) return actionError(check.error);

  const { answerId, hidden, reason } = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_public_answer_hidden", {
    p_answer_id: answerId,
    p_hidden: hidden,
    p_reason: cleanAuditReason(reason) ?? undefined,
  });
  if (error) {
    if (!error.code?.startsWith("CD")) {
      console.error("[pergunte] falha ao ocultar resposta", error.code);
    }
    return actionError(dbMessage(error, "Não conseguimos atualizar a resposta. Tente de novo."));
  }

  revalidateModeration();
  revalidatePath("/pergunte", "layout");
  return {
    ok: true,
    message: hidden
      ? "Resposta ocultada. Ela não aparece mais para o público."
      : "Resposta reexibida. Ela voltou a aparecer na pergunta.",
  };
}
