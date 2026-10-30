import { z } from "zod";
import { PORTFOLIO_KINDS, PORTFOLIO_LIMITS, type PortfolioKind } from "./presentation";

/**
 * Validação (zod) do formulário do portfólio. Módulo puro — usado pelas Server Actions.
 * Espelha os CHECKs de `portfolio_items` (docs/18 §2.2); o banco valida de novo.
 */

/** Valores crus do formulário, devolvidos pelas actions para repor os campos (React 19 reseta o form). */
export interface PortfolioFormValues {
  kind: string;
  title: string;
  description: string;
  url: string;
  venue: string;
  year: string;
  tags: string[];
  pinned: boolean;
  /** Só na criação: publica no feed um aviso com o item anexado. */
  share_to_feed: boolean;
}

export const EMPTY_PORTFOLIO_VALUES: PortfolioFormValues = {
  kind: "",
  title: "",
  description: "",
  url: "",
  venue: "",
  year: "",
  tags: [],
  pinned: false,
  share_to_feed: true,
};

const text = (formData: FormData, name: string) => {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
};

export function readPortfolioForm(formData: FormData): PortfolioFormValues {
  return {
    kind: text(formData, "kind"),
    title: text(formData, "title"),
    description: text(formData, "description"),
    url: text(formData, "url"),
    venue: text(formData, "venue"),
    year: text(formData, "year"),
    tags: formData.getAll("tags").filter((v): v is string => typeof v === "string"),
    pinned: formData.get("pinned") === "on",
    share_to_feed: formData.get("share_to_feed") === "on",
  };
}

/** Igual a `private.normalize_tags`: minúsculas, sem espaços nas pontas, sem vazias nem repetidas. */
export function normalizeTags(tags: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tags) {
    const tag = raw.trim().toLocaleLowerCase("pt-BR");
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    out.push(tag);
  }
  return out;
}

/** O navegador envia as quebras do <textarea> como CRLF: viram LF antes de contar. */
const lf = (value: string) => value.replace(/\r\n?/g, "\n");

const optionalText = (max: number, message: string) =>
  z
    .string()
    .transform(lf)
    .pipe(z.string().trim().max(max, { error: message }))
    .transform((v) => (v === "" ? null : v));

const kinds = PORTFOLIO_KINDS as unknown as [PortfolioKind, ...PortfolioKind[]];

export const portfolioItemSchema = z.object({
  kind: z.enum(kinds, { error: "Escolha o tipo do item." }),
  title: z
    .string()
    .trim()
    .min(PORTFOLIO_LIMITS.titleMin, { error: "Escreva o título (pelo menos 3 caracteres)." })
    .max(PORTFOLIO_LIMITS.titleMax, { error: "O título pode ter no máximo 200 caracteres." }),
  description: optionalText(
    PORTFOLIO_LIMITS.descriptionMax,
    "A descrição pode ter no máximo 2.000 caracteres.",
  ),
  url: z
    .string()
    .trim()
    .max(PORTFOLIO_LIMITS.urlMax, { error: "O link pode ter no máximo 500 caracteres." })
    .refine((v) => v === "" || /^https?:\/\/\S+$/i.test(v), {
      error: "Use o link completo, começando com https://.",
    })
    .transform((v) => (v === "" ? null : v)),
  venue: optionalText(
    PORTFOLIO_LIMITS.venueMax,
    "O nome do lugar (revista, evento, instituição) pode ter no máximo 160 caracteres.",
  ),
  year: z
    .string()
    .trim()
    .refine((v) => v === "" || /^\d{4}$/.test(v), { error: "Use o ano com 4 dígitos, como 2026." })
    .transform((v) => (v === "" ? null : Number(v)))
    .refine((v) => v === null || (v >= PORTFOLIO_LIMITS.yearMin && v <= PORTFOLIO_LIMITS.yearMax), {
      error: `O ano precisa estar entre ${PORTFOLIO_LIMITS.yearMin} e ${PORTFOLIO_LIMITS.yearMax}.`,
    }),
  tags: z
    .array(
      z
        .string()
        .trim()
        .max(PORTFOLIO_LIMITS.tagMax, { error: "Cada tag pode ter no máximo 40 caracteres." }),
    )
    .transform(normalizeTags)
    .pipe(z.array(z.string()).max(PORTFOLIO_LIMITS.tagsMax, { error: "Use no máximo 8 tags." })),
  pinned: z.boolean(),
  share_to_feed: z.boolean(),
});

export type PortfolioInput = z.output<typeof portfolioItemSchema>;
export type PortfolioFieldErrors = Partial<Record<keyof PortfolioFormValues, string[]>>;

export function validatePortfolioForm(
  values: PortfolioFormValues,
): { success: true; data: PortfolioInput } | { success: false; fieldErrors: PortfolioFieldErrors } {
  const parsed = portfolioItemSchema.safeParse(values);
  if (parsed.success) return { success: true, data: parsed.data };
  return {
    success: false,
    fieldErrors: z.flattenError(parsed.error).fieldErrors as PortfolioFieldErrors,
  };
}

/** Colunas que a dona grava (grant de insert/update de portfolio_items). */
export function toPortfolioRow(input: PortfolioInput) {
  return {
    kind: input.kind,
    title: input.title,
    description: input.description,
    url: input.url,
    venue: input.venue,
    year: input.year,
    tags: input.tags,
    pinned: input.pinned,
  };
}

/** Uma linha do banco → valores do formulário de edição. */
export function portfolioToFormValues(item: {
  kind: string;
  title: string;
  description: string | null;
  url: string | null;
  venue: string | null;
  year: number | null;
  tags: string[];
  pinned: boolean;
}): PortfolioFormValues {
  return {
    kind: item.kind,
    title: item.title,
    description: item.description ?? "",
    url: item.url ?? "",
    venue: item.venue ?? "",
    year: item.year ? String(item.year) : "",
    tags: [...item.tags],
    pinned: item.pinned,
    share_to_feed: false,
  };
}
