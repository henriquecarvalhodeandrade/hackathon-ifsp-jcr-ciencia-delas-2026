import { z } from "zod";
import { PAPER_RELATIONS, type PaperRelation } from "@/lib/constants";
import type { CrossrefPaperData } from "./crossref";
import { isValidDoi, normalizeDoi } from "./doi";
import { PAPER_LIMITS, maxPaperYear } from "./limits";

/**
 * Validação (zod) dos formulários da Vitrine. Módulo puro — usado pelas Server Actions e
 * também no navegador (para ler o formulário antes de buscar dados pelo DOI).
 */

/** Valores crus do formulário, devolvidos às actions para repor os campos (React 19 reseta o form). */
export interface PaperFormValues {
  doi: string;
  url: string;
  title: string;
  authors: string[];
  abstract: string;
  venue: string;
  year: string;
  area_id: string;
  keywords: string[];
  submitter_relation: string;
  women_authorship_confirmed: boolean;
  plain_summary: string;
  plain_summary_source: string;
}

export const EMPTY_PAPER_VALUES: PaperFormValues = {
  doi: "",
  url: "",
  title: "",
  authors: [],
  abstract: "",
  venue: "",
  year: "",
  area_id: "",
  keywords: [],
  submitter_relation: "",
  women_authorship_confirmed: false,
  plain_summary: "",
  plain_summary_source: "",
};

const text = (formData: FormData, name: string) => {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
};
const list = (formData: FormData, name: string) =>
  formData.getAll(name).filter((v): v is string => typeof v === "string");

export function readPaperForm(formData: FormData): PaperFormValues {
  return {
    doi: text(formData, "doi"),
    url: text(formData, "url"),
    title: text(formData, "title"),
    authors: list(formData, "authors"),
    abstract: text(formData, "abstract"),
    venue: text(formData, "venue"),
    year: text(formData, "year"),
    area_id: text(formData, "area_id"),
    keywords: list(formData, "keywords"),
    submitter_relation: text(formData, "submitter_relation"),
    women_authorship_confirmed: formData.get("women_authorship_confirmed") === "on",
    plain_summary: text(formData, "plain_summary"),
    plain_summary_source: text(formData, "plain_summary_source"),
  };
}

const relations = Object.keys(PAPER_RELATIONS) as [PaperRelation, ...PaperRelation[]];

const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, { error: message })
    .transform((v) => (v === "" ? null : v));

function dedupe(items: string[], key: (s: string) => string = (s) => s.toLocaleLowerCase("pt-BR")) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const k = key(item);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function createPaperSchema(now: Date = new Date()) {
  const yearMax = maxPaperYear(now);
  return z
    .object({
      doi: z
        .string()
        .transform((v) => normalizeDoi(v))
        .refine((v) => v === "" || isValidDoi(v), {
          error: "Esse DOI não parece válido. Ele começa com 10. e tem uma barra, como 10.1590/s0100-123.",
        })
        .transform((v) => (v === "" ? null : v)),
      url: z
        .string()
        .trim()
        .max(PAPER_LIMITS.urlMax, { error: "O link pode ter no máximo 1.000 caracteres." })
        .refine((v) => v === "" || /^https?:\/\/\S+$/i.test(v), {
          error: "Use o link completo, começando com https://.",
        })
        .transform((v) => (v === "" ? null : v)),
      title: z
        .string()
        .trim()
        .min(PAPER_LIMITS.titleMin, { error: "Escreva o título do paper (pelo menos 5 caracteres)." })
        .max(PAPER_LIMITS.titleMax, { error: "O título pode ter no máximo 300 caracteres." }),
      authors: z
        .array(
          z
            .string()
            .trim()
            .max(PAPER_LIMITS.authorNameMax, { error: "Cada nome pode ter no máximo 200 caracteres." }),
        )
        .transform((names) => dedupe(names.filter(Boolean)))
        .pipe(
          z
            .array(z.string())
            .min(1, { error: "Informe pelo menos um nome de autora." })
            .max(PAPER_LIMITS.authorsMax, { error: "Informe no máximo 50 nomes." }),
        ),
      abstract: z
        .string()
        .trim()
        .min(PAPER_LIMITS.abstractMin, {
          error: "O resumo precisa ter pelo menos 50 caracteres — cole o abstract do paper.",
        })
        .max(PAPER_LIMITS.abstractMax, { error: "O resumo pode ter no máximo 5.000 caracteres." }),
      venue: optionalText(PAPER_LIMITS.venueMax, "O nome da revista ou do evento pode ter no máximo 300 caracteres."),
      year: z
        .string()
        .trim()
        .refine((v) => v === "" || /^\d{4}$/.test(v), { error: "Use o ano com 4 dígitos, como 2026." })
        .transform((v) => (v === "" ? null : Number(v)))
        .refine((v) => v === null || (v >= PAPER_LIMITS.yearMin && v <= yearMax), {
          error: `O ano precisa estar entre ${PAPER_LIMITS.yearMin} e ${yearMax}.`,
        }),
      area_id: z
        .string()
        .trim()
        .refine((v) => /^\d{1,5}$/.test(v) && Number(v) > 0, {
          error: "Escolha a área do paper — ela ajuda quem filtra a Vitrine.",
        })
        .transform(Number),
      keywords: z
        .array(
          z
            .string()
            .trim()
            .max(PAPER_LIMITS.keywordMax, { error: "Cada palavra-chave pode ter no máximo 60 caracteres." }),
        )
        .transform((items) => dedupe(items.map((k) => k.toLocaleLowerCase("pt-BR")).filter(Boolean)))
        .pipe(z.array(z.string()).max(PAPER_LIMITS.keywordsMax, { error: "Use no máximo 15 palavras-chave." })),
      submitter_relation: z.enum(relations, { error: "Conte qual é a sua relação com o trabalho." }),
      women_authorship_confirmed: z.literal(true, {
        error: "Confirme que o trabalho tem autoria de mulheres — é o propósito da Vitrine.",
      }),
      plain_summary: optionalText(PAPER_LIMITS.plainSummaryMax, "O resumo acessível pode ter no máximo 1.500 caracteres."),
      plain_summary_source: z.string(),
    })
    .transform(({ plain_summary, plain_summary_source, ...rest }) => ({
      ...rest,
      plain_summary,
      plain_summary_source: plain_summary
        ? plain_summary_source === "ai"
          ? ("ai" as const)
          : ("author" as const)
        : null,
    }));
}

