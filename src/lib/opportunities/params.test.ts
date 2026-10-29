import { describe, expect, it } from "vitest";
import {
  activeFilterChips,
  currentListHref,
  filtersHref,
  filtersToSearchParams,
  hasActiveFilters,
  isUuid,
  myTabHref,
  pageRange,
  parseMyTab,
  parseOpportunityFilters,
  parseReceivedFilter,
  parseSearch,
  receivedFilterHref,
} from "./params";

describe("parseOpportunityFilters", () => {
  it("sem parâmetros: só vagas abertas, página 1", () => {
    const filters = parseOpportunityFilters({});
    expect(filters).toEqual({
      q: "",
      area: "",
      tipo: "",
      bolsa: false,
      modalidade: "",
      etapa: "",
      encerradas: false,
      page: 1,
    });
    expect(hasActiveFilters(filters)).toBe(false);
  });

  it("aceita só valores conhecidos", () => {
    const filters = parseOpportunityFilters({
      q: "  abelhas   nativas ",
      area: "Ecologia",
      tipo: "ic_junior",
      bolsa: "1",
      modalidade: "hybrid",
      etapa: "high_school",
      encerradas: "on",
      pagina: "3",
    });
    expect(filters).toEqual({
      q: "abelhas nativas",
      area: "ecologia",
      tipo: "ic_junior",
      bolsa: true,
      modalidade: "hybrid",
      etapa: "high_school",
      encerradas: true,
      page: 3,
    });
    expect(hasActiveFilters(filters)).toBe(true);
  });

  it("ignora valores inválidos", () => {
    const filters = parseOpportunityFilters({
      area: "a; drop table",
      tipo: "estagio",
      bolsa: "talvez",
      modalidade: "remoto",
      etapa: "doutora",
      encerradas: "0",
      pagina: "-2",
    });
    expect(filters.area).toBe("");
    expect(filters.tipo).toBe("");
    expect(filters.bolsa).toBe(false);
    expect(filters.modalidade).toBe("");
    expect(filters.etapa).toBe("");
    expect(filters.encerradas).toBe(false);
    expect(filters.page).toBe(1);
    expect(parseOpportunityFilters({ pagina: "99999" }).page).toBe(500);
  });

  it("usa o primeiro valor de parâmetros repetidos", () => {
    expect(parseOpportunityFilters({ tipo: ["tcc", "ic"] }).tipo).toBe("tcc");
  });

  it("busca sem o curinga * e com no máximo 100 caracteres", () => {
    expect(parseSearch("abelhas*")).toBe("abelhas");
    expect(parseSearch("*")).toBe("");
    expect(parseSearch("x".repeat(150))).toHaveLength(100);
  });
});

describe("links dos filtros", () => {
  const filters = parseOpportunityFilters({
    q: "café",
    tipo: "ic",
    bolsa: "1",
    etapa: "undergraduate",
    pagina: "2",
  });

  it("serializa só o que está ativo, sem a página", () => {
    expect(filtersToSearchParams(filters)).toEqual({
      q: "café",
      tipo: "ic",
      bolsa: "1",
      etapa: "undergraduate",
    });
    expect(filtersHref(filters)).toBe("/ics?q=caf%C3%A9&tipo=ic&bolsa=1&etapa=undergraduate");
    expect(filtersHref(parseOpportunityFilters({}))).toBe("/ics");
  });

  it("link da página atual inclui a página", () => {
    expect(currentListHref(filters)).toBe(
      "/ics?q=caf%C3%A9&tipo=ic&bolsa=1&etapa=undergraduate&pagina=2",
    );
    expect(currentListHref(parseOpportunityFilters({}))).toBe("/ics");
  });

  it("troca um filtro e volta para a página 1", () => {
    expect(filtersHref(filters, { etapa: "high_school", bolsa: false })).toBe(
      "/ics?q=caf%C3%A9&tipo=ic&etapa=high_school",
    );
  });

  it("chips removem só o próprio filtro", () => {
    const chips = activeFilterChips(filters);
    expect(chips.map((c) => c.label)).toEqual([
      "Busca: “café”",
      "Iniciação Científica",
      "Com bolsa",
      "Para: Graduação",
    ]);
    expect(chips.find((c) => c.key === "bolsa")?.href).toBe(
      "/ics?q=caf%C3%A9&tipo=ic&etapa=undergraduate",
    );
    expect(
      activeFilterChips(parseOpportunityFilters({ area: "ecologia" }), { area: "Ecologia" })[0]
        ?.label,
    ).toBe("Área: Ecologia");
  });

  it("intervalo da página", () => {
    expect(pageRange(1, 12)).toEqual({ from: 0, to: 11 });
    expect(pageRange(3, 12)).toEqual({ from: 24, to: 35 });
    expect(pageRange(0, 12)).toEqual({ from: 0, to: 11 });
  });
});

describe("abas e filtros das outras páginas", () => {
  it("/ics/minhas", () => {
    expect(parseMyTab(undefined)).toBe("candidaturas");
    expect(parseMyTab("publicadas")).toBe("publicadas");
    expect(parseMyTab("outra")).toBe("candidaturas");
    expect(myTabHref("candidaturas")).toBe("/ics/minhas");
    expect(myTabHref("publicadas")).toBe("/ics/minhas?aba=publicadas");
  });

  it("/ics/<id>/candidaturas", () => {
    const id = "b1000000-0000-4000-8000-000000000001";
    expect(parseReceivedFilter("in_review")).toBe("in_review");
    expect(parseReceivedFilter("qualquer")).toBe("todas");
    expect(receivedFilterHref(id, "todas")).toBe(`/ics/${id}/candidaturas`);
    expect(receivedFilterHref(id, "accepted")).toBe(`/ics/${id}/candidaturas?status=accepted`);
  });

  it("isUuid", () => {
    expect(isUuid("b1000000-0000-4000-8000-000000000001")).toBe(true);
    expect(isUuid("nova")).toBe(false);
    expect(isUuid(null)).toBe(false);
  });
});
