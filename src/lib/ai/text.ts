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
const ORCID_RE = /\b\d{4}-\d{4}-\d{4}-\d{3}[\dX]\b/g;
const PHONE_RE = /(?:\+?55[\s-]?)?(?:\(\d{2}\)|\b\d{2})[\s-]?9?\s?\d{4}[-\s]?\d{4}\b/g;
const HANDLE_RE = /(^|\s)@[\w.]{2,}/g;

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
