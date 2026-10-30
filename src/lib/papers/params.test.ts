import { describe, expect, it } from "vitest";
import {
  areaIdsForSlug,
  buildHref,
  groupAreas,
  isUuid,
  parseAreaSlug,
  parsePage,
  parseRankingPeriod,
  parseSearch,
  parseVitrineOrder,
  periodVotesCaption,
  periodVotesLabel,
  rankBadgeLabel,
  rankingVotes,
  relationDisplay,
  relationSentence,
  shortAuthorList,
  type AreaRow,
} from "./params";

const AREAS: AreaRow[] = [
  { id: 1, slug: "engenharias", name: "Engenharias", big_area: "Engenharias" },
  { id: 2, slug: "engenharia-civil", name: "Engenharia Civil", big_area: "Engenharias" },
  {
    id: 3,
    slug: "engenharia-aeroespacial",
    name: "Engenharia Aeroespacial",
    big_area: "Engenharias",
  },
  { id: 4, slug: "ecologia", name: "Ecologia", big_area: "Ciências Biológicas" },
  {
    id: 5,
    slug: "ciencias-biologicas",
    name: "Ciências Biológicas",
    big_area: "Ciências Biológicas",
  },
];

describe("parse*", () => {
  it("aceita só períodos conhecidos", () => {
    expect(parseRankingPeriod("month", "week")).toBe("month");
    expect(parseRankingPeriod(["year", "all"], "week")).toBe("year");
    expect(parseRankingPeriod("recent", "week")).toBe("week");
    expect(parseRankingPeriod(undefined, "hot")).toBe("hot");
    expect(parseVitrineOrder("recent")).toBe("recent");
    expect(parseVitrineOrder("qualquer")).toBe("hot");
  });

  it("página: inteiro ≥ 1 e no máximo 500", () => {
    expect(parsePage("3")).toBe(3);
    expect(parsePage("0")).toBe(1);
    expect(parsePage("-2")).toBe(1);
    expect(parsePage("abc")).toBe(1);
    expect(parsePage("99999")).toBe(500);
    expect(parsePage(undefined)).toBe(1);
  });

  it("busca e slug de área", () => {
    expect(parseSearch("  abelhas   nativas ")).toBe("abelhas nativas");
    expect(parseSearch("x".repeat(150))).toHaveLength(100);
    expect(parseAreaSlug("Ecologia")).toBe("ecologia");
    expect(parseAreaSlug("a; drop table")).toBeNull();
    expect(parseAreaSlug("")).toBeNull();
  });

  it("parseSearch remove o * (curinga do PostgREST no ilike)", () => {
    expect(parseSearch("*")).toBe("");
    expect(parseSearch("abelhas*")).toBe("abelhas");
    expect(parseSearch("café * leite")).toBe("café leite");
  });

  it("isUuid", () => {
    expect(isUuid("b1000000-0000-4000-8000-000000000001")).toBe(true);
    expect(isUuid("b1000000")).toBe(false);
    expect(isUuid(null)).toBe(false);
  });
});

describe("áreas", () => {
  it("grande área inclui as subáreas; subárea é só ela", () => {
    expect(areaIdsForSlug(AREAS, "engenharias")).toEqual([1, 2, 3]);
    expect(areaIdsForSlug(AREAS, "ecologia")).toEqual([4]);
    expect(areaIdsForSlug(AREAS, "inexistente")).toBeNull();
    expect(areaIdsForSlug(AREAS, null)).toBeNull();
  });

  it("agrupa por grande área, em ordem alfabética", () => {
    const groups = groupAreas(AREAS);
    expect(groups.map((g) => g.bigArea)).toEqual(["Ciências Biológicas", "Engenharias"]);
    expect(groups[1]!.parent?.slug).toBe("engenharias");
    expect(groups[1]!.children.map((c) => c.slug)).toEqual([
      "engenharia-aeroespacial",
      "engenharia-civil",
    ]);
  });
});

describe("buildHref", () => {
  it("ignora vazios e a página 1", () => {
    expect(buildHref("/papers", { periodo: "week", area: null, q: "", pagina: 1 })).toBe(
      "/papers?periodo=week",
    );
    expect(buildHref("/papers", { q: "café & chá", pagina: 2 })).toBe(
      "/papers?q=caf%C3%A9+%26+ch%C3%A1&pagina=2",
    );
    expect(buildHref("/ranking", {})).toBe("/ranking");
  });
});

describe("rótulos", () => {
  it("relação de quem enviou em 3ª pessoa", () => {
    expect(relationDisplay("coauthor")).toBe("coautora do trabalho");
    expect(relationDisplay("outra")).toBeNull();
  });

  it('frase de quem indicou para visitantes (sem repetir "indicou")', () => {
    expect(relationSentence("reader")).toBe("Indicado por uma leitora da comunidade.");
    expect(relationSentence("coauthor")).toBe("Indicado por uma coautora do trabalho.");
    expect(relationSentence("outra")).toBe("Indicado por uma pesquisadora da comunidade.");
  });

  it("selos e contagens do ranking", () => {
    expect(rankBadgeLabel(1, "week")).toBe("#1 da semana");
    expect(rankBadgeLabel(2, "hot")).toBe("#2 em alta");
    expect(periodVotesLabel("month", 1)).toBe("1 destaque nos últimos 30 dias");
    expect(periodVotesLabel("all", 12)).toBe("12 destaques no total");
    expect(periodVotesCaption("week", 1)).toBe("destaque nos últimos 7 dias");
    expect(periodVotesCaption("year", 4)).toBe("destaques nos últimos 12 meses");
    expect(rankingVotes("week", { vote_count: 10, period_votes: 3 })).toBe(3);
    expect(rankingVotes("all", { vote_count: 10, period_votes: 3 })).toBe(10);
    expect(rankingVotes("year", { vote_count: 10, period_votes: null })).toBe(0);
  });

  it("lista curta de autoras", () => {
    expect(shortAuthorList([])).toBe("");
    expect(shortAuthorList(["Ana"])).toBe("Ana");
    expect(shortAuthorList(["Ana", "Bia"])).toBe("Ana e Bia");
    expect(shortAuthorList(["Ana", "Bia", "Carol"])).toBe("Ana, Bia e Carol");
    expect(shortAuthorList(["Ana", "Bia", "Carol", "Dani", "Eva"])).toBe(
      "Ana, Bia, Carol e mais 2",
    );
  });
});
