"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { refreshMyEmbedding } from "@/lib/matching/service";
import type { ProfileSection } from "@/lib/profile/form-values";
import { safeNextPath } from "@/lib/profile/redirect";
import { completeOnboardingForCurrentUser, saveSectionForCurrentUser } from "@/lib/profile/save";
import type { ProfileActionState } from "@/lib/profile/types";

/** Etapas do onboarding, na ordem (as mesmas seções do /perfil). */
const STEP_SECTIONS: readonly ProfileSection[] = ["sobre", "pesquisa", "mentoria", "privacidade"];

function destinationAfterOnboarding(
  rawNext: FormDataEntryValue | null,
  seeksMentorship: boolean,
): string {
  const fallback = seeksMentorship ? "/mentoria" : "/painel";
  const next = safeNextPath(rawNext, fallback);
  return next.startsWith("/onboarding") ? fallback : next;
}

/**
 * Salva uma etapa do onboarding (cada etapa é um formulário com o campo oculto `step`).
 * Na última etapa confere o mínimo (nome, fase, 1 área), marca `onboarded_at`, agenda o
 * embedding do perfil (sem bloquear a resposta) e redireciona.
 */
export async function saveOnboardingStepAction(
  _prev: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> {
  const step = Number(formData.get("step"));
  const section = STEP_SECTIONS[step - 1];
  if (!section) {
    return {
      ok: false,
      section: "sobre",
      error: "Etapa desconhecida. Recarregue a página, por favor.",
      values: {},
    };
  }

  const outcome = await saveSectionForCurrentUser(section, formData);
  if (!outcome.ok) {
    return {
      ok: false,
      section,
      error: outcome.error,
      fieldErrors: outcome.fieldErrors,
      values: outcome.values,
    };
  }

  if (step < STEP_SECTIONS.length) {
    revalidatePath("/onboarding");
    return {
      ok: true,
      section,
      message: `Etapa ${step} salva.`,
      values: outcome.values,
      nextStep: step + 1,
    };
  }

  const completion = await completeOnboardingForCurrentUser();
  if (!completion.ok) {
    return {
      ok: false,
      section,
      error: completion.error,
      values: outcome.values,
      goToStep: completion.step,
    };
  }

  // Nunca lança; sem consentimento/chave de IA simplesmente não faz nada.
  after(async () => {
    await refreshMyEmbedding();
  });
  revalidatePath("/", "layout");
  redirect(destinationAfterOnboarding(formData.get("next"), completion.seeksMentorship));
}
