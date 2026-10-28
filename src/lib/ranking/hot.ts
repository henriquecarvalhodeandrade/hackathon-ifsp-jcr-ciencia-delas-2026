import type { RankingPeriod } from "@/lib/constants";

/**
 * Fórmulas de ranking da Vitrine — espelham EXATAMENTE a RPC `get_paper_ranking` (SQL),
 * para a UI explicar a ordem e para testes. Módulo puro.
 *
 * "Em alta" (estilo Hacker News):
 *     hot_score = vote_count / (idade_em_horas + 2) ^ 1.5
 * (na interface: destaques ÷ (horas desde a publicação + 2)^1,5). O "+2" evita divisão por zero
 * e dá um fôlego inicial a papers recém-publicados; o expoente 1.5 faz a pontuação cair com a
 * idade do paper.
 */

export const HOT_GRAVITY = 1.5;
export const HOT_AGE_OFFSET_HOURS = 2;

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

type DateLike = Date | string | number;

function toMs(value: DateLike): number {
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
}

/** Idade em horas (nunca negativa — datas no futuro contam como 0). */
export function ageInHours(createdAt: DateLike, now: DateLike = new Date()): number {
  const diff = toMs(now) - toMs(createdAt);
  if (!Number.isFinite(diff)) return 0;
  return Math.max(0, diff / HOUR_MS);
}

export function hotScore(votes: number, createdAt: DateLike, now: DateLike = new Date()): number {
  const v = Number.isFinite(votes) ? votes : 0;
  return v / Math.pow(ageInHours(createdAt, now) + HOT_AGE_OFFSET_HOURS, HOT_GRAVITY);
}

/** Tamanho fixo de cada janela, igual ao SQL (`now() - interval '7 days' | '30 days' | '365 days'`). */
export const PERIOD_WINDOW_DAYS = { week: 7, month: 30, year: 365 } as const;

/**
 * Início da janela de votos de cada período — idêntico à RPC `get_paper_ranking`, que usa
 * janelas fixas (7, 30 e 365 dias) e não meses de calendário. "all" e "hot" → null.
 */
export function periodStart(period: RankingPeriod, now: DateLike = new Date()): Date | null {
  const base = toMs(now);
  switch (period) {
    case "week":
    case "month":
    case "year":
      return new Date(base - PERIOD_WINDOW_DAYS[period] * DAY_MS);
    case "all":
    case "hot":
      return null;
  }
}

/**
 * Fórmula do "Em alta" como aparece para as pessoas (votos se chamam "destaques" na interface).
 * Mesma conta de `hotScore` e da RPC `get_paper_ranking`.
 */
export const HOT_FORMULA_TEXT = "destaques ÷ (horas desde a publicação + 2)^1,5";

/**
 * Como cada período do ranking ordena os papers, em linguagem simples (pt-BR).
 * FONTE ÚNICA: /ranking, a Vitrine (/papers) e a documentação usam estes textos.
 * Na interface, votos sempre se chamam "destaques".
 */
export const RANKING_PERIOD_EXPLANATIONS: Record<RankingPeriod, string> = {
  hot: `Papers novos que recebem destaques sobem mais rápido: a pontuação é ${HOT_FORMULA_TEXT} e cai com o tempo.`,
  week: "Papers com mais destaques recebidos nos últimos 7 dias.",
  month: "Papers com mais destaques recebidos nos últimos 30 dias.",
  year: "Papers com mais destaques recebidos nos últimos 365 dias.",
  all: "Papers com mais destaques desde que entraram na Vitrine.",
};
