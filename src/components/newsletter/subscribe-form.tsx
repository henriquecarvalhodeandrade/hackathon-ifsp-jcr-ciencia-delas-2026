"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { CircleAlert, MailCheck, Mail, Send } from "lucide-react";
import {
  Alert,
  Button,
  Checkbox,
  ChipGroup,
  Field,
  FormMessage,
  Input,
  SubmitButton,
} from "@/components/ui";
import { subscribeToNewsletter, type SubscribeState } from "@/app/newsletter/actions";
import { NEWSLETTER_AGE_TEXT, NEWSLETTER_CONSENT_TEXT } from "@/lib/newsletter/constants";
import { useFocusOnMount } from "./use-focus-on-mount";

export interface SubscribeFormProps {
  /** Grandes áreas do CNPq (opções de interesse). */
  areas: ReadonlyArray<{ id: number; name: string }>;
  /** E-mail da conta da membra logada (atalho "Assinar com meu e-mail"). */
  accountEmail?: string | null;
  /** Desliga o formulário (inscrições fechadas neste ambiente). */
  disabled?: boolean;
}

const PRIVACY_LABEL = "Política de Privacidade";

/** Texto exato do consentimento, com o trecho "Política de Privacidade" virando link. */
function ConsentLabel() {
  const [before, after] = NEWSLETTER_CONSENT_TEXT.split(PRIVACY_LABEL);
  if (after === undefined) return <>{NEWSLETTER_CONSENT_TEXT}</>;
  return (
    <>
      {before}
      <Link href="/privacidade" className="font-semibold text-primary underline underline-offset-2">
        {PRIVACY_LABEL}
      </Link>
      {after}
    </>
  );
}

function CheckboxError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="flex items-start gap-1.5 pl-8 text-sm font-medium text-danger">
      <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <span>{message}</span>
    </p>
  );
}

/** Painel que substitui o formulário após o envio; recebe o foco (o botão clicado deixou de existir). */
function SubscribeSuccess({
  message,
  devNotice,
  onReset,
}: {
  message: string;
  devNotice?: string;
  onReset: () => void;
}) {
  const titleRef = useFocusOnMount<HTMLParagraphElement>();
  return (
    <div className="grid gap-4" role="status" aria-live="polite">
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-success-soft text-success"
        >
          <MailCheck className="size-5" />
        </span>
        <div className="grid gap-1">
          <p
            ref={titleRef}
            tabIndex={-1}
            className="rounded-control font-display text-xl font-semibold text-fg"
          >
            Confira seu e-mail
          </p>
          <p className="text-fg-muted">{message}</p>
        </div>
      </div>
      {devNotice && (
        <Alert variant="warning" title="Só no desenvolvimento">
          {devNotice}
        </Alert>
      )}
      <div>
        <Button variant="outline" onClick={onReset}>
          Inscrever outro e-mail
        </Button>
      </div>
    </div>
  );
}

function SubscribeFormInner({
  areas,
  accountEmail,
  disabled,
  onReset,
  focusEmail,
}: SubscribeFormProps & { onReset: () => void; focusEmail: boolean }) {
  const [state, formAction] = useActionState<SubscribeState, FormData>(subscribeToNewsletter, null);
  // Depois de "Inscrever outro e-mail" o formulário volta: o foco vai para o campo de e-mail.
  const emailRef = useFocusOnMount<HTMLInputElement>(focusEmail);
  const errors = state && !state.ok ? state.fieldErrors : undefined;
  const values = state?.values;
  const email = values?.email ?? accountEmail ?? "";
  const usingAccountEmail =
    Boolean(accountEmail) && email.toLowerCase() === accountEmail?.toLowerCase();

  if (state?.ok) {
    return (
      <SubscribeSuccess message={state.message} devNotice={state.devNotice} onReset={onReset} />
    );
  }

  return (
    <form action={formAction} noValidate className="grid">
      {/* Região aria-live sempre montada; o espaçamento só aparece quando há mensagem. */}
      <FormMessage tone="error" className="has-[p]:mb-5">
        {state && !state.ok ? state.error : null}
      </FormMessage>

      <fieldset disabled={disabled} className="grid gap-5 disabled:opacity-70">
        {/* Armadilha para robôs: fora da tela e escondida de leitores de tela. */}
        <div aria-hidden="true" className="absolute -left-[9999px] size-px overflow-hidden">
          <label>
            Deixe este campo em branco
            <input type="text" name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
          </label>
        </div>

        <Field
          label="Seu e-mail"
          required
          hint={
            accountEmail
              ? "Preenchemos com o e-mail da sua conta. Pode trocar se preferir."
              : undefined
          }
          error={errors?.email}
        >
          <Input
            ref={emailRef}
            key={`email-${email}`}
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder="nome@instituicao.edu.br"
            leadingIcon={<Mail />}
            defaultValue={email}
            maxLength={254}
          />
        </Field>

        {areas.length > 0 && (
          <ChipGroup
            key={`areas-${values?.areas.join(",") ?? ""}`}
            name="areas"
            legend="Áreas de interesse (opcional)"
            hint="Sem escolher nenhuma, você recebe todas as edições. Com áreas, recebe as edições que têm papers delas."
            options={areas.map((a) => ({ value: String(a.id), label: a.name }))}
            defaultValue={values?.areas}
            error={errors?.areas}
          />
        )}

        <div className="grid gap-3 rounded-control border border-border bg-surface-2 p-4">
          <div className="grid gap-1.5">
            <Checkbox
              key={`consent-${values?.consent ? 1 : 0}`}
              name="consent"
              label={<ConsentLabel />}
              defaultChecked={values?.consent}
              aria-invalid={errors?.consent ? true : undefined}
              aria-describedby={errors?.consent ? "newsletter-consent-erro" : undefined}
              required
            />
            <CheckboxError id="newsletter-consent-erro" message={errors?.consent?.[0]} />
          </div>
          <div className="grid gap-1.5">
            <Checkbox
              key={`age-${values?.age ? 1 : 0}`}
              name="age"
              label={NEWSLETTER_AGE_TEXT}
              description="Alguns destaques tratam de temas sensíveis, como assédio e saúde mental."
              defaultChecked={values?.age}
              aria-invalid={errors?.age ? true : undefined}
              aria-describedby={errors?.age ? "newsletter-age-erro" : undefined}
              required
            />
            <CheckboxError id="newsletter-age-erro" message={errors?.age?.[0]} />
          </div>
        </div>

        <div className="grid gap-3">
          <SubmitButton pendingText="Inscrevendo…" size="lg" fullWidth>
            <Send aria-hidden="true" />
            {usingAccountEmail ? "Assinar com meu e-mail" : "Assinar o boletim"}
          </SubmitButton>
          <p className="text-center text-sm text-fg-subtle">
            Um e-mail por semana, sem propaganda. Cancele com um clique.
          </p>
        </div>
      </fieldset>
    </form>
  );
}

/** Formulário de inscrição (double opt-in) com consentimento LGPD e confirmação de idade. */
export function SubscribeForm(props: SubscribeFormProps) {
  const [round, setRound] = useState(0);
  return (
    <SubscribeFormInner
      key={round}
      {...props}
      focusEmail={round > 0}
      onReset={() => setRound((r) => r + 1)}
    />
  );
}
