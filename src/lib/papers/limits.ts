/**
 * Limites dos campos de papers e comentários — iguais aos CHECKs das tabelas
 * `papers` e `paper_comments` (supabase/migrations/20261027120400_papers.sql).
 */
export const PAPER_LIMITS = {
  titleMin: 5,
  titleMax: 300,
  abstractMin: 50,
  abstractMax: 5000,
  authorsMax: 50,
  authorNameMax: 200,
  venueMax: 300,
  urlMax: 1000,
  yearMin: 1900,
  keywordsMax: 15,
  keywordMax: 60,
  plainSummaryMax: 1500,
  commentMin: 2,
  commentMax: 3000,
} as const;

/** Ano máximo aceito no formulário (o banco aceita até 2100; aqui, até o ano que vem). */
export function maxPaperYear(now: Date = new Date()): number {
  return now.getFullYear() + 1;
}
