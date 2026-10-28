import { describe, expect, it } from "vitest";
import {
  activeFilterChips,
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

describe("parseDirectoryFilters", () => {
  it("normaliza e valida os parâmetros", () => {
    expect(
      parseDirectoryFilters({
        q: " computação ",
        area: "Ecologia",
        stage: "phd",
        uf: "sp",
        mentoras: "1",
        pagina: "3",
      }),
    ).toEqual({
      q: "computação",
      area: "ecologia",
      stage: "phd",
      uf: "SP",
      mentoras: true,
      trajetoria: "",
      page: 3,
    });
  });

  it("descarta valores inválidos", () => {
    expect(
      parseDirectoryFilters({
        area: "drop table;",
        stage: "chefe",
        uf: "XX",
        mentoras: "talvez",
        pagina: "-2",
      }),
    ).toEqual({ q: "", area: "", stage: "", uf: "", mentoras: false, trajetoria: "", page: 1 });
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

describe("filtro de trajetória (?trajetoria=<slug>)", () => {
  it("aceita só marcas do catálogo (sem diferenciar maiúsculas)", () => {
    expect(parseDirectoryFilters({ trajetoria: "primeira-geracao" }).trajetoria).toBe(
      "primeira-geracao",
    );
    expect(parseDirectoryFilters({ trajetoria: " Escola-Publica " }).trajetoria).toBe(
      "escola-publica",
    );
    expect(parseDirectoryFilters({ trajetoria: ["mae-cuidadora", "x"] }).trajetoria).toBe(
      "mae-cuidadora",
    );
  });

  it("ignora slugs desconhecidos (e não conta como filtro ativo)", () => {
    for (const value of ["raca", "primeira-geracao;drop", "", "%", "primeira_geracao"]) {
      const filters = parseDirectoryFilters({ trajetoria: value });
      expect(filters.trajetoria).toBe("");
      expect(hasActiveFilters(filters)).toBe(false);
      expect(filtersToSearchParams(filters)).toEqual({});
    }
  });

  it("vale como filtro ativo e volta para a URL (paginação)", () => {
    const filters = parseDirectoryFilters({ trajetoria: "ensino-tecnico", pagina: "2" });
    expect(hasActiveFilters(filters)).toBe(true);
    expect(filtersToSearchParams(filters)).toEqual({ trajetoria: "ensino-tecnico" });
  });
});

describe("activeFilterChips", () => {
  it("lista os filtros ativos com o link que remove só aquele", () => {
    const filters = parseDirectoryFilters({
      q: "ana",
      area: "ecologia",
      uf: "SP",
      trajetoria: "primeira-geracao",
      mentoras: "1",
      pagina: "3",
    });
    expect(activeFilterChips(filters, { area: "Ecologia" })).toEqual([
      {
        key: "q",
        label: "Busca: “ana”",
        href: "/pesquisadoras?area=ecologia&uf=SP&mentoras=1&trajetoria=primeira-geracao",
      },
      {
        key: "area",
        label: "Área: Ecologia",
        href: "/pesquisadoras?q=ana&uf=SP&mentoras=1&trajetoria=primeira-geracao",
      },
      {
        key: "uf",
        label: "Estado: São Paulo",
        href: "/pesquisadoras?q=ana&area=ecologia&mentoras=1&trajetoria=primeira-geracao",
      },
      {
        key: "trajetoria",
        label: "Trajetória: Primeira da família na universidade",
        href: "/pesquisadoras?q=ana&area=ecologia&uf=SP&mentoras=1",
      },
      {
        key: "mentoras",
        label: "Só mentoras",
        href: "/pesquisadoras?q=ana&area=ecologia&uf=SP&trajetoria=primeira-geracao",
      },
    ]);
  });

  it("sem filtros, nenhum chip; o último filtro removido volta para /pesquisadoras", () => {
    expect(activeFilterChips(parseDirectoryFilters({}))).toEqual([]);
    expect(activeFilterChips(parseDirectoryFilters({ trajetoria: "escola-publica" }))).toEqual([
      { key: "trajetoria", label: "Trajetória: Escola pública", href: "/pesquisadoras" },
    ]);
  });
});
