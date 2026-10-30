/**
 * Monta os dados (serializáveis) dos cartões de sugestão a partir das sugestões salvas,
 * da disponibilidade atual das mentoras e dos pedidos em aberto da mentoranda. Puro e testável.
 */
import type { MentorSuggestion } from "@/lib/matching/service";
import {
  CAREER_STAGES,
  MENTORSHIP_TOPICS,
  type CareerStage,
  type MentorshipStatus,
} from "@/lib/constants";
import {
  refreshTrajectorySentence,
  sharedTrajectory,
  trajectoryChipLabels,
} from "@/lib/trajectory/catalog";
import { suggestionSourceLabel, sharedItems } from "./presentation";

export interface MatchCardData {
  mentorId: string;
  name: string;
  avatarUrl: string | null;
  headline: string | null;
  institution: string | null;
  state: string | null;
  careerStage: string | null;
  score: number;
  reason: string;
  source: "ai" | "heuristic";
  sourceLabel: string;
  sharedAreas: string[];
  sharedTopics: string[];
  /** Outros temas em que ela orienta (rótulos), além dos em comum. */
  otherTopics: string[];
  /**
   * Marcas de trajetória que as duas declararam (rótulos curtos, ordem do catálogo) — linha
   * "Em comum na trajetória". Vazio quando alguma não declarou ou não há marca em comum.
   */
  sharedTrajectory: string[];
  starters: string[];
  /** Vagas abertas agora; null quando não foi possível conferir. */
  openSlots: number | null;
  /** Pedido em andamento da mentoranda com esta mentora. */
  requestStatus: Extract<MentorshipStatus, "pending" | "accepted"> | null;
  canRequest: boolean;
  /** Por que o botão "Pedir mentoria" está desligado (quando estiver). */
  unavailableReason: string | null;
}

export interface CandidateAvailability {
  open_slots: number | null;
  existing_request_status: string | null;
  /** Marcas de trajetória da mentora (RPC get_mentor_candidates). */
  trajectory_tags?: readonly string[] | null;
}

/** Mentoras disponíveis agora (RPC get_mentor_candidates, que tem limite de linhas). */
export interface CandidatePool {
  byMentor: ReadonlyMap<string, CandidateAvailability>;
  /**
   * false quando a RPC devolveu o máximo de linhas: a lista pode estar cortada, então ficar
   * de fora dela NÃO quer dizer que a mentora está sem vagas.
   */
  complete: boolean;
}

export type CandidateLookup =
  | { kind: "available"; candidate: CandidateAvailability }
  | { kind: "unavailable" }
  | { kind: "unknown" };

/** Situação de uma mentora no conjunto de candidatas (null = a RPC falhou). */
export function lookupCandidate(pool: CandidatePool | null, mentorId: string): CandidateLookup {
  if (!pool) return { kind: "unknown" };
  const candidate = pool.byMentor.get(mentorId);
  if (candidate) return { kind: "available", candidate };
  return pool.complete ? { kind: "unavailable" } : { kind: "unknown" };
}

export interface MatchCardContext {
  menteeAreaIds: readonly number[];
  menteeTopics: readonly string[];
  areaNames: ReadonlyMap<number, string>;
  /** Modelo de IA gravado nas sugestões (para o selo). */
  model: string | null;
  /** Mentoras disponíveis agora (RPC get_mentor_candidates). null = não deu para conferir. */
  candidates: CandidatePool | null;
  /** mentor_id → status do pedido em aberto (pending/accepted) da mentoranda. */
  openRequests: ReadonlyMap<string, MentorshipStatus>;
  /**
   * Marcas de trajetória de quem vê (opcional). Com elas, o cartão mostra o que as duas têm em
   * comum — calculado na hora, então vale também para sugestões já salvas.
   */
  menteeTrajectory?: readonly string[] | null;
}

export function topicLabel(slug: string): string {
  return (MENTORSHIP_TOPICS as Record<string, string>)[slug] ?? slug;
}

export function careerStageLabel(stage: string | null | undefined): string | null {
  if (!stage) return null;
  return CAREER_STAGES[stage as CareerStage]?.label ?? null;
}

function asOpenStatus(value: string | null | undefined): MatchCardData["requestStatus"] {
  return value === "pending" || value === "accepted" ? value : null;
}

