/**
 * Limites dos campos de vagas e candidaturas — iguais aos CHECKs de `research_opportunities` e
 * `opportunity_applications` (docs/18-rede-social.md §2.3).
 */
export const OPPORTUNITY_LIMITS = {
  titleMin: 5,
  titleMax: 160,
  descriptionMin: 30,
  descriptionMax: 4000,
  requirementsMax: 2000,
  keywordsMax: 10,
  keywordMax: 40,
  institutionMax: 160,
  cityMax: 80,
  scholarshipInfoMax: 160,
  weeklyHoursMin: 1,
  weeklyHoursMax: 40,
  vacanciesMin: 1,
  vacanciesMax: 20,
  targetStagesMin: 1,
  targetStagesMax: 8,
  /** Prazo: no máximo 2 anos à frente (só no app — pega anos digitados errado). */
  deadlineMaxYears: 2,
  messageMin: 30,
  messageMax: 2000,
  ownerNoteMax: 1000,
} as const;

/** Vagas por página em /ics. */
export const OPPORTUNITIES_PAGE_SIZE = 12;
