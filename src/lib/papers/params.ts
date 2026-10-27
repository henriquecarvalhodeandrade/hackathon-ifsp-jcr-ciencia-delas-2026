import { RANKING_PERIODS, type PaperRelation, type RankingPeriod } from "@/lib/constants";
import { pluralize } from "@/lib/utils";

/**
 * Parâmetros de URL e rótulos da Vitrine e do ranking. Módulo puro.
 *
 *   /papers?periodo=hot|week|month|year|all|recent&area=<slug>&q=<texto>&pagina=N
 *   /ranking?aba=papers|comunidade&periodo=hot|week|month|year|all&area=<slug>
 */

export const PAPERS_PAGE_SIZE = 12;
export const RANKING_LIMIT = 20;

/** Ordem das abas. "recent" é uma lista simples (mais novos primeiro), fora da RPC de ranking. */
export const RANKING_PERIOD_ORDER: readonly RankingPeriod[] = ["hot", "week", "month", "year", "all"];

export type VitrineOrder = RankingPeriod | "recent";

export const VITRINE_ORDER_LABELS: Record<VitrineOrder, string> = {
  ...RANKING_PERIODS,
  recent: "Recentes",
};

export const VITRINE_ORDER_ORDER: readonly VitrineOrder[] = [...RANKING_PERIOD_ORDER, "recent"];

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export function parseRankingPeriod(value: string | string[] | undefined, fallback: RankingPeriod): RankingPeriod {
  const v = first(value);
  return v && (RANKING_PERIOD_ORDER as readonly string[]).includes(v) ? (v as RankingPeriod) : fallback;
}

export function parseVitrineOrder(value: string | string[] | undefined, fallback: VitrineOrder = "hot"): VitrineOrder {
  const v = first(value);
  return v && (VITRINE_ORDER_ORDER as readonly string[]).includes(v) ? (v as VitrineOrder) : fallback;
}

/** Página 1-based; valores inválidos viram 1. Limita a 500 para evitar offsets absurdos. */
export function parsePage(value: string | string[] | undefined): number {
  const v = Number.parseInt(first(value) ?? "", 10);
  return Number.isFinite(v) && v >= 1 ? Math.min(v, 500) : 1;
}

/** Busca: texto aparado, espaços colapsados, no máximo 100 caracteres. */
export function parseSearch(value: string | string[] | undefined): string {
  return (first(value) ?? "").replace(/\s+/g, " ").trim().slice(0, 100);
}

/** Slug de área: só letras minúsculas, números e hífen (o resto é ignorado). */
export function parseAreaSlug(value: string | string[] | undefined): string | null {
  const v = (first(value) ?? "").trim().toLowerCase();
  return /^[a-z0-9-]{2,80}$/.test(v) ? v : null;
}

/** Escapa curingas do LIKE/ILIKE (% _ \) para buscar o texto literal. */
export function escapeLikePattern(text: string): string {
  return text.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export interface AreaRow {
  id: number;
  slug: string;
  name: string;
  big_area: string;
}

/** É uma grande área do CNPq (a linha cujo nome é o da própria grande área)? */
export function isBigArea(area: Pick<AreaRow, "name" | "big_area">): boolean {
  return area.name === area.big_area;
}

/**
 * Ids de área que um filtro por slug cobre — igual à RPC `get_paper_ranking`:
 * slug de grande área inclui todas as subáreas dela. Slug desconhecido → null.
 */
export function areaIdsForSlug(areas: readonly AreaRow[], slug: string | null): number[] | null {
  if (!slug) return null;
  const area = areas.find((a) => a.slug === slug);
  if (!area) return null;
  if (!isBigArea(area)) return [area.id];
  return areas.filter((a) => a.big_area === area.big_area).map((a) => a.id);
}

export interface AreaGroup {
  bigArea: string;
  /** A linha da grande área, se existir no catálogo. */
  parent: AreaRow | null;
  children: AreaRow[];
}

/** Agrupa o catálogo por grande área (ordem alfabética pt-BR) para <optgroup>. */
export function groupAreas(areas: readonly AreaRow[]): AreaGroup[] {
  const groups = new Map<string, AreaGroup>();
  for (const area of areas) {
    const group = groups.get(area.big_area) ?? { bigArea: area.big_area, parent: null, children: [] };
    if (isBigArea(area)) group.parent = area;
    else group.children.push(area);
    groups.set(area.big_area, group);
  }
  const collator = new Intl.Collator("pt-BR");
  return [...groups.values()]
    .map((g) => ({ ...g, children: [...g.children].sort((a, b) => collator.compare(a.name, b.name)) }))
    .sort((a, b) => collator.compare(a.bigArea, b.bigArea));
}

type QueryValue = string | number | null | undefined;

/** Monta "/caminho?a=1&b=2" ignorando valores vazios (e a página 1). */
export function buildHref(path: string, params: Record<string, QueryValue>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === "") continue;
    if (key === "pagina" && Number(value) <= 1) continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `${path}?${qs}` : path;
}

/** "Sou coautora" (formulário) → "coautora" (exibição em 3ª pessoa). */
export const PAPER_RELATION_DISPLAY: Record<PaperRelation, string> = {
  author: "autora principal do trabalho",
  coauthor: "coautora do trabalho",
  advisor: "orientadora ou supervisora do trabalho",
  reader: "leitora que indicou o trabalho",
};

export function relationDisplay(relation: string): string | null {
  return relation in PAPER_RELATION_DISPLAY ? PAPER_RELATION_DISPLAY[relation as PaperRelation] : null;
}

/** "#1 da semana", "#2 em alta"... */
export function rankBadgeLabel(position: number, period: RankingPeriod): string {
  const suffix: Record<RankingPeriod, string> = {
    hot: "em alta",
    week: "da semana",
    month: "do mês",
    year: "do ano",
    all: "de todos os tempos",
  };
  return `#${position} ${suffix[period]}`;
}

/** Janela de cada período, para compor frases ("3 destaques nos últimos 7 dias"). */
export const PERIOD_WINDOW_TEXT: Record<RankingPeriod, string> = {
  week: "nos últimos 7 dias",
  month: "nos últimos 30 dias",
  year: "nos últimos 12 meses",
  all: "no total",
  hot: "no total",
};

/** Quantos destaques contam no período: "3 destaques nos últimos 7 dias". */
export function periodVotesLabel(period: RankingPeriod, votes: number): string {
  return `${pluralize(votes, "destaque")} ${PERIOD_WINDOW_TEXT[period]}`;
}

/** Só o texto, sem o número: "destaques nos últimos 7 dias". */
export function periodVotesCaption(period: RankingPeriod, votes: number): string {
  return `${pluralize(votes, "destaque", undefined, { withCount: false })} ${PERIOD_WINDOW_TEXT[period]}`;
}

/** Votos que contam para a posição no período (hot e all usam o total). */
export function rankingVotes(
  period: RankingPeriod,
  paper: { vote_count: number; period_votes: number | null },
): number {
  return period === "hot" || period === "all" ? paper.vote_count : (paper.period_votes ?? 0);
}

/** "Ana Souza, Bia Lima e mais 3" — lista curta de autoras para cartões. */
export function shortAuthorList(authors: readonly string[], max = 3): string {
  if (authors.length <= max) {
    if (authors.length <= 1) return authors[0] ?? "";
    return `${authors.slice(0, -1).join(", ")} e ${authors[authors.length - 1]}`;
  }
  const rest = authors.length - max;
  return `${authors.slice(0, max).join(", ")} e mais ${rest}`;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string | null | undefined): value is string {
  return typeof value === "string" && UUID.test(value);
}
