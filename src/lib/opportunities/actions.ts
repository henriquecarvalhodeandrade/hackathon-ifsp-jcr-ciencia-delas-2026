"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentProfile, getCurrentUser, type Profile } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";
import { firstName } from "@/lib/mentorship/presentation";
import { createClient } from "@/lib/supabase/server";
import { friendlyOpportunityError } from "./errors";
import { canPublishOpportunities, feedPostBody, type OwnerDecision } from "./labels";
import { isUuid } from "./params";
import { isOpportunityOpen } from "./presentation";
import {
  applySchema,
  fieldErrorsOf,
  opportunityIdSchema,
  readOpportunityForm,
  respondSchema,
  statusSchema,
  validateOpportunityForm,
  withdrawSchema,
  type OpportunityFormValues,
} from "./schema";
import type {
  ActionState,
  ApplyValues,
  OpportunityFormState,
  RespondValues,
  SimpleResult,
} from "./types";

/**
 * Server Actions do Explorar ICs. Cada uma confere a sessão e o perfil no servidor (o proxy é só
 * uma checagem otimista), valida com zod e grava com o cliente da usuária — quem autoriza de
 * verdade é o RLS, e os triggers garantem as regras (CD070–CD076) e criam as notificações.
 * Ids de usuárias nunca vêm do formulário: `owner_id` e `applicant_id` são `auth.uid()`.
 */

const SESSION_EXPIRED = "Sua sessão expirou. Entre de novo na sua conta para continuar.";

async function getMember(): Promise<{ profile: Profile } | { error: string }> {
  if (!isSupabaseConfigured()) {
    return { error: "O Supabase ainda não foi configurado neste ambiente." };
  }
  const user = await getCurrentUser();
  if (!user) return { error: SESSION_EXPIRED };
  const profile = await getCurrentProfile();
  if (!profile?.onboarded_at) {
    return { error: "Complete o seu perfil antes de usar o Explorar ICs." };
  }
  return { profile };
}

/** Lista, detalhe, candidaturas e "minhas" ficam todas sob /ics. */
function revalidateIcs() {
  revalidatePath("/ics", "layout");
}

