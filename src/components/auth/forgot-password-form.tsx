"use client";

import { useActionState } from "react";
import { Send } from "lucide-react";
import { Field } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { requestPasswordResetAction } from "@/app/recuperar-senha/actions";
import type { AuthActionState } from "@/lib/profile/types";

/** Pede o link de redefinição de senha por e-mail. */
export function ForgotPasswordForm() {
  const [state, formAction] = useActionState<AuthActionState, FormData>(requestPasswordResetAction, null);
  const errors = state && !state.ok ? state.fieldErrors : undefined;

  return (
    <form action={formAction} noValidate className="grid gap-5">
      <FormMessage tone={state?.ok ? "success" : "error"}>
        {state ? (state.ok ? state.message : state.error) : null}
      </FormMessage>
      <Field label="E-mail da sua conta" required error={errors?.email}>
        <Input name="email" type="email" autoComplete="email" inputMode="email" defaultValue={state?.values.email} />
      </Field>
      <SubmitButton size="lg" fullWidth pendingText="Enviando…">
        <Send aria-hidden="true" />
        Enviar link de redefinição
      </SubmitButton>
    </form>
  );
}
