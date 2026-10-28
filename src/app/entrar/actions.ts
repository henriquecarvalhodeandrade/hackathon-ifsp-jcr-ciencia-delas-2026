"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/env";
import { authRedirectUrl } from "@/lib/profile/auth-config";
import { rememberAuthNext } from "@/lib/profile/auth-next";
import {
  authFieldErrors,
  formText,
  loginSchema,
  magicLinkSchema,
} from "@/lib/profile/auth-schemas";
import {
  authErrorMessage,
  isEmailNotConfirmedError,
  isUnknownAccountError,
} from "@/lib/profile/errors";
import { safeNextPath } from "@/lib/profile/redirect";
import { NOT_CONFIGURED_ERROR, VALIDATION_ERROR } from "@/lib/profile/save";
import type { AuthActionState } from "@/lib/profile/types";
import { createClient } from "@/lib/supabase/server";

const DEFAULT_NEXT = "/forum";

/**
 * Login por e-mail. Um único formulário com dois botões:
 *   intent=password → e-mail + senha (redireciona para ?next)
 *   intent=magic    → link mágico por e-mail (resposta neutra, sem revelar se a conta existe)
 */
export async function signInAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const intent = formText(formData, "intent") === "magic" ? "magic" : "password";
  const values = { email: formText(formData, "email").trim() };
  const next = safeNextPath(formText(formData, "next"), DEFAULT_NEXT);
  if (!isSupabaseConfigured()) return { ok: false, error: NOT_CONFIGURED_ERROR, values };

  const supabase = await createClient();

  if (intent === "magic") {
    const parsed = magicLinkSchema.safeParse(values);
    if (!parsed.success)
      return {
        ok: false,
        error: VALIDATION_ERROR,
        fieldErrors: authFieldErrors(parsed.error),
        values,
      };

    const { error } = await supabase.auth.signInWithOtp({
      email: parsed.data.email,
      options: {
        // Cadastro só pela tela /cadastro (aceite do código de conduta).
        shouldCreateUser: false,
        // Sempre com "?next=": o modelo do e-mail (supabase/templates/magic_link.html) monta o
        // link a partir deste endereço acrescentando "&token_hash=...".
        emailRedirectTo: authRedirectUrl(`/auth/confirm?next=${encodeURIComponent(next)}`),
      },
    });
    if (error && !isUnknownAccountError(error)) {
      console.warn(`[auth] link mágico falhou (${error.status ?? ""} ${error.code ?? ""})`);
      return { ok: false, error: authErrorMessage(error), values };
    }
    await rememberAuthNext(next === DEFAULT_NEXT ? null : next);
    return {
      ok: true,
      kind: "magic_link_sent",
      message: `Se existir uma conta com ${parsed.data.email}, enviamos um link de acesso. Ele vale por 1 hora — confira também o spam.`,
      values,
    };
  }

  const parsed = loginSchema.safeParse({ ...values, password: formText(formData, "password") });
  if (!parsed.success)
    return {
      ok: false,
      error: VALIDATION_ERROR,
      fieldErrors: authFieldErrors(parsed.error),
      values,
    };

  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    return {
      ok: false,
      error: authErrorMessage(error),
      values,
      canResendConfirmation: isEmailNotConfirmedError(error),
    };
  }

  revalidatePath("/", "layout");
  redirect(next);
}
