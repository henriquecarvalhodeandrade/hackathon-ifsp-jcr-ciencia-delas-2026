import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  createPostSchema,
  createThreadSchema,
  FORUM_LIMITS,
  isChecked,
  normalizeTags,
  reactionSchema,
  readPostForm,
  readThreadForm,
  updateThreadSchema,
} from "./schema";

const THREAD_ID = "a1000000-0000-4000-8000-000000000001";
const POST_ID = "a2000000-0000-4000-8000-000000000012";

function form(entries: Array<[string, string]>): FormData {
  const fd = new FormData();
  for (const [k, v] of entries) fd.append(k, v);
  return fd;
}

describe("normalizeTags", () => {
  it("apara, colapsa espaços, põe em minúsculas e remove repetidas/vazias", () => {
    expect(normalizeTags(["  Bolsas ", "bolsas", "", "Vale  do Paraíba", "IC"])).toEqual([
      "bolsas",
      "vale do paraíba",
      "ic",
    ]);
  });
});

describe("isChecked", () => {
  it("entende os valores de checkbox/switch", () => {
    expect(isChecked("on")).toBe(true);
    expect(isChecked("true")).toBe(true);
    expect(isChecked(null)).toBe(false);
    expect(isChecked("off")).toBe(false);
  });
});

describe("readThreadForm + createThreadSchema", () => {
  it("aceita um tópico válido", () => {
    const values = readThreadForm(
      form([
        ["categoryId", "2"],
        ["title", "  Doutorado ou indústria?  "],
        ["body", "Estou terminando o mestrado e queria ouvir experiências."],
        ["tags", "Carreira"],
        ["tags", "carreira"],
        ["tags", "Indústria"],
        ["anonymous", "on"],
      ]),
    );
    expect(values.tags).toEqual(["carreira", "indústria"]);
    expect(values.anonymous).toBe(true);
    const parsed = createThreadSchema.parse(values);
    expect(parsed).toMatchObject({ categoryId: 2, title: "Doutorado ou indústria?", anonymous: true });
  });

  it("devolve mensagens em pt-BR por campo", () => {
    const result = createThreadSchema.safeParse(
      readThreadForm(
        form([
          ["categoryId", ""],
          ["title", "Oi"],
          ["body", "curto"],
          ...Array.from({ length: 6 }, (_, i) => ["tags", `tag${i}`] as [string, string]),
        ]),
      ),
    );
    expect(result.success).toBe(false);
    const errors = z.flattenError(result.error!).fieldErrors;
    expect(errors.categoryId?.[0]).toBe("Escolha uma categoria.");
    expect(errors.title?.[0]).toContain("pelo menos 5");
    expect(errors.body?.[0]).toContain("pelo menos 10");
    expect(errors.tags?.[0]).toBe("Use no máximo 5 tags.");
  });

  it("respeita os limites máximos do banco", () => {
    const result = updateThreadSchema.safeParse({
      threadId: THREAD_ID,
      title: "x".repeat(FORUM_LIMITS.titleMax + 1),
      body: "y".repeat(FORUM_LIMITS.threadBodyMax + 1),
      tags: ["z".repeat(FORUM_LIMITS.tagMaxLength + 1)],
    });
    expect(result.success).toBe(false);
    const errors = z.flattenError(result.error!).fieldErrors;
    expect(errors.title?.[0]).toContain("160");
    expect(errors.body?.[0]).toContain("20.000");
    expect(errors.tags?.[0]).toContain("40");
  });
});

describe("createPostSchema", () => {
  it("valida o corpo da resposta e o id do tópico", () => {
    const ok = createPostSchema.safeParse({ threadId: THREAD_ID, ...readPostForm(form([["body", " Obrigada! "]])) });
    expect(ok.success && ok.data.body).toBe("Obrigada!");

    const bad = createPostSchema.safeParse({ threadId: "nao-e-uuid", body: "a", anonymous: false });
    expect(bad.success).toBe(false);
    const errors = z.flattenError(bad.error!).fieldErrors;
    expect(errors.threadId).toBeDefined();
    expect(errors.body?.[0]).toContain("pelo menos 2");
  });
});

describe("reactionSchema", () => {
  it("aceita reação em tópico ou resposta e recusa campos extras", () => {
    expect(reactionSchema.safeParse({ threadId: THREAD_ID, kind: "support", active: true }).success).toBe(true);
    expect(
      reactionSchema.safeParse({ threadId: THREAD_ID, postId: POST_ID, kind: "useful", active: false }).success,
    ).toBe(true);
    expect(reactionSchema.safeParse({ threadId: THREAD_ID, kind: "like", active: true }).success).toBe(false);
    expect(
      reactionSchema.safeParse({ threadId: THREAD_ID, kind: "support", active: true, userId: POST_ID }).success,
    ).toBe(false);
  });
});
