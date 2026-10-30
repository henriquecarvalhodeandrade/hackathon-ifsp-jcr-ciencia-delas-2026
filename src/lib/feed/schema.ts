import { z } from "zod";
import type { Enums } from "@/lib/database.types";
import { formatNumber } from "@/lib/utils";

/**
 * Validação (zod) das Server Actions do feed. Módulo puro: também roda no cliente (para
 * remontar os campos quando a action falha). Mensagens em pt-BR, iguais às da interface.
 * Ids de usuárias NUNCA vêm do formulário: a autoria é o default `auth.uid()` das colunas.
 */

/** Limites espelhados dos CHECKs de posts/post_comments (docs/18-rede-social.md §2.4). */
export const FEED_LIMITS = {
  bodyMax: 3000,
  commentMax: 1500,
  linkMax: 500,
} as const;

/**
 * Valores do enum `post_kind` (mesma ordem do banco). Lista local de propósito: o `satisfies`
 * confere com os tipos gerados e schema.test.ts confere com `Constants` — assim o módulo não
 * depende, em tempo de execução, de os tipos gerados já estarem recarregados no servidor.
 */
export const POST_KINDS = [
  "update",
  "project",
  "achievement",
  "publication",
  "event",
] as const satisfies readonly Enums<"post_kind">[];
export type PostKind = (typeof POST_KINDS)[number];

export function isPostKind(value: unknown): value is PostKind {
  return typeof value === "string" && (POST_KINDS as readonly string[]).includes(value);
}

// ---------------------------------------------------------------------------
// Link externo
// ---------------------------------------------------------------------------

export type NormalizeResult = { ok: true; value: string } | { ok: false; error: string };

const INVALID_LINK = "Esse endereço não parece válido. Confira se copiou o link inteiro.";

/**
 * Normaliza o link da publicação. O banco exige `http(s)://` (nada de `javascript:`); aqui
 * aceitamos o que as pessoas costumam colar ("doi.org/10.1590/…") e devolvemos com https://.
 */
export function normalizeLinkUrl(input: string): NormalizeResult {
  const raw = input.trim();
  if (!raw) return { ok: false, error: "Informe o endereço." };
  if (/\s/.test(raw)) return { ok: false, error: "O endereço não pode ter espaços." };

  const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(raw);
  if (hasScheme && !/^https?:\/\//i.test(raw)) {
    return { ok: false, error: "Use um endereço que comece com https://." };
  }
  const candidate = hasScheme ? raw : `https://${raw.replace(/^\/+/, "")}`;

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return { ok: false, error: INVALID_LINK };
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return { ok: false, error: "Use um endereço que comece com https://." };
  }
  if (!url.hostname.includes(".") || url.username || url.password) {
    return { ok: false, error: INVALID_LINK };
  }
  if (url.href.length > FEED_LIMITS.linkMax) {
    return { ok: false, error: `Use um endereço com até ${FEED_LIMITS.linkMax} caracteres.` };
  }
  return { ok: true, value: url.href };
}

// ---------------------------------------------------------------------------
// Anexo (um item do meu portfólio OU uma vaga que publiquei)
// ---------------------------------------------------------------------------

export type PostAttachment = { type: "portfolio" | "opportunity"; id: string };

