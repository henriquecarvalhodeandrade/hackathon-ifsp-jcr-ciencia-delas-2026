"use client";

import { useActionState, useEffect, useRef } from "react";
import { Send, ShieldAlert } from "lucide-react";
import { Alert, Checkbox, Field, FormMessage, SubmitButton, Textarea } from "@/components/ui";
import {
  CONNECTION_ERROR_KEEP_TEXT,
  freshNonce,
  withConnectionFallback,
} from "@/lib/forum/client-action";
import { submitAnswer, type AnswerFormState } from "@/lib/pergunte/actions";
import { ANSWER_LIMITS, readAnswerForm } from "@/lib/pergunte/schemas";
import { PersonalDataHint, usePersonalDataCheck } from "./personal-data-hint";

const action = withConnectionFallback<AnswerFormState, FormData>(submitAnswer, (formData) => {
  const { body, showIdentity } = readAnswerForm(formData);
  return {
    ok: false,
    error: CONNECTION_ERROR_KEEP_TEXT,
    values: { body, showIdentity },
    nonce: freshNonce(),
  };
});

/** Resposta pública de uma membra (identidade só se ela marcar, resposta por resposta). */
export function AnswerForm({ questionId }: { questionId: string }) {
  const [state, formAction] = useActionState<AnswerFormState, FormData>(action, null);
  const formRef = useRef<HTMLFormElement>(null);
  const personalData = usePersonalDataCheck({ allowLinks: true });
  const resetPersonalData = personalData.reset;

  useEffect(() => {
    if (!state) return;
    if (!state.ok) {
      formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
      return;
    }
    // Resposta publicada: o campo volta vazio, e o aviso some junto.
    resetPersonalData();
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    requestAnimationFrame(() => {
      document
        .getElementById(`resposta-${state.answerId}`)
        ?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
    });
  }, [state, resetPersonalData]);

  const failure = state && !state.ok ? state : null;
  const values = failure?.values ?? { body: "", showIdentity: false };
  const errors = failure?.fieldErrors;
  // O erro do texto aparece junto do campo; os demais (sessão, limite, pergunta fechada), no topo.
  const message = state?.ok ? state.message : errors?.body ? null : (failure?.error ?? null);

  return (
    <form ref={formRef} action={formAction} noValidate className="grid gap-5">
      <input type="hidden" name="questionId" value={questionId} />

      <Alert variant="warning" icon={<ShieldAlert />} title="Antes de responder">
        Quem pergunta pode ter menos de 18 anos. Responda em público, sem pedir nem oferecer
        contatos privados, e indique caminhos públicos.
      </Alert>

      <FormMessage tone={state?.ok ? "success" : "error"}>{message}</FormMessage>

      <div key={state?.nonce ?? "inicial"} className="grid gap-4">
        <Field
          label="Sua resposta"
          hint="Conte da sua experiência com acolhimento. Links para sites oficiais podem; e-mail, telefone e redes sociais, não."
          required
          error={errors?.body}
        >
          <Textarea
            name="body"
            rows={7}
            maxLength={ANSWER_LIMITS.max}
            showCount
            defaultValue={values.body}
            onChange={(event) => personalData.check(event.currentTarget.value)}
          />
        </Field>
        <PersonalDataHint matches={personalData.matches} context="resposta" />
        <Checkbox
          name="showIdentity"
          defaultChecked={values.showIdentity}
          label="Mostrar meu nome e minha etapa da carreira nesta resposta"
          description="Desmarcado, a resposta aparece como “Uma cientista da rede”. A moderação sempre vê quem respondeu."
        />
      </div>

      <div>
        <SubmitButton pendingText="Publicando…">
          <Send aria-hidden="true" />
          Publicar resposta
        </SubmitButton>
      </div>
    </form>
  );
}