function str(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

// ---------------------------------------------------------------------------
// Publicar / editar vaga
// ---------------------------------------------------------------------------

export async function saveOpportunity(
  _prev: OpportunityFormState,
  formData: FormData,
): Promise<OpportunityFormState> {
  const values = readOpportunityForm(formData);
  const rawId = str(formData, "opportunity_id");
  const editingId = rawId === "" ? null : rawId;
  if (editingId && !isUuid(editingId)) return { ok: false, error: "Vaga inválida.", values };

  const member = await getMember();
  if ("error" in member) return { ok: false, error: member.error, values };
  const { profile } = member;
  const supabase = await createClient();

  let currentDeadline: string | null = null;
  if (editingId) {
    const { data: current } = await supabase
      .from("research_opportunities")
      .select("owner_id, deadline")
      .eq("id", editingId)
      .maybeSingle();
    if (!current || current.owner_id !== profile.id) {
      return { ok: false, error: "Você só pode editar vagas que você mesma publicou.", values };
    }
    currentDeadline = current.deadline;
  } else if (!canPublishOpportunities(profile.career_stage)) {
    return {
      ok: false,
      error:
        "Só pesquisadoras do mestrado em diante publicam vagas. Se a sua etapa mudou, atualize o seu perfil.",
      values,
    };
  }

  const result = validateOpportunityForm(values, { currentDeadline });
  if (!result.success) {
    return {
      ok: false,
      error: "Alguns campos precisam de atenção. Confira as mensagens abaixo de cada um.",
      fieldErrors: result.fieldErrors,
      values,
    };
  }

  if (editingId) {
    const { data, error } = await supabase
      .from("research_opportunities")
      .update(result.data)
      .eq("id", editingId)
      .eq("owner_id", profile.id)
      .select("id")
      .maybeSingle();
    if (error) return saveError(error, values);
    if (!data) {
      return { ok: false, error: "Você só pode editar vagas que você mesma publicou.", values };
    }
    revalidateIcs();
    redirect(`/ics/${data.id}?aviso=atualizada`);
  }

  const { data, error } = await supabase
    .from("research_opportunities")
    .insert(result.data)
    .select("id")
    .single();
  if (error) return saveError(error, values);

  // Compartilhar no feed é um extra: se falhar (limite de publicações, feed fora do ar), a vaga
  // continua publicada e a página avisa.
  let shared = false;
  if (values.share_to_feed) {
    const { error: postError } = await supabase.from("posts").insert({
      kind: "update",
      body: feedPostBody(result.data.kind, result.data.title),
      opportunity_id: data.id,
    });
    if (postError) {
      console.error(
        "[ics] falha ao compartilhar a vaga no feed",
        postError.code,
        postError.message,
      );
    } else {
      shared = true;
      revalidatePath("/feed", "layout");
    }
  }

  revalidateIcs();
  const notice = !values.share_to_feed
    ? "publicada"
    : shared
      ? "publicada-feed"
      : "publicada-sem-feed";
  redirect(`/ics/${data.id}?aviso=${notice}`);
}

function saveError(
  error: { code?: string; message?: string; details?: string },
  values: OpportunityFormValues,
): OpportunityFormState {
  const message = friendlyOpportunityError(error, "save");
  return {
    ok: false,
    error: message,
    fieldErrors: error.code === "23503" ? { area_id: [message] } : undefined,
    values,
  };
}

// ---------------------------------------------------------------------------
// Encerrar / reabrir / excluir (dona)
// ---------------------------------------------------------------------------

/** Encerra ou reabre a vaga (`closed_at` é gravado pelo banco). */
export async function setOpportunityStatus(formData: FormData): Promise<SimpleResult> {
  const parsed = statusSchema.safeParse({
    opportunity_id: formData.get("opportunity_id"),
    status: formData.get("status"),
  });
  if (!parsed.success) return { ok: false, error: "Vaga inválida. Recarregue a página." };
  const member = await getMember();
  if ("error" in member) return { ok: false, error: member.error };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("research_opportunities")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.opportunity_id)
    .eq("owner_id", member.profile.id)
    .select("id");
  if (error) {
    console.error("[ics] falha ao mudar a situação da vaga", error.code, error.message);
    return { ok: false, error: friendlyOpportunityError(error, "status") };
  }
  if (!data || data.length === 0) {
    return { ok: false, error: "Só quem publicou a vaga pode encerrá-la ou reabri-la." };
  }
  revalidateIcs();
  return { ok: true };
}

/** A dona exclui a vaga (as candidaturas vão junto). Sucesso → "Vagas que publiquei". */
export async function deleteOpportunity(formData: FormData): Promise<SimpleResult> {
  const parsed = opportunityIdSchema.safeParse({ opportunity_id: formData.get("opportunity_id") });
  if (!parsed.success) return { ok: false, error: "Vaga inválida. Recarregue a página." };
  const member = await getMember();
  if ("error" in member) return { ok: false, error: member.error };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("research_opportunities")
    .delete()
    .eq("id", parsed.data.opportunity_id)
    .eq("owner_id", member.profile.id)
    .select("id");
  if (error) {
    console.error("[ics] falha ao excluir vaga", error.code, error.message);
    return { ok: false, error: friendlyOpportunityError(error, "delete") };
  }
  if (!data || data.length === 0) {
    return { ok: false, error: "Só quem publicou a vaga pode excluí-la." };
  }
  revalidateIcs();
  revalidatePath("/feed", "layout");
  redirect("/ics/minhas?aba=publicadas&aviso=removida");
}

// ---------------------------------------------------------------------------
// Candidatar-se / desistir (candidata)
// ---------------------------------------------------------------------------

