import {
  CAREER_STAGES,
  MEETING_FORMATS,
  type CareerStage,
  type MeetingFormat,
} from "@/lib/constants";
import {
  OPPORTUNITY_KINDS,
  RECEIVED_FILTERS,
  isOpportunityKind,
  type OpportunityKind,
  type ReceivedFilter,
} from "./labels";
import { modalityLabel } from "./presentation";

/**
 * Parâmetros de URL do Explorar ICs. Módulo puro (testado em params.test.ts).
 *
 *   /ics?q=<texto>&area=<slug>&tipo=<kind>&bolsa=1&modalidade=<formato>&etapa=<etapa>
 *       &encerradas=1&pagina=N
 *   /ics/minhas?aba=candidaturas|publicadas
 *   /ics/<id>/candidaturas?status=submitted|in_review|accepted|declined|withdrawn
 */

type RawValue = string | string[] | undefined;
type RawParams = Record<string, RawValue>;

const first = (value: RawValue) => (Array.isArray(value) ? value[0] : value) ?? "";

const truthy = (value: RawValue) => ["1", "on", "true"].includes(first(value).trim());

export interface OpportunityFilters {
  q: string;
  /** Slug de área (uma grande área inclui as subáreas). */
  area: string;
  tipo: OpportunityKind | "";
  bolsa: boolean;
  modalidade: MeetingFormat | "";
  /** Etapa que precisa estar em `target_stages`. */
  etapa: CareerStage | "";
  /** Inclui vagas encerradas e fora do prazo (padrão: só as abertas). */
  encerradas: boolean;
  page: number;
}

/**
 * Busca: texto aparado, espaços colapsados, no máximo 100 caracteres. O `*` sai porque o
 * PostgREST o trata como `%` em `ilike` (o resto do escape é de `src/lib/search/normalize.ts`).
 */
export function parseSearch(value: RawValue): string {
  return first(value)
    .normalize("NFC")
    .replace(/\*/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);
}

/** Página 1-based; valores inválidos viram 1. Limita a 500 para evitar offsets absurdos. */
export function parsePage(value: RawValue): number {
  const v = Number.parseInt(first(value), 10);
  return Number.isFinite(v) && v >= 1 ? Math.min(v, 500) : 1;
}

export function parseOpportunityFilters(params: RawParams): OpportunityFilters {
  const area = first(params.area).trim().toLowerCase();
  const tipo = first(params.tipo).trim();
  const modalidade = first(params.modalidade).trim();
  const etapa = first(params.etapa).trim();
  return {
    q: parseSearch(params.q),
    area: /^[a-z0-9]+(-[a-z0-9]+)*$/.test(area) && area.length <= 80 ? area : "",
    tipo: isOpportunityKind(tipo) ? tipo : "",
    bolsa: truthy(params.bolsa),
    modalidade: modalidade in MEETING_FORMATS ? (modalidade as MeetingFormat) : "",
    etapa: etapa in CAREER_STAGES ? (etapa as CareerStage) : "",
    encerradas: truthy(params.encerradas),
    page: parsePage(params.pagina),
  };
}

/** Algum filtro que reduz a lista (a página não conta). */
export function hasActiveFilters(filters: OpportunityFilters): boolean {
  return Boolean(
    filters.q ||
    filters.area ||
    filters.tipo ||
    filters.bolsa ||
    filters.modalidade ||
    filters.etapa ||
    filters.encerradas,
  );
}

/** searchParams normalizados para links (paginação, chips), sem valores vazios nem a página. */
export function filtersToSearchParams(filters: OpportunityFilters): Record<string, string> {
  const out: Record<string, string> = {};
  if (filters.q) out.q = filters.q;
  if (filters.area) out.area = filters.area;
  if (filters.tipo) out.tipo = filters.tipo;
  if (filters.bolsa) out.bolsa = "1";
  if (filters.modalidade) out.modalidade = filters.modalidade;
  if (filters.etapa) out.etapa = filters.etapa;
  if (filters.encerradas) out.encerradas = "1";
  return out;
}

