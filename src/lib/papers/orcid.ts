import { z } from "zod";
import { normalizeOrcid, orcidCheckDigit, type NormalizeResult } from "@/lib/profile/links";
import { stripMarkup } from "./crossref";
import { isValidDoi, normalizeDoi } from "./doi";
import { PAPER_LIMITS } from "./limits";
import type { PaperFormValues } from "./schema";

/**
 * Importação de publicações do ORCID (API pública, sem chave) — parte pura e testada.
 * A chamada HTTP fica em ./orcid-lookup.ts e a Server Action em ./orcid-actions.ts.
 *
 * Endpoint: `GET https://pub.orcid.org/v3.0/{orcid}/works` com `Accept: application/json`.
 * Formato relevante da resposta (v3.0, "works" agrupados pelo próprio ORCID):
 *
 *   group[]: {
 *     external-ids: { external-id: [{ external-id-type, external-id-value,
 *                     external-id-normalized?: { value }, external-id-relationship }] }
 *     work-summary[]: {          ← o mesmo trabalho vindo de fontes diferentes
 *       put-code, display-index, type,
 *       title: { title: { value }, subtitle?, translated-title? },
 *       external-ids, url?: { value },
 *       publication-date?: { year?: { value }, month?, day? },
 *       journal-title?: { value }
 *     }
 *   }
 */

export const ORCID_API_BASE = "https://pub.orcid.org/v3.0";

/** Formato canônico do iD (o último caractere pode ser X). */
export const ORCID_ID_PATTERN = /^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/;

/** Teto de publicações devolvidas ao navegador (pesquisadoras muito produtivas têm centenas). */
export const ORCID_MAX_WORKS = 300;

export interface OrcidWork {
  /** Identificador do trabalho no registro ORCID (chave estável na lista). */
  putCode: number | null;
  title: string;
  year: number | null;
  /** Revista, evento ou série (journal-title). */
  journal: string | null;
  /** DOI normalizado (minúsculo, sem prefixo), só da relação "self". */
  doi: string | null;
  /** Link do registro (http/https), quando a fonte informou. */
  url: string | null;
  /** Tipo do ORCID (journal-article, conference-paper…). */
  type: string | null;
}

/**
 * Aceita "0000-0002-1825-0097", "https://orcid.org/0000-0002-1825-0097" ou os 16 dígitos
 * colados e confere o dígito verificador (ISO 7064 MOD 11-2). Mesma regra do perfil.
 */
export function parseOrcidId(input: unknown): NormalizeResult {
  return normalizeOrcid(typeof input === "string" ? input : "");
}

/** iD já no formato canônico e com dígito verificador correto. */
export function isValidOrcidId(id: string): boolean {
  if (!ORCID_ID_PATTERN.test(id)) return false;
  const compact = id.replace(/-/g, "");
  return orcidCheckDigit(compact.slice(0, 15)) === compact[15];
}

/**
 * URL da API pública para a lista de trabalhos. Proteção contra SSRF: o host é fixo e o iD
 * precisa estar validado (formato canônico + dígito verificador) antes de entrar na URL.
 */
export function orcidWorksUrl(id: string): string {
  if (!isValidOrcidId(id)) throw new Error("ORCID iD inválido");
  return `${ORCID_API_BASE}/${id}/works`;
}

