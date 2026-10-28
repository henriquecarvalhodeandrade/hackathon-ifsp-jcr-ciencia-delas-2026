/**
 * Filtros do diretório de pesquisadoras (/pesquisadoras) vindos da URL.
 * Módulo puro (testado em directory.test.ts).
 */
import { BR_STATES, CAREER_STAGES, type BrState, type CareerStage } from "@/lib/constants";
import { isTrajectorySlug, trajectoryMark, type TrajectorySlug } from "@/lib/trajectory/catalog";

export const DIRECTORY_PAGE_SIZE = 24;

export interface DirectoryFilters {
  q: string;
  area: string;
  stage: CareerStage | "";
  uf: BrState | "";
  mentoras: boolean;
  /** Marca de trajetória (?trajetoria=<slug>); slug fora do catálogo é ignorado. */
  trajetoria: TrajectorySlug | "";
  page: number;
}

type RawParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

/**
 * Limpa o termo de busca que volta para a URL e aparece na tela: remove pontuação que não ajuda
 * a buscar (vírgula, parênteses, aspas, barra invertida, dois-pontos, ponto) e os curingas do LIKE
 * (% _ *), colapsa espaços e corta em 80 caracteres. Acentos e maiúsculas ficam como a pessoa
 * digitou — a busca em si (`profiles.search_text`) ignora os dois (src/lib/search/normalize.ts).
 */
export function sanitizeSearchTerm(raw: string): string {
  return raw
    .normalize("NFC")
    .replace(/[,()"'\\:%_*.]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

export function parseDirectoryFilters(params: RawParams): DirectoryFilters {
  const stage = first(params.stage);
  const uf = first(params.uf).toUpperCase();
  const area = first(params.area).toLowerCase();
  const pageNumber = Number.parseInt(first(params.pagina), 10);
  const mentoras = first(params.mentoras);
  const trajetoria = first(params.trajetoria).toLowerCase();
  return {
    q: sanitizeSearchTerm(first(params.q)),
    area: /^[a-z0-9]+(-[a-z0-9]+)*$/.test(area) && area.length <= 80 ? area : "",
    stage: stage in CAREER_STAGES ? (stage as CareerStage) : "",
    uf: uf in BR_STATES ? (uf as BrState) : "",
    mentoras: mentoras === "1" || mentoras === "on" || mentoras === "true",
    trajetoria: isTrajectorySlug(trajetoria) ? trajetoria : "",
    page: Number.isFinite(pageNumber) && pageNumber > 0 ? Math.min(pageNumber, 1000) : 1,
  };
}

export function hasActiveFilters(filters: DirectoryFilters): boolean {
  return Boolean(
    filters.q ||
    filters.area ||
    filters.stage ||
    filters.uf ||
    filters.mentoras ||
    filters.trajetoria,
  );
}

/** searchParams normalizados para links (paginação), sem valores vazios. */
export function filtersToSearchParams(filters: DirectoryFilters): Record<string, string> {
  const out: Record<string, string> = {};
  if (filters.q) out.q = filters.q;
  if (filters.area) out.area = filters.area;
  if (filters.stage) out.stage = filters.stage;
  if (filters.uf) out.uf = filters.uf;
  if (filters.mentoras) out.mentoras = "1";
  if (filters.trajetoria) out.trajetoria = filters.trajetoria;
  return out;
}

export type DirectoryFilterKey = "q" | "area" | "stage" | "uf" | "mentoras" | "trajetoria";

export interface ActiveFilterChip {
  key: DirectoryFilterKey;
  /** Texto do chip, ex.: "Trajetória: Escola pública". */
  label: string;
  /** /pesquisadoras sem este filtro (os outros continuam; volta para a página 1). */
  href: string;
}

/** Chips "filtros ativos", cada um com o link que remove só aquele filtro. */
export function activeFilterChips(
  filters: DirectoryFilters,
  names: { area?: string } = {},
): ActiveFilterChip[] {
  const params = filtersToSearchParams(filters);
  const without = (key: DirectoryFilterKey) => {
    const rest = Object.fromEntries(Object.entries(params).filter(([k]) => k !== key));
    const query = new URLSearchParams(rest).toString();
    return query ? `/pesquisadoras?${query}` : "/pesquisadoras";
  };
  const chips: ActiveFilterChip[] = [];
  if (filters.q) chips.push({ key: "q", label: `Busca: “${filters.q}”`, href: without("q") });
  if (filters.area)
    chips.push({
      key: "area",
      label: `Área: ${names.area ?? filters.area}`,
      href: without("area"),
    });
  if (filters.stage)
    chips.push({
      key: "stage",
      label: `Fase: ${CAREER_STAGES[filters.stage].label}`,
      href: without("stage"),
    });
  if (filters.uf)
    chips.push({ key: "uf", label: `Estado: ${BR_STATES[filters.uf]}`, href: without("uf") });
  if (filters.trajetoria)
    chips.push({
      key: "trajetoria",
      label: `Trajetória: ${trajectoryMark(filters.trajetoria)?.chip ?? filters.trajetoria}`,
      href: without("trajetoria"),
    });
  if (filters.mentoras)
    chips.push({ key: "mentoras", label: "Só mentoras", href: without("mentoras") });
  return chips;
}

/** Intervalo inclusivo para `.range()` do supabase-js. */
export function pageRange(
  page: number,
  pageSize = DIRECTORY_PAGE_SIZE,
): { from: number; to: number } {
  const from = (Math.max(1, page) - 1) * pageSize;
  return { from, to: from + pageSize - 1 };
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
