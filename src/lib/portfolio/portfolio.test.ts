import { describe, expect, it } from "vitest";
import { friendlyPortfolioError, portfolioFallback } from "./errors";
import {
  linkHost,
  parsePortfolioNotice,
  PORTFOLIO_KIND_LABELS,
  PORTFOLIO_KINDS,
  portfolioKindLabel,
  portfolioMeta,
  portfolioPostBody,
  postKindForPortfolio,
  sortPortfolioItems,
} from "./presentation";
import {
  EMPTY_PORTFOLIO_VALUES,
  normalizeTags,
  portfolioToFormValues,
  readPortfolioForm,
  toPortfolioRow,
  validatePortfolioForm,
  type PortfolioFormValues,
} from "./schema";

const valid: PortfolioFormValues = {
  ...EMPTY_PORTFOLIO_VALUES,
  kind: "article",
  title: "Abelhas sem ferrão no Vale do Paraíba",
};

describe("rótulos", () => {
  it("todos os tipos têm rótulo em pt-BR", () => {
    expect(PORTFOLIO_KINDS.map((k) => PORTFOLIO_KIND_LABELS[k])).toEqual([
      "Artigo",
      "Projeto",
      "Apresentação",
      "Pôster",
      "TCC, dissertação ou tese",
      "Prêmio",
      "Curso",
      "Outro",
    ]);
    expect(portfolioKindLabel("desconhecido")).toBe("Outro");
  });
});

describe("validatePortfolioForm", () => {
  it("aceita o mínimo (tipo + título) e transforma vazios em null", () => {
    const result = validatePortfolioForm(valid);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toEqual({
      kind: "article",
      title: "Abelhas sem ferrão no Vale do Paraíba",
      description: null,
      url: null,
      venue: null,
      year: null,
      tags: [],
      pinned: false,
      share_to_feed: true,
    });
  });

  it("exige tipo conhecido e título de 3 a 200 caracteres", () => {
    const result = validatePortfolioForm({ ...valid, kind: "blog", title: "ab" });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.fieldErrors.kind?.[0]).toBe("Escolha o tipo do item.");
    expect(result.fieldErrors.title?.[0]).toMatch(/pelo menos 3/);
    expect(validatePortfolioForm({ ...valid, title: "a".repeat(201) }).success).toBe(false);
    expect(validatePortfolioForm({ ...valid, title: "a".repeat(200) }).success).toBe(true);
  });

  it("link só http(s), sem espaços, até 500", () => {
    expect(validatePortfolioForm({ ...valid, url: "https://doi.org/10.1/x" }).success).toBe(true);
    expect(validatePortfolioForm({ ...valid, url: "ftp://x.org" }).success).toBe(false);
    expect(validatePortfolioForm({ ...valid, url: "javascript:alert(1)" }).success).toBe(false);
    expect(validatePortfolioForm({ ...valid, url: "https://a b.org" }).success).toBe(false);
    expect(
      validatePortfolioForm({ ...valid, url: `https://x.org/${"a".repeat(490)}` }).success,
    ).toBe(false);
  });

  it("ano com 4 dígitos entre 1950 e 2100", () => {
    const ok = validatePortfolioForm({ ...valid, year: " 2025 " });
    expect(ok.success && ok.data.year).toBe(2025);
    expect(validatePortfolioForm({ ...valid, year: "1949" }).success).toBe(false);
    expect(validatePortfolioForm({ ...valid, year: "2101" }).success).toBe(false);
    expect(validatePortfolioForm({ ...valid, year: "25" }).success).toBe(false);
  });

  it("descrição até 2.000 contando CRLF como uma quebra; local até 160", () => {
    expect(validatePortfolioForm({ ...valid, description: "a\r\n".repeat(1000) }).success).toBe(
      true,
    );
    expect(validatePortfolioForm({ ...valid, description: "a".repeat(2001) }).success).toBe(false);
    expect(validatePortfolioForm({ ...valid, venue: "a".repeat(161) }).success).toBe(false);
  });

  it("tags normalizadas (minúsculas, sem repetidas) e no máximo 8 × 40", () => {
    const result = validatePortfolioForm({
      ...valid,
      tags: ["Ecologia", " ecologia ", "", "Polinização"],
    });
    expect(result.success && result.data.tags).toEqual(["ecologia", "polinização"]);
    const nine = Array.from({ length: 9 }, (_, i) => `tag ${i}`);
    expect(validatePortfolioForm({ ...valid, tags: nine }).success).toBe(false);
    expect(validatePortfolioForm({ ...valid, tags: ["a".repeat(41)] }).success).toBe(false);
  });

  it("normalizeTags igual ao private.normalize_tags", () => {
    expect(normalizeTags(["B", "a", "b", "  A "])).toEqual(["b", "a"]);
  });
});

