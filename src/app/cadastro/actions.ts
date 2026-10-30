"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/env";
import { authRedirectUrl } from "@/lib/profile/auth-config";
import { rememberAuthNext } from "@/lib/profile/auth-next";
import { authFieldErrors, formText, signupSchema } from "@/lib/profile/auth-schemas";
import { authErrorMessage } from "@/lib/profile/errors";
import { safeNextPath, withNext } from "@/lib/profile/redirect";
import { NOT_CONFIGURED_ERROR, VALIDATION_ERROR } from "@/lib/profile/save";
import type { AuthActionState } from "@/lib/profile/types";
import { createClient } from "@/lib/supabase/server";

const DEFAULT_NEXT = "/onboarding";

/**
 * Cadastro com e-mail e senha. Com confirmação de e-mail ligada (padrão, local e Cloud),
 * mostra "confira seu e-mail"; se o Supabase devolver a sessão na hora (confirmação
 * desligada), segue direto para o onboarding.
 */
export async function signUpAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const values = {
    full_name: formText(formData, "full_name"),
    email: formText(formData, "email").trim(),
    terms: formData.get("terms") === "on",
  };
  const next = safeNextPath(formText(formData, "next"), DEFAULT_NEXT);
  if (!isSupabaseConfigured()) return { ok: false, error: NOT_CONFIGURED_ERROR, values };

  const parsed = signupSchema.safeParse({
    full_name: values.full_name,
    email: values.email,
    password: formText(formData, "password"),
    terms: formData.get("terms") ?? undefined,
  });
  if (!parsed.success)
    return {
      ok: false,
      error: VALIDATION_ERROR,
      fieldErrors: authFieldErrors(parsed.error),
      values,
    };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.full_name },
      emailRedirectTo: authRedirectUrl(`/auth/confirm?next=${DEFAULT_NEXT}`),
    },
  });
  if (error) {
    console.warn(`[auth] cadastro falhou (${error.status ?? ""} ${error.code ?? ""})`);
    return { ok: false, error: authErrorMessage(error), values };
  }

  if (data.session) {
    revalidatePath("/", "layout");
    redirect(withNext("/onboarding", next, DEFAULT_NEXT));
  }

  // O modelo de e-mail leva a /onboarding; o cookie preserva um ?next diferente.
  await rememberAuthNext(next === DEFAULT_NEXT ? null : next);
  return {
    ok: true,
    kind: "signup_email_sent",
    message: `Enviamos um link de confirmação para ${parsed.data.email}.`,
    values: { full_name: parsed.data.full_name, email: parsed.data.email },
  };
}
