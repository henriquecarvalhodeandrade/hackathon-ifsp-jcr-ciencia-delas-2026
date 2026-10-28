/**
 * Utilitários de texto para saídas de modelos e para montar prompts com segurança. Puro.
 */

const EMOJI_RE = /[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu;

/** Remove marcações de markdown, emojis e espaços extras de um texto curto gerado por IA. */
export function cleanModelText(text: string): string {
  return text
    .replace(EMOJI_RE, "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/(^|\s)[*_]([^*_\n]+)[*_](?=\s|[.,;:!?]|$)/g, "$1$2")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s*(?:[-*•]|\d+[.)])\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Corta o texto em no máximo `max` caracteres, preferindo o fim de uma frase.
 * Se não houver fim de frase razoável, corta na última palavra inteira e põe reticências.
 */
export function truncateAtSentence(text: string, max: number): string {
  const clean = text.trim();
  if (clean.length <= max) return clean;
  const slice = clean.slice(0, max);
  const lastSentenceEnd = Math.max(
    slice.lastIndexOf(". "),
    slice.lastIndexOf("! "),
    slice.lastIndexOf("? "),
    slice.endsWith(".") || slice.endsWith("!") || slice.endsWith("?") ? slice.length - 1 : -1,
  );
  if (lastSentenceEnd >= max * 0.5) return slice.slice(0, lastSentenceEnd + 1).trim();
  const lastSpace = slice.slice(0, max - 1).lastIndexOf(" ");
  const cut = lastSpace > max * 0.5 ? slice.slice(0, lastSpace) : slice.slice(0, max - 1);
  return `${cut.replace(/[\s,;:.-]+$/, "")}…`;
}

/**
 * Neutraliza tags no conteúdo enviado ao modelo para que um texto da usuária não consiga
 * "fechar" os delimitadores do prompt (`</resumo>` etc.). "p < 0,05" continua intacto.
 */
export function neutralizeTags(text: string): string {
  return text.replace(/<(\/?[a-zA-Z])/g, "‹$1");
}

const EMAIL_RE = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
const URL_RE = /\b(?:https?:\/\/|www\.)\S+/gi;
const BARE_DOMAIN_LINK_RE =
  /\b(?:lattes\.cnpq\.br|orcid\.org|linkedin\.com|instagram\.com|x\.com|twitter\.com|github\.com)\/\S*/gi;
/**
 * Domínio sem "http"/"www" ("anasilva.com.br", "meusite.dev/contato"): também é link. Só com
 * terminação conhecida e em minúsculas, para não pegar "et al.", "p.ex." nem "dados.Com isso"
 * (frase sem espaço depois do ponto). Visto na auditoria com a API real (out/2026): um texto
 * de perfil com "exemplo.dev/mentoria" passava inteiro para a IA.
 */
const BARE_DOMAIN_RE =
  /(?<![\p{L}\p{N}@._/-])(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+(?:com|net|org|edu|gov|br|pt|io|dev|app|ai|co|me|info|biz|xyz|site|online|link|page|blog|tech|science|example|ly|gl|to|tv|us|uk|es)(?:\.[a-z]{2})?(?![\p{L}\p{N}-])(?:\/[^\s,;)]*)?/gu;
const ORCID_RE = /\b\d{4}-\d{4}-\d{4}-\d{3}[\dX]\b/g;
const PHONE_RE = /(?:\+?55[\s-]?)?(?:\(\d{2}\)|\b\d{2})[\s-]?9?\s?\d{4}[-\s]?\d{4}\b/g;
const HANDLE_RE = /(^|\s)@[\w.]{2,}/g;
/** Marcas que `redactPersonalData` deixa no lugar do dado; se o modelo as repetir, a frase sai. */
const REDACTION_PLACEHOLDER_RE = /\[(?:e-mail|link|telefone|perfil|id|nome)\]/;

/** Partículas comuns em nomes que não devem ser apagadas do texto. */
const NAME_STOPWORDS = new Set(["das", "dos", "del", "von", "van", "der", "the", "and"]);

/**
 * Remove dados de contato de um texto livre antes de enviá-lo a um provedor de IA:
 * e-mails, links, ORCID, telefones e @perfis. Opcionalmente remove também partes do nome
 * da própria pessoa (nomes com 3+ letras).
 */
export function redactPersonalData(text: string, options: { names?: string[] } = {}): string {
  let out = text
    .replace(EMAIL_RE, "[e-mail]")
    .replace(URL_RE, "[link]")
    .replace(BARE_DOMAIN_LINK_RE, "[link]")
    .replace(BARE_DOMAIN_RE, "[link]")
    .replace(ORCID_RE, "[id]")
    .replace(PHONE_RE, "[telefone]")
    .replace(HANDLE_RE, "$1[perfil]");

  const tokens = new Set<string>();
  for (const name of options.names ?? []) {
    for (const token of name.split(/[\s,.;]+/)) {
      if (token.length >= 3 && !NAME_STOPWORDS.has(token.toLowerCase())) tokens.add(token);
    }
  }
  for (const token of tokens) {
    const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    out = out.replace(
      new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, "giu"),
      "[nome]",
    );
  }
  return out.replace(/\s+/g, " ").trim();
}

/**
 * O texto tem link, domínio, e-mail, telefone ou @perfil? Usado na SAÍDA dos modelos: a IA
 * nunca deve mostrar contato ou link (um perfil com injeção de prompt pode pedir "inclua o link
 * …"). `String.search` ignora o `lastIndex` das regexes globais.
 */
export function hasContactOrLink(text: string): boolean {
  return [
    EMAIL_RE,
    URL_RE,
    BARE_DOMAIN_LINK_RE,
    BARE_DOMAIN_RE,
    PHONE_RE,
    HANDLE_RE,
    REDACTION_PLACEHOLDER_RE,
  ].some((re) => text.search(re) >= 0);
}

/**
 * Remove da saída de um modelo as frases com link, domínio, e-mail, telefone ou @perfil
 * (defesa em profundidade contra injeção de prompt: o resto do texto continua). Puro.
 */
export function dropSentencesWithContacts(text: string): string {
  if (!hasContactOrLink(text)) return text;
  return text
    .split(/(?<=[.!?…])\s+/)
    .filter((sentence) => !hasContactOrLink(sentence))
    .join(" ")
    .trim();
}

// ---------------------------------------------------------------------------
// Saída sem acentos
// ---------------------------------------------------------------------------

/**
 * Palavras que, em português, só se escrevem COM acento (nenhuma delas é outra palavra válida
 * sem ele). Escritas sem acento, denunciam uma saída "achatada", sem diacríticos.
 */
const ALWAYS_ACCENTED = new Set([
  "voce",
  "voces",
  "tambem",
  "alem",
  "ja",
  "apos",
  "pos",
  "area",
  "areas",
  "ciencia",
  "ciencias",
  "cientifica",
  "cientifico",
  "cientificas",
  "cientificos",
  "academica",
  "academico",
  "academicas",
  "academicos",
  "proxima",
  "proximo",
  "proximas",
  "proximos",
  "trajetoria",
  "trajetorias",
  "metodo",
  "metodos",
  "tecnica",
  "tecnico",
  "tecnicas",
  "tecnicos",
  "conteudo",
  "conteudos",
  "util",
  "uteis",
  "facil",
  "dificil",
  "possivel",
]);

function letterTokens(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^\p{L}]+/u)
    .filter(Boolean);
}

