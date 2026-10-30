import {
  CircleCheck,
  CircleX,
  Hourglass,
  Lock,
  Search,
  Send,
  Undo2,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui";
import {
  APPLICATION_STATUS_LABELS,
  RECEIVED_STATUS_LABELS,
  applicationStatusTone,
  type ApplicationStatus,
} from "@/lib/opportunities/labels";
import { OPPORTUNITY_STATE_LABELS, type OpportunityState } from "@/lib/opportunities/presentation";

const APPLICATION_ICONS: Record<ApplicationStatus, LucideIcon> = {
  submitted: Send,
  in_review: Search,
  accepted: CircleCheck,
  declined: CircleX,
  withdrawn: Undo2,
};

/**
 * Selo de status da candidatura (ícone + texto: nunca só cor). `viewer="owner"` usa os rótulos
 * da dona da vaga ("Nova", "Desistiu"); o padrão é o da candidata ("Enviada", "Você desistiu").
 */
export function ApplicationStatusBadge({
  status,
  viewer = "applicant",
  size = "md",
  srPrefix,
  className,
}: {
  status: ApplicationStatus;
  viewer?: "applicant" | "owner";
  /** "sm" nos cartões da lista. */
  size?: "sm" | "md";
  /** Contexto só para leitores de tela, ex.: "Sua candidatura:" (nos cartões). */
  srPrefix?: string;
  className?: string;
}) {
  const Icon = APPLICATION_ICONS[status] ?? Hourglass;
  const labels = viewer === "owner" ? RECEIVED_STATUS_LABELS : APPLICATION_STATUS_LABELS;
  return (
    <Badge variant={applicationStatusTone(status)} size={size} className={className}>
      <Icon aria-hidden="true" />
      {srPrefix && <span className="sr-only">{srPrefix} </span>}
      {labels[status] ?? status}
    </Badge>
  );
}

/** Selo de situação da vaga: Aberta / Encerrada / Prazo encerrado. */
export function OpportunityStateBadge({
  state,
  className,
}: {
  state: OpportunityState;
  className?: string;
}) {
  return (
    <Badge variant={state === "open" ? "success" : "neutral"} size="md" className={className}>
      {state === "open" ? <Hourglass aria-hidden="true" /> : <Lock aria-hidden="true" />}
      {OPPORTUNITY_STATE_LABELS[state]}
    </Badge>
  );
}
