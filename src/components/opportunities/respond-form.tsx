"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { CircleCheck, CircleX, Search } from "lucide-react";
import { Button, Field, FormMessage, Textarea, type ButtonProps } from "@/components/ui";
import { respondToApplication } from "@/lib/opportunities/actions";
import {
  OWNER_DECISION_LABELS,
  ownerDecisionsFor,
  type ApplicationStatus,
  type OwnerDecision,
} from "@/lib/opportunities/labels";
import { OPPORTUNITY_LIMITS } from "@/lib/opportunities/limits";
import type { ActionState, RespondValues } from "@/lib/opportunities/types";

const DECISION_STYLE: Record<
  OwnerDecision,
  { variant: ButtonProps["variant"]; icon: typeof Search; pending: string }
> = {
  accepted: { variant: "primary", icon: CircleCheck, pending: "Aprovando…" },
  in_review: { variant: "outline", icon: Search, pending: "Marcando…" },
  declined: { variant: "outline", icon: CircleX, pending: "Registrando…" },
};

/** Ordem dos botões: o passo mais provável primeiro. */
const DECISION_ORDER: readonly OwnerDecision[] = ["accepted", "in_review", "declined"];

function DecisionButton({ value }: { value: OwnerDecision }) {
  const { pending, data } = useFormStatus();
  const isThis = pending && data?.get("decision") === value;
  const { variant, icon: Icon, pending: pendingText } = DECISION_STYLE[value];
  return (
    <Button
      type="submit"
      name="decision"
      value={value}
      variant={variant}
      size="sm"
      loading={isThis}
      loadingText={pendingText}
      disabled={pending}
    >
      <Icon aria-hidden="true" />
      {OWNER_DECISION_LABELS[value]}
    </Button>
  );
}

export interface RespondApplicationFormProps {
  applicationId: string;
  opportunityId: string;
  status: ApplicationStatus;
  /** Primeiro nome da candidata ("Recado para Larissa"). */
  applicantName: string;
  /** Recado já enviado (a dona pode reescrever ao mudar a decisão). */
  currentNote: string | null;
}

/**
 * Responder uma candidatura: em análise, aprovar ou não aprovar, com recado opcional para a
 * candidata. A dona pode mudar de ideia entre as três decisões; desistência não tem volta.
 */
export function RespondApplicationForm({
  applicationId,
  opportunityId,
  status,
  applicantName,
  currentNote,
}: RespondApplicationFormProps) {
  const [state, formAction] = useActionState<ActionState<RespondValues>, FormData>(
    respondToApplication,
    null,
  );
  const decisions = ownerDecisionsFor(status);
  const errors = state && !state.ok ? state.fieldErrors : undefined;
  // Erro: o texto digitado volta. Sucesso: a página recarrega com o recado salvo.
  const note = state && !state.ok ? (state.values?.owner_note ?? "") : (currentNote ?? "");

  if (decisions.length === 0) return null;

  return (
    <form action={formAction} noValidate className="grid gap-3">
      <input type="hidden" name="application_id" value={applicationId} />
      <input type="hidden" name="opportunity_id" value={opportunityId} />
      <FormMessage tone={state?.ok ? "success" : "error"}>
        {state ? (state.ok ? state.message : state.error) : null}
      </FormMessage>
      <Field
        label={`Recado para ${applicantName}`}
        optional
        hint="Ela vê o recado junto com a decisão. Ex.: próximos passos, um horário para conversar ou um incentivo."
        error={errors?.owner_note}
      >
        <Textarea
          key={`${status}-${note}`}
          name="owner_note"
          rows={3}
          maxLength={OPPORTUNITY_LIMITS.ownerNoteMax}
          showCount
          defaultValue={note}
        />
      </Field>
      <div className="flex flex-wrap gap-2">
        {DECISION_ORDER.filter((d) => decisions.includes(d)).map((decision) => (
          <DecisionButton key={decision} value={decision} />
        ))}
      </div>
    </form>
  );
}