export type PaperInput = z.output<ReturnType<typeof createPaperSchema>>;
export type PaperFieldErrors = Partial<Record<keyof PaperFormValues, string[]>>;

export const MISSING_LINK_ERROR =
  "Informe o DOI ou um link para o paper — assim as pessoas chegam ao texto completo.";

/**
 * Valida o formulário inteiro. A regra "DOI ou link" é checada à parte, nos valores crus,
 * para aparecer junto com os demais erros (refinamentos do zod só rodam com o objeto válido).
 */
export function validatePaperForm(
  values: PaperFormValues,
  now: Date = new Date(),
): { success: true; data: PaperInput } | { success: false; fieldErrors: PaperFieldErrors } {
  const parsed = createPaperSchema(now).safeParse(values);
  const missingLink = values.doi.trim() === "" && values.url.trim() === "";
  if (parsed.success && !missingLink) return { success: true, data: parsed.data };
  const fieldErrors: PaperFieldErrors = parsed.success
    ? {}
    : (z.flattenError(parsed.error).fieldErrors as PaperFieldErrors);
  if (missingLink) fieldErrors.url = [MISSING_LINK_ERROR, ...(fieldErrors.url ?? [])];
  return { success: false, fieldErrors };
}

export const commentSchema = z.object({
  paper_id: z.uuid({ error: "Paper inválido." }),
  body: z
    .string()
    .trim()
    .min(PAPER_LIMITS.commentMin, { error: "Escreva pelo menos 2 caracteres." })
    .max(PAPER_LIMITS.commentMax, { error: "O comentário pode ter no máximo 3.000 caracteres." }),
});

/** Uma linha do banco → valores do formulário de edição. */
export function paperToFormValues(paper: {
  doi: string | null;
  url: string | null;
  title: string;
  authors: string[];
  abstract: string;
  venue: string | null;
  year: number | null;
  area_id: number | null;
  keywords: string[];
  submitter_relation: string;
  women_authorship_confirmed: boolean;
  plain_summary: string | null;
  plain_summary_source: string | null;
}): PaperFormValues {
  return {
    doi: paper.doi ?? "",
    url: paper.url ?? "",
    title: paper.title,
    authors: [...paper.authors],
    abstract: paper.abstract,
    venue: paper.venue ?? "",
    year: paper.year ? String(paper.year) : "",
    area_id: paper.area_id ? String(paper.area_id) : "",
    keywords: [...paper.keywords],
    submitter_relation: paper.submitter_relation,
    women_authorship_confirmed: paper.women_authorship_confirmed,
    plain_summary: paper.plain_summary ?? "",
    plain_summary_source: paper.plain_summary_source ?? "",
  };
}

/**
 * Preenche o formulário com os dados do Crossref. Campos que o Crossref trouxe substituem
 * os atuais; os demais (link, área, palavras-chave, relação, resumo acessível) ficam como estão.
 */
export function mergeCrossrefIntoValues(current: PaperFormValues, data: CrossrefPaperData): PaperFormValues {
  return {
    ...current,
    doi: data.doi,
    title: data.title ?? current.title,
    authors: data.authors.length > 0 ? data.authors : current.authors,
    abstract: data.abstract ?? current.abstract,
    venue: data.venue ?? current.venue,
    year: data.year ? String(data.year) : current.year,
  };
}

/** Lista dos campos que o Crossref preencheu (para a mensagem de sucesso). */
export function filledByCrossref(data: CrossrefPaperData): string[] {
  const fields: string[] = [];
  if (data.title) fields.push("título");
  if (data.authors.length > 0) fields.push("autoras");
  if (data.abstract) fields.push("resumo");
  if (data.venue) fields.push("revista ou evento");
  if (data.year) fields.push("ano");
  return fields;
}
