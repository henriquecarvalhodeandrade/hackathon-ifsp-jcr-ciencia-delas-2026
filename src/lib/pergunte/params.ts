import { isQuestionStage, type QuestionStage } from "./labels";

/** Leitura segura dos searchParams de /pergunte (valores inválidos caem no padrão). */

type Param = string | string[] | undefined;

function first(value: Param): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export const QUESTIONS_PAGE_SIZE = 10;

export interface QuestionFilters {
  stage: QuestionStage | null;
  areaId: number | null;
  page: number;
}

export function parseStage(value: Param): QuestionStage | null {
  const v = first(value);
  return isQuestionStage(v) ? v : null;
}

/** Id de grande área (smallint positivo); `validIds` restringe às áreas que existem. */
export function parseAreaId(value: Param, validIds?: ReadonlySet<number>): number | null {
  const v = first(value);
  if (!v || !/^\d{1,5}$/.test(v)) return null;
  const id = Number(v);
  if (id < 1 || id > 32767) return null;
  if (validIds && !validIds.has(id)) return null;
  return id;
}

export function parsePage(value: Param, max = 1000): number {
  const v = first(value);
  if (!v || !/^\d{1,6}$/.test(v)) return 1;
  return Math.min(Math.max(1, Number(v)), max);
}

export function parseQuestionFilters(
  params: Record<string, Param>,
  validAreaIds?: ReadonlySet<number>,
): QuestionFilters {
  return {
    stage: parseStage(params.etapa),
    areaId: parseAreaId(params.area, validAreaIds),
    page: parsePage(params.pagina),
  };
}

/** searchParams dos links de filtro (sem a página: trocar filtro volta para a primeira). */
export function filterParams(filters: Pick<QuestionFilters, "stage" | "areaId">) {
  const params: Record<string, string> = {};
  if (filters.stage) params.etapa = filters.stage;
  if (filters.areaId) params.area = String(filters.areaId);
  return params;
}

/** Link de /pergunte com os filtros (âncora na lista para não voltar ao topo do formulário). */
export function filterHref(filters: Pick<QuestionFilters, "stage" | "areaId">): string {
  const qs = new URLSearchParams(filterParams(filters)).toString();
  return `/pergunte${qs ? `?${qs}` : ""}#perguntas-respondidas`;
}
