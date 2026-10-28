"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentProfile, getCurrentUser } from "@/lib/auth";
import type { TablesInsert } from "@/lib/database.types";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { fallbackMessage, friendlyRecognitionError, type RecognitionOperation } from "./errors";
import {
  declarationConsentSchema,
  declarationRequestSchema,
  declarationRevokeSchema,
  feedbackDeleteSchema,
  feedbackSchema,
  fieldErrorsOf,
  returnToSchema,
  type ReturnTo,
} from "./schemas";
import type { FeedbackState, FeedbackValues, RecognitionActionState } from "./types";

/**
 * Server Actions do reconhecimento. Cada uma confere a sessão no servidor, valida com zod e deixa
 * o banco garantir as regras (participante, mentoria concluída, autoria, uma declaração ativa,
 * autorização das duas — CD030–CD037). O sucesso redireciona com um aviso (?aviso=); o erro volta
 * para o formulário.
 */

const NOT_SIGNED_IN = "Sua sessão expirou. Entre de novo para continuar.";

async function getMemberId(): Promise<string | { error: string }> {
  if (!isSupabaseConfigured()) {
    return { error: "O Supabase ainda não foi configurado neste ambiente." };
  }
  const user = await getCurrentUser();
  if (!user) return { error: NOT_SIGNED_IN };
  const profile = await getCurrentProfile();
  if (!profile?.onboarded_at) return { error: "Complete o seu perfil antes de continuar." };
  return user.id;
}

