"use server";

import { isSupabaseConfigured } from "@/lib/env";
import { authRedirectUrl } from "@/lib/profile/auth-config";
import { authFieldErrors, formText, magicLinkSchema } from "@/lib/profile/auth-schemas";
import { authErrorMessage, isRateLimitError } from "@/lib/profile/errors";
import { NOT_CONFIGURED_ERROR, VALIDATION_ERROR } from "@/lib/profile/save";
import type { AuthActionState } from "@/lib/profile/types";
import { createClient } from "@/lib/supabase/server";

/** Envia o link de redefinição de senha. A resposta é sempre neutra (não revela contas). */
export async function requestPasswordResetAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const values = { email: formText(formData, "email").trim() };
  if (!isSupabaseConfigured()) return { ok: false, error: NOT_CONFIGURED_ERROR, values };

  const parsed = magicLinkSchema.safeParse(values);
  if (!parsed.success)
    return {
      ok: false,
      error: VALIDATION_ERROR,
      fieldErrors: authFieldErrors(parsed.error),
      values,
    };

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: authRedirectUrl("/auth/confirm?next=/redefinir-senha"),
  });
  if (error && isRateLimitError(error))
    return { ok: false, error: authErrorMessage(error), values };
  if (error)
    console.warn(`[auth] recuperação de senha falhou (${error.status ?? ""} ${error.code ?? ""})`);

  return {
    ok: true,
    kind: "recovery_sent",
    message: `Se existir uma conta com ${parsed.data.email}, enviamos um link para criar uma nova senha. Ele vale por 1 hora — confira também o spam.`,
    values,
  };
}
