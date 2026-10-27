/**
 * Filtros do diretório de pesquisadoras (/pesquisadoras) vindos da URL.
 * Módulo puro (testado em directory.test.ts).
 */
import { BR_STATES, CAREER_STAGES, type BrState, type CareerStage } from "@/lib/constants";

export const DIRECTORY_PAGE_SIZE = 24;

export interface DirectoryFilters {
  q: string;
  area: string;
  stage: CareerStage | "";
  uf: BrState | "";
  mentoras: boolean;
  page: number;
}

type RawParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

/**
 * Limpa o termo de busca para uso em `ilike` dentro de um filtro `or=(...)` do PostgREST:
 * remove os caracteres que têm significado na sintaxe (vírgula, parênteses, aspas, barra
 * invertida, dois-pontos) e os curingas do LIKE (% _ *), e corta em 80 caracteres.
 */
export function sanitizeSearchTerm(raw: string): string {
  return raw
    .normalize("NFC")
    .replace(/[,()"'\\:%_*.]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

/** Filtro `or` para buscar o termo no nome, na instituição e no título do perfil. */
export function buildSearchOrFilter(term: string): string | null {
  const clean = sanitizeSearchTerm(term);
  if (clean.length < 2) return null;
  const pattern = `%${clean.replace(/ /g, "%")}%`;
  return ["full_name", "institution", "headline"]
    .map((column) => `${column}.ilike.${pattern}`)
    .join(",");
}

export function parseDirectoryFilters(params: RawParams): DirectoryFilters {
  const stage = first(params.stage);
  const uf = first(params.uf).toUpperCase();
  const area = first(params.area).toLowerCase();
  const pageNumber = Number.parseInt(first(params.pagina), 10);
  const mentoras = first(params.mentoras);
  return {
    q: sanitizeSearchTerm(first(params.q)),
    area: /^[a-z0-9]+(-[a-z0-9]+)*$/.test(area) && area.length <= 80 ? area : "",
    stage: stage in CAREER_STAGES ? (stage as CareerStage) : "",
    uf: uf in BR_STATES ? (uf as BrState) : "",
    mentoras: mentoras === "1" || mentoras === "on" || mentoras === "true",
    page: Number.isFinite(pageNumber) && pageNumber > 0 ? Math.min(pageNumber, 1000) : 1,
  };
}

export function hasActiveFilters(filters: DirectoryFilters): boolean {
  return Boolean(filters.q || filters.area || filters.stage || filters.uf || filters.mentoras);
}

/** searchParams normalizados para links (paginação), sem valores vazios. */
export function filtersToSearchParams(filters: DirectoryFilters): Record<string, string> {
  const out: Record<string, string> = {};
  if (filters.q) out.q = filters.q;
  if (filters.area) out.area = filters.area;
  if (filters.stage) out.stage = filters.stage;
  if (filters.uf) out.uf = filters.uf;
  if (filters.mentoras) out.mentoras = "1";
  return out;
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
