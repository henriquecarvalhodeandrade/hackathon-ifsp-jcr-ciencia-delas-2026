import { describe, expect, it } from "vitest";
import { fallbackIntro, isEditionEmpty, parseEditionContent, safeInternalPath } from "./content";

const PAPER_ID = "b1000000-0000-4000-8000-000000000001";

describe("safeInternalPath", () => {
  it("aceita caminhos internos", () => {
    expect(safeInternalPath("/papers/abc", "/x")).toBe("/papers/abc");
    expect(safeInternalPath("/forum/t/1?aba=2#r", "/x")).toBe("/forum/t/1?aba=2#r");
  });
  it.each([
    "https://evil.example",
    "//evil.example",
    "/\\evil",
    "javascript:alert(1)",
    "papers/1",
    "/a b",
    42,
    null,
  ])("recusa %s", (value) => {
    expect(safeInternalPath(value, "/fallback")).toBe("/fallback");
  });
});

describe("parseEditionContent", () => {
  it("lê o formato do contrato (seed)", () => {
    const content = parseEditionContent({
      papers: [
        {
          id: PAPER_ID,
          title: "Queimadas no Vale",
          authors: ["Ana", "Bia"],
          votes: 12,
          plain_summary: "Resumo",
          url: `/papers/${PAPER_ID}`,
        },
      ],
      threads: [
        {
          id: "t1",
          title: "Revisão sistemática",
          category: "Dúvidas",
          replies: 4,
          url: "/forum/t/t1",
        },
      ],
      mentors: [{ id: "m1", full_name: "Marina", headline: "Docente", url: "/pesquisadoras/m1" }],
      stats: { new_members: 10, new_papers: 3, mentorships: 2 },
    });
    expect(content.papers[0]).toMatchObject({ id: PAPER_ID, votes: 12, authors: ["Ana", "Bia"] });
    expect(content.papers[0]!.area_id).toBeUndefined();
    expect(content.threads[0]!.url).toBe("/forum/t/t1");
    expect(content.stats).toEqual({ new_members: 10, new_papers: 3, mentorships: 2 });
  });

  it("nunca quebra: descarta itens inválidos e completa valores ausentes", () => {
    const content = parseEditionContent({
      papers: [{ title: "sem id" }, { id: "p2", title: "Ok", url: "https://evil.example" }],
      threads: "não é lista",
      stats: { new_members: "7", new_papers: -1 },
    });
    expect(content.papers).toHaveLength(1);
    expect(content.papers[0]).toMatchObject({
      id: "p2",
      authors: [],
      votes: 0,
      plain_summary: null,
      url: "/papers/p2",
    });
    expect(content.threads).toEqual([]);
    expect(content.mentors).toEqual([]);
    expect(content.stats).toEqual({ new_members: 7, new_papers: 0, mentorships: 0 });
  });

  it("aceita lixo total", () => {
    for (const raw of [null, undefined, 1, "x", [], { stats: null }]) {
      expect(isEditionEmpty(parseEditionContent(raw))).toBe(true);
    }
  });
});

describe("fallbackIntro", () => {
  it("usa só números reais, com plural correto", () => {
    const intro = fallbackIntro(
      parseEditionContent({
        papers: [
          { id: "p1", title: "A" },
          { id: "p2", title: "B" },
        ],
        threads: [{ id: "t1", title: "T" }],
        stats: { new_members: 1, new_papers: 0, mentorships: 3 },
      }),
    );
    expect(intro).toBe(
      "Nesta semana, a comunidade destacou 2 papers na Vitrine, movimentou 1 conversa no fórum, deu as boas-vindas a 1 nova integrante e começou 3 novas mentorias. Confira os destaques abaixo e compartilhe com quem também faz ciência.",
    );
  });

  it("semana vazia tem texto acolhedor", () => {
    expect(fallbackIntro(parseEditionContent({}))).toMatch(/^Semana tranquila/);
  });
});
