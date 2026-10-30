/**
 * Regra pura dos "destaques" da landing (testada em featured.test.ts):
 * mostra os 3 papers mais destacados da semana; se ninguém recebeu destaque
 * nos últimos 7 dias, cai para os papers "em alta" (fórmula hot) — e a seção
 * troca o título para não prometer "da semana" sem ser verdade.
 */

export interface RankedPaperLike {
  id: string;
  period_votes: number;
}

export type FeaturedPeriod = "week" | "hot";

export function pickFeaturedPapers<T extends RankedPaperLike>(
  week: readonly T[] | null | undefined,
  hot: readonly T[] | null | undefined,
  limit = 3,
): { papers: T[]; period: FeaturedPeriod | null } {
  const weekly = (week ?? []).filter((p) => p.period_votes > 0).slice(0, limit);
  if (weekly.length > 0) return { papers: weekly, period: "week" };
  const trending = (hot ?? []).slice(0, limit);
  if (trending.length > 0) return { papers: trending, period: "hot" };
  return { papers: [], period: null };
}

/** Primeiro nome para a saudação ("Que bom te ver, Larissa"). */
export function firstName(fullName: string | null | undefined): string | null {
  const name = (fullName ?? "").trim().split(/\s+/)[0];
  return name ? name : null;
}
