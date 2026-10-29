import { Lock, LockOpen, Pencil, Trash2, Users } from "lucide-react";
import { ButtonLink, ConfirmDialog } from "@/components/ui";
import { deleteOpportunity, setOpportunityStatus } from "@/lib/opportunities/actions";
import { opportunityState, type OpportunityTiming } from "@/lib/opportunities/presentation";
import { cn, formatNumber, pluralize } from "@/lib/utils";

export interface OwnerActionsProps {
  opportunity: OpportunityTiming & { id: string; title: string; application_count: number };
  /** Esconde o botão "Editar" (na própria página de edição). */
  hideEdit?: boolean;
  /** Esconde "Ver candidaturas" (na própria página de candidaturas). */
  hideApplications?: boolean;
  now?: Date;
  className?: string;
}

/** Botão "Encerrar inscrições" / "Reabrir inscrições" com confirmação. */
export function OpportunityStatusButton({
  opportunity,
  now = new Date(),
  fullWidth = false,
}: Pick<OwnerActionsProps, "opportunity" | "now"> & { fullWidth?: boolean }) {
  const closing = opportunity.status === "open";
  const expired = opportunityState(opportunity, now) === "expired";
  return (
    <ConfirmDialog
      action={setOpportunityStatus}
      hiddenFields={{ opportunity_id: opportunity.id, status: closing ? "closed" : "open" }}
      tone="primary"
      triggerVariant="outline"
      triggerClassName={fullWidth ? "w-full" : undefined}
      triggerIcon={closing ? <Lock aria-hidden="true" /> : <LockOpen aria-hidden="true" />}
      triggerLabel={closing ? "Encerrar inscrições" : "Reabrir inscrições"}
      title={closing ? "Encerrar as inscrições desta vaga?" : "Reabrir as inscrições desta vaga?"}
      description={
        closing
          ? "A vaga sai da lista de vagas abertas e ninguém mais consegue se candidatar. As candidaturas recebidas continuam aqui, e você pode reabrir quando quiser."
          : expired
            ? "Atenção: o prazo de inscrição já passou. Reabrir não basta — edite a vaga e escolha um novo prazo para voltar a receber candidaturas."
            : "A vaga volta para a lista de vagas abertas e pode receber novas candidaturas até o prazo."
      }
      confirmLabel={closing ? "Encerrar inscrições" : "Reabrir inscrições"}
      pendingLabel={closing ? "Encerrando…" : "Reabrindo…"}
    />
  );
}

/** Botão "Excluir vaga" com confirmação. Sucesso → "Vagas que publiquei". */
export function DeleteOpportunityButton({
  opportunity,
  triggerVariant = "ghost",
  fullWidth = false,
}: {
  opportunity: OwnerActionsProps["opportunity"];
  triggerVariant?: "ghost" | "danger" | "outline";
  fullWidth?: boolean;
}) {
  const count = opportunity.application_count;
  return (
    <ConfirmDialog
      action={deleteOpportunity}
      hiddenFields={{ opportunity_id: opportunity.id }}
      triggerVariant={triggerVariant}
      triggerIcon={<Trash2 aria-hidden="true" />}
      triggerLabel="Excluir vaga"
      triggerClassName={cn(
        triggerVariant === "ghost" && "text-danger hover:text-danger",
        fullWidth && "w-full",
      )}
      title="Excluir esta vaga?"
      description={
        count > 0
          ? `A vaga e as ${pluralize(count, "candidatura recebida", "candidaturas recebidas")} somem da Artemis. Isso não pode ser desfeito — se quiser só parar de receber candidaturas, encerre as inscrições.`
          : "A vaga some da Artemis. Isso não pode ser desfeito — se quiser só parar de receber candidaturas, encerre as inscrições."
      }
      confirmLabel="Sim, excluir"
      pendingLabel="Excluindo…"
    />
  );
}

/** Ações da dona da vaga: ver candidaturas, editar, encerrar/reabrir e excluir. */
export function OwnerActions({
  opportunity,
  hideEdit = false,
  hideApplications = false,
  now = new Date(),
  className,
}: OwnerActionsProps) {
  return (
    <div className={cn("grid gap-2", className)}>
      {!hideApplications && (
        <ButtonLink href={`/ics/${opportunity.id}/candidaturas`} fullWidth>
          <Users aria-hidden="true" />
          Ver candidaturas ({formatNumber(opportunity.application_count)})
        </ButtonLink>
      )}
      {!hideEdit && (
        <ButtonLink href={`/ics/${opportunity.id}/editar`} variant="outline" fullWidth>
          <Pencil aria-hidden="true" />
          Editar vaga
        </ButtonLink>
      )}
      <OpportunityStatusButton opportunity={opportunity} now={now} fullWidth />
      <DeleteOpportunityButton opportunity={opportunity} fullWidth />
    </div>
  );
}