export async function applyToOpportunity(
  _prev: ActionState<ApplyValues>,
  formData: FormData,
): Promise<ActionState<ApplyValues>> {
  const values: ApplyValues = { message: str(formData, "message") };
  const member = await getMember();
  if ("error" in member) return { ok: false, error: member.error, values };

  const parsed = applySchema.safeParse({
    opportunity_id: formData.get("opportunity_id"),
    message: values.message,
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: "A carta precisa de um ajuste antes do envio.",
      fieldErrors: fieldErrorsOf(parsed.error),
      values,
    };
  }
  const { opportunity_id: opportunityId, message } = parsed.data;

  // Conferência amigável antes (o banco valida de novo: CD071, CD072, CD073).
  const supabase = await createClient();
  const { data: opportunity } = await supabase
    .from("research_opportunities")
    .select("owner_id, status, deadline")
    .eq("id", opportunityId)
    .maybeSingle();
  if (!opportunity) {
    return { ok: false, error: "Esta vaga não está mais disponível.", values };
  }
  if (opportunity.owner_id === member.profile.id) {
    return { ok: false, error: "Você não pode se candidatar à sua própria vaga.", values };
  }
  if (!isOpportunityOpen(opportunity)) {
    return {
      ok: false,
      error: "As inscrições desta vaga já foram encerradas. Que tal procurar outras vagas abertas?",
      values,
    };
  }

  const { error } = await supabase
    .from("opportunity_applications")
    .insert({ opportunity_id: opportunityId, message });
  if (error) {
    if (!error.code?.startsWith("CD") && error.code !== "23505") {
      console.error("[ics] falha ao enviar candidatura", error.code, error.message);
    }
    return { ok: false, error: friendlyOpportunityError(error, "apply"), values };
  }

  revalidateIcs();
  redirect(`/ics/${opportunityId}?aviso=candidatura-enviada`);
}

/** A candidata desiste (só enquanto enviada ou em análise — CD074 no banco). */
export async function withdrawApplication(formData: FormData): Promise<SimpleResult> {
  const parsed = withdrawSchema.safeParse({
    application_id: formData.get("application_id"),
    opportunity_id: formData.get("opportunity_id"),
  });
  if (!parsed.success) return { ok: false, error: "Candidatura inválida. Recarregue a página." };
  const member = await getMember();
  if ("error" in member) return { ok: false, error: member.error };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("opportunity_applications")
    .update({ status: "withdrawn" })
    .eq("id", parsed.data.application_id)
    .eq("opportunity_id", parsed.data.opportunity_id)
    .eq("applicant_id", member.profile.id)
    .select("id");
  if (error) {
    console.error("[ics] falha ao desistir da candidatura", error.code, error.message);
    return { ok: false, error: friendlyOpportunityError(error, "withdraw") };
  }
  if (!data || data.length === 0) {
    return { ok: false, error: "Não encontramos esta candidatura. Recarregue a página." };
  }
  revalidateIcs();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Responder candidatura (dona)
// ---------------------------------------------------------------------------

const RESPONDED: Record<OwnerDecision, (name: string) => string> = {
  in_review: (name) => `Candidatura de ${name} marcada como em análise. Ela recebe um aviso.`,
  accepted: (name) =>
    `Candidatura de ${name} aprovada! Ela recebe um aviso e vocês já podem conversar por mensagem.`,
  declined: (name) => `Resposta registrada. ${name} recebe um aviso.`,
};

export async function respondToApplication(
  _prev: ActionState<RespondValues>,
  formData: FormData,
): Promise<ActionState<RespondValues>> {
  const values: RespondValues = { owner_note: str(formData, "owner_note") };
  const member = await getMember();
  if ("error" in member) return { ok: false, error: member.error, values };

  const parsed = respondSchema.safeParse({
    application_id: formData.get("application_id"),
    opportunity_id: formData.get("opportunity_id"),
    decision: formData.get("decision"),
    owner_note: values.owner_note,
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: "Confira a resposta antes de enviar.",
      fieldErrors: fieldErrorsOf(parsed.error),
      values,
    };
  }
  const { application_id, opportunity_id, decision, owner_note } = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("opportunity_applications")
    .update({ status: decision, owner_note })
    .eq("id", application_id)
    .eq("opportunity_id", opportunity_id)
    .select("id, applicant:profiles!applicant_id(full_name)");
  if (error) {
    if (!error.code?.startsWith("CD")) {
      console.error("[ics] falha ao responder candidatura", error.code, error.message);
    }
    return { ok: false, error: friendlyOpportunityError(error, "respond"), values };
  }
  const row = data?.[0];
  if (!row) {
    return { ok: false, error: "Só a dona da vaga responde às candidaturas.", values };
  }

  revalidateIcs();
  const name = firstName(row.applicant?.full_name) || "A candidata";
  return { ok: true, message: RESPONDED[decision](name), values };
}
