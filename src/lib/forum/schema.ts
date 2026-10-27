import { z } from "zod";
import { Constants } from "@/lib/database.types";
import { formatNumber } from "@/lib/utils";

/** Limites espelhados dos CHECKs de supabase/migrations/20261027120300_forum.sql. */
export const FORUM_LIMITS = {
  titleMin: 5,
  titleMax: 160,
  threadBodyMin: 10,
  threadBodyMax: 20000,
  postBodyMin: 2,
  postBodyMax: 10000,
  tagsMax: 5,
  tagMaxLength: 40,
} as const;

export const REACTION_KIND_VALUES = Constants.public.Enums.reaction_kind;
export type ReactionKindValue = (typeof REACTION_KIND_VALUES)[number];

/**
 * Normaliza tags como o banco faz (private.normalize_tags): espaços aparados e
 * colapsados, minúsculas, sem vazias e sem repetidas (mantém a primeira ocorrência).
 */
export function normalizeTags(tags: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tags) {
    const tag = raw.replace(/\s+/g, " ").trim().toLocaleLowerCase("pt-BR");
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    out.push(tag);
  }
  return out;
}

/** Checkbox/Switch nativo envia "on" quando marcado. */
export function isChecked(value: FormDataEntryValue | null | undefined): boolean {
  return value === "on" || value === "true" || value === "1";
}

const L = FORUM_LIMITS;

const titleSchema = z
  .string()
  .trim()
  .min(L.titleMin, { error: `Dê um título com pelo menos ${L.titleMin} caracteres.` })
  .max(L.titleMax, { error: `Use no máximo ${L.titleMax} caracteres no título.` });

const threadBodySchema = z
  .string()
  .trim()
  .min(L.threadBodyMin, { error: `Escreva pelo menos ${L.threadBodyMin} caracteres para contextualizar.` })
  .max(L.threadBodyMax, { error: `O texto pode ter até ${formatNumber(L.threadBodyMax)} caracteres.` });

const tagsSchema = z
  .array(z.string().max(L.tagMaxLength, { error: `Cada tag pode ter até ${L.tagMaxLength} caracteres.` }))
  .max(L.tagsMax, { error: `Use no máximo ${L.tagsMax} tags.` });

const idSchema = z.guid({ error: "Não encontramos esse conteúdo." });

export const createThreadSchema = z.object({
  categoryId: z.coerce
    .number({ error: "Escolha uma categoria." })
    .int({ error: "Escolha uma categoria." })
    .positive({ error: "Escolha uma categoria." }),
  title: titleSchema,
  body: threadBodySchema,
  tags: tagsSchema,
  anonymous: z.boolean(),
});

export const updateThreadSchema = z.object({
  threadId: idSchema,
  title: titleSchema,
  body: threadBodySchema,
  tags: tagsSchema,
});

const postBodySchema = z
  .string()
  .trim()
  .min(L.postBodyMin, { error: `Escreva pelo menos ${L.postBodyMin} caracteres.` })
  .max(L.postBodyMax, { error: `A resposta pode ter até ${formatNumber(L.postBodyMax)} caracteres.` });

export const createPostSchema = z.object({
  threadId: idSchema,
  body: postBodySchema,
  anonymous: z.boolean(),
});

export const updatePostSchema = z.object({
  postId: idSchema,
  threadId: idSchema,
  body: postBodySchema,
});

export const reactionSchema = z
  .object({
    threadId: idSchema,
    postId: idSchema.nullable().optional(),
    kind: z.enum(REACTION_KIND_VALUES, { error: "Reação inválida." }),
    active: z.boolean(),
  })
  .strict();

export const idPairSchema = z.object({ threadId: idSchema, postId: idSchema });

/** Valores do formulário de tópico (devolvidos para o React 19 não perder o texto). */
export type ThreadFormValues = {
  categoryId: string;
  title: string;
  body: string;
  tags: string[];
  anonymous: boolean;
};

export type PostFormValues = { body: string; anonymous: boolean };

function readString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export function readThreadForm(formData: FormData): ThreadFormValues {
  return {
    categoryId: readString(formData, "categoryId"),
    title: readString(formData, "title"),
    body: readString(formData, "body"),
    tags: normalizeTags(formData.getAll("tags").filter((v): v is string => typeof v === "string")),
    anonymous: isChecked(formData.get("anonymous")),
  };
}

export function readPostForm(formData: FormData): PostFormValues {
  return { body: readString(formData, "body"), anonymous: isChecked(formData.get("anonymous")) };
}

export { readString as readFormString };