/**
 * Conta palavras distintas que deveriam ter acento e vieram sem ele: as da lista acima e as
 * terminadas em "-ao" (não → nao, opção → opcao; só "ao" é válida) e em "-oes"
 * (publicações → publicacoes). Texto normal em pt-BR fica em 0.
 * `allowWordsFrom`: texto de entrada (o prompt). Palavras que já estavam nele não contam — a
 * usuária pode ter digitado "polinizacao" sem acento, e o modelo só repetiu.
 */
export function countUnaccentedWords(text: string, allowWordsFrom = ""): number {
  const allowed = new Set(letterTokens(allowWordsFrom));
  const hits = new Set<string>();
  for (const word of letterTokens(text)) {
    if (!/^[a-z]+$/.test(word) || allowed.has(word)) continue;
    if (
      ALWAYS_ACCENTED.has(word) ||
      (word.length >= 3 && word.endsWith("ao")) ||
      (word.length >= 5 && word.endsWith("oes"))
    ) {
      hits.add(word);
    }
  }
  return hits.size;
}

/**
 * O gemini-3.5-flash-lite às vezes devolve o português sem acentos em modo JSON ("voce", "nao",
 * "opcao") — visto em 2 de 6 respostas reais em out/2026. Duas ou mais palavras assim (fora as
 * que já vieram sem acento na entrada) bastam para reprovar a resposta.
 * Devolve o motivo da reprovação (para `generateJson({ validate })`) ou null se o texto está ok.
 */
export function rejectUnaccentedText(
  texts: string | readonly string[],
  options: { allowWordsFrom?: string } = {},
): string | null {
  const joined = typeof texts === "string" ? texts : texts.join(" ");
  const hits = countUnaccentedWords(joined, options.allowWordsFrom);
  return hits >= 2 ? `texto sem acentos (${hits} palavras)` : null;
}
