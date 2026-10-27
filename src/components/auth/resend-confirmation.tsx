"use client";

import { useActionState } from "react";
import { MailCheck } from "lucide-react";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import type { AuthActionState } from "@/lib/profile/types";
import { resendConfirmationAction } from "./actions";

/** "Reenviar e-mail de confirmação" — usado no login (e-mail não confirmado) e após o cadastro. */
export function ResendConfirmation({ email, label = "Reenviar e-mail de confirmação" }: { email: string; label?: string }) {
  const [state, formAction] = useActionState<AuthActionState, FormData>(resendConfirmationAction, null);
  return (
    <form action={formAction} className="grid gap-3">
      <input type="hidden" name="email" value={email} />
      <FormMessage tone={state?.ok ? "success" : "error"}>{state ? (state.ok ? state.message : state.error) : null}</FormMessage>
      <SubmitButton variant="outline" pendingText="Reenviando…" className="justify-self-start">
        <MailCheck aria-hidden="true" />
        {label}
      </SubmitButton>
    </form>
  );
}