/** "/ics?…" com os filtros atuais trocados por `changes` (volta para a página 1). */
export function filtersHref(
  filters: OpportunityFilters,
  changes: Partial<Omit<OpportunityFilters, "page">> = {},
): string {
  const query = new URLSearchParams(filtersToSearchParams({ ...filters, ...changes, page: 1 }));
  const qs = query.toString();
  return qs ? `/ics?${qs}` : "/ics";
}

/** "/ics?…&pagina=N" da página atual (para voltar depois de entrar). */
export function currentListHref(filters: OpportunityFilters): string {
  const query = new URLSearchParams(filtersToSearchParams(filters));
  if (filters.page > 1) query.set("pagina", String(filters.page));
  const qs = query.toString();
  return qs ? `/ics?${qs}` : "/ics";
}

export type OpportunityFilterKey = Exclude<keyof OpportunityFilters, "page">;

export interface ActiveFilterChip {
  key: OpportunityFilterKey;
  label: string;
  /** /ics sem este filtro (os outros continuam). */
  href: string;
}

const CLEARED: { [K in OpportunityFilterKey]: OpportunityFilters[K] } = {
  q: "",
  area: "",
  tipo: "",
  bolsa: false,
  modalidade: "",
  etapa: "",
  encerradas: false,
};

/** Chips "filtros ativos", cada um com o link que remove só aquele filtro. */
export function activeFilterChips(
  filters: OpportunityFilters,
  names: { area?: string } = {},
): ActiveFilterChip[] {
  const without = (key: OpportunityFilterKey) => filtersHref(filters, { [key]: CLEARED[key] });
  const chips: ActiveFilterChip[] = [];
  if (filters.q) chips.push({ key: "q", label: `Busca: “${filters.q}”`, href: without("q") });
  if (filters.area)
    chips.push({
      key: "area",
      label: `Área: ${names.area ?? filters.area}`,
      href: without("area"),
    });
  if (filters.tipo)
    chips.push({ key: "tipo", label: OPPORTUNITY_KINDS[filters.tipo], href: without("tipo") });
  if (filters.bolsa) chips.push({ key: "bolsa", label: "Com bolsa", href: without("bolsa") });
  if (filters.modalidade)
    chips.push({
      key: "modalidade",
      label: modalityLabel(filters.modalidade) ?? filters.modalidade,
      href: without("modalidade"),
    });
  if (filters.etapa)
    chips.push({
      key: "etapa",
      label: `Para: ${CAREER_STAGES[filters.etapa].label}`,
      href: without("etapa"),
    });
  if (filters.encerradas)
    chips.push({ key: "encerradas", label: "Inclui encerradas", href: without("encerradas") });
  return chips;
}

/** Intervalo inclusivo para `.range()` do supabase-js. */
export function pageRange(page: number, pageSize: number): { from: number; to: number } {
  const from = (Math.max(1, page) - 1) * pageSize;
  return { from, to: from + pageSize - 1 };
}

// ---------------------------------------------------------------------------
// Abas e filtros das outras páginas
// ---------------------------------------------------------------------------

export const MY_TABS = ["candidaturas", "publicadas"] as const;
export type MyTab = (typeof MY_TABS)[number];

export const MY_TAB_LABELS: Record<MyTab, string> = {
  candidaturas: "Minhas candidaturas",
  publicadas: "Vagas que publiquei",
};

export function parseMyTab(value: RawValue): MyTab {
  const v = first(value);
  return (MY_TABS as readonly string[]).includes(v) ? (v as MyTab) : "candidaturas";
}

export function myTabHref(tab: MyTab): string {
  return tab === "candidaturas" ? "/ics/minhas" : `/ics/minhas?aba=${tab}`;
}

export function parseReceivedFilter(value: RawValue): ReceivedFilter {
  const v = first(value);
  return (RECEIVED_FILTERS as readonly string[]).includes(v) ? (v as ReceivedFilter) : "todas";
}

export function receivedFilterHref(opportunityId: string, filter: ReceivedFilter): string {
  const base = `/ics/${opportunityId}/candidaturas`;
  return filter === "todas" ? base : `${base}?status=${filter}`;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string | null | undefined): value is string {
  return typeof value === "string" && UUID.test(value);
}
