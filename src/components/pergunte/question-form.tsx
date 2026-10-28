"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { z } from "zod";
import { Send, ShieldCheck } from "lucide-react";
import {
  Alert,
  Field,
  FormMessage,
  revealFormMessage,
  Select,
  SubmitButton,
  Textarea,
} from "@/components/ui";
import {
  CONNECTION_ERROR_KEEP_TEXT,
  freshNonce,
  withConnectionFallback,
} from "@/lib/forum/client-action";
import { submitQuestion, type QuestionFormState } from "@/lib/pergunte/actions";
import { STAGE_OPTIONS } from "@/lib/pergunte/labels";
import { QUESTION_LIMITS, questionSchema, readQuestionForm } from "@/lib/pergunte/schemas";
import { PersonalDataHint, usePersonalDataCheck } from "./personal-data-hint";
import { TrackingLinkCard } from "./tracking-link-card";

/**
 * Antes de chamar o servidor, a mesma validação do servidor roda aqui (tamanho, etapa, área e
 * dados pessoais, com as mesmas mensagens): quem escreveu um telefone sem querer recebe o aviso
 * na hora, e o texto nem sai do navegador.
 */
async function validateThenSubmit(
  prev: QuestionFormState,
  formData: FormData,
): Promise<QuestionFormState> {
  const values = readQuestionForm(formData);
  const parsed = questionSchema.safeParse(values);
  if (!parsed.success) {
    const fieldErrors = z.flattenError(parsed.error).fieldErrors;
    return {
      ok: false,
      error: fieldErrors.body?.[0] ?? "Confira os campos destacados.",
      fieldErrors,
      values,
      nonce: freshNonce(),
    };
  }
  return submitQuestion(prev, formData);
}

const action = withConnectionFallback<QuestionFormState, FormData>(
  validateThenSubmit,
  (formData) => ({
    ok: false,
    error: CONNECTION_ERROR_KEEP_TEXT,
    values: readQuestionForm(formData),
    nonce: freshNonce(),
  }),
);

export interface QuestionFormProps {
  areas: ReadonlyArray<{ id: number; name: string }>;
  /** Momento em que o servidor montou o formulário (envio rápido demais parece robô). */
  renderedAt: number;
}

/** Formulário da pergunta anônima (sem conta, sem nome, sem contato). */
export function QuestionForm({ areas, renderedAt }: QuestionFormProps) {
  const [state, formAction] = useActionState<QuestionFormState, FormData>(action, null);
  const [dismissedToken, setDismissedToken] = useState<string | null>(null);
  const personalData = usePersonalDataCheck();
  const formRef = useRef<HTMLFormElement>(null);
  const messageRef = useRef<HTMLDivElement>(null);

  const success = state?.ok && state.token !== dismissedToken ? state : null;
  const failure = state && !state.ok ? state : null;
  const values = failure?.values ?? { body: "", stage: "", areaId: "" };
  const errors = failure?.fieldErrors;

  useEffect(() => {
    if (!state || state.ok) return;
    const invalid = formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
    if (invalid) invalid.focus();
    else revealFormMessage(messageRef.current);
  }, [state]);

  if (success) {
    return (
      <TrackingLinkCard
        token={success.token}
        onNewQuestion={() => {
          setDismissedToken(success.token);
          personalData.reset();
          // O botão some junto com o cartão: o foco vai para o campo da nova pergunta.
          requestAnimationFrame(() =>
            document.querySelector<HTMLTextAreaElement>('textarea[name="body"]')?.focus(),
          );
        }}
      />
    );
  }

  return (
    <form ref={formRef} action={formAction} noValidate className="grid gap-5">
      <Alert variant="info" icon={<ShieldCheck />} title="Sua pergunta é anônima">
        Não escreva seu nome, sua escola, e-mail, telefone ou @ de redes sociais. Toda pergunta
        passa pela moderação antes de aparecer.
      </Alert>

      <FormMessage ref={messageRef} tone="error">
        {failure && !failure.fieldErrors?.body ? failure.error : null}
      </FormMessage>

      <div key={failure?.nonce ?? "inicial"} className="grid gap-5">
        <div className="grid gap-2">
          <Field
            label="Sua pergunta"
            hint={`Conte o que você quer saber sobre ciência ou carreira científica. Entre ${QUESTION_LIMITS.min} e ${QUESTION_LIMITS.max} caracteres.`}
            required
            error={errors?.body}
          >
            <Textarea
              name="body"
              rows={6}
              maxLength={QUESTION_LIMITS.max}
              showCount
              defaultValue={values.body}
              placeholder="Ex.: Como é o dia a dia de quem pesquisa os oceanos?"
              onChange={(event) => personalData.check(event.currentTarget.value)}
            />
          </Field>
          <PersonalDataHint matches={personalData.matches} context="pergunta" />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Você está no" optional error={errors?.stage}>
            <Select
              name="stage"
              defaultValue={values.stage}
              placeholder="Prefiro não dizer"
              options={STAGE_OPTIONS}
            />
          </Field>
          <Field label="Área da pergunta" optional error={errors?.areaId}>
            <Select
              name="areaId"
              defaultValue={values.areaId}
              placeholder="Não sei ou prefiro não dizer"
              options={areas.map((area) => ({ value: String(area.id), label: area.name }))}
            />
          </Field>
        </div>
      </div>

      {/* Armadilha para robôs: invisível e fora da ordem de tabulação. Pessoas não preenchem. */}
      <div aria-hidden="true" className="sr-only">
        <label htmlFor="pergunta-site">Deixe este campo em branco</label>
        <input
          id="pergunta-site"
          type="text"
          name="site"
          tabIndex={-1}
          autoComplete="off"
          defaultValue=""
          aria-hidden="true"
        />
      </div>
      <input type="hidden" name="renderedAt" value={renderedAt} />

      <div className="grid gap-3 sm:flex sm:items-center sm:justify-between">
        <SubmitButton pendingText="Enviando…" size="lg">
          <Send aria-hidden="true" />
          Enviar pergunta
        </SubmitButton>
        <p className="text-sm text-fg-muted sm:max-w-xs sm:text-right">
          Não guardamos nome, e-mail, IP nem conta de quem pergunta, nem quando você está logada.
        </p>
      </div>
    </form>
  );
}
