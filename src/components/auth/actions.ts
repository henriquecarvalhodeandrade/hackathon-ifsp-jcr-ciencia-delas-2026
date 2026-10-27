"use server";

import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/env";
import { authRedirectUrl, isGoogleAuthEnabled } from "@/lib/profile/auth-config";
import { authFieldErrors, formText, magicLinkSchema } from "@/lib/profile/auth-schemas";
import { authErrorMessage, isRateLimitError } from "@/lib/profile/errors";
import { safeNextPath, withNext } from "@/lib/profile/redirect";
import { NOT_CONFIGURED_ERROR } from "@/lib/profile/save";
import type { AuthActionState } from "@/lib/profile/types";
import { createClient } from "@/lib/supabase/server";

/** Reenvia o e-mail de confirmação de cadastro (resposta neutra: não revela se a conta existe). */
export async function resendConfirmationAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const values = { email: formText(formData, "email").trim() };
  if (!isSupabaseConfigured()) return { ok: false, error: NOT_CONFIGURED_ERROR, values };

  const parsed = magicLinkSchema.safeParse(values);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Confira o e-mail informado.",
      fieldErrors: authFieldErrors(parsed.error),
      values,
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: parsed.data.email,
    options: { emailRedirectTo: authRedirectUrl("/auth/confirm?next=/onboarding") },
  });
  if (error && isRateLimitError(error))
    return { ok: false, error: authErrorMessage(error), values };
  if (error)
    console.warn(
      `[auth] reenvio de confirmação falhou (${error.status ?? ""} ${error.code ?? ""})`,
    );

  return {
    ok: true,
    kind: "confirmation_resent",
    message: `Se houver um cadastro aguardando confirmação para ${parsed.data.email}, reenviamos o e-mail. Confira também o spam.`,
    values,
  };
}

/** Inicia o login com Google (OAuth + PKCE) e leva a usuária para a tela do Google. */
export async function signInWithGoogleAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const next = safeNextPath(formText(formData, "next"), "/forum");
  if (!isSupabaseConfigured()) return { ok: false, error: NOT_CONFIGURED_ERROR, values: {} };
  if (!isGoogleAuthEnabled())
    return { ok: false, error: "O acesso com Google não está habilitado.", values: {} };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: authRedirectUrl(withNext("/auth/callback", next)) },
  });
  if (error || !data.url) {
    if (error)
      console.warn(`[auth] OAuth Google falhou (${error.status ?? ""} ${error.code ?? ""})`);
    return {
      ok: false,
      error: "Não conseguimos abrir o login do Google agora. Tente de novo ou use seu e-mail.",
      values: {},
    };
  }
  redirect(data.url);
}
