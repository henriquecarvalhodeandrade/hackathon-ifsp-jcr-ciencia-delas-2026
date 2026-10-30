import { describe, expect, it } from "vitest";
import { z } from "zod";
import { Constants } from "@/lib/database.types";
import {
  attachmentColumns,
  createCommentSchema,
  createPostSchema,
  decodeAttachment,
  deleteCommentSchema,
  deletePostSchema,
  encodeAttachment,
  FEED_LIMITS,
  isPostKind,
  likeSchema,
  normalizeLinkUrl,
  POST_KINDS,
  readCommentForm,
  readPostEditForm,
  readPostForm,
  updateCommentSchema,
  updatePostSchema,
} from "./schema";

const POST_ID = "b1000000-0000-4000-8000-000000000001";
const COMMENT_ID = "b2000000-0000-4000-8000-000000000002";
const ITEM_ID = "c3000000-0000-4000-8000-000000000003";

function form(entries: Array<[string, string]>): FormData {
  const fd = new FormData();
  for (const [k, v] of entries) fd.append(k, v);
  return fd;
}

function fieldErrors(error: z.ZodError) {
  return z.flattenError(error).fieldErrors as Record<string, string[] | undefined>;
}

describe("POST_KINDS / isPostKind", () => {
  it("segue o enum post_kind do banco", () => {
    expect(POST_KINDS).toEqual(Constants.public.Enums.post_kind);
    expect(isPostKind("achievement")).toBe(true);
    expect(isPostKind("Achievement")).toBe(false);
    expect(isPostKind(undefined)).toBe(false);
  });
});

describe("normalizeLinkUrl", () => {
  it("acrescenta https:// quando falta o esquema", () => {
    expect(normalizeLinkUrl("doi.org/10.1590/s0100-123")).toEqual({
      ok: true,
      value: "https://doi.org/10.1590/s0100-123",
    });
  });

  it("mantém http e https", () => {
    expect(normalizeLinkUrl(" http://exemplo.org/evento ")).toEqual({
      ok: true,
      value: "http://exemplo.org/evento",
    });
  });

  it("recusa esquemas perigosos, espaços, credenciais e hosts sem ponto", () => {
    expect(normalizeLinkUrl("javascript:alert(1)").ok).toBe(false);
    expect(normalizeLinkUrl("ftp://exemplo.org").ok).toBe(false);
    expect(normalizeLinkUrl("exemplo .org").ok).toBe(false);
    expect(normalizeLinkUrl("https://ana:senha@exemplo.org").ok).toBe(false);
    expect(normalizeLinkUrl("localhost:3000").ok).toBe(false);
    expect(normalizeLinkUrl("").ok).toBe(false);
  });

  it("respeita o limite de 500 caracteres", () => {
    const long = `https://exemplo.org/${"a".repeat(FEED_LIMITS.linkMax)}`;
    const result = normalizeLinkUrl(long);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("500");
  });
});

describe("anexos", () => {
  it("codifica e decodifica item de portfólio e vaga", () => {
    const value = encodeAttachment({ type: "portfolio", id: ITEM_ID });
    expect(value).toBe(`portfolio:${ITEM_ID}`);
    expect(decodeAttachment(value)).toEqual({ type: "portfolio", id: ITEM_ID });
    expect(decodeAttachment(`opportunity:${ITEM_ID.toUpperCase()}`)).toEqual({
      type: "opportunity",
      id: ITEM_ID,
    });
  });

  it("recusa formatos desconhecidos", () => {
    expect(decodeAttachment("")).toBeNull();
    expect(decodeAttachment(ITEM_ID)).toBeNull();
    expect(decodeAttachment(`paper:${ITEM_ID}`)).toBeNull();
    expect(decodeAttachment("portfolio:123")).toBeNull();
  });

  it("preenche no máximo uma coluna de anexo", () => {
    expect(attachmentColumns(null)).toEqual({ portfolio_item_id: null, opportunity_id: null });
    expect(attachmentColumns({ type: "portfolio", id: ITEM_ID })).toEqual({
      portfolio_item_id: ITEM_ID,
      opportunity_id: null,
    });
    expect(attachmentColumns({ type: "opportunity", id: ITEM_ID })).toEqual({
      portfolio_item_id: null,
      opportunity_id: ITEM_ID,
    });
  });
});

