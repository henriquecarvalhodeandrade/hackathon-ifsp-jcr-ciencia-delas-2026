"use client";

import { useActionState, useEffect, useRef } from "react";
import { CircleCheck, KeyRound } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { updatePasswordAction } from "@/app/redefinir-senha/actions";
import type { AuthActionState } from "@/lib/profile/types";
import { PasswordInput } from "./password-input";

function PasswordUpdated({ message }: { message: string }) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    headingRef.current?.focus();
  }, []);
  return (
    <section aria-labelledby="senha-atualizada" className="grid gap-5">
      <div className="flex items-start gap-4 rounded-card border border-success/30 bg-success-soft p-5 text-success-soft-fg">
        <CircleCheck aria-hidden="true" className="mt-0.5 size-6 shrink-0 text-success" />
        <div className="grid gap-1">
          <h2
            id="senha-atualizada"
            ref={headingRef}
            tabIndex={-1}
            className="font-display text-xl font-semibold outline-none"
          >
            Tudo certo!
          </h2>
          <p>{message}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-3">
        <ButtonLink href="/forum">Ir para a comunidade</ButtonLink>
        <ButtonLink href="/perfil" variant="outline">
          Ver meu perfil
        </ButtonLink>
      </div>
    </section>
  );
}

/** Nova senha + confirmação (exige sessão: link de recuperação ou login normal). */
export function ResetPasswordForm() {
  const [state, formAction] = useActionState<AuthActionState, FormData>(updatePasswordAction, null);
  if (state?.ok) return <PasswordUpdated message={state.message} />;
  const errors = state && !state.ok ? state.fieldErrors : undefined;

  return (
    <form action={formAction} noValidate className="grid gap-5">
      <FormMessage tone="error">{state && !state.ok ? state.error : null}</FormMessage>
      <Field label="Nova senha" required error={errors?.password} hint="Pelo menos 8 caracteres.">
        <PasswordInput name="password" autoComplete="new-password" />
      </Field>
      <Field label="Repita a nova senha" required error={errors?.password_confirm}>
        <PasswordInput name="password_confirm" autoComplete="new-password" />
      </Field>
      <SubmitButton size="lg" fullWidth pendingText="Salvando…">
        <KeyRound aria-hidden="true" />
        Salvar nova senha
      </SubmitButton>
    </form>
  );
}
