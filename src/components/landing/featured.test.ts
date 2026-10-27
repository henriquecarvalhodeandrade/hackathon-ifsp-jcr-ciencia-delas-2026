import { describe, expect, it } from "vitest";
import { firstName, pickFeaturedPapers } from "./featured";

const p = (id: string, period_votes: number) => ({ id, period_votes });

describe("pickFeaturedPapers", () => {
  it("usa a semana quando há destaques nos últimos 7 dias (ignora quem tem 0)", () => {
    const result = pickFeaturedPapers([p("a", 5), p("b", 2), p("c", 0), p("d", 0)], [p("x", 0)]);
    expect(result).toEqual({ papers: [p("a", 5), p("b", 2)], period: "week" });
  });

  it("limita a 3", () => {
    const week = [p("a", 4), p("b", 3), p("c", 2), p("d", 1)];
    expect(pickFeaturedPapers(week, []).papers.map((x) => x.id)).toEqual(["a", "b", "c"]);
  });

  it("cai para 'em alta' quando a semana está vazia", () => {
    expect(pickFeaturedPapers([p("a", 0)], [p("h1", 0), p("h2", 0)])).toEqual({
      papers: [p("h1", 0), p("h2", 0)],
      period: "hot",
    });
  });

  it("sem papers: lista vazia e período nulo", () => {
    expect(pickFeaturedPapers(null, undefined)).toEqual({ papers: [], period: null });
  });
});

describe("firstName", () => {
  it("pega o primeiro nome", () => {
    expect(firstName("  Larissa Gomes ")).toBe("Larissa");
    expect(firstName("")).toBeNull();
    expect(firstName(null)).toBeNull();
  });
});
