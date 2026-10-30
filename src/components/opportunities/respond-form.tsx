"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { ChevronDown, CircleCheck, CircleX, Search } from "lucide-react";
import { MessageButton } from "@/components/messages/message-button";
import {
  Button,
  Dialog,
  Field,
  FormMessage,
  SubmitButton,
  Textarea,
  type ButtonProps,
} from "@/components/ui";
import { respondToApplication } from "@/lib/opportunities/actions";
import {
  OWNER_DECISION_LABELS,
  ownerDecisionsFor,
  type ApplicationStatus,
  type OwnerDecision,
} from "@/lib/opportunities/labels";
import { OPPORTUNITY_LIMITS } from "@/lib/opportunities/limits";
import type { ActionState, RespondValues } from "@/lib/opportunities/types";
import { cn } from "@/lib/utils";
import { ApplicationStatusBadge } from "./status-badges";

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

/** Botão de decisão (envia o formulário com `decision=<valor>`). */
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

/** Desfazer uma aprovação pede confirmação (a candidata já foi avisada e pode ter escrito). */
function UndoApprovalButton({
  value,
  applicantName,
}: {
  value: Exclude<OwnerDecision, "accepted">;
  applicantName: string;
}) {
  const [open, setOpen] = useState(false);
  const { variant, icon: Icon, pending } = DECISION_STYLE[value];
  return (
    <>
      <Button variant={variant} size="sm" onClick={() => setOpen(true)} aria-haspopup="dialog">
        <Icon aria-hidden="true" />
        {OWNER_DECISION_LABELS[value]}
      </Button>
      {/* O diálogo fica dentro do <form>: o botão de confirmar envia `decision=<valor>`. */}
      <Dialog
        open={open}
        onOpenChange={setOpen}
        size="sm"
        title={`Desfazer a aprovação de ${applicantName}?`}
        description={
          value === "declined"
            ? `${applicantName} recebe um aviso de que a candidatura não foi aprovada, com o recado que estiver no campo.`
            : `${applicantName} recebe um aviso de que a candidatura voltou para análise.`
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Manter aprovada
            </Button>
            <SubmitButton name="decision" value={value} variant="danger" pendingText={pending}>
              {value === "declined" ? "Sim, não aprovar" : "Sim, voltar para análise"}
            </SubmitButton>
          </>
        }
      />
    </>
  );
}

export interface ApplicationDecisionProps {
  applicationId: string;
  opportunityId: string;
  status: ApplicationStatus;
  applicantId: string | null;
  /** Primeiro nome da candidata ("Recado para Larissa"). */
  applicantName: string;
  /** Recado já enviado (a dona pode reescrever ao mudar a decisão). */
  currentNote: string | null;
}

/**
 * Decisão da dona sobre uma candidatura. Nova: o formulário (recado opcional + em análise, aprovar
 * ou não aprovar). Já respondida: um resumo (decisão + "Seu recado") e "Mudar decisão", que revela
 * o formulário — desfazer uma aprovação pede confirmação. Depois de decidir, o foco vai para o
 * resumo, que anuncia o resultado. Desistência não tem volta (nada a decidir).
 */
export function ApplicationDecision({
  applicationId,
  opportunityId,
  status,
  applicantId,
  applicantName,
  currentNote,
}: ApplicationDecisionProps) {
  const [state, formAction] = useActionState<ActionState<RespondValues>, FormData>(
    respondToApplication,
    null,
  );
  const formId = useId();
  const summaryRef = useRef<HTMLDivElement>(null);
  const decisions = ownerDecisionsFor(status);
  const decided = status === "accepted" || status === "declined";
  const [editing, setEditing] = useState(false);
  const [lastState, setLastState] = useState(state);
  // Muda a cada resposta da action: remonta os botões de confirmação (fecha o diálogo).
  const [version, setVersion] = useState(0);
  if (state !== lastState) {
    setLastState(state);
    setVersion((v) => v + 1);
    // Decisão registrada: o formulário recolhe e o resumo mostra o resultado.
    if (state?.ok) setEditing(false);
  }

  useEffect(() => {
    if (state?.ok) summaryRef.current?.focus();
  }, [state]);

  if (decisions.length === 0) return null;

  const errors = state && !state.ok ? state.fieldErrors : undefined;
  // Erro: o texto digitado volta. Sucesso: a página recarrega com o recado salvo.
  const note = state && !state.ok ? (state.values?.owner_note ?? "") : (currentNote ?? "");
  const showForm = !decided || editing;

  return (
    <div className="grid gap-3">
      {status !== "submitted" && (
        <div
          ref={summaryRef}
          tabIndex={-1}
          className="grid gap-2 rounded-control bg-surface-2 p-3.5 text-sm outline-offset-2"
        >
          <p className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-fg">Sua decisão:</span>
            <ApplicationStatusBadge status={status} viewer="owner" />
          </p>
          <p className="break-words whitespace-pre-line text-fg-muted">
            {currentNote ? (
              <>
                <span className="font-semibold text-fg">Seu recado:</span> “{currentNote}”
              </>
            ) : (
              `Sem recado para ${applicantName}.`
            )}
          </p>
          <FormMessage tone="success">{state?.ok ? state.message : null}</FormMessage>
        </div>
      )}

      {decided && (
        <div className="flex flex-wrap items-center gap-2">
          {status === "accepted" && applicantId && (
            <MessageButton
              profileId={applicantId}
              label="Enviar mensagem"
              variant="outline"
              size="sm"
            />
          )}
          <Button
            variant="ghost"
            size="sm"
            aria-expanded={editing}
            aria-controls={formId}
            onClick={() => setEditing((value) => !value)}
          >
            Mudar decisão
            <ChevronDown
              aria-hidden="true"
              className={cn("transition-transform", editing && "rotate-180")}
            />
          </Button>
        </div>
      )}

      <form id={formId} action={formAction} noValidate hidden={!showForm} className="grid gap-3">
        <input type="hidden" name="application_id" value={applicationId} />
        <input type="hidden" name="opportunity_id" value={opportunityId} />
        <FormMessage tone="error">{state && !state.ok ? state.error : null}</FormMessage>
        {status === "submitted" && (
          <FormMessage tone="success">{state?.ok ? state.message : null}</FormMessage>
        )}
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
          {DECISION_ORDER.filter((d) => decisions.includes(d)).map((decision) =>
            status === "accepted" && decision !== "accepted" ? (
              <UndoApprovalButton
                key={`${decision}-${version}`}
                value={decision}
                applicantName={applicantName}
              />
            ) : (
              <DecisionButton key={decision} value={decision} />
            ),
          )}
        </div>
      </form>
    </div>
  );
}