describe("readPostForm + createPostSchema", () => {
  it("aceita uma publicação completa e normaliza link, anexo e quebras de linha", () => {
    const values = readPostForm(
      form([
        ["kind", "achievement"],
        ["body", "  Defendi o mestrado!\r\nObrigada a todas.  "],
        ["linkUrl", "repositorio.unesp.br/handle/123"],
        ["attachment", `portfolio:${ITEM_ID}`],
      ]),
    );
    const parsed = createPostSchema.safeParse(values);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data).toEqual({
      kind: "achievement",
      body: "Defendi o mestrado!\nObrigada a todas.",
      linkUrl: "https://repositorio.unesp.br/handle/123",
      attachment: { type: "portfolio", id: ITEM_ID },
    });
  });

  it("link e anexo vazios viram null", () => {
    const parsed = createPostSchema.safeParse(
      readPostForm(
        form([
          ["kind", "update"],
          ["body", "Oi, rede!"],
        ]),
      ),
    );
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.linkUrl).toBeNull();
      expect(parsed.data.attachment).toBeNull();
    }
  });

  it("recusa texto vazio, longo demais, tipo desconhecido, link e anexo inválidos", () => {
    const parsed = createPostSchema.safeParse({
      kind: "meme",
      body: "   ",
      linkUrl: "javascript:alert(1)",
      attachment: "paper:1",
    });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    const errors = fieldErrors(parsed.error);
    expect(errors.kind?.[0]).toBe("Escolha o tipo da publicação.");
    expect(errors.body?.[0]).toBe("Escreva algo antes de publicar.");
    expect(errors.linkUrl?.[0]).toContain("https://");
    expect(errors.attachment?.[0]).toBe("Escolha um anexo da lista.");

    const long = createPostSchema.safeParse({
      kind: "update",
      body: "a".repeat(FEED_LIMITS.bodyMax + 1),
      linkUrl: "",
      attachment: "",
    });
    expect(long.success).toBe(false);
    if (!long.success) expect(fieldErrors(long.error).body?.[0]).toContain("3.000");
  });

  it("conta CRLF como um caractere só (igual ao contador do campo)", () => {
    const body = `${"a".repeat(FEED_LIMITS.bodyMax - 2)}\r\nb`;
    expect(
      createPostSchema.safeParse({ kind: "update", body, linkUrl: "", attachment: "" }).success,
    ).toBe(true);
  });
});

describe("updatePostSchema", () => {
  it("exige o id e aceita tipo, texto e link (sem anexo)", () => {
    const values = readPostEditForm(
      form([
        ["kind", "event"],
        ["body", "Semana da Ciência no IFSP"],
        ["linkUrl", ""],
        ["attachment", `portfolio:${ITEM_ID}`],
      ]),
    );
    expect(values).toEqual({ kind: "event", body: "Semana da Ciência no IFSP", linkUrl: "" });
    const parsed = updatePostSchema.safeParse({ ...values, postId: POST_ID });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data).not.toHaveProperty("attachment");
    expect(updatePostSchema.safeParse({ ...values, postId: "123" }).success).toBe(false);
  });
});

describe("deletePostSchema", () => {
  it("origem desconhecida volta para a lista", () => {
    const parsed = deletePostSchema.safeParse({ postId: POST_ID, from: "outra" });
    expect(parsed.success && parsed.data.from).toBe("lista");
    const detail = deletePostSchema.safeParse({ postId: POST_ID, from: "detalhe" });
    expect(detail.success && detail.data.from).toBe("detalhe");
  });
});

describe("likeSchema", () => {
  it("aceita só o id e o estado desejado", () => {
    expect(likeSchema.safeParse({ postId: POST_ID, liked: true }).success).toBe(true);
    expect(likeSchema.safeParse({ postId: POST_ID, liked: "sim" }).success).toBe(false);
    expect(likeSchema.safeParse({ postId: POST_ID, liked: true, userId: POST_ID }).success).toBe(
      false,
    );
  });
});

describe("comentários", () => {
  it("valida texto de 1 a 1.500 caracteres", () => {
    const values = readCommentForm(form([["body", "  Parabéns!  "]]));
    const ok = createCommentSchema.safeParse({ ...values, postId: POST_ID });
    expect(ok.success && ok.data.body).toBe("Parabéns!");

    const empty = createCommentSchema.safeParse({ body: "  ", postId: POST_ID });
    expect(empty.success).toBe(false);
    if (!empty.success)
      expect(fieldErrors(empty.error).body?.[0]).toBe("Escreva seu comentário antes de enviar.");

    const long = createCommentSchema.safeParse({
      body: "a".repeat(FEED_LIMITS.commentMax + 1),
      postId: POST_ID,
    });
    expect(long.success).toBe(false);
    if (!long.success) expect(fieldErrors(long.error).body?.[0]).toContain("1.500");
  });

  it("edição e exclusão exigem ids válidos", () => {
    expect(
      updateCommentSchema.safeParse({ commentId: COMMENT_ID, postId: POST_ID, body: "Ok" }).success,
    ).toBe(true);
    expect(
      updateCommentSchema.safeParse({ commentId: "x", postId: POST_ID, body: "Ok" }).success,
    ).toBe(false);
    expect(deleteCommentSchema.safeParse({ commentId: COMMENT_ID, postId: POST_ID }).success).toBe(
      true,
    );
  });
});
