/**
 * Detector de dados pessoais do "Pergunte a uma cientista" (puro: roda no navegador e no servidor).
 *
 * As expressões são AS MESMAS de `private.detect_personal_data` na migration
 * supabase/migrations/20261028190100_public_questions.sql — o banco recusa sozinho o que escapar
 * do app (inclusive chamadas diretas à API). O teste `pii.test.ts` lê a migration e compara as
 * duas listas: mudou aqui, mude lá (e vice-versa).
 *
 * Só usamos o que funciona igual no JavaScript e no Postgres (ARE): classes `[...]`, `\s`, `\S`,
 * grupos `(?:...)`, lookahead/lookbehind e a flag de maiúsculas/minúsculas (`i` / `~*`). Nada de
 * `\b` (no Postgres é `\y`) nem de `.` solto (o `.` do Postgres casa quebra de linha).
 */

export type PersonalDataKind = "email" | "telefone" | "documento" | "rede_social" | "link";

/** [tipo, expressão] na mesma ordem do banco. */
export const PII_PATTERNS: ReadonlyArray<readonly [PersonalDataKind, string]> = [
  [
    "email",
    String.raw`[a-z0-9._%+-]+\s*(?:@|\(at\)|\[at\])\s*[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}`,
  ],
  [
    "email",
    String.raw`[a-z0-9._%+-]+\s*(?:\(?\s*arroba\s*\)?|@|\(at\)|\[at\])\s*[a-z0-9-]+\s*(?:\.|ponto)\s*[a-z]{2,}`,
  ],
  [
    "telefone",
    String.raw`(?<![0-9])(?:\+?55[\s.-]*)?(?:\(?[1-9][0-9]\)?[\s.-]*)?9[\s.-]?[0-9]{4}[\s.-]?[0-9]{4}(?![0-9])`,
  ],
  [
    "telefone",
    String.raw`(?<![0-9])(?:\+?55[\s.-]*)?\(?[1-9][0-9]\)?[\s.-]*[2-5][0-9]{3}[\s.-]?[0-9]{4}(?![0-9])`,
  ],
  ["documento", String.raw`(?<![0-9])[0-9]{3}\.?[0-9]{3}\.?[0-9]{3}-?[0-9]{2}(?![0-9])`],
  ["documento", String.raw`(?<![0-9])[0-9]{1,2}\.[0-9]{3}\.[0-9]{3}-[0-9xX](?![0-9])`],
  ["rede_social", String.raw`(?<![a-z0-9._%+-])@[a-z0-9_][a-z0-9_.]{1,29}`],
  [
    "rede_social",
    String.raw`(?<![a-z0-9-])(?:instagram\.com|instagr\.am|tiktok\.com|facebook\.com|fb\.com|fb\.me|m\.me|twitter\.com|x\.com|linkedin\.com|wa\.me|api\.whatsapp\.com|chat\.whatsapp\.com|t\.me|telegram\.me|discord\.gg|discord\.com|snapchat\.com|threads\.net|bsky\.app|kwai\.com|linktr\.ee|bit\.ly|tinyurl\.com|cutt\.ly|is\.gd|encurtador\.com\.br)`,
  ],
  // Contato disfarçado: endereço com %XX no nome do site (https://%69nstagram.com) ou entidade HTML
  // (&commat;, &#64;), que o Markdown das respostas transforma em @, ponto etc.
  ["rede_social", String.raw`(?://|www\.)[^\s/?#]*%[0-9a-f]{2}|&#?[a-z0-9]{2,31};`],
  ["link", String.raw`https?://\S+`],
  ["link", String.raw`(?<![a-z0-9@.-])www\.\S+`],
  [
    "link",
    String.raw`(?<![a-z0-9@-])[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|net|org|br|io|me|app|dev|info|xyz|site|link|ly|gl|gg)(?![a-z0-9])`,
  ],
];