function str(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function logUnexpected(what: string, error: { code?: string; message: string }) {
  if (!error.code?.startsWith("CD")) {
    console.warn(`[reconhecimento] ${what} — ${error.code ?? ""} ${error.message.slice(0, 160)}`);
  }
}

export type RecognitionNotice =
  | "retorno-enviado"
  | "retorno-apagado"
  | "declaracao-pedida"
  | "declaracao-emitida"
  | "declaracao-revogada"
  | "declaracao-cancelada";

/** Destino depois da ação: o cartão em /mentoria?aba=ativas ou a página da mentoria concluída. */
function destination(returnTo: ReturnTo, requestId: string, notice: RecognitionNotice): string {
  return returnTo === "concluida"
    ? `/mentoria/concluida/${requestId}?aviso=${notice}`
    : `/mentoria?aba=ativas&aviso=${notice}#reconhecimento-${requestId}`;
}

function refresh(requestId: string) {
  revalidatePath("/mentoria");
  revalidatePath(`/mentoria/concluida/${requestId}`);
  // Pendências do /painel e números do impacto (landing).
  revalidatePath("/", "layout");
}

function failure(operation: RecognitionOperation, error?: string): RecognitionActionState {
  return { ok: false, error: error ?? fallbackMessage(operation) };
}

// ---------------------------------------------------------------------------
// Retorno privado
// ---------------------------------------------------------------------------

export async function submitFeedbackAction(
  _prev: FeedbackState,
  formData: FormData,
): Promise<FeedbackState> {
  const values: FeedbackValues = {
    helpfulness: str(formData, "helpfulness"),
    outcomes: formData.getAll("outcomes").filter((v): v is string => typeof v === "string"),
    would_recommend: str(formData, "would_recommend"),
    note: str(formData, "note"),
  };
  const member = await getMemberId();
  if (typeof member !== "string") return { ok: false, error: member.error, values };

  const parsed = feedbackSchema.safeParse({
    request_id: str(formData, "request_id"),
    helpfulness: values.helpfulness,
    outcomes: values.outcomes,
    would_recommend: values.would_recommend || undefined,
    note: values.note,
  });
  if (!parsed.success) {
    const fieldErrors = fieldErrorsOf(parsed.error);
    return {
      ok: false,
      error:
        fieldErrors.helpfulness?.[0] ??
        fieldErrors.outcomes?.[0] ??
        fieldErrors.note?.[0] ??
        fieldErrors.request_id?.[0] ??
        fallbackMessage("feedback"),
      fieldErrors,
      values,
    };
  }
  const input = parsed.data;

  const supabase = await createClient();
  // author_id (auth.uid()), role e created_at vêm do banco: o trigger BEFORE INSERT os preenche.
  const row = {
    request_id: input.request_id,
    helpfulness: input.helpfulness,
    outcomes: input.outcomes,
    would_recommend: input.would_recommend,
    note: input.note,
  } as TablesInsert<"mentorship_feedback">;
  const { error } = await supabase.from("mentorship_feedback").insert(row);
  if (error) {
    logUnexpected("retorno", error);
    return { ok: false, error: friendlyRecognitionError(error, "feedback"), values };
  }

  refresh(input.request_id);
  redirect(destination("concluida", input.request_id, "retorno-enviado"));
}

export async function deleteFeedbackAction(
  _prev: RecognitionActionState,
  formData: FormData,
): Promise<RecognitionActionState> {
  const member = await getMemberId();
  if (typeof member !== "string") return failure("feedback-delete", member.error);
  const parsed = feedbackDeleteSchema.safeParse({ request_id: str(formData, "request_id") });
  if (!parsed.success) return failure("feedback-delete");

  const supabase = await createClient();
  // RLS: só a autora apaga; o filtro por author_id deixa isso explícito.
  const { data, error } = await supabase
    .from("mentorship_feedback")
    .delete()
    .eq("request_id", parsed.data.request_id)
    .eq("author_id", member)
    .select("id");
  if (error) {
    logUnexpected("apagar retorno", error);
    return failure("feedback-delete", friendlyRecognitionError(error, "feedback-delete"));
  }
  if (!data?.length) {
    return failure("feedback-delete", "Este retorno já foi apagado. Recarregue a página.");
  }

  refresh(parsed.data.request_id);
  redirect(destination("concluida", parsed.data.request_id, "retorno-apagado"));
}

// ---------------------------------------------------------------------------
// Declaração de participação
// ---------------------------------------------------------------------------

export async function requestDeclarationAction(
  _prev: RecognitionActionState,
  formData: FormData,
): Promise<RecognitionActionState> {
  const returnTo = returnToSchema.parse(str(formData, "return_to"));
  const member = await getMemberId();
  if (typeof member !== "string") return failure("declaration-request", member.error);
  const parsed = declarationRequestSchema.safeParse({
    request_id: str(formData, "request_id"),
    consent: formData.get("consent") ?? undefined,
  });
  if (!parsed.success) {
    const fieldErrors = fieldErrorsOf(parsed.error);
    return {
      ok: false,
      error:
        fieldErrors.consent?.[0] ??
        fieldErrors.request_id?.[0] ??
        fallbackMessage("declaration-request"),
      fieldErrors,
    };
  }

  const supabase = await createClient();
  // O banco carimba a autorização de quem pede e gera o código (a cliente só manda o pedido).
  const { error } = await supabase
    .from("mentorship_declarations")
    .insert({ request_id: parsed.data.request_id } as TablesInsert<"mentorship_declarations">);
  if (error) {
    logUnexpected("pedir declaração", error);
    return failure("declaration-request", friendlyRecognitionError(error, "declaration-request"));
  }

  refresh(parsed.data.request_id);
  redirect(destination(returnTo, parsed.data.request_id, "declaracao-pedida"));
}

export async function consentDeclarationAction(
  _prev: RecognitionActionState,
  formData: FormData,
): Promise<RecognitionActionState> {
  const returnTo = returnToSchema.parse(str(formData, "return_to"));
  const member = await getMemberId();
  if (typeof member !== "string") return failure("declaration-consent", member.error);
  const parsed = declarationConsentSchema.safeParse({
    request_id: str(formData, "request_id"),
    declaration_id: str(formData, "declaration_id"),
    consent: formData.get("consent") ?? undefined,
  });
  if (!parsed.success) {
    const fieldErrors = fieldErrorsOf(parsed.error);
    return {
      ok: false,
      error: fieldErrors.consent?.[0] ?? fallbackMessage("declaration-consent"),
      fieldErrors,
    };
  }

  const supabase = await createClient();
  const { data: issuedAt, error } = await supabase.rpc("consent_mentorship_declaration", {
    p_declaration_id: parsed.data.declaration_id,
  });
  if (error) {
    logUnexpected("autorizar declaração", error);
    return failure("declaration-consent", friendlyRecognitionError(error, "declaration-consent"));
  }

  refresh(parsed.data.request_id);
  redirect(
    destination(
      returnTo,
      parsed.data.request_id,
      issuedAt ? "declaracao-emitida" : "declaracao-pedida",
    ),
  );
}

export async function revokeDeclarationAction(
  _prev: RecognitionActionState,
  formData: FormData,
): Promise<RecognitionActionState> {
  const returnTo = returnToSchema.parse(str(formData, "return_to"));
  const member = await getMemberId();
  if (typeof member !== "string") return failure("declaration-revoke", member.error);
  const parsed = declarationRevokeSchema.safeParse({
    request_id: str(formData, "request_id"),
    declaration_id: str(formData, "declaration_id"),
    reason: str(formData, "reason"),
  });
  if (!parsed.success) {
    const fieldErrors = fieldErrorsOf(parsed.error);
    return {
      ok: false,
      error: fieldErrors.reason?.[0] ?? fallbackMessage("declaration-revoke"),
      fieldErrors,
    };
  }

  const supabase = await createClient();
  // Para o aviso certo: revogar uma emitida ≠ cancelar um pedido ainda pendente.
  const { data: current } = await supabase
    .from("mentorship_declarations")
    .select("issued_at")
    .eq("id", parsed.data.declaration_id)
    .maybeSingle();
  const { error } = await supabase.rpc("revoke_mentorship_declaration", {
    p_declaration_id: parsed.data.declaration_id,
    p_reason: parsed.data.reason ?? undefined,
  });
  if (error) {
    logUnexpected("revogar declaração", error);
    return failure("declaration-revoke", friendlyRecognitionError(error, "declaration-revoke"));
  }

  refresh(parsed.data.request_id);
  redirect(
    destination(
      returnTo,
      parsed.data.request_id,
      current?.issued_at ? "declaracao-revogada" : "declaracao-cancelada",
    ),
  );
}
