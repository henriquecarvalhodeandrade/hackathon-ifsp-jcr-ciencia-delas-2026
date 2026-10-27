import "server-only";
import { getCurrentUser } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { dbErrorMessage } from "./errors";
import {
  readSectionValues,
  updateToFormValues,
  type ProfileFieldErrors,
  type ProfileFormValues,
  type ProfileSection,
} from "./form-values";
import { missingOnboardingStep, parseProfileSection } from "./schemas";

/**
 * Gravação das seções do perfil com a sessão da usuária (RLS + GRANT por coluna).
 * Usado pelas Server Actions do onboarding e do /perfil. Nunca recebe id do cliente:
 * o id vem sempre da sessão.
 */

type ServerClient = Awaited<ReturnType<typeof createClient>>;

export type SaveSectionOutcome =
  | { ok: true; userId: string; values: Partial<ProfileFormValues>; consentRevoked: boolean }
  | {
      ok: false;
      error: string;
      fieldErrors?: ProfileFieldErrors;
      values: Partial<ProfileFormValues>;
    };

export const NOT_CONFIGURED_ERROR =
  "O Supabase ainda não foi configurado neste ambiente. Veja docs/07-setup-e-deploy.md.";
export const SESSION_EXPIRED_ERROR =
  "Sua sessão terminou. Entre de novo para continuar — nada foi perdido.";
export const VALIDATION_ERROR =
  "Alguns campos precisam de atenção. Confira as mensagens abaixo de cada um.";

/** Substitui as áreas do perfil pelas escolhidas (apaga as que saíram, insere as novas). */
async function replaceProfileAreas(
  supabase: ServerClient,
  userId: string,
  areaIds: number[],
): Promise<string | null> {
  const { data: current, error: readError } = await supabase
    .from("profile_research_areas")
    .select("area_id")
    .eq("profile_id", userId);
  if (readError) return dbErrorMessage(readError);

  const currentIds = new Set((current ?? []).map((row) => row.area_id));
  const wanted = new Set(areaIds);
  const toRemove = [...currentIds].filter((id) => !wanted.has(id));
  const toAdd = areaIds.filter((id) => !currentIds.has(id));

  if (toRemove.length > 0) {
    const { error } = await supabase
      .from("profile_research_areas")
      .delete()
      .eq("profile_id", userId)
      .in("area_id", toRemove);
    if (error) return dbErrorMessage(error);
  }
  if (toAdd.length > 0) {
    const { error } = await supabase
      .from("profile_research_areas")
      .insert(toAdd.map((area_id) => ({ profile_id: userId, area_id })));
    if (error) return dbErrorMessage(error);
  }
  return null;
}

/** Valida e grava uma seção do perfil da usuária logada. */
export async function saveSectionForCurrentUser(
  section: ProfileSection,
  formData: FormData,
): Promise<SaveSectionOutcome> {
  const values = readSectionValues(section, formData);
  if (!isSupabaseConfigured()) return { ok: false, error: NOT_CONFIGURED_ERROR, values };

  const user = await getCurrentUser();
  if (!user) return { ok: false, error: SESSION_EXPIRED_ERROR, values };

  const parsed = parseProfileSection(section, values);
  if (!parsed.success)
    return { ok: false, error: VALIDATION_ERROR, fieldErrors: parsed.fieldErrors, values };

  const supabase = await createClient();

  let consentRevoked = false;
  if (section === "privacidade" && parsed.update.ai_consent === false) {
    const { data } = await supabase
      .from("profiles")
      .select("ai_consent")
      .eq("id", user.id)
      .maybeSingle();
    consentRevoked = Boolean(data?.ai_consent);
  }

  // Perfis: sempre update (nunca upsert — o upsert tentaria gravar o id, que não tem GRANT).
  const { data: updated, error } = await supabase
    .from("profiles")
    .update(parsed.update)
    .eq("id", user.id)
    .select("id")
    .maybeSingle();
  if (error) {
    console.warn(`[perfil] falha ao salvar a seção ${section} (${error.code})`);
    return { ok: false, error: dbErrorMessage(error), values };
  }
  if (!updated) {
    return {
      ok: false,
      error: "Não encontramos o seu perfil. Saia e entre de novo, por favor.",
      values,
    };
  }

  if (parsed.areaIds) {
    const areaError = await replaceProfileAreas(supabase, user.id, parsed.areaIds);
    if (areaError) return { ok: false, error: areaError, values };
  }

  return {
    ok: true,
    userId: user.id,
    values: { ...values, ...updateToFormValues(parsed.update, parsed.areaIds) },
    consentRevoked,
  };
}

export type CompleteOnboardingOutcome =
  { ok: true; seeksMentorship: boolean } | { ok: false; error: string; step?: 1 | 2 };

/** Confere o mínimo necessário (nome, fase, 1 área) e marca o onboarding como concluído. */
export async function completeOnboardingForCurrentUser(): Promise<CompleteOnboardingOutcome> {
  if (!isSupabaseConfigured()) return { ok: false, error: NOT_CONFIGURED_ERROR };
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: SESSION_EXPIRED_ERROR };

  const supabase = await createClient();
  const [{ data: profile, error }, { count }] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, career_stage, seeks_mentorship, onboarded_at")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("profile_research_areas")
      .select("area_id", { count: "exact", head: true })
      .eq("profile_id", user.id),
  ]);
  if (error || !profile) return { ok: false, error: dbErrorMessage(error) };

  const missing = missingOnboardingStep({ ...profile, areaCount: count ?? 0 });
  if (missing) return { ok: false, error: missing.message, step: missing.step };

  if (!profile.onboarded_at) {
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ onboarded_at: new Date().toISOString() })
      .eq("id", user.id);
    if (updateError) return { ok: false, error: dbErrorMessage(updateError) };
  }
  return { ok: true, seeksMentorship: profile.seeks_mentorship };
}

/** Mensagem de sucesso de cada seção. */
export function sectionSavedMessage(
  section: ProfileSection,
  values: Partial<ProfileFormValues>,
  consentRevoked: boolean,
) {
  switch (section) {
    case "sobre":
      return "Seus dados foram salvos.";
    case "pesquisa":
      return "Sua pesquisa foi atualizada.";
    case "mentoria":
      return "Suas preferências de mentoria foram salvas.";
    case "privacidade":
      if (values.ai_consent) return "Consentimento registrado. Você pode retirá-lo quando quiser.";
      return consentRevoked
        ? "Consentimento retirado. A análise de IA do seu perfil foi apagada."
        : "Preferência salva. Suas sugestões usam só as regras da plataforma.";
  }
}
