"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentProfile, getCurrentUser, type Profile } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";
import {
  findMentorsForCurrentUser,
  MatchingError,
  refreshMyEmbedding,
} from "@/lib/matching/service";
import { fallbackMessage, friendlyMentorshipError } from "@/lib/mentorship/errors";
import { isOpenStatus } from "@/lib/mentorship/presentation";
import { loadCandidateAvailability, loadSuggestionMatch } from "@/lib/mentorship/queries";
import {
  availabilitySchema,
  consentSchema,
  fieldErrorsOf,
  requestIdSchema,
  requestSchema,
  respondSchema,
} from "@/lib/mentorship/schemas";
import type {
  ActionState,
  FindMentorsState,
  RequestValues,
  RespondValues,
} from "@/lib/mentorship/types";
import { lookupCandidate } from "@/lib/mentorship/view-models";
import { createClient } from "@/lib/supabase/server";

/**
 * Server Actions da mentoria. Cada uma confere a sessão e o perfil no servidor (o proxy é só
 * uma checagem otimista), valida com zod e deixa o RLS + triggers do banco garantirem as regras
 * (máquina de estados, capacidade, participantes). Ids de usuárias vêm sempre da sessão.
 */

const PATH = "/mentoria";

type Member = { userId: string; profile: Profile };

const NOT_SIGNED_IN = "Sua sessão expirou. Entre de novo para continuar.";

async function getMember(): Promise<Member | { error: string }> {
  if (!isSupabaseConfigured())
    return { error: "O Supabase ainda não foi configurado neste ambiente." };
  const user = await getCurrentUser();
  if (!user) return { error: NOT_SIGNED_IN };
  const profile = await getCurrentProfile();
  if (!profile?.onboarded_at) {
    return { error: "Complete o seu perfil antes de usar a mentoria." };
  }
  return { userId: user.id, profile };
}

