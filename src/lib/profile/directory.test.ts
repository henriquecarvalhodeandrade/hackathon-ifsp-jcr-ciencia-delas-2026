import { describe, expect, it } from "vitest";
import {
  buildSearchOrFilter,
  filtersToSearchParams,
  hasActiveFilters,
  isUuid,
  pageRange,
  parseDirectoryFilters,
  sanitizeSearchTerm,
} from "./directory";

describe("sanitizeSearchTerm", () => {
  it("remove caracteres da sintaxe do PostgREST e curingas do LIKE", () => {
    expect(sanitizeSearchTerm("ana,(silva)")).toBe("ana silva");
    expect(sanitizeSearchTerm("100%_*")).toBe("100");
    expect(sanitizeSearchTerm('  "IFSP" : Jacareí  ')).toBe("IFSP Jacareí");
  });

  it("corta termos longos", () => {
    expect(sanitizeSearchTerm("a".repeat(200))).toHaveLength(80);
  });
});

describe("buildSearchOrFilter", () => {
  it("busca nome, instituição e título com curinga entre palavras", () => {
    expect(buildSearchOrFilter("Marina IFSP")).toBe(
      "full_name.ilike.%Marina%IFSP%,institution.ilike.%Marina%IFSP%,headline.ilike.%Marina%IFSP%",
    );
  });

  it("ignora termos curtos demais ou vazios depois da limpeza", () => {
    expect(buildSearchOrFilter("a")).toBeNull();
    expect(buildSearchOrFilter("(),")).toBeNull();
  });
});

describe("parseDirectoryFilters", () => {
  it("normaliza e valida os parâmetros", () => {
    expect(
      parseDirectoryFilters({ q: " computação ", area: "Ecologia", stage: "phd", uf: "sp", mentoras: "1", pagina: "3" }),
    ).toEqual({ q: "computação", area: "ecologia", stage: "phd", uf: "SP", mentoras: true, page: 3 });
  });

  it("descarta valores inválidos", () => {
    expect(
      parseDirectoryFilters({ area: "drop table;", stage: "chefe", uf: "XX", mentoras: "talvez", pagina: "-2" }),
    ).toEqual({ q: "", area: "", stage: "", uf: "", mentoras: false, page: 1 });
    expect(parseDirectoryFilters({ pagina: ["2", "5"] }).page).toBe(2);
    expect(parseDirectoryFilters({ pagina: "99999" }).page).toBe(1000);
  });
});

describe("utilidades", () => {
  it("detecta filtros ativos e monta os searchParams", () => {
    const filters = parseDirectoryFilters({ uf: "RJ", mentoras: "1" });
    expect(hasActiveFilters(filters)).toBe(true);
    expect(filtersToSearchParams(filters)).toEqual({ uf: "RJ", mentoras: "1" });
    expect(hasActiveFilters(parseDirectoryFilters({}))).toBe(false);
  });

  it("calcula o intervalo da página", () => {
    expect(pageRange(1)).toEqual({ from: 0, to: 23 });
    expect(pageRange(3, 10)).toEqual({ from: 20, to: 29 });
    expect(pageRange(0)).toEqual({ from: 0, to: 23 });
  });

  it("valida UUIDs", () => {
    expect(isUuid("d1000000-0000-4000-8000-000000000001")).toBe(true);
    expect(isUuid("nao-e-uuid")).toBe(false);
  });
});
