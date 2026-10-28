import { describe, expect, it } from "vitest";
import {
  isThreadPublishable,
  rankPapersByWindowVotes,
  rankThreadsByActivity,
  toNewsletterPaper,
  type PaperCandidate,
  type ThreadCandidate,
} from "./select";

function paper(
  id: string,
  vote_count: number,
  created_at = "2026-10-01T00:00:00Z",
): PaperCandidate {
  return {
    id,
    title: `Paper ${id}`,
    authors: ["Ana"],
    plain_summary: null,
    vote_count,
    created_at,
    area_id: null,
    area_name: null,
  };
}

describe("rankPapersByWindowVotes", () => {
  it("ordena por votos na janela, depois total, depois mais novo; ignora quem não teve voto", () => {
    const votes = [
      { paper_id: "a" },
      { paper_id: "b" },
      { paper_id: "b" },
      { paper_id: "c" },
      { paper_id: "d" },
    ];
    const ranked = rankPapersByWindowVotes(
      votes,
      [
        paper("a", 5),
        paper("b", 2),
        paper("c", 5, "2026-10-20T00:00:00Z"),
        paper("d", 1),
        paper("e", 99),
      ],
      3,
    );
    expect(ranked.map((p) => p.id)).toEqual(["b", "c", "a"]);
  });
});

describe("toNewsletterPaper", () => {
  it("gera o formato do contrato com url interna", () => {
    expect(
      toNewsletterPaper({
        ...paper("x", 3),
        area_id: 10,
        area_name: "Computação",
        plain_summary: " Resumo ",
      }),
    ).toEqual({
      id: "x",
      title: "Paper x",
      authors: ["Ana"],
      votes: 3,
      plain_summary: "Resumo",
      url: "/papers/x",
      area_id: 10,
      area: "Computação",
    });
  });
});

function thread(id: string, over: Partial<ThreadCandidate> = {}): ThreadCandidate {
  return {
    id,
    title: `Tópico ${id}`,
    reply_count: 0,
    created_at: "2026-10-01T00:00:00Z",
    is_anonymous: false,
    category_name: "Carreira",
    category_slug: "carreira",
    category_allows_anonymous: false,
    ...over,
  };
}

describe("rankThreadsByActivity", () => {
  const windowStart = new Date("2026-10-19T12:00:00Z");

  it("soma respostas e reações da janela e exclui espaços de apoio/anônimos", () => {
    const ranked = rankThreadsByActivity({
      threads: [
        thread("carreira", { reply_count: 2 }),
        thread("novo", { created_at: "2026-10-25T00:00:00Z" }),
        thread("apoio", { category_allows_anonymous: true, reply_count: 9 }),
        thread("anon", { is_anonymous: true }),
        thread("parado"),
      ],
      postThreadIds: ["carreira", "carreira", "apoio", "apoio", "apoio", "anon"],
      reactionThreadIds: ["carreira", "apoio"],
      windowStart,
      limit: 4,
    });
    expect(ranked.map((t) => t.id)).toEqual(["carreira", "novo"]);
  });

  it("deixa de fora apresentações pessoais e tópicos sem categoria conhecida", () => {
    const ranked = rankThreadsByActivity({
      threads: [
        thread("apresentacao", { category_slug: "apresente-se", category_name: "Apresente-se" }),
        thread("sem-categoria", { category_slug: null, category_name: null }),
        thread("eventos", { category_slug: "eventos" }),
      ],
      postThreadIds: ["apresentacao", "sem-categoria", "eventos"],
      reactionThreadIds: [],
      windowStart,
      limit: 4,
    });
    expect(ranked.map((t) => t.id)).toEqual(["eventos"]);
    expect(isThreadPublishable(thread("x"))).toBe(true);
    expect(isThreadPublishable(thread("y", { category_slug: "apresente-se" }))).toBe(false);
  });
});