function str(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

// ---------------------------------------------------------------------------
// Sugestões
// ---------------------------------------------------------------------------

export async function findMentorsAction(
  _prev: FindMentorsState,
  _formData: FormData,
): Promise<FindMentorsState> {
  void _formData;
  const member = await getMember();
  if ("error" in member) return { ok: false, error: member.error };
  if (!member.profile.seeks_mentorship) {
    return {
      ok: false,
      error: "Ative “Quero ser mentorada” no seu perfil para receber sugestões de mentoras.",
    };
  }

  // Sem consentimento de IA as sugestões saem só das regras da plataforma (nada sai do
  // servidor); o consentimento só liga embeddings e explicações por IA (matching/service.ts).
  let result: Awaited<ReturnType<typeof findMentorsForCurrentUser>>;
  try {
    result = await findMentorsForCurrentUser({ limit: 6 });
  } catch (error) {
    if (error instanceof MatchingError) return { ok: false, error: error.message };
    console.error(
      `[mentoria] findMentors falhou — ${error instanceof Error ? error.message.slice(0, 200) : "erro"}`,
    );
    return {
      ok: false,
      error: "Não conseguimos buscar mentoras agora. Tente de novo em instantes.",
    };
  }

  revalidatePath(PATH);
  const warnings = result.warnings.map((w) =>
    w.startsWith("Não foi possível salvar as sugestões")
      ? "Não conseguimos salvar as sugestões agora. Tente gerar de novo em instantes."
      : w,
  );
  return { ok: true, count: result.suggestions.length, source: result.source, warnings };
}

export async function grantAiConsentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const member = await getMember();
  if ("error" in member) return { ok: false, error: member.error };

  const parsed = consentSchema.safeParse({ ai_consent: formData.get("ai_consent") ?? undefined });
  if (!parsed.success) {
    return {
      ok: false,
      error: "Confira a autorização abaixo.",
      fieldErrors: fieldErrorsOf(parsed.error),
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .update({ ai_consent: true })
    .eq("id", member.userId)
    .select("id");
  if (error || !data?.length) {
    if (error)
      console.warn(`[mentoria] consentimento — ${error.code ?? ""} ${error.message.slice(0, 160)}`);
    return { ok: false, error: friendlyMentorshipError(error, "consent") };
  }

  // Gera o embedding do perfil se a IA estiver configurada (nunca lança).
  await refreshMyEmbedding();
  revalidatePath(PATH);
  redirect(`${PATH}?aba=sugestoes&aviso=consentimento`);
}

// ---------------------------------------------------------------------------
// Pedidos (mentoranda)
// ---------------------------------------------------------------------------

export async function createRequestAction(
  _prev: ActionState<RequestValues>,
  formData: FormData,
): Promise<ActionState<RequestValues>> {
  const values: RequestValues = {
    mentor_id: str(formData, "mentor_id"),
    message: str(formData, "message"),
  };
  const member = await getMember();
  if ("error" in member) return { ok: false, error: member.error, values };

  const parsed = requestSchema.safeParse(values);
  if (!parsed.success) {
    return {
      ok: false,
      error: "A mensagem precisa de um ajuste antes do envio.",
      fieldErrors: fieldErrorsOf(parsed.error),
      values,
    };
  }
  const { mentor_id: mentorId, message } = parsed.data;
  if (mentorId === member.userId) {
    return { ok: false, error: "Você não pode pedir mentoria para si mesma.", values };
  }

  const supabase = await createClient();

  // Confere vagas e pedidos em aberto antes (o banco valida de novo no insert).
  const availability = lookupCandidate(await loadCandidateAvailability(supabase), mentorId);
  if (availability.kind === "available" && availability.candidate.existing_request_status) {
    return {
      ok: false,
      error: "Você já tem um pedido em aberto ou uma mentoria ativa com esta mentora.",
      values,
    };
  }
  if (availability.kind === "unavailable") {
    return {
      ok: false,
      error:
        "Esta mentora está sem vagas ou pausou novos pedidos no momento. Que tal escolher outra sugestão?",
      values,
    };
  }

  const match = await loadSuggestionMatch(supabase, member.userId, mentorId);
  const { error } = await supabase.from("mentorship_requests").insert({
    mentor_id: mentorId,
    message,
    match_score: match.score,
    match_reason: match.reason,
  });
  if (error) {
    if (!error.code?.startsWith("CD")) {
      console.warn(`[mentoria] novo pedido — ${error.code ?? ""} ${error.message.slice(0, 160)}`);
    }
    return { ok: false, error: friendlyMentorshipError(error, "request"), values };
  }

  revalidatePath(PATH);
  redirect(`${PATH}?aba=enviadas&aviso=enviado`);
}

export async function cancelRequestAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const member = await getMember();
  if ("error" in member) return { ok: false, error: member.error };
  const parsed = requestIdSchema.safeParse({ request_id: str(formData, "request_id") });
  if (!parsed.success) return { ok: false, error: fallbackMessage("cancel") };

  const closed = "Este pedido já foi encerrado ou não está mais disponível. Recarregue a página.";
  const supabase = await createClient();
  // Lê o status atual (só pedidos da própria mentoranda) para escolher o aviso certo e
  // garantir que a atualização valha só para esse estado.
  const { data: current, error: readError } = await supabase
    .from("mentorship_requests")
    .select("status")
    .eq("id", parsed.data.request_id)
    .eq("mentee_id", member.userId)
    .maybeSingle();
  if (readError) return { ok: false, error: friendlyMentorshipError(readError, "cancel") };
  if (!current || !isOpenStatus(current.status)) return { ok: false, error: closed };

  const { data, error } = await supabase
    .from("mentorship_requests")
    .update({ status: "cancelled" })
    .eq("id", parsed.data.request_id)
    .eq("mentee_id", member.userId)
    .eq("status", current.status)
    .select("id");
  if (error) return { ok: false, error: friendlyMentorshipError(error, "cancel") };
  if (!data?.length) return { ok: false, error: closed };

  revalidatePath(PATH);
  redirect(
    `${PATH}?aba=enviadas&aviso=${current.status === "accepted" ? "mentoria-cancelada" : "cancelado"}`,
  );
}

// ---------------------------------------------------------------------------
// Pedidos (mentora)
// ---------------------------------------------------------------------------

export async function respondRequestAction(
  _prev: ActionState<RespondValues>,
  formData: FormData,
): Promise<ActionState<RespondValues>> {
  const values: RespondValues = { response_message: str(formData, "response_message") };
  const member = await getMember();
  if ("error" in member) return { ok: false, error: member.error, values };

  const parsed = respondSchema.safeParse({
    request_id: str(formData, "request_id"),
    decision: str(formData, "decision"),
    response_message: values.response_message,
  });
  if (!parsed.success) {
    const fieldErrors = fieldErrorsOf(parsed.error);
    return {
      ok: false,
      error:
        fieldErrors.response_message?.[0] ??
        fieldErrors.decision?.[0] ??
        fallbackMessage("respond"),
      fieldErrors,
      values,
    };
  }
  const { request_id: requestId, decision, response_message: responseMessage } = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("mentorship_requests")
    .update({ status: decision, response_message: responseMessage })
    .eq("id", requestId)
    .eq("mentor_id", member.userId)
    .eq("status", "pending")
    .select("id");
  if (error) return { ok: false, error: friendlyMentorshipError(error, "respond"), values };
  if (!data?.length) {
    return {
      ok: false,
      error: "Este pedido já foi respondido ou cancelado pela pesquisadora. Recarregue a página.",
      values,
    };
  }

  revalidatePath(PATH);
  redirect(
    decision === "accepted"
      ? `${PATH}?aba=ativas&aviso=aceito`
      : `${PATH}?aba=recebidas&aviso=recusado`,
  );
}

export async function setAvailabilityAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const member = await getMember();
  if ("error" in member) return { ok: false, error: member.error };
  if (!member.profile.is_mentor) {
    return { ok: false, error: "Ative “Quero ser mentora” no seu perfil para receber pedidos." };
  }
  const parsed = availabilitySchema.safeParse({ available: str(formData, "available") });
  if (!parsed.success) return { ok: false, error: fallbackMessage("availability") };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .update({ mentor_available: parsed.data.available })
    .eq("id", member.userId)
    .select("mentor_available");
  if (error || !data?.length)
    return { ok: false, error: friendlyMentorshipError(error, "availability") };

  revalidatePath(PATH);
  return {
    ok: true,
    message: parsed.data.available
      ? "Pronto! Você voltou a aparecer nas sugestões e a receber novos pedidos."
      : "Novos pedidos pausados. As mentorias em andamento continuam normalmente.",
  };
}

// ---------------------------------------------------------------------------
// Mentorias ativas (as duas participantes)
// ---------------------------------------------------------------------------

export async function completeMentorshipAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const member = await getMember();
  if ("error" in member) return { ok: false, error: member.error };
  const parsed = requestIdSchema.safeParse({ request_id: str(formData, "request_id") });
  if (!parsed.success) return { ok: false, error: fallbackMessage("complete") };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("mentorship_requests")
    .update({ status: "completed" })
    .eq("id", parsed.data.request_id)
    .eq("status", "accepted")
    .or(`mentee_id.eq.${member.userId},mentor_id.eq.${member.userId}`)
    .select("id");
  if (error) return { ok: false, error: friendlyMentorshipError(error, "complete") };
  if (!data?.length) {
    return {
      ok: false,
      error: "Esta mentoria já foi encerrada. Recarregue a página para ver o status atual.",
    };
  }

  revalidatePath(PATH);
  redirect(`${PATH}?aba=ativas&aviso=concluido`);
}
