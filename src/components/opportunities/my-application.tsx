import { MessageCircle, Undo2 } from "lucide-react";
import { ButtonLink, ConfirmDialog } from "@/components/ui";
import { withdrawApplication } from "@/lib/opportunities/actions";
import { canWithdraw, type ApplicationStatus } from "@/lib/opportunities/labels";
import type { Application } from "@/lib/opportunities/types";
import { QuotedMessage } from "./quoted-message";
import { ApplicationStatusBadge } from "./status-badges";
import { TimeAgo } from "./time-ago";

/** O que acontece agora, em uma frase, para cada status (visão da candidata). */
export function applicantStatusText(status: ApplicationStatus, ownerName: string): string {
  switch (status) {
    case "submitted":
      return `${ownerName} ainda não abriu sua candidatura. Você recebe uma notificação assim que ela responder.`;
    case "in_review":
      return `${ownerName} está analisando sua candidatura. Você recebe uma notificação quando ela decidir.`;
    case "accepted":
      return `Parabéns! ${ownerName} aprovou sua candidatura.`;
    case "declined":
      return "Desta vez não deu certo. Cada candidatura é um treino — que tal procurar outras vagas abertas?";
    case "withdrawn":
      return "Você desistiu desta candidatura. Não é possível se candidatar de novo à mesma vaga.";
  }
}

export interface MyApplicationProps {
  application: Application;
  ownerId: string;
  /** Primeiro nome de quem publicou a vaga. */
  ownerName: string;
  /** Mostra a carta enviada (no detalhe da vaga, sim; na lista, fica recolhida). */
  headingLevel?: "h2" | "h3";
}

/**
 * Andamento da própria candidatura: status, recado da dona da vaga, a carta enviada, "Desistir"
 * (enquanto enviada ou em análise) e, se aprovada, o próximo passo (mandar mensagem).
 */
export function MyApplication({ application, ownerId, ownerName }: MyApplicationProps) {
  const { status } = application;
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <ApplicationStatusBadge status={status} />
        <TimeAgo date={application.created_at} prefix="Enviada" />
      </div>
      <p className="text-[0.9375rem] text-fg-muted">{applicantStatusText(status, ownerName)}</p>

      {application.owner_note && (
        <QuotedMessage label={`Recado de ${ownerName}`}>{application.owner_note}</QuotedMessage>
      )}

      {status === "accepted" && (
        <div className="grid gap-3 rounded-control border border-success/30 bg-success-soft p-4 text-success-soft-fg">
          <p className="text-sm font-semibold">
            Próximo passo: combine com {ownerName} como e quando vocês começam.
          </p>
          <ButtonLink
            href={`/mensagens?com=${ownerId}`}
            variant="secondary"
            size="sm"
            className="justify-self-start"
          >
            <MessageCircle aria-hidden="true" />
            Mande uma mensagem para {ownerName}
          </ButtonLink>
        </div>
      )}

      <details className="group rounded-control border border-border">
        <summary className="cursor-pointer rounded-control px-3.5 py-2.5 text-sm font-semibold text-fg-muted hover:text-fg">
          Ver a carta que você enviou
        </summary>
        <p className="border-t border-border px-3.5 py-3 text-[0.9375rem] break-words whitespace-pre-line text-fg">
          {application.message}
        </p>
      </details>

      {canWithdraw(status) && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <p className="text-sm text-fg-muted">Mudou de planos? Avise desistindo da vaga.</p>
          <ConfirmDialog
            action={withdrawApplication}
            hiddenFields={{
              application_id: application.id,
              opportunity_id: application.opportunity_id,
            }}
            triggerLabel="Desistir"
            triggerIcon={<Undo2 aria-hidden="true" />}
            triggerSize="sm"
            title="Desistir desta candidatura?"
            description={`${ownerName} verá que você desistiu. Depois não é possível se candidatar de novo a esta vaga.`}
            confirmLabel="Sim, desistir"
            pendingLabel="Desistindo…"
          />
        </div>
      )}
    </div>
  );
}
