/**
 * Catálogo de resultados do retorno da mentoria (puro). É a MESMA lista de
 * `private.mentorship_outcomes()` na migration 20261028190000_mentorship_recognition.sql — um
 * teste lê a migration e compara os dois conjuntos. Para mudar uma opção, mude nos dois lugares
 * (e lembre que o banco recusa slugs fora da lista com CD033).
 */

export type FeedbackRole = "mentee" | "mentor";

export interface Outcome {
  slug: string;
  /** Texto da caixa no formulário (primeira pessoa). */
  label: string;
  /** Texto do impacto agregado (terceira pessoa do plural); só as opções da mentoranda. */
  impactLabel?: string;
}

export const MENTEE_OUTCOMES = [
  {
    slug: "menos-sozinha",
    label: "Me senti menos sozinha na pesquisa",
    impactLabel: "Se sentiram menos sozinhas na pesquisa",
  },
  {
    slug: "plano-definido",
    label: "Saí com um plano para os próximos meses",
    impactLabel: "Saíram com um plano para os próximos meses",
  },
  {
    slug: "iniciacao-cientifica",
    label: "Entrei ou avancei na iniciação científica",
    impactLabel: "Entraram ou avançaram na iniciação científica",
  },
  {
    slug: "candidatura",
    label: "Me candidatei a uma bolsa, edital ou processo seletivo",
    impactLabel: "Se candidataram a uma bolsa, edital ou processo seletivo",
  },
  {
    slug: "trabalho-apresentado",
    label: "Submeti ou apresentei um trabalho",
    impactLabel: "Submeteram ou apresentaram um trabalho",
  },
  {
    slug: "rede-ampliada",
    label: "Conheci pessoas e grupos da minha área",
    impactLabel: "Conheceram pessoas e grupos da área",
  },
] as const satisfies readonly Outcome[];

export const MENTOR_OUTCOMES = [
  { slug: "aprendi-tambem", label: "Também aprendi com a mentoranda" },
  { slug: "quero-mentorar-mais", label: "Quero acompanhar outras pesquisadoras" },
] as const satisfies readonly Outcome[];

export type MenteeOutcomeSlug = (typeof MENTEE_OUTCOMES)[number]["slug"];
export type MentorOutcomeSlug = (typeof MENTOR_OUTCOMES)[number]["slug"];
export type OutcomeSlug = MenteeOutcomeSlug | MentorOutcomeSlug;

export const OUTCOMES: Record<FeedbackRole, readonly Outcome[]> = {
  mentee: MENTEE_OUTCOMES,
  mentor: MENTOR_OUTCOMES,
};

/** Máximo de opções por retorno (igual ao CHECK do banco). */
export const MAX_OUTCOMES = 6;

export function outcomesFor(role: FeedbackRole): readonly Outcome[] {
  return OUTCOMES[role];
}

export function isOutcomeFor(role: FeedbackRole, slug: string): boolean {
  return OUTCOMES[role].some((outcome) => outcome.slug === slug);
}

const ALL = [...MENTEE_OUTCOMES, ...MENTOR_OUTCOMES] as readonly Outcome[];

/** Algum slug do catálogo (de qualquer papel). */
export function isKnownOutcome(slug: string): slug is OutcomeSlug {
  return ALL.some((outcome) => outcome.slug === slug);
}

export function outcomeLabel(slug: string): string | null {
  return ALL.find((outcome) => outcome.slug === slug)?.label ?? null;
}

/** Rótulo do impacto agregado (só opções da mentoranda); cai no rótulo do formulário. */
export function outcomeImpactLabel(slug: string): string | null {
  const outcome = ALL.find((item) => item.slug === slug);
  return outcome ? (outcome.impactLabel ?? outcome.label) : null;
}
