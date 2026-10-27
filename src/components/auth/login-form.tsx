"use client";

import { useActionState } from "react";
import Link from "next/link";
import { LogIn, Mail } from "lucide-react";
import { Field } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { signInAction } from "@/app/entrar/actions";
import type { AuthActionState } from "@/lib/profile/types";
import { IntentSubmitButton } from "./intent-submit-button";
import { PasswordInput } from "./password-input";
import { ResendConfirmation } from "./resend-confirmation";

export interface LoginFormProps {
  /** Destino depois de entrar (já validado no servidor). */
  next: string;
}

/** Entrar com e-mail + senha ou pedir um link mágico — mesmo formulário, dois botões. */
export function LoginForm({ next }: LoginFormProps) {
  const [state, formAction] = useActionState<AuthActionState, FormData>(signInAction, null);
  const errors = state && !state.ok ? state.fieldErrors : undefined;
  const email = state?.values.email ?? "";
  const canResend = state !== null && !state.ok && state.canResendConfirmation && Boolean(email);

  return (
    <div className="grid gap-5">
      <form action={formAction} noValidate className="grid gap-5">
        <input type="hidden" name="next" value={next} />
        <FormMessage tone={state?.ok ? "success" : "error"}>
          {state ? (state.ok ? state.message : state.error) : null}
        </FormMessage>

        <Field label="E-mail" required error={errors?.email}>
          <Input name="email" type="email" autoComplete="email" inputMode="email" defaultValue={email} />
        </Field>

        <div className="grid gap-2">
          <Field label="Senha" error={errors?.password}>
            <PasswordInput name="password" autoComplete="current-password" />
          </Field>
          <Link
            href="/recuperar-senha"
            className="justify-self-end rounded-control text-sm font-semibold text-primary underline-offset-4 hover:underline"
          >
            Esqueci minha senha
          </Link>
        </div>

        <IntentSubmitButton intent="password" size="lg" fullWidth pendingText="Entrando…">
          <LogIn aria-hidden="true" />
          Entrar
        </IntentSubmitButton>

        <Separator label="ou, sem senha" />

        <div className="grid gap-2">
          <IntentSubmitButton intent="magic" variant="outline" fullWidth pendingText="Enviando link…">
            <Mail aria-hidden="true" />
            Receber link de acesso por e-mail
          </IntentSubmitButton>
          <p className="text-center text-sm text-fg-subtle">Enviamos um link que vale por 1 hora para o e-mail acima.</p>
        </div>
      </form>

      {canResend && <ResendConfirmation email={email} />}
    </div>
  );
}
