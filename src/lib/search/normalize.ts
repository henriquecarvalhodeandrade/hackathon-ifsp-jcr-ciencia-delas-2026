/**
 * Busca sem acento e sem diferença de maiúsculas (módulo puro, testado em normalize.test.ts).
 *
 * O banco guarda em `search_text` (profiles, forum_threads, papers) o texto pesquisável já
 * normalizado: `lower(unaccent(...))` com espaços colapsados — migration
 * `20261028170000_accent_insensitive_search.sql`. Aqui o termo digitado passa pela MESMA
 * normalização (sem os diacríticos que o `unaccent` tira + minúsculas) e vira padrões para
 * `.ilike("search_text", padrao)`: "Jacarei" encontra "Jacareí", "REVISAO" encontra "revisão".
 *
 * Cada palavra vira um filtro próprio (E lógico): "visão jacareí" encontra o perfil que tem as
 * duas palavras em qualquer campo e em qualquer ordem.
 */

/** Tamanho máximo do termo normalizado (o resto é ignorado). */
export const SEARCH_MAX_LENGTH = 80;
/** Máximo de palavras transformadas em filtro (as demais são ignoradas). */
export const SEARCH_MAX_TERMS = 6;
/** Termos mais curtos que isso (no total) não filtram nada. */
export const SEARCH_MIN_LENGTH = 2;

/**
 * Letras que não se decompõem em NFD mas que o `unaccent` do Postgres troca por ASCII (inclusive
 * as ligaduras que aparecem ao copiar texto de PDFs, como "ﬁ"), e a pontuação tipográfica que ele
 * simplifica (aspas curvas, hífens e travessões, reticências). Aplicadas depois das minúsculas.
 */
const EXTRA_FOLDS: Record<string, string> = {
  ß: "ss",
  æ: "ae",
  œ: "oe",
  ø: "o",
  ł: "l",
  ŀ: "l",
  đ: "d",
  ð: "d",
  þ: "th",
  ħ: "h",
  ŧ: "t",
  ŋ: "n",
  ı: "i",
  ĳ: "ij",
  ǆ: "dz",
  ǉ: "lj",
  ǌ: "nj",
  ŉ: "'n",
  ſ: "s",
  ƒ: "f",
  ﬀ: "ff",
  ﬁ: "fi",
  ﬂ: "fl",
  ﬃ: "ffi",
  ﬄ: "ffl",
  ﬅ: "st",
  ﬆ: "st",
  "‘": "'",
  "’": "'",
  "‚": ",",
  ʼ: "'",
  "′": "'",
  "“": '"',
  "”": '"',
  "″": '"',
  "„": ",,",
  "«": "<<",
  "»": ">>",
  "¡": "!",
  "¿": "?",
  "‐": "-",
  "‑": "-",
  "‒": "-",
  "–": "-",
  "—": "-",
  "―": "-",
  "−": "-",
  "…": "...",
};
const EXTRA_FOLDS_RE = new RegExp(`[${Object.keys(EXTRA_FOLDS).join("")}]`, "gu");

/**
 * Letras cujos acentos o `unaccent` remove: latinas e gregas (do cirílico, só Ё/ё). Nas demais
 * escritas ele mantém a letra como está — "й", "が", Hangul, sinais do devanágari e do hebraico —,
 * então aqui também.
 */
const FOLDABLE_LETTER = /[\p{Script=Latin}\p{Script=Greek}\u0401\u0451]/gu;
/** Marcas combinantes que o `unaccent` apaga (depois da decomposição ou soltas no texto). */
const STRIPPED_MARKS = /[\u0300-\u0362\u20dd-\u20e0\u20e2-\u20e4]/g;

/**
 * Texto normalizado como o banco faz em `search_text` (`lower(unaccent(...))`): composição NFC
 * (como o texto digitado chega ao banco), decomposição NFD só das letras latinas/gregas para tirar
 * os diacríticos, minúsculas, espaços colapsados e aparado. Não escapa nada.
 */
export function foldSearchText(raw: string): string {
  return raw
    .normalize("NFC")
    .replace(FOLDABLE_LETTER, (letter) => letter.normalize("NFD"))
    .replace(STRIPPED_MARKS, "")
    .toLowerCase()
    .replace(EXTRA_FOLDS_RE, (char) => EXTRA_FOLDS[char] ?? char)
    .replace(/\s+/g, " ")
    .trim();
}

/** Escapa os curingas do LIKE/ILIKE (`%`, `_` e a barra invertida, que é o escape padrão). */
export function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, (char) => `\\${char}`);
}

/**
 * Termo pronto para `ilike`: normalizado (NFD, sem acentos, minúsculas, espaços colapsados),
 * sem `*` (o PostgREST o trata como `%` e não há como escapá-lo), cortado em
 * {@link SEARCH_MAX_LENGTH} caracteres e com `%`, `_` e `\` escapados.
 */
export function normalizeSearchQuery(raw: string | null | undefined): string {
  return escapeLike(foldQuery(raw));
}

function foldQuery(raw: string | null | undefined): string {
  return foldSearchText((raw ?? "").replace(/\*/g, " "))
    .slice(0, SEARCH_MAX_LENGTH)
    .trim();
}

/**
 * Padrões `%palavra%` (normalizados e escapados) para aplicar com `.ilike("search_text", p)` —
 * um filtro por palavra, todos obrigatórios. Lista vazia quando o termo é curto demais
 * (< {@link SEARCH_MIN_LENGTH} caracteres) ou só tem espaços/curingas.
 */
export function searchPatterns(raw: string | null | undefined): string[] {
  const folded = foldQuery(raw);
  if (folded.replace(/[\s%_\\]/g, "").length < SEARCH_MIN_LENGTH) return [];
  const words = [...new Set(folded.split(" ").filter(Boolean))].slice(0, SEARCH_MAX_TERMS);
  return words.map((word) => `%${escapeLike(word)}%`);
}

/** Interface mínima de um filtro do supabase-js (PostgrestFilterBuilder) com `.ilike()`. */
interface IlikeFilterable<T> {
  ilike(column: string, pattern: string): T;
}

/**
 * Aplica a busca normalizada em `search_text` a uma consulta do supabase-js (um `.ilike` por
 * palavra). Sem termo útil, devolve a consulta como veio.
 */
export function applySearchText<T extends IlikeFilterable<T>>(
  query: T,
  raw: string | null | undefined,
  column = "search_text",
): T {
  return searchPatterns(raw).reduce((q, pattern) => q.ilike(column, pattern), query);
}
