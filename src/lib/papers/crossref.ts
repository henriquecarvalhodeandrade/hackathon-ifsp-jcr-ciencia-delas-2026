import { z } from "zod";
import { normalizeDoi } from "./doi";
import { PAPER_LIMITS } from "./limits";

/**
 * Conversão da resposta da API pública do Crossref (`GET https://api.crossref.org/works/{doi}`)
 * para os campos do formulário de papers. Módulo puro (a chamada HTTP fica em ./lookup.ts).
 *
 * Formato relevante de `message`:
 *   title: string[] · subtitle?: string[] · author?: [{ given?, family?, name? }]
 *   container-title?: string[] · publisher?: string · abstract?: string (JATS XML)
 *   issued / published-print / published-online / created: { "date-parts": [[ano, mês?, dia?]] }
 */

export interface CrossrefPaperData {
  doi: string;
  title: string | null;
  authors: string[];
  venue: string | null;
  year: number | null;
  abstract: string | null;
}

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
};

/** Decodifica entidades HTML/XML comuns (&amp;, &#233;, &#x00e9;...). */
export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
    if (entity[0] === "#") {
      const code =
        entity[1] === "x" || entity[1] === "X"
          ? Number.parseInt(entity.slice(2), 16)
          : Number.parseInt(entity.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
    }
    return ENTITIES[entity.toLowerCase()] ?? match;
  });
}

/** Tags de formatação em linha: somem sem deixar espaço ("<i>Hall</i>." → "Hall."). */
const INLINE_TAG =
  /<\/?(?:jats:|mml:)?(?:i|b|em|strong|sub|sup|sc|u|span|a|italic|bold|underline|monospace|inline-formula)\b[^>]*>/gi;

/** Remove marcação (HTML, MathML, JATS) e normaliza espaços numa única linha. */
export function stripMarkup(text: string): string {
  return decodeEntities(text.replace(INLINE_TAG, "").replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Abstract em JATS → texto simples com parágrafos separados por linha em branco.
 * Remove títulos como "Abstract", "Resumo" ou "Summary" no início.
 */
export function cleanAbstract(raw: string): string {
  const withBreaks = raw
    .replace(/<\/(?:jats:)?(?:p|sec|title)>/gi, "\n\n")
    .replace(/<(?:jats:)?break\s*\/?>/gi, "\n");
  const paragraphs = withBreaks
    .split(/\n{2,}/)
    .map((p) => stripMarkup(p))
    .filter(Boolean);
  if (paragraphs.length > 0 && /^(abstract|resumo|summary|background)[.:]?$/i.test(paragraphs[0]!)) {
    paragraphs.shift();
  }
  const text = paragraphs.join("\n\n");
  return text.replace(/^(abstract|resumo|summary)\s*[.:—–-]?\s+/i, "").trim();
}

function clip(text: string, max: number): string {
  if (text.length <= max) return text;
  const slice = text.slice(0, max - 1);
  const lastSpace = slice.lastIndexOf(" ");
  return `${(lastSpace > max * 0.8 ? slice.slice(0, lastSpace) : slice).trimEnd()}…`;
}

const dateParts = z
  .object({ "date-parts": z.array(z.array(z.union([z.number(), z.string(), z.null()]))).optional() })
  .partial();

const workSchema = z.object({
  DOI: z.string().optional(),
  title: z.array(z.string()).optional(),
  subtitle: z.array(z.string()).optional(),
  author: z
    .array(
      z
        .object({
          given: z.string().optional(),
          family: z.string().optional(),
          name: z.string().optional(),
        })
        .loose(),
    )
    .optional(),
  "container-title": z.array(z.string()).optional(),
  publisher: z.string().optional(),
  abstract: z.string().optional(),
  issued: dateParts.optional(),
  "published-print": dateParts.optional(),
  "published-online": dateParts.optional(),
  created: dateParts.optional(),
});

function yearFrom(...candidates: Array<z.infer<typeof dateParts> | undefined>): number | null {
  for (const candidate of candidates) {
    const raw = candidate?.["date-parts"]?.[0]?.[0];
    const year = typeof raw === "string" ? Number.parseInt(raw, 10) : raw;
    if (typeof year === "number" && Number.isInteger(year) && year >= PAPER_LIMITS.yearMin && year <= 2100) {
      return year;
    }
  }
  return null;
}

function authorName(author: { given?: string; family?: string; name?: string }): string {
  const full = author.name ?? [author.given, author.family].filter(Boolean).join(" ");
  return clip(stripMarkup(full), PAPER_LIMITS.authorNameMax);
}

/**
 * Aceita o JSON inteiro da API (`{ status, message }`) ou só `message`.
 * Retorna null quando o formato não é reconhecido.
 */
export function parseCrossrefWork(json: unknown, requestedDoi?: string): CrossrefPaperData | null {
  const message =
    json && typeof json === "object" && "message" in json ? (json as { message: unknown }).message : json;
  const parsed = workSchema.safeParse(message);
  if (!parsed.success) return null;
  const work = parsed.data;

  const doi = normalizeDoi(work.DOI ?? requestedDoi ?? "");
  if (!doi) return null;

  const mainTitle = work.title?.map(stripMarkup).find(Boolean) ?? null;
  const subtitle = work.subtitle?.map(stripMarkup).find(Boolean);
  const fullTitle = mainTitle && subtitle && !mainTitle.includes(subtitle) ? `${mainTitle}: ${subtitle}` : mainTitle;
  const title = fullTitle
    ? fullTitle.length <= PAPER_LIMITS.titleMax
      ? fullTitle
      : clip(mainTitle!, PAPER_LIMITS.titleMax)
    : null;

  const seen = new Set<string>();
  const authors: string[] = [];
  for (const author of work.author ?? []) {
    const name = authorName(author);
    const key = name.toLocaleLowerCase("pt-BR");
    if (!name || seen.has(key)) continue;
    seen.add(key);
    authors.push(name);
    if (authors.length >= PAPER_LIMITS.authorsMax) break;
  }

  const container = work["container-title"]?.map(stripMarkup).find(Boolean) ?? null;
  const venueRaw = container ?? (work.publisher ? stripMarkup(work.publisher) : null);
  const venue = venueRaw ? clip(venueRaw, PAPER_LIMITS.venueMax) : null;

  const abstractText = work.abstract ? cleanAbstract(work.abstract) : "";
  const abstract = abstractText ? clip(abstractText, PAPER_LIMITS.abstractMax) : null;

  return {
    doi,
    title,
    authors,
    venue,
    year: yearFrom(work.issued, work["published-print"], work["published-online"], work.created),
    abstract,
  };
}

/** URL da API do Crossref para um DOI (segmentos codificados, barras preservadas). */
export function crossrefWorkUrl(doi: string): string {
  return `https://api.crossref.org/works/${doi.split("/").map(encodeURIComponent).join("/")}`;
}
