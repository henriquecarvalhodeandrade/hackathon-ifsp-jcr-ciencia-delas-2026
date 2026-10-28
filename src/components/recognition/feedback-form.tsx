"use client";

import { useActionState, useEffect, useId, useRef } from "react";
import { CircleAlert, Send } from "lucide-react";
import {
  ButtonLink,
  Checkbox,
  Field,
  FormMessage,
  Radio,
  RadioGroup,
  SubmitButton,
  Textarea,
  revealFormMessage,
} from "@/components/ui";
import { submitFeedbackAction } from "@/lib/recognition/actions";
import { outcomesFor, type FeedbackRole } from "@/lib/recognition/outcomes";
import { NOTE_MAX, WOULD_RECOMMEND_OPTIONS } from "@/lib/recognition/schemas";
import type { FeedbackState } from "@/lib/recognition/types";

const SCALE = ["1", "2", "3", "4", "5"] as const;

/**
 * Retorno privado da mentoria concluída (30 segundos). Só a nota de ajuda é obrigatória — e o
 * retorno inteiro é opcional: "Agora não" volta para as mentorias. Funciona sem JavaScript
 * (formulário nativo + Server Action); com erro, as respostas voltam preenchidas.
 */
export function FeedbackForm({
  requestId,
  role,
  otherFirstName,
}: {
  requestId: string;
  role: FeedbackRole;
  otherFirstName: string;
}) {
  const [state, formAction] = useActionState<FeedbackState, FormData>(submitFeedbackAction, null);
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const messageRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const values = state?.values;
  const errors = state?.fieldErrors;
  // Remonta os campos com as respostas devolvidas (o React limpa o formulário a cada envio).
  const fieldsKey = values ? JSON.stringify(values) : "inicial";
  const helpfulnessError = errors?.helpfulness?.[0];
  const outcomes = outcomesFor(role);

  // Erro de campo: o foco vai para o primeiro campo inválido (o botão de envio fica desabilitado
  // durante o envio e o foco cairia no <body>); erro geral: a mensagem aparece na tela.
  useEffect(() => {
    if (!state || state.ok) return;
    const invalid = formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
    if (invalid) invalid.focus();
    else revealFormMessage(messageRef.current);
  }, [state]);

  return (
    <form ref={formRef} action={formAction} noValidate className="grid gap-7">
      <input type="hidden" name="request_id" value={requestId} />
      <FormMessage ref={messageRef} tone="error">
        {state && !state.ok ? state.error : null}
      </FormMessage>

      <div key={fieldsKey} className="grid gap-7">
        <fieldset
          className="grid gap-2"
          aria-describedby={helpfulnessError ? `${id}-ajuda-erro` : undefined}
        >
          <legend className="mb-1 text-sm font-semibold text-fg">
            Quanto a mentoria ajudou você?
            <span aria-hidden="true" className="ml-0.5 text-danger">
              *
            </span>
          </legend>
          <div className="grid grid-cols-5 gap-2 sm:max-w-md">
            {SCALE.map((value) => (
              <Radio
                key={value}
                name="helpfulness"
                value={value}
                variant="card"
                required
                defaultChecked={values?.helpfulness === value}
                aria-invalid={helpfulnessError ? true : undefined}
                className="flex-col items-center gap-1.5 px-1 py-3 text-center"
                label={
                  <span className="font-display text-lg leading-none tabular">
                    {value}
                    <span className="sr-only">
                      {value === "1" ? " (ajudou pouco)" : value === "5" ? " (ajudou muito)" : ""}
                    </span>
                  </span>
                }
              />
            ))}
          </div>
          <div
            aria-hidden="true"
            className="flex justify-between text-sm text-fg-muted sm:max-w-md"
          >
            <span>Ajudou pouco</span>
            <span>Ajudou muito</span>
          </div>
          {helpfulnessError && (
            <p
              id={`${id}-ajuda-erro`}
              className="flex items-start gap-1.5 text-sm font-medium text-danger"
            >
              <CircleAlert aria-hidden="true" className="mt-0.5 size-4" />
              <span>{helpfulnessError}</span>
            </p>
          )}
        </fieldset>

        <fieldset className="grid gap-2" aria-describedby={`${id}-mudou-dica`}>
          <legend className="mb-1 text-sm font-semibold text-fg">
            {role === "mentee"
              ? "O que mudou para você com a mentoria?"
              : `O que acompanhar ${otherFirstName} trouxe para você?`}
          </legend>
          <p id={`${id}-mudou-dica`} className="-mt-1 mb-1 text-sm text-fg-muted">
            Marque quantas quiser, ou nenhuma.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {outcomes.map((outcome) => (
              <Checkbox
                key={outcome.slug}
                name="outcomes"
                value={outcome.slug}
                label={outcome.label}
                defaultChecked={values?.outcomes.includes(outcome.slug)}
                className="rounded-control border border-border bg-surface p-3.5 transition-colors hover:border-border-strong has-checked:border-primary has-checked:bg-primary-soft/50"
              />
            ))}
          </div>
          {errors?.outcomes?.[0] && (
            <p className="flex items-start gap-1.5 text-sm font-medium text-danger">
              <CircleAlert aria-hidden="true" className="mt-0.5 size-4" />
              <span>{errors.outcomes[0]}</span>
            </p>
          )}
        </fieldset>

        <RadioGroup
          name="would_recommend"
          legend="Você indicaria a Artemis para outra pesquisadora?"
          options={WOULD_RECOMMEND_OPTIONS}
          defaultValue={values?.would_recommend}
          orientation="horizontal"
          error={errors?.would_recommend}
        />

        <Field
          label="Quer deixar uma nota?"
          optional
          hint="Só você vê esta nota."
          error={errors?.note}
        >
          <Textarea
            name="note"
            rows={3}
            maxLength={NOTE_MAX}
            showCount
            defaultValue={values?.note ?? ""}
          />
        </Field>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-border pt-5">
        <SubmitButton pendingText="Enviando…">
          <Send aria-hidden="true" />
          Enviar meu retorno
        </SubmitButton>
        <ButtonLink href="/mentoria?aba=ativas" variant="ghost">
          Agora não
        </ButtonLink>
      </div>
    </form>
  );
}