const TYPE_LABELS: Record<string, string> = {
  "journal-article": "Artigo em periódico",
  "conference-paper": "Trabalho em evento",
  "conference-abstract": "Resumo em evento",
  "conference-poster": "Pôster em evento",
  "book-chapter": "Capítulo de livro",
  book: "Livro",
  "edited-book": "Livro organizado",
  preprint: "Preprint",
  "dissertation-thesis": "Dissertação ou tese",
  dissertation: "Dissertação ou tese",
  review: "Revisão",
  "data-set": "Conjunto de dados",
  report: "Relatório",
  "working-paper": "Texto para discussão",
  "research-tool": "Ferramenta de pesquisa",
  "research-technique": "Técnica de pesquisa",
  software: "Software",
  "book-review": "Resenha",
  "journal-issue": "Edição de periódico",
  "magazine-article": "Artigo em revista",
  "newspaper-article": "Artigo em jornal",
  "newsletter-article": "Artigo em boletim",
  "encyclopedia-entry": "Verbete de enciclopédia",
  "dictionary-entry": "Verbete de dicionário",
  "lecture-speech": "Palestra",
  "public-speech": "Palestra",
  "supervised-student-publication": "Publicação de orientanda ou orientando",
  "technical-standard": "Norma técnica",
  "standards-and-policy": "Normas e políticas",
  "data-management-plan": "Plano de gestão de dados",
  "learning-object": "Material didático",
  "online-resource": "Recurso online",
  website: "Site",
  translation: "Tradução",
  manual: "Manual",
  patent: "Patente",
  other: "Outro",
};

/** Rótulo em pt-BR do tipo de trabalho (null quando desconhecido). */
export function orcidWorkTypeLabel(type: string | null | undefined): string | null {
  return type ? (TYPE_LABELS[type] ?? null) : null;
}

// ---------------------------------------------------------------------------
// Conversão do JSON
// ---------------------------------------------------------------------------

const valueOf = z
  .object({ value: z.union([z.string(), z.number()]).nullish() })
  .loose()
  .nullish();

const externalIds = z
  .object({
    "external-id": z
      .array(
        z
          .object({
            "external-id-type": z.string().nullish(),
            "external-id-value": z.string().nullish(),
            "external-id-normalized": valueOf,
            "external-id-relationship": z.string().nullish(),
          })
          .loose(),
      )
      .nullish(),
  })
  .loose()
  .nullish();

const summarySchema = z
  .object({
    "put-code": z.number().nullish(),
    "display-index": z.union([z.string(), z.number()]).nullish(),
    type: z.string().nullish(),
    title: z
      .object({ title: valueOf, "translated-title": z.unknown().optional() })
      .loose()
      .nullish(),
    "external-ids": externalIds,
    url: valueOf,
    "publication-date": z.object({ year: valueOf }).loose().nullish(),
    "journal-title": valueOf,
  })
  .loose();

const groupSchema = z
  .object({
    "external-ids": externalIds,
    "work-summary": z.array(z.unknown()).nullish(),
  })
  .loose();

type Summary = z.infer<typeof summarySchema>;
type ExternalIds = z.infer<typeof externalIds>;

function textOf(field: { value?: string | number | null } | null | undefined): string {
  const value = field?.value;
  return typeof value === "string" ? value : typeof value === "number" ? String(value) : "";
}

