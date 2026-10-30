"use server";

import { getCurrentUser } from "@/lib/auth";
import { DEMO_PASSWORD_REFUSED, isProtectedDemoAccount } from "@/lib/demo/guard";
import { isSupabaseConfigured } from "@/lib/env";
import { authFieldErrors, formText, resetPasswordSchema } from "@/lib/profile/auth-schemas";
import { authErrorMessage } from "@/lib/profile/errors";
import { NOT_CONFIGURED_ERROR, VALIDATION_ERROR } from "@/lib/profile/save";
import type { AuthActionState } from "@/lib/profile/types";
import { createClient } from "@/lib/supabase/server";

/** Troca a senha da usuária logada (sessão vinda do link de recuperação ou do login normal). */
export async function updatePasswordAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  if (!isSupabaseConfigured()) return { ok: false, error: NOT_CONFIGURED_ERROR, values: {} };

  const user = await getCurrentUser();
  if (!user) {
    return {
      ok: false,
      error:
        "Seu link expirou ou a sessão terminou. Peça um novo link de redefinição para continuar.",
      values: {},
    };
  }

  // Modo demonstração: várias pessoas da banca usam as mesmas contas fictícias (docs/14).
  if (isProtectedDemoAccount(user.email))
    return { ok: false, error: DEMO_PASSWORD_REFUSED, values: {} };

  const parsed = resetPasswordSchema.safeParse({
    password: formText(formData, "password"),
    password_confirm: formText(formData, "password_confirm"),
  });
  if (!parsed.success)
    return {
      ok: false,
      error: VALIDATION_ERROR,
      fieldErrors: authFieldErrors(parsed.error),
      values: {},
    };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    const fieldError = error.code === "same_password" || error.code === "weak_password";
    return {
      ok: false,
      error: authErrorMessage(error),
      fieldErrors: fieldError ? { password: [authErrorMessage(error)] } : undefined,
      values: {},
    };
  }

  return {
    ok: true,
    kind: "password_updated",
    message: "Senha atualizada. Use a nova senha no próximo acesso.",
    values: {},
  };
}
