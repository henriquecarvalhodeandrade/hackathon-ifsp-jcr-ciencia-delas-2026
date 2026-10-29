"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Send } from "lucide-react";
import { Field, FormMessage, SubmitButton, Textarea } from "@/components/ui";
import { applyToOpportunity } from "@/lib/opportunities/actions";
import { OPPORTUNITY_LIMITS } from "@/lib/opportunities/limits";
import type { ActionState, ApplyValues } from "@/lib/opportunities/types";

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
  const errors = state && !state.ok ? state.fieldErrors : undefined;
  const previous = state?.values?.message ?? "";

  return (
    <form action={formAction} noValidate className="grid gap-5">
      <input type="hidden" name="opportunity_id" value={opportunityId} />
      <FormMessage tone="error">{state && !state.ok ? state.error : null}</FormMessage>

      <Field
        label="Carta de apresentação"
        required
        hint={`Entre ${OPPORTUNITY_LIMITS.messageMin} e 2.000 caracteres. Seja você mesma: não precisa ter experiência, precisa ter vontade de aprender.`}
        error={errors?.message}
      >
        <Textarea
          key={previous}
          name="message"
          rows={8}
          maxLength={OPPORTUNITY_LIMITS.messageMax}
          showCount
          placeholder={PLACEHOLDER}
          defaultValue={previous}
        />
      </Field>

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
