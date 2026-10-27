import type { EmbeddingKind } from "./providers/types";

/**
 * O gemini-embedding-2 não usa `taskType`: a tarefa vai como prefixo no próprio texto.
 *  - documento (perfil de mentora, o que é "buscado"):  `title: none | text: ...`
 *  - consulta (perfil da mentoranda, quem "busca"):    `task: search result | query: ...`
 * Modelos antigos (gemini-embedding-001) usam taskType e recebem o texto sem prefixo.
 */
export const DOCUMENT_PREFIX = "title: none | text: ";
export const QUERY_PREFIX = "task: search result | query: ";

/** Limite defensivo de caracteres por texto (bem abaixo do limite de tokens do modelo). */
export const MAX_EMBEDDING_CHARS = 6000;

export function formatEmbeddingInput(
  text: string,
  kind: EmbeddingKind,
  options: { usePrefix?: boolean } = {},
): string {
  const body = text.replace(/\s+/g, " ").trim().slice(0, MAX_EMBEDDING_CHARS);
  if (options.usePrefix === false) return body;
  return `${kind === "document" ? DOCUMENT_PREFIX : QUERY_PREFIX}${body}`;
}

/** Normaliza o vetor para norma L2 = 1 (necessário para a similaridade de cosseno ser estável). */
export function l2Normalize(vector: number[]): number[] {
  let sum = 0;
  for (const v of vector) sum += v * v;
  const norm = Math.sqrt(sum);
  if (!Number.isFinite(norm) || norm === 0) return vector.map(() => 0);
  return vector.map((v) => v / norm);
}

/**
 * Ajusta o vetor à dimensão esperada. Modelos Gemini são treinados com Matryoshka (MRL),
 * então truncar um vetor maior preserva o significado; vetor menor é erro.
 */
export function fitDimensions(vector: number[], dimensions: number): number[] | null {
  if (vector.length < dimensions) return null;
  return l2Normalize(vector.length === dimensions ? vector : vector.slice(0, dimensions));
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}
