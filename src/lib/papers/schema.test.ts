import { describe, expect, it } from "vitest";
import {
  EMPTY_PAPER_VALUES,
  MISSING_LINK_ERROR,
  commentSchema,
  filledByCrossref,
  mergeCrossrefIntoValues,
  paperToFormValues,
  readPaperForm,
  validatePaperForm,
  type PaperFormValues,
} from "./schema";

const NOW = new Date("2026-10-27T12:00:00Z");

const valid: PaperFormValues = {
  ...EMPTY_PAPER_VALUES,
  doi: "https://doi.org/10.5555/Demo.Teste.1",
  url: "",
  title: "  Redes neurais leves para folhas de café  ",
  authors: ["Ana Souza", " Bia Lima ", "ana souza", ""],
  abstract: "Este trabalho apresenta um modelo leve de visão computacional para celulares de campo.",
  venue: " ",
  year: "2026",
  area_id: "13",
  keywords: ["Visão Computacional", "visão computacional", " Café "],
  submitter_relation: "coauthor",
  women_authorship_confirmed: true,
  plain_summary: "",
  plain_summary_source: "ai",
};

describe("readPaperForm", () => {
  it("lê campos simples, listas e o checkbox", () => {
    const fd = new FormData();
    fd.set("title", "Título");
    fd.append("authors", "Ana");
    fd.append("authors", "Bia");
    fd.set("women_authorship_confirmed", "on");
    const values = readPaperForm(fd);
    expect(values.title).toBe("Título");
    expect(values.authors).toEqual(["Ana", "Bia"]);
    expect(values.women_authorship_confirmed).toBe(true);
    expect(values.doi).toBe("");
    expect(values.keywords).toEqual([]);
  });
});

describe("validatePaperForm", () => {
  it("normaliza e converte para o formato do banco", () => {
    const result = validatePaperForm(valid, NOW);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toEqual({
      doi: "10.5555/demo.teste.1",
      url: null,
      title: "Redes neurais leves para folhas de café",
      authors: ["Ana Souza", "Bia Lima"],
      abstract: valid.abstract,
      venue: null,
      year: 2026,
      area_id: 13,
      keywords: ["visão computacional", "café"],
      submitter_relation: "coauthor",
      women_authorship_confirmed: true,
      plain_summary: null,
      plain_summary_source: null,
    });
  });

  it("marca a origem do resumo acessível", () => {
    const ai = validatePaperForm({ ...valid, plain_summary: "Um resumo simples.", plain_summary_source: "ai" }, NOW);
    const author = validatePaperForm({ ...valid, plain_summary: "Um resumo simples.", plain_summary_source: "" }, NOW);
    expect(ai.success && ai.data.plain_summary_source).toBe("ai");
    expect(author.success && author.data.plain_summary_source).toBe("author");
  });

  it("exige DOI ou link, junto com os outros erros", () => {
    const result = validatePaperForm({ ...EMPTY_PAPER_VALUES }, NOW);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.fieldErrors.url).toEqual([MISSING_LINK_ERROR]);
    expect(result.fieldErrors.title?.[0]).toMatch(/título/);
    expect(result.fieldErrors.authors?.[0]).toMatch(/autora/);
    expect(result.fieldErrors.abstract?.[0]).toMatch(/50 caracteres/);
    expect(result.fieldErrors.area_id?.[0]).toMatch(/área/);
    expect(result.fieldErrors.submitter_relation?.[0]).toMatch(/relação/);
    expect(result.fieldErrors.women_authorship_confirmed?.[0]).toMatch(/autoria de mulheres/);
  });

  it("aceita só o link quando não há DOI", () => {
    const result = validatePaperForm({ ...valid, doi: "", url: "https://repositorio.ifsp.edu.br/x" }, NOW);
    expect(result.success && result.data.url).toBe("https://repositorio.ifsp.edu.br/x");
  });

  it("recusa DOI, link e ano inválidos", () => {
    const result = validatePaperForm(
      { ...valid, doi: "doi.org/abc", url: "javascript:alert(1)", year: "2031", area_id: "abc" },
      NOW,
    );
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.fieldErrors.doi?.[0]).toMatch(/DOI/);
    expect(result.fieldErrors.url?.[0]).toMatch(/https:\/\//);
    expect(result.fieldErrors.year?.[0]).toMatch(/entre 1900 e 2027/);
    expect(result.fieldErrors.area_id).toBeDefined();
    expect(validatePaperForm({ ...valid, year: "26" }, NOW).success).toBe(false);
  });

  it("respeita os limites de quantidade", () => {
    const many = validatePaperForm(
      {
        ...valid,
        authors: Array.from({ length: 51 }, (_, i) => `Autora ${i}`),
        keywords: Array.from({ length: 16 }, (_, i) => `palavra ${i}`),
      },
      NOW,
    );
    expect(many.success).toBe(false);
    if (many.success) return;
    expect(many.fieldErrors.authors?.[0]).toMatch(/50/);
    expect(many.fieldErrors.keywords?.[0]).toMatch(/15/);
  });
});

describe("commentSchema", () => {
  it("valida tamanho e id do paper", () => {
    const id = "b1000000-0000-4000-8000-000000000001";
    expect(commentSchema.safeParse({ paper_id: id, body: "  Ótimo trabalho!  " }).data?.body).toBe("Ótimo trabalho!");
    expect(commentSchema.safeParse({ paper_id: id, body: " a " }).success).toBe(false);
    expect(commentSchema.safeParse({ paper_id: id, body: "x".repeat(3001) }).success).toBe(false);
    expect(commentSchema.safeParse({ paper_id: "nao-e-uuid", body: "Olá!" }).success).toBe(false);
  });
});

describe("paperToFormValues / mergeCrossrefIntoValues", () => {
  it("converte uma linha do banco para o formulário", () => {
    const values = paperToFormValues({
      doi: null,
      url: "https://exemplo.org",
      title: "T",
      authors: ["A"],
      abstract: "R",
      venue: null,
      year: null,
      area_id: 5,
      keywords: [],
      submitter_relation: "author",
      women_authorship_confirmed: true,
      plain_summary: null,
      plain_summary_source: null,
    });
    expect(values).toMatchObject({ doi: "", year: "", area_id: "5", venue: "", plain_summary: "" });
  });

  it("substitui só o que o Crossref trouxe", () => {
    const current = { ...valid, url: "https://meu-link.org", area_id: "20", title: "Antigo" };
    const merged = mergeCrossrefIntoValues(current, {
      doi: "10.1038/nature12373",
      title: "Novo título",
      authors: [],
      venue: "Nature",
      year: 2013,
      abstract: null,
    });
    expect(merged).toMatchObject({
      doi: "10.1038/nature12373",
      title: "Novo título",
      authors: current.authors,
      venue: "Nature",
      year: "2013",
      abstract: current.abstract,
      url: "https://meu-link.org",
      area_id: "20",
    });
    expect(
      filledByCrossref({ doi: "x", title: "t", authors: [], venue: "Nature", year: 2013, abstract: null }),
    ).toEqual(["título", "revista ou evento", "ano"]);
  });
});