export function buildMatchCard(suggestion: MentorSuggestion, ctx: MatchCardContext): MatchCardData {
  const mentor = suggestion.mentor;
  const lookup = lookupCandidate(ctx.candidates, suggestion.mentorId);
  const candidate = lookup.kind === "available" ? lookup.candidate : null;
  const requestStatus =
    asOpenStatus(ctx.openRequests.get(suggestion.mentorId)) ??
    asOpenStatus(candidate?.existing_request_status);

  const sharedAreaIds = sharedItems(mentor.area_ids, ctx.menteeAreaIds);
  const sharedAreas = sharedAreaIds
    .map((areaId) => ctx.areaNames.get(areaId))
    .filter((name): name is string => Boolean(name));
  const sharedTopicSlugs = sharedItems(mentor.mentorship_topics, ctx.menteeTopics);
  const otherTopics = mentor.mentorship_topics
    .filter((slug) => !sharedTopicSlugs.includes(slug))
    .map(topicLabel);

  // Marcas da mentora: as atuais (RPC) quando ela está no conjunto; senão, as da sugestão.
  const mentorTrajectory = candidate?.trajectory_tags ?? mentor.trajectory_tags;
  const sharedSlugs = sharedTrajectory(ctx.menteeTrajectory, mentorTrajectory);
  const sharedMarks = trajectoryChipLabels(sharedSlugs);
  // O motivo salvo pode citar uma marca que alguma das duas já tirou: com as marcas de agora
  // em mãos, a frase "Vocês têm em comum" é refeita (ou some). Sem elas, o texto fica como está.
  const reason =
    ctx.menteeTrajectory != null && mentorTrajectory != null
      ? refreshTrajectorySentence(suggestion.reason, sharedSlugs) ||
        "Faz parte da rede de mentoras da Artemis."
      : suggestion.reason;

  const openSlots = candidate ? (candidate.open_slots ?? null) : null;
  const knownUnavailable = lookup.kind === "unavailable";

  let unavailableReason: string | null = null;
  if (requestStatus === "pending") unavailableReason = "Você já enviou um pedido para ela.";
  else if (requestStatus === "accepted") unavailableReason = "Vocês já estão em mentoria.";
  else if (knownUnavailable || (openSlots !== null && openSlots <= 0))
    unavailableReason = "Ela está sem vagas ou pausou novos pedidos no momento.";

  return {
    mentorId: suggestion.mentorId,
    name: mentor.full_name || "Mentora",
    avatarUrl: mentor.avatar_url,
    headline: mentor.headline,
    institution: mentor.institution,
    state: mentor.state,
    careerStage: careerStageLabel(mentor.career_stage),
    score: Math.max(0, Math.min(100, Math.round(suggestion.score))),
    reason,
    source: suggestion.source,
    sourceLabel: suggestionSourceLabel(suggestion.source, ctx.model),
    sharedAreas,
    sharedTopics: sharedTopicSlugs.map(topicLabel),
    otherTopics,
    sharedTrajectory: sharedMarks,
    starters: suggestion.conversationStarters.filter((s) => s.trim().length > 0).slice(0, 3),
    openSlots,
    requestStatus,
    canRequest: unavailableReason === null,
    unavailableReason,
  };
}

// ---------------------------------------------------------------------------
// Link direto ?mentora=<id> (diretório / perfil → pedido)
// ---------------------------------------------------------------------------

export interface DeepLinkMentorInfo {
  id: string;
  is_mentor: boolean;
  mentor_available: boolean;
  onboarded: boolean;
}

export type DeepLinkState =
  | { kind: "ok"; openSlots: number | null }
  | { kind: "not_found" }
  | { kind: "self" }
  | { kind: "not_mentor" }
  | { kind: "unavailable" }
  | { kind: "open_request"; status: "pending" | "accepted" };

export function resolveDeepLink(input: {
  mentor: DeepLinkMentorInfo | null;
  viewerId: string;
  candidates: CandidatePool | null;
  openRequests: ReadonlyMap<string, MentorshipStatus>;
}): DeepLinkState {
  const { mentor, viewerId, candidates, openRequests } = input;
  if (!mentor) return { kind: "not_found" };
  if (mentor.id === viewerId) return { kind: "self" };
  if (!mentor.is_mentor || !mentor.onboarded) return { kind: "not_mentor" };
  const open = asOpenStatus(openRequests.get(mentor.id));
  if (open) return { kind: "open_request", status: open };
  if (!mentor.mentor_available) return { kind: "unavailable" };
  const lookup = lookupCandidate(candidates, mentor.id);
  if (lookup.kind === "unavailable") return { kind: "unavailable" };
  if (lookup.kind === "available") {
    const existing = asOpenStatus(lookup.candidate.existing_request_status);
    if (existing) return { kind: "open_request", status: existing };
    return { kind: "ok", openSlots: lookup.candidate.open_slots ?? null };
  }
  return { kind: "ok", openSlots: null };
}

export function buildMatchCards(
  suggestions: readonly MentorSuggestion[],
  ctx: MatchCardContext,
): MatchCardData[] {
  return [...suggestions].sort((a, b) => a.rank - b.rank).map((s) => buildMatchCard(s, ctx));
}
