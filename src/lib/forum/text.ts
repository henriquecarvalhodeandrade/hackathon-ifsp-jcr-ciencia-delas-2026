/**
 * Utilitários puros do fórum (sem acesso a banco): busca, paginação e texto.
 */

export const FORUM_PAGE_SIZE = 20;
export const SEARCH_MAX_LENGTH = 80;

type ParamValue = string | string[] | undefined;

function first(value: ParamValue): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

/**
 * Limpa o termo de busca para usar em filtros `ilike` do PostgREST dentro de `.or()`:
 * remove curingas (% _ *), separadores da sintaxe de filtro (, ( ) ") e barras invertidas,
 * colapsa espaços e limita o tamanho.
 */
export function sanitizeSearchTerm(raw: ParamValue): string {
  return first(raw)
    .replace(/[%_*,()"\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, SEARCH_MAX_LENGTH)
    .trim();
}

/** Tag vinda da URL (?tag=): minúscula, aparada, até 40 caracteres, sem caracteres de filtro. */
export function sanitizeTag(raw: ParamValue): string {
  return first(raw)
    .replace(/[,(){}"\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("pt-BR")
    .slice(0, 40)
    .trim();
}

/** Página 1-based a partir de ?pagina= (inválida ou ausente → 1). */
export function parsePage(raw: ParamValue, maxPage = 1000): number {
  const value = first(raw).trim();
  if (!/^\d+$/.test(value)) return 1;
  const page = Number.parseInt(value, 10);
  if (!Number.isFinite(page) || page < 1) return 1;
  return Math.min(page, maxPage);
}

/** Intervalo inclusivo para `.range(from, to)` do supabase-js. */
export function pageRange(page: number, pageSize = FORUM_PAGE_SIZE): { from: number; to: number } {
  const from = (Math.max(1, page) - 1) * pageSize;
  return { from, to: from + pageSize - 1 };
}

export function totalPages(total: number, pageSize = FORUM_PAGE_SIZE): number {
  return Math.max(1, Math.ceil(Math.max(0, total) / pageSize));
}

/**
 * Converte Markdown em texto corrido para trechos (busca, metadados, prévias).
 * Não é um parser completo — só remove a sintaxe mais comum.
 */
export function markdownToPlainText(markdown: string | null | undefined): string {
  if (!markdown) return "";
  return (
    markdown
      // blocos de código cercados: mantém o conteúdo
      .replace(/```[^\n]*\n([\s\S]*?)```/g, "$1")
      .replace(/~~~[^\n]*\n([\s\S]*?)~~~/g, "$1")
      // imagens e links: fica o texto
      .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
      // código em linha
      .replace(/`([^`]+)`/g, "$1")
      // títulos, citações, listas e linhas horizontais no início da linha
      .replace(/^\s{0,3}#{1,6}\s+/gm, "")
      .replace(/^\s{0,3}>\s?/gm, "")
      .replace(/^\s*(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s+)?/gm, "")
      .replace(/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/gm, "")
      // ênfase e riscado
      .replace(/(\*\*|__)(?!\s)(.+?)(?<!\s)\1/g, "$2")
      // ênfase simples só fora de palavras (preserva snake_case)
      .replace(/(^|[^\w*])([*_])(?!\s)(.+?)(?<!\s)\2(?=[^\w*]|$)/g, "$1$3")
      .replace(/~~(.+?)~~/g, "$1")
      // tabelas: barras viram espaço
      .replace(/\|/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}
