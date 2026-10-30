/**
 * DOI (Digital Object Identifier) — normalização e validação, espelhando o trigger
 * `papers_before_write` do banco: sem prefixo de URL/"doi:", sem espaços e em minúsculas
 * (DOIs não diferenciam maiúsculas). Módulo puro: roda no servidor e no navegador.
 */

/** Mesmo padrão do CHECK de `papers.doi`. */
export const DOI_PATTERN = /^10\.\d{4,9}\/\S+$/;
export const DOI_MAX_LENGTH = 255;

const PREFIX = /^(?:https?:\/\/(?:dx\.)?doi\.org\/|doi:\s*)/i;

/**
 * "https://doi.org/10.1590/ABC" · "doi: 10.1590/abc" · " 10.1590/abc. " → "10.1590/abc".
 * Também remove pontuação final colada por engano (ponto, vírgula, ponto e vírgula).
 * Não valida — use `isValidDoi` no resultado.
 */
export function normalizeDoi(input: string | null | undefined): string {
  let doi = (input ?? "").trim().replace(PREFIX, "").trim();
  try {
    // Quem copia da barra de endereços pode trazer o DOI codificado (%2F).
    if (/%[0-9a-f]{2}/i.test(doi)) doi = decodeURIComponent(doi);
  } catch {
    // sequência % inválida: mantém como veio (e a validação recusa se for o caso)
  }
  return doi.replace(/[.,;]+$/, "").toLowerCase();
}

export function isValidDoi(doi: string): boolean {
  return doi.length <= DOI_MAX_LENGTH && DOI_PATTERN.test(doi);
}

/** Link resolvível do DOI (https://doi.org/...), com cada segmento codificado. */
export function doiUrl(doi: string): string {
  return `https://doi.org/${doi.split("/").map(encodeURIComponent).join("/")}`;
}
