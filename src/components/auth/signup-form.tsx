"use client";

import { useActionState, useEffect, useRef } from "react";
import Link from "next/link";
import { MailCheck, UserPlus } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { signUpAction } from "@/app/cadastro/actions";
import type { AuthActionState } from "@/lib/profile/types";
import { PasswordInput } from "./password-input";
import { ResendConfirmation } from "./resend-confirmation";

export interface SignupFormProps {
  next: string;
  /** Aviso do Mailpit (só em desenvolvimento), renderizado no servidor. */
  devNotice?: React.ReactNode;
}

const linkClass = "font-semibold text-primary underline underline-offset-2 hover:decoration-2";

function CheckEmail({ email, devNotice }: { email: string; devNotice?: React.ReactNode }) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    headingRef.current?.focus();
  }, []);
  return (
    <section aria-labelledby="confira-email" className="grid gap-5">
      <div className="flex items-start gap-4 rounded-card border border-success/30 bg-success-soft p-5 text-success-soft-fg">
        <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-surface text-success">
          <MailCheck aria-hidden="true" className="size-6" />
        </span>
        <div className="grid gap-1.5">
          <h2
            id="confira-email"
            ref={headingRef}
            tabIndex={-1}
            className="font-display text-xl font-semibold outline-none"
          >
            Confira seu e-mail
          </h2>
          <p>
            Enviamos um link de confirmação para <strong className="break-all">{email}</strong>.
            Abra-o para ativar sua conta e completar seu perfil — ele vale por 1 hora.
          </p>
        </div>
      </div>
      <div className="grid gap-3 text-sm text-fg-muted">
        <p>Não chegou em alguns minutos? Procure na caixa de spam ou peça um novo envio.</p>
        <ResendConfirmation email={email} />
      </div>
      {devNotice}
    </section>
  );
}

/** Cadastro: nome, e-mail, senha e aceite do código de conduta e da política de privacidade. */
export function SignupForm({ next, devNotice }: SignupFormProps) {
  const [state, formAction] = useActionState<AuthActionState, FormData>(signUpAction, null);
  if (state?.ok && state.values.email)
    return <CheckEmail email={state.values.email} devNotice={devNotice} />;

  const errors = state && !state.ok ? state.fieldErrors : undefined;
  const values = state?.values;
  const termsError = errors?.terms?.[0];

  return (
    <form action={formAction} noValidate className="grid gap-5">
      <input type="hidden" name="next" value={next} />
      <FormMessage tone="error">{state && !state.ok ? state.error : null}</FormMessage>

      <Field
        label="Nome completo"
        required
        error={errors?.full_name}
        hint="É assim que você aparece para a comunidade."
      >
        <Input
          name="full_name"
          autoComplete="name"
          defaultValue={values?.full_name}
          maxLength={120}
        />
      </Field>

      <Field label="E-mail" required error={errors?.email}>
        <Input
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          defaultValue={values?.email}
        />
      </Field>

      <Field
        label="Senha"
        required
        error={errors?.password}
        hint="Pelo menos 8 caracteres. Uma frase curta que só você conhece é forte e fácil de lembrar."
      >
        <PasswordInput name="password" autoComplete="new-password" />
      </Field>

      <div className="grid gap-1.5">
        <Checkbox
          key={`terms-${values?.terms ? "1" : "0"}`}
          name="terms"
          defaultChecked={values?.terms}
          aria-invalid={termsError ? true : undefined}
          aria-describedby={termsError ? "erro-aceite" : undefined}
          required
          label={
            <>
              Li e aceito o{" "}
              <Link href="/conduta" target="_blank" className={linkClass}>
                código de conduta
                <span className="sr-only"> (abre em nova aba)</span>
              </Link>{" "}
              e a{" "}
              <Link href="/privacidade" target="_blank" className={linkClass}>
                política de privacidade
                <span className="sr-only"> (abre em nova aba)</span>
              </Link>
              .
            </>
          }
          description="Acolhimento, respeito e tolerância zero a assédio. Seus dados ficam visíveis só para membras."
        />
        {termsError && (
          <p id="erro-aceite" className="pl-8 text-sm font-medium text-danger">
            {termsError}
          </p>
        )}
      </div>

      <SubmitButton size="lg" fullWidth pendingText="Criando sua conta…">
        <UserPlus aria-hidden="true" />
        Criar conta
      </SubmitButton>
    </form>
  );
}
