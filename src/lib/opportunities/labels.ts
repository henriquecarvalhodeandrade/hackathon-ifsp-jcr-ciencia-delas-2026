import type { CareerStage, MeetingFormat } from "@/lib/constants";

/**
 * Domínios do Explorar ICs (docs/18 §2.3): tipos de vaga, status das candidaturas e quem pode
 * publicar. As chaves são os valores dos enums do banco; os rótulos aparecem na interface.
 * Módulo puro (sem rede nem banco).
 */

export type OpportunityKind = "ic" | "ic_junior" | "tcc" | "extension" | "volunteer";
export type OpportunityStatus = "open" | "closed";
export type ApplicationStatus = "submitted" | "in_review" | "accepted" | "declined" | "withdrawn";

export const OPPORTUNITY_KINDS: Record<OpportunityKind, string> = {
  ic: "Iniciação Científica",
  ic_junior: "IC Júnior (ensino médio)",
  tcc: "TCC",
  extension: "Extensão",
  volunteer: "Voluntariado",
};

export const OPPORTUNITY_KIND_ORDER = Object.keys(OPPORTUNITY_KINDS) as OpportunityKind[];

export const OPPORTUNITY_KIND_OPTIONS = OPPORTUNITY_KIND_ORDER.map((value) => ({
  value,
  label: OPPORTUNITY_KINDS[value],
}));

/** Como o tipo entra numa frase: "Abri uma vaga de iniciação científica: …". */
const KIND_IN_SENTENCE: Record<OpportunityKind, string> = {
  ic: "iniciação científica",
  ic_junior: "IC Júnior",
  tcc: "TCC",
  extension: "extensão",
  volunteer: "voluntariado",
};

export function isOpportunityKind(value: unknown): value is OpportunityKind {
  return typeof value === "string" && value in OPPORTUNITY_KINDS;
}

export function opportunityKindLabel(kind: string): string {
  return isOpportunityKind(kind) ? OPPORTUNITY_KINDS[kind] : "Oportunidade";
}

/** Texto da publicação no feed quando a vaga é compartilhada ao publicar. */
export function feedPostBody(kind: OpportunityKind, title: string): string {
  return `Abri uma vaga de ${KIND_IN_SENTENCE[kind]}: ${title.trim()}. As candidaturas são pela Artemis!`;
}

// ---------------------------------------------------------------------------
// Quem publica
// ---------------------------------------------------------------------------

/** Etapas que podem publicar vagas (mestrado em diante — o banco confere com CD070). */
export const PUBLISHER_STAGES: readonly CareerStage[] = [
  "masters",
  "phd",
  "postdoc",
  "researcher",
  "professor",
  "industry",
];

export function canPublishOpportunities(stage: string | null | undefined): boolean {
  return Boolean(stage && (PUBLISHER_STAGES as readonly string[]).includes(stage));
}

// ---------------------------------------------------------------------------
// Candidaturas
// ---------------------------------------------------------------------------

/** Status vistos pela candidata (a própria candidatura). */
export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  submitted: "Enviada",
  in_review: "Em análise",
  accepted: "Aprovada",
  declined: "Não aprovada",
  withdrawn: "Você desistiu",
};

/** Status vistos pela dona da vaga (candidaturas recebidas). */
export const RECEIVED_STATUS_LABELS: Record<ApplicationStatus, string> = {
  submitted: "Nova",
  in_review: "Em análise",
  accepted: "Aprovada",
  declined: "Não aprovada",
  withdrawn: "Desistiu",
};

/** Subconjunto das variantes de <Badge> (mantém este módulo sem dependência de UI). */
export type StatusTone = "warning" | "info" | "success" | "neutral";

const STATUS_TONE: Record<ApplicationStatus, StatusTone> = {
  submitted: "warning",
  in_review: "info",
  accepted: "success",
  declined: "neutral",
  withdrawn: "neutral",
};

export function isApplicationStatus(value: unknown): value is ApplicationStatus {
  return typeof value === "string" && value in APPLICATION_STATUS_LABELS;
}

export function applicationStatusTone(status: ApplicationStatus): StatusTone {
  return STATUS_TONE[status] ?? "neutral";
}

/** A candidata só desiste enquanto a candidatura está enviada ou em análise. */
export function canWithdraw(status: ApplicationStatus): boolean {
  return status === "submitted" || status === "in_review";
}

/** Decisões que a dona pode tomar (ela muda de ideia entre as três; desistência é final). */
export type OwnerDecision = "in_review" | "accepted" | "declined";

export const OWNER_DECISIONS: readonly OwnerDecision[] = ["in_review", "accepted", "declined"];

export function ownerDecisionsFor(status: ApplicationStatus): OwnerDecision[] {
  if (status === "withdrawn") return [];
  return OWNER_DECISIONS.filter((decision) => decision !== status);
}

export const OWNER_DECISION_LABELS: Record<OwnerDecision, string> = {
  in_review: "Marcar em análise",
  accepted: "Aprovar",
  declined: "Não aprovar",
};

/** Abas de filtro das candidaturas recebidas (?status=). */
export const RECEIVED_FILTERS = [
  "todas",
  "submitted",
  "in_review",
  "accepted",
  "declined",
  "withdrawn",
] as const;
export type ReceivedFilter = (typeof RECEIVED_FILTERS)[number];

export const RECEIVED_FILTER_LABELS: Record<ReceivedFilter, string> = {
  todas: "Todas",
  submitted: "Novas",
  in_review: "Em análise",
  accepted: "Aprovadas",
  declined: "Não aprovadas",
  withdrawn: "Desistências",
};

// ---------------------------------------------------------------------------
// Modalidade
// ---------------------------------------------------------------------------

export const MODALITY_ORDER: readonly MeetingFormat[] = ["in_person", "hybrid", "online"];
