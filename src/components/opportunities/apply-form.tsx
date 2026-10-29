"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Send } from "lucide-react";
import { Field, FormMessage, revealFormMessage, SubmitButton, Textarea } from "@/components/ui";
import { applyToOpportunity } from "@/lib/opportunities/actions";
import { OPPORTUNITY_LIMITS } from "@/lib/opportunities/limits";
import { missingCharsLabel } from "@/lib/opportunities/presentation";
import type { ActionState, ApplyValues } from "@/lib/opportunities/types";
import { APPLY_MESSAGE_ID } from "./apply-shortcut";

const PLACEHOLDER =
  "Conte quem você é (curso, semestre, escola), o que já estudou ou fez que tem a ver com esta vaga, por que ela te interessa e quantas horas por semana você tem disponíveis.";

export interface ApplyFormProps {
  opportunityId: string;
  /** Primeiro nome de quem publicou ("Marina verá…"). */
  ownerName: string;
  /** Links do perfil da candidata, mostrados como informação (ela não edita aqui). */
  profileLinks: React.ReactNode;
  /** A candidata tem Lattes ou ORCID no perfil (muda a frase que apresenta os links). */
  hasProfileLinks: boolean;
}

/**
 * Candidatar-se: carta de apresentação (30–2.000 caracteres). A Server Action grava a candidatura
 * e volta para a vaga com o andamento no lugar do formulário.
 */
export function ApplyForm({
  opportunityId,
  ownerName,
  profileLinks,
  hasProfileLinks,
}: ApplyFormProps) {
  const [state, formAction] = useActionState<ActionState<ApplyValues>, FormData>(
    applyToOpportunity,
    null,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const messageRef = useRef<HTMLDivElement>(null);
  const errors = state && !state.ok ? state.fieldErrors : undefined;
  const previous = state?.values?.message ?? "";
  const [length, setLength] = useState(0);
  const [lastState, setLastState] = useState(state);
  if (state !== lastState) {
    setLastState(state);
    setLength(previous.trim().length);
  }
  const missing = missingCharsLabel(length, OPPORTUNITY_LIMITS.messageMin);

  // Depois de um envio com erro: foco no campo inválido; erro geral (limite do dia, vaga
  // encerrada…) aparece no topo do formulário — rola até ele.
  useEffect(() => {
    if (!state || state.ok) return;
    const invalid = state.fieldErrors
      ? formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')
      : null;
    if (invalid) invalid.focus();
    else revealFormMessage(messageRef.current);
  }, [state]);

  return (
    <form ref={formRef} action={formAction} noValidate className="grid gap-5">
      <input type="hidden" name="opportunity_id" value={opportunityId} />
      <FormMessage ref={messageRef} tone="error">
        {state && !state.ok ? state.error : null}
      </FormMessage>

      <div className="grid gap-1.5">
        <Field
          label="Carta de apresentação"
          required
          hint={`Entre ${OPPORTUNITY_LIMITS.messageMin} e 2.000 caracteres. Seja você mesma: não precisa ter experiência, precisa ter vontade de aprender.`}
          error={errors?.message}
        >
          <Textarea
            key={previous}
            id={APPLY_MESSAGE_ID}
            name="message"
            rows={8}
            maxLength={OPPORTUNITY_LIMITS.messageMax}
            showCount
            placeholder={PLACEHOLDER}
            defaultValue={previous}
            onChange={(event) => setLength(event.currentTarget.value.trim().length)}
          />
        </Field>
        {/* Ajuda ao vivo enquanto a carta não chega ao mínimo (o erro do envio fica no Field). */}
        {missing && !errors?.message && (
          <p className="text-sm text-fg-muted">{missing} para o mínimo.</p>
        )}
      </div>

      <div className="grid gap-2 rounded-control bg-surface-2 p-3.5 text-sm text-fg-muted">
        <p>
          {ownerName} verá seu nome, seu{" "}
          <Link
            href="/perfil"
            className="font-semibold text-primary underline-offset-2 hover:underline"
          >
            perfil
          </Link>{" "}
          (título, etapa e instituição) e esta carta.
          {hasProfileLinks && " Do seu perfil, também vão junto:"}
        </p>
        {profileLinks}
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
        <SubmitButton pendingText="Enviando candidatura…">
          <Send aria-hidden="true" />
          Enviar candidatura
        </SubmitButton>
        <p className="text-sm text-fg-subtle">Você só pode se candidatar uma vez a cada vaga.</p>
      </div>
    </form>
  );
}