const ATTACHMENT_PATTERN =
  /^(portfolio|opportunity):([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

/** Valor da opção no <select> do anexo: "portfolio:<id>" ou "opportunity:<id>". */
export function encodeAttachment(attachment: PostAttachment): string {
  return `${attachment.type}:${attachment.id}`;
}

/** Inverso de encodeAttachment; null para vazio ou formato desconhecido. */
export function decodeAttachment(value: string): PostAttachment | null {
  const match = ATTACHMENT_PATTERN.exec(value.trim());
  if (!match) return null;
  return { type: match[1]!.toLowerCase() as PostAttachment["type"], id: match[2]!.toLowerCase() };
}

/** Colunas do insert: no máximo um dos dois anexos preenchido. */
export function attachmentColumns(attachment: PostAttachment | null): {
  portfolio_item_id: string | null;
  opportunity_id: string | null;
} {
  return {
    portfolio_item_id: attachment?.type === "portfolio" ? attachment.id : null,
    opportunity_id: attachment?.type === "opportunity" ? attachment.id : null,
  };
}

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

/** O <textarea> envia quebras de linha como CRLF: viram LF antes de contar (igual ao contador). */
const normalizeNewlines = (value: unknown) =>
  typeof value === "string" ? value.replace(/\r\n?/g, "\n") : value;

const idSchema = z.guid({ error: "Não encontramos essa publicação. Recarregue a página." });

const kindSchema = z.enum(POST_KINDS, { error: "Escolha o tipo da publicação." });

const postBodySchema = z.preprocess(
  normalizeNewlines,
  z
    .string({ error: "Escreva algo antes de publicar." })
    .trim()
    .min(1, { error: "Escreva algo antes de publicar." })
    .max(FEED_LIMITS.bodyMax, {
      error: `A publicação pode ter até ${formatNumber(FEED_LIMITS.bodyMax)} caracteres.`,
    }),
);

const commentBodySchema = z.preprocess(
  normalizeNewlines,
  z
    .string({ error: "Escreva seu comentário antes de enviar." })
    .trim()
    .min(1, { error: "Escreva seu comentário antes de enviar." })
    .max(FEED_LIMITS.commentMax, {
      error: `O comentário pode ter até ${formatNumber(FEED_LIMITS.commentMax)} caracteres.`,
    }),
);

/** Link opcional: vazio vira null. */
const linkSchema = z
  .string()
  .trim()
  .transform((value, ctx) => {
    if (!value) return null;
    const result = normalizeLinkUrl(value);
    if (!result.ok) {
      ctx.addIssue({ code: "custom", message: result.error });
      return z.NEVER;
    }
    return result.value;
  });

/** Anexo opcional: vazio vira null. */
const attachmentSchema = z
  .string()
  .trim()
  .transform((value, ctx) => {
    if (!value) return null;
    const attachment = decodeAttachment(value);
    if (!attachment) {
      ctx.addIssue({ code: "custom", message: "Escolha um anexo da lista." });
      return z.NEVER;
    }
    return attachment;
  });

export const createPostSchema = z.object({
  kind: kindSchema,
  body: postBodySchema,
  linkUrl: linkSchema,
  attachment: attachmentSchema,
});
export type CreatePostInput = z.infer<typeof createPostSchema>;

/** A autora edita tipo, texto e link (o anexo fica como está — docs/18 §2.4). */
export const updatePostSchema = z.object({
  postId: idSchema,
  kind: kindSchema,
  body: postBodySchema,
  linkUrl: linkSchema,
});
export type UpdatePostInput = z.infer<typeof updatePostSchema>;

export const deletePostSchema = z.object({
  postId: idSchema,
  /** De onde veio o pedido: apagando na página da publicação, voltamos para o feed. */
  from: z.enum(["lista", "detalhe"]).catch("lista"),
});

export const likeSchema = z
  .object({ postId: idSchema, liked: z.boolean({ error: "Curtida inválida." }) })
  .strict();

const commentIdSchema = z.guid({ error: "Não encontramos esse comentário. Recarregue a página." });

export const createCommentSchema = z.object({ postId: idSchema, body: commentBodySchema });

export const updateCommentSchema = z.object({
  commentId: commentIdSchema,
  postId: idSchema,
  body: commentBodySchema,
});

export const deleteCommentSchema = z.object({ commentId: commentIdSchema, postId: idSchema });

// ---------------------------------------------------------------------------
// Leitura dos formulários (devolvidos no estado para o React 19 não perder o texto)
// ---------------------------------------------------------------------------

export type PostFormValues = { kind: string; body: string; linkUrl: string; attachment: string };
export type PostEditValues = Omit<PostFormValues, "attachment">;
export type CommentFormValues = { body: string };

export function readFormString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export function readPostForm(formData: FormData): PostFormValues {
  return {
    kind: readFormString(formData, "kind"),
    body: readFormString(formData, "body"),
    linkUrl: readFormString(formData, "linkUrl"),
    attachment: readFormString(formData, "attachment"),
  };
}

export function readPostEditForm(formData: FormData): PostEditValues {
  return {
    kind: readFormString(formData, "kind"),
    body: readFormString(formData, "body"),
    linkUrl: readFormString(formData, "linkUrl"),
  };
}

export function readCommentForm(formData: FormData): CommentFormValues {
  return { body: readFormString(formData, "body") };
}