/**
 * Compilação protegida: navegadores antigos (Safari < 16.4, comum em celulares mais velhos) não
 * conhecem lookbehind e lançariam SyntaxError ao carregar a página. Nesses casos a expressão é
 * pulada só no navegador — o servidor (Node) e o banco continuam conferindo tudo.
 */
function compile(source: string): RegExp | null {
  try {
    return new RegExp(source, "i");
  } catch {
    return null;
  }
}

let compiled: ReadonlyArray<readonly [PersonalDataKind, RegExp | null]> | null = null;

function patterns() {
  compiled ??= PII_PATTERNS.map(([kind, source]) => [kind, compile(source)] as const);
  return compiled;
}

/** Caracteres invisíveis que alguém poderia usar para "quebrar" um e-mail ou telefone. */
const INVISIBLE = /[​-‍⁠﻿­]/g;

/**
 * Mesma normalização do banco: NFKC (＠ e dígitos largos viram ASCII), sem invisíveis, sem barras
 * invertidas (no Markdown das respostas, "9\-9876" aparece como "9-9876") e com o ponto
 * ideográfico "。" (que o navegador lê como "." num endereço) trocado por ".".
 */
export function normalizeForPii(text: string): string {
  return text.normalize("NFKC").replace(INVISIBLE, "").replaceAll("。", ".").replaceAll("\\", "");
}

export interface DetectOptions {
  /** Respostas aceitam links (para indicar sites oficiais); perguntas, não. */
  allowLinks?: boolean;
}

export interface PersonalDataMatch {
  kind: PersonalDataKind;
  /** Primeiro trecho encontrado deste tipo (já normalizado), para mostrar onde está. */
  text: string;
}

/** Como `detectPersonalData`, com o primeiro trecho de cada tipo (o aviso mostra onde está). */
export function findPersonalData(
  text: string,
  { allowLinks = false }: DetectOptions = {},
): PersonalDataMatch[] {
  const value = normalizeForPii(text);
  const found: PersonalDataMatch[] = [];
  for (const [kind, pattern] of patterns()) {
    if (!pattern || (kind === "link" && allowLinks)) continue;
    if (found.some((match) => match.kind === kind)) continue;
    const match = pattern.exec(value);
    if (match) found.push({ kind, text: match[0].trim() });
  }
  return found;
}

/** Tipos de dado pessoal encontrados (sem repetição, na ordem da lista). Vazio = texto ok. */
export function detectPersonalData(text: string, options: DetectOptions = {}): PersonalDataKind[] {
  return findPersonalData(text, options).map((match) => match.kind);
}

/** CD041 — mesma mensagem do banco. */
export const QUESTION_PII_MESSAGE =
  "Para proteger você, tire da pergunta e-mails, telefones, documentos, links e @ de redes sociais.";

/** CD047 — mesma mensagem do banco. */
export const ANSWER_PII_MESSAGE =
  "Para a segurança de quem perguntou, não compartilhe e-mail, telefone ou redes sociais. Indique caminhos públicos, como sites oficiais.";

const KIND_LABELS: Record<PersonalDataKind, string> = {
  email: "e-mail",
  telefone: "telefone",
  documento: "documento (CPF ou RG)",
  rede_social: "rede social (@ ou perfil)",
  link: "link",
};

function joinPtBr(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} e ${items.at(-1)}`;
}

/** "e-mail e telefone" — para mostrar, junto do aviso, o que foi encontrado. */
export function describeKinds(kinds: readonly PersonalDataKind[]): string {
  return joinPtBr(kinds.map((kind) => KIND_LABELS[kind]));
}

const SAMPLE_MAX = 40;

/** "link (“anos.Me”) e telefone (“99876-5432”)" — o tipo e o trecho, para achar no texto. */
export function describeMatches(matches: readonly PersonalDataMatch[]): string {
  return joinPtBr(
    matches.map(({ kind, text }) => {
      const sample = text.length > SAMPLE_MAX ? `${text.slice(0, SAMPLE_MAX - 1)}…` : text;
      return sample ? `${KIND_LABELS[kind]} (“${sample}”)` : KIND_LABELS[kind];
    }),
  );
}