describe("formulário", () => {
  it("lê o FormData (checkboxes 'on') e volta para a linha", () => {
    const fd = new FormData();
    fd.set("kind", "award");
    fd.set("title", "Prêmio Mulheres na Ciência");
    fd.append("tags", "prêmio");
    fd.append("tags", "ciência");
    fd.set("pinned", "on");
    const values = readPortfolioForm(fd);
    expect(values).toMatchObject({
      kind: "award",
      tags: ["prêmio", "ciência"],
      pinned: true,
      share_to_feed: false,
    });
    const result = validatePortfolioForm(values);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(toPortfolioRow(result.data)).not.toHaveProperty("share_to_feed");
  });

  it("linha do banco → valores de edição (sem compartilhar de novo)", () => {
    expect(
      portfolioToFormValues({
        kind: "project",
        title: "Projeto",
        description: null,
        url: null,
        venue: "IFSP",
        year: 2024,
        tags: ["a"],
        pinned: true,
      }),
    ).toEqual({
      kind: "project",
      title: "Projeto",
      description: "",
      url: "",
      venue: "IFSP",
      year: "2024",
      tags: ["a"],
      pinned: true,
      share_to_feed: false,
    });
  });
});

describe("sortPortfolioItems", () => {
  const item = (id: string, pinned: boolean, year: number | null, created_at: string) => ({
    id,
    pinned,
    year,
    created_at,
  });

  it("destacados primeiro, depois ano (sem ano no fim), depois criação mais recente", () => {
    const items = [
      item("sem-ano", false, null, "2026-10-01T00:00:00Z"),
      item("2020", false, 2020, "2026-10-02T00:00:00Z"),
      item("2024-velho", false, 2024, "2026-01-01T00:00:00Z"),
      item("2024-novo", false, 2024, "2026-09-01T00:00:00Z"),
      item("fixado-antigo", true, 2010, "2025-01-01T00:00:00Z"),
      item("fixado-sem-ano", true, null, "2026-10-03T00:00:00Z"),
    ];
    expect(sortPortfolioItems(items).map((i) => i.id)).toEqual([
      "fixado-antigo",
      "fixado-sem-ano",
      "2024-novo",
      "2024-velho",
      "2020",
      "sem-ano",
    ]);
  });

  it("não altera a lista original e desempata pelo id", () => {
    const items = [
      item("b", false, 2024, "2026-01-01T00:00:00Z"),
      item("a", false, 2024, "2026-01-01T00:00:00Z"),
    ];
    expect(sortPortfolioItems(items).map((i) => i.id)).toEqual(["a", "b"]);
    expect(items.map((i) => i.id)).toEqual(["b", "a"]);
  });
});

describe("compartilhar no feed", () => {
  it("mapeia o tipo do item para o tipo da publicação", () => {
    expect(postKindForPortfolio("article")).toBe("publication");
    expect(postKindForPortfolio("thesis")).toBe("publication");
    expect(postKindForPortfolio("poster")).toBe("publication");
    expect(postKindForPortfolio("presentation")).toBe("publication");
    expect(postKindForPortfolio("award")).toBe("achievement");
    expect(postKindForPortfolio("course")).toBe("achievement");
    expect(postKindForPortfolio("project")).toBe("project");
    expect(postKindForPortfolio("other")).toBe("update");
    expect(postKindForPortfolio("???")).toBe("update");
  });

  it("frase curta com o título", () => {
    expect(portfolioPostBody("  Abelhas \n sem ferrão ")).toBe(
      "Adicionei ao meu portfólio: Abelhas sem ferrão",
    );
    expect(portfolioPostBody("")).toBe("Adicionei um item ao meu portfólio.");
  });
});

describe("textos do cartão e avisos", () => {
  it("meta e domínio do link", () => {
    expect(portfolioMeta({ venue: "SBPC", year: 2025 })).toBe("SBPC · 2025");
    expect(portfolioMeta({ venue: null, year: null })).toBe("");
    expect(linkHost("https://www.scielo.br/j/x")).toBe("scielo.br");
    expect(linkHost("javascript:alert(1)")).toBeNull();
    expect(linkHost("não é link")).toBeNull();
  });

  it("aviso só com chave conhecida", () => {
    expect(parsePortfolioNotice("apagado")?.title).toBe("Item apagado");
    expect(parsePortfolioNotice("<script>")).toBeNull();
  });
});

describe("friendlyPortfolioError", () => {
  it("regras do banco e códigos genéricos", () => {
    expect(friendlyPortfolioError({ code: "CD066", message: "" }, "save")).toMatch(/50 itens/);
    expect(friendlyPortfolioError({ code: "CD067", message: "Calma." }, "save")).toBe("Calma.");
    expect(friendlyPortfolioError({ code: "42501" }, "delete")).toMatch(/próprio portfólio/);
    expect(friendlyPortfolioError({ code: "XX000", message: "boom" }, "pin")).toBe(
      portfolioFallback("pin"),
    );
  });
});
