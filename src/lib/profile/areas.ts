/**
 * Áreas de pesquisa (research_areas): agrupamento por grande área do CNPq e resolução de
 * filtros. Uma linha em que name = big_area representa a própria grande área.
 * Módulo puro (testado em areas.test.ts).
 */

export interface ResearchArea {
  id: number;
  slug: string;
  name: string;
  big_area: string;
}

export interface AreaGroup {
  bigArea: string;
  /** Linha que representa a grande área inteira (se existir no catálogo). */
  general: ResearchArea | null;
  /** Subáreas, na ordem do catálogo. */
  areas: ResearchArea[];
}

/** Agrupa por grande área mantendo a ordem do catálogo (pela primeira ocorrência). */
export function groupAreas(areas: readonly ResearchArea[]): AreaGroup[] {
  const groups = new Map<string, AreaGroup>();
  for (const area of [...areas].sort((a, b) => a.id - b.id)) {
    let group = groups.get(area.big_area);
    if (!group) {
      group = { bigArea: area.big_area, general: null, areas: [] };
      groups.set(area.big_area, group);
    }
    if (area.name === area.big_area) group.general = area;
    else group.areas.push(area);
  }
  return [...groups.values()];
}

export function isBigArea(area: Pick<ResearchArea, "name" | "big_area">): boolean {
  return area.name === area.big_area;
}

/**
 * Ids que um filtro por `slug` deve aceitar: a própria área ou, se for uma grande área,
 * ela e todas as subáreas. Slug desconhecido → lista vazia.
 */
export function areaIdsForFilter(areas: readonly ResearchArea[], slug: string): number[] {
  const target = areas.find((area) => area.slug === slug);
  if (!target) return [];
  if (!isBigArea(target)) return [target.id];
  return areas.filter((area) => area.big_area === target.big_area).map((area) => area.id);
}

/** Ordena áreas de um perfil como no catálogo (grande área antes das subáreas). */
export function sortAreas<T extends { id: number }>(areas: readonly T[]): T[] {
  return [...areas].sort((a, b) => a.id - b.id);
}