function clip(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

/** DOI da relação "self" (o próprio trabalho — "part-of" é o do livro/periódico). */
function doiFrom(ids: ExternalIds): string | null {
  for (const id of ids?.["external-id"] ?? []) {
    if (id["external-id-type"]?.toLowerCase() !== "doi") continue;
    const relationship = id["external-id-relationship"]?.toLowerCase() ?? "self";
    if (relationship !== "self") continue;
    const raw = textOf(id["external-id-normalized"]) || id["external-id-value"] || "";
    const doi = normalizeDoi(raw);
    if (doi && isValidDoi(doi)) return doi;
  }
  return null;
}

function yearFrom(summary: Summary): number | null {
  const raw = textOf(summary["publication-date"]?.year).trim();
  if (!/^\d{4}$/.test(raw)) return null;
  const year = Number(raw);
  return year >= PAPER_LIMITS.yearMin && year <= 2100 ? year : null;
}

function urlFrom(summary: Summary): string | null {
  const raw = textOf(summary.url).trim();
  if (!raw || raw.length > PAPER_LIMITS.urlMax || !/^https?:\/\/\S+$/i.test(raw)) return null;
  return raw;
}

function workFrom(summary: Summary, groupIds: ExternalIds): OrcidWork | null {
  const title = stripMarkup(textOf(summary.title?.title));
  if (!title) return null;
  const journal = stripMarkup(textOf(summary["journal-title"]));
  return {
    putCode: summary["put-code"] ?? null,
    title: clip(title, PAPER_LIMITS.titleMax),
    year: yearFrom(summary),
    journal: journal ? clip(journal, PAPER_LIMITS.venueMax) : null,
    doi: doiFrom(summary["external-ids"]) ?? doiFrom(groupIds),
    url: urlFrom(summary),
    type: summary.type ?? null,
  };
}

/** Completa os campos vazios de `base` com os de `extra` (mesmo trabalho, outra fonte). */
function fillGaps(base: OrcidWork, extra: OrcidWork): OrcidWork {
  return {
    ...base,
    year: base.year ?? extra.year,
    journal: base.journal ?? extra.journal,
    doi: base.doi ?? extra.doi,
    url: base.url ?? extra.url,
    type: base.type ?? extra.type,
  };
}

function displayIndex(summary: Summary): number {
  const n = Number(summary["display-index"]);
  return Number.isFinite(n) ? n : -1;
}

/**
 * Um grupo do ORCID = o mesmo trabalho informado por várias fontes. Usa a versão preferida
 * (maior `display-index`) e completa ano/revista/DOI/link com as demais.
 */
function workFromGroup(group: z.infer<typeof groupSchema>): OrcidWork | null {
  const summaries = (group["work-summary"] ?? [])
    .map((raw) => summarySchema.safeParse(raw))
    .filter((parsed) => parsed.success)
    .map((parsed) => parsed.data)
    .map((summary, index) => ({ summary, index }))
    .sort((a, b) => displayIndex(b.summary) - displayIndex(a.summary) || a.index - b.index);

  let result: OrcidWork | null = null;
  for (const { summary } of summaries) {
    const work = workFrom(summary, group["external-ids"]);
    if (!work) continue;
    result = result ? fillGaps(result, work) : work;
  }
  return result;
}

function titleKey(work: OrcidWork): string {
  const title = work.title
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
  return `${title}|${work.year ?? ""}`;
}

/**
 * Remove duplicatas: mesmo DOI (sem diferenciar maiúsculas) vira um item só, completado com os
 * dados das cópias. Trabalhos sem DOI com o mesmo título e ano de outro item também saem
 * (fontes diferentes que o ORCID não agrupou). A ordem de entrada é mantida.
 */
export function dedupeOrcidWorks(works: OrcidWork[]): OrcidWork[] {
  const byDoi = new Map<string, number>();
  const result: OrcidWork[] = [];
  for (const work of works) {
    const doi = work.doi ? normalizeDoi(work.doi) : null;
    const seenAt = doi ? byDoi.get(doi) : undefined;
    if (seenAt !== undefined) {
      result[seenAt] = fillGaps(result[seenAt]!, work);
      continue;
    }
    if (doi) byDoi.set(doi, result.length);
    result.push(doi ? { ...work, doi } : work);
  }

  const titlesWithDoi = new Set(result.filter((w) => w.doi).map(titleKey));
  const titlesWithoutDoi = new Set<string>();
  return result.filter((work) => {
    if (work.doi) return true;
    const key = titleKey(work);
    if (titlesWithDoi.has(key) || titlesWithoutDoi.has(key)) return false;
    titlesWithoutDoi.add(key);
    return true;
  });
}

/** Mais recentes primeiro (sem ano no fim) e, no mesmo ano, por título. */
export function sortOrcidWorks(works: OrcidWork[]): OrcidWork[] {
  return [...works].sort(
    (a, b) =>
      (b.year ?? -Infinity) - (a.year ?? -Infinity) ||
      a.title.localeCompare(b.title, "pt-BR", { sensitivity: "base" }),
  );
}

/**
 * Converte a resposta de `/v3.0/{orcid}/works` numa lista sem duplicatas e ordenada.
 * Retorna null quando o formato não é reconhecido. Grupos ou fontes malformados são
 * ignorados sem derrubar o resto.
 */
export function parseOrcidWorks(json: unknown): OrcidWork[] | null {
  if (!json || typeof json !== "object" || !("group" in json)) return null;
  const groups = (json as { group: unknown }).group;
  if (groups === null) return [];
  if (!Array.isArray(groups)) return null;

  const works: OrcidWork[] = [];
  for (const raw of groups) {
    const group = groupSchema.safeParse(raw);
    if (!group.success) continue;
    const work = workFromGroup(group.data);
    if (work) works.push(work);
  }
  return sortOrcidWorks(dedupeOrcidWorks(works));
}

// ---------------------------------------------------------------------------
// Formulário
// ---------------------------------------------------------------------------

/**
 * Preenche o formulário com um trabalho do ORCID (sem passar pelo Crossref): título, ano,
 * revista/evento e DOI substituem os atuais quando vieram; o link do registro só entra se o
 * campo estiver vazio. Autoras, resumo, área e o resto ficam como estão.
 */
export function mergeOrcidIntoValues(current: PaperFormValues, work: OrcidWork): PaperFormValues {
  return {
    ...current,
    doi: work.doi ?? current.doi,
    title: work.title || current.title,
    year: work.year ? String(work.year) : current.year,
    venue: work.journal ?? current.venue,
    url: current.url.trim() === "" && work.url ? work.url : current.url,
  };
}

/** O que a última importação do ORCID fez no formulário: os valores antes e depois. */
export interface OrcidImportRecord {
  before: PaperFormValues;
  after: PaperFormValues;
}

function sameText(a: string, b: string) {
  // O navegador pode devolver as quebras de linha do <textarea> como \r\n.
  return a.replace(/\r\n?/g, "\n") === b.replace(/\r\n?/g, "\n");
}

function sameList(a: readonly string[], b: readonly string[]) {
  return a.length === b.length && a.every((item, i) => item === b[i]);
}

/**
 * Antes de usar OUTRO trabalho do ORCID, desfaz a importação anterior nos campos que ela
 * preencheu e que a pessoa não editou depois (voltam ao valor de antes da importação). Sem isso,
 * trocar de trabalho misturava os dois: escolher um sem DOI depois de um com DOI deixava o DOI,
 * as autoras e o resumo do primeiro sob o título do segundo. O que ela digitou fica como está.
 */
export function undoOrcidImport(
  current: PaperFormValues,
  previous: OrcidImportRecord | null,
): PaperFormValues {
  if (!previous) return current;
  const { before, after } = previous;
  const text = (field: "doi" | "url" | "title" | "abstract" | "venue" | "year") =>
    !sameText(after[field], before[field]) && sameText(current[field], after[field])
      ? before[field]
      : current[field];
  const authorsStale =
    !sameList(after.authors, before.authors) && sameList(current.authors, after.authors);
  return {
    ...current,
    doi: text("doi"),
    url: text("url"),
    title: text("title"),
    authors: authorsStale ? before.authors : current.authors,
    abstract: text("abstract"),
    venue: text("venue"),
    year: text("year"),
  };
}

/** Campos que a pessoa ainda precisa completar depois de uma importação sem DOI. */
export function missingAfterOrcid(values: PaperFormValues): string[] {
  const missing: string[] = [];
  if (values.authors.length === 0) missing.push("autoras");
  if (values.abstract.trim() === "") missing.push("resumo");
  if (values.doi.trim() === "" && values.url.trim() === "") missing.push("o link para o paper");
  return missing;
}

/** Campos que o ORCID preencheu (para a mensagem de sucesso). */
export function filledByOrcid(work: OrcidWork, current: PaperFormValues): string[] {
  const fields = ["título"];
  if (work.year) fields.push("ano");
  if (work.journal) fields.push("revista ou evento");
  if (work.doi) fields.push("DOI");
  if (work.url && current.url.trim() === "") fields.push("link");
  return fields;
}

/** Junta itens em pt-BR: "a", "a e b", "a, b e c". */
export function joinPt(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} e ${items[items.length - 1]}`;
}
