import { describe, expect, it } from "vitest";
import { EMPTY_PAPER_VALUES } from "./schema";
import {
  dedupeOrcidWorks,
  filledByOrcid,
  isValidOrcidId,
  joinPt,
  mergeOrcidIntoValues,
  missingAfterOrcid,
  orcidWorksUrl,
  orcidWorkTypeLabel,
  parseOrcidId,
  parseOrcidWorks,
  sortOrcidWorks,
  undoOrcidImport,
  type OrcidWork,
} from "./orcid";
import { ORCID_WORKS_FIXTURE } from "./orcid.fixture";

const work = (overrides: Partial<OrcidWork>): OrcidWork => ({
  putCode: null,
  title: "Um trabalho",
  year: null,
  journal: null,
  doi: null,
  url: null,
  type: null,
  ...overrides,
});

describe("ORCID iD (ISO 7064 11,2)", () => {
  it("aceita iDs com dígito verificador correto, inclusive X", () => {
    expect(parseOrcidId("0000-0002-1825-0097")).toEqual({ ok: true, value: "0000-0002-1825-0097" });
    expect(parseOrcidId("https://orcid.org/0000-0002-1694-233X")).toEqual({
      ok: true,
      value: "0000-0002-1694-233X",
    });
    expect(parseOrcidId(" orcid.org/000000021694233x ")).toEqual({
      ok: true,
      value: "0000-0002-1694-233X",
    });
    expect(parseOrcidId("0000 0001 5109 3700")).toEqual({ ok: true, value: "0000-0001-5109-3700" });
  });

  it("recusa dígito verificador errado, formato errado e valores que não são texto", () => {
    const wrong = parseOrcidId("0000-0002-1825-0098");
    expect(wrong.ok).toBe(false);
    if (!wrong.ok) expect(wrong.error).toMatch(/não confere/);
    expect(parseOrcidId("0000-0002-1825").ok).toBe(false);
    expect(parseOrcidId("").ok).toBe(false);
    expect(parseOrcidId(null).ok).toBe(false);
    expect(parseOrcidId(42).ok).toBe(false);
  });

  it("isValidOrcidId só aceita o formato canônico com hífens", () => {
    expect(isValidOrcidId("0000-0002-1825-0097")).toBe(true);
    expect(isValidOrcidId("0000-0002-1694-233X")).toBe(true);
    expect(isValidOrcidId("0000000218250097")).toBe(false);
    expect(isValidOrcidId("0000-0002-1825-0098")).toBe(false);
    expect(isValidOrcidId("0000-0002-1694-233x")).toBe(false);
  });
});

describe("orcidWorksUrl (host fixo, sem SSRF)", () => {
  it("monta a URL da API pública v3.0", () => {
    expect(orcidWorksUrl("0000-0002-1825-0097")).toBe(
      "https://pub.orcid.org/v3.0/0000-0002-1825-0097/works",
    );
  });

  it("recusa qualquer coisa que não seja um iD validado", () => {
    for (const evil of [
      "0000-0002-1825-0098",
      "../../admin",
      "0000-0002-1825-0097/../../x",
      "0000-0002-1825-0097@evil.example",
      "https://evil.example/0000-0002-1825-0097",
      "",
    ]) {
      expect(() => orcidWorksUrl(evil)).toThrow();
    }
  });
});

describe("parseOrcidWorks (fixture realista da v3.0)", () => {
  const works = parseOrcidWorks(ORCID_WORKS_FIXTURE)!;

  it("devolve um item por trabalho, sem duplicatas, mais recentes primeiro", () => {
    expect(works.map((w) => w.title)).toEqual([
      "Redes neurais leves para detecção de abelhas nativas",
      "Monitoramento de manguezais & sensoriamento",
      "Mulheres na engenharia de materiais",
      "Ensino de química com materiais acessíveis",
    ]);
  });

  it("usa a fonte preferida e completa revista e link com a outra fonte do grupo", () => {
    expect(works[0]).toEqual({
      putCode: 1001,
      title: "Redes neurais leves para detecção de abelhas nativas",
      year: 2024,
      journal: "Revista Brasileira de Computação Aplicada",
      doi: "10.5555/artemis.2024.001",
      url: "https://revista.exemplo.org/artigo/1",
      type: "journal-article",
    });
  });

  it("ignora o DOI de relação part-of (é o do livro, não o do capítulo)", () => {
    const chapter = works.find((w) => w.putCode === 2001)!;
    expect(chapter.doi).toBeNull();
    expect(chapter.journal).toBe("Ciência de Materiais no Brasil");
    expect(chapter.type).toBe("book-chapter");
  });

  it("limpa marcação do título e mantém o link do repositório", () => {
    const paper = works.find((w) => w.putCode === 3001)!;
    expect(paper).toMatchObject({
      title: "Monitoramento de manguezais & sensoriamento",
      year: 2022,
      doi: null,
      url: "https://repositorio.exemplo.edu.br/handle/123",
    });
  });

  it("descarta ano fora do intervalo e link que não é http(s)", () => {
    const thesis = works.find((w) => w.putCode === 7001)!;
    expect(thesis.year).toBeNull();
    expect(thesis.url).toBeNull();
  });

  it("aceita lista vazia e recusa formatos desconhecidos", () => {
    expect(parseOrcidWorks({ group: [], path: "/x/works" })).toEqual([]);
    expect(parseOrcidWorks({ group: null })).toEqual([]);
    expect(parseOrcidWorks({ "response-code": 404 })).toBeNull();
    expect(parseOrcidWorks({ group: "x" })).toBeNull();
    expect(parseOrcidWorks(null)).toBeNull();
    expect(parseOrcidWorks("texto")).toBeNull();
  });

  it("corta títulos e revistas nos limites do banco", () => {
    const long = parseOrcidWorks({
      group: [
        {
          "external-ids": null,
          "work-summary": [
            {
              title: { title: { value: "T".repeat(400) } },
              "journal-title": { value: "R".repeat(400) },
              "publication-date": { year: { value: "2020" } },
            },
          ],
        },
      ],
    })!;
    expect(long[0]!.title.length).toBe(300);
    expect(long[0]!.journal!.length).toBe(300);
  });
});

describe("dedupeOrcidWorks", () => {
  it("junta o mesmo DOI (sem diferenciar maiúsculas) completando os campos vazios", () => {
    const result = dedupeOrcidWorks([
      work({ title: "A", doi: "10.5555/ABC", year: 2020 }),
      work({
        title: "A (preprint)",
        doi: "10.5555/abc",
        journal: "Revista X",
        url: "https://x.org",
      }),
      work({ title: "B", doi: "10.5555/def" }),
    ]);
    expect(result).toEqual([
      work({
        title: "A",
        doi: "10.5555/abc",
        year: 2020,
        journal: "Revista X",
        url: "https://x.org",
      }),
      work({ title: "B", doi: "10.5555/def" }),
    ]);
  });

  it("remove cópias sem DOI com o mesmo título e ano (ignorando acentos e pontuação)", () => {
    const result = dedupeOrcidWorks([
      work({ title: "Ciência Aberta", year: 2021 }),
      work({ title: "ciencia aberta.", year: 2021 }),
      work({ title: "Ciência aberta", year: 2022 }),
      work({ title: "CIÊNCIA ABERTA", year: 2021, doi: "10.5555/ca" }),
    ]);
    expect(result.map((w) => [w.title, w.year, w.doi])).toEqual([
      ["Ciência aberta", 2022, null],
      ["CIÊNCIA ABERTA", 2021, "10.5555/ca"],
    ]);
  });
});

describe("sortOrcidWorks", () => {
  it("ordena por ano (sem ano no fim) e depois por título", () => {
    const sorted = sortOrcidWorks([
      work({ title: "b", year: 2020 }),
      work({ title: "sem ano" }),
      work({ title: "a", year: 2020 }),
      work({ title: "c", year: 2024 }),
    ]);
    expect(sorted.map((w) => w.title)).toEqual(["c", "a", "b", "sem ano"]);
  });
});

describe("mergeOrcidIntoValues / filledByOrcid", () => {
  const current = {
    ...EMPTY_PAPER_VALUES,
    title: "Antigo",
    authors: ["Ana"],
    abstract: "x".repeat(60),
    area_id: "12",
    url: "",
  };

  it("preenche título, ano, revista, DOI e o link (se estiver vazio), sem mexer no resto", () => {
    const item = work({
      title: "Novo título",
      year: 2023,
      journal: "Revista Y",
      doi: "10.5555/y",
      url: "https://y.org/1",
    });
    expect(mergeOrcidIntoValues(current, item)).toEqual({
      ...current,
      title: "Novo título",
      year: "2023",
      venue: "Revista Y",
      doi: "10.5555/y",
      url: "https://y.org/1",
    });
    expect(filledByOrcid(item, current)).toEqual([
      "título",
      "ano",
      "revista ou evento",
      "DOI",
      "link",
    ]);
  });

  it("não troca um link já digitado nem apaga campos que o ORCID não trouxe", () => {
    const withUrl = { ...current, url: "https://meu.link", year: "2019", venue: "Evento Z" };
    const item = work({ title: "Só título", url: "https://outro.link" });
    expect(mergeOrcidIntoValues(withUrl, item)).toEqual({ ...withUrl, title: "Só título" });
    expect(filledByOrcid(item, withUrl)).toEqual(["título"]);
  });
});

describe("undoOrcidImport (trocar de trabalho sem misturar dados)", () => {
  const typed = { ...EMPTY_PAPER_VALUES, area_id: "12", keywords: ["abelhas"] };
  // 1ª escolha: trabalho com DOI, preenchido pelo Crossref.
  const afterA = {
    ...typed,
    doi: "10.5555/a",
    title: "Trabalho A",
    authors: ["Ana", "Bia"],
    abstract: "Resumo do A\ncom duas linhas",
    venue: "Revista A",
    year: "2020",
  };

  it("sem importação anterior, devolve os valores como estão", () => {
    expect(undoOrcidImport(afterA, null)).toBe(afterA);
  });

  it("desfaz DOI, autoras, resumo, revista e ano que a escolha anterior preencheu", () => {
    const undone = undoOrcidImport(afterA, { before: typed, after: afterA });
    expect(undone).toEqual(typed);
    // Reproduz o defeito: o 2º trabalho (sem DOI) não herda o DOI nem as autoras do 1º.
    const b = work({ title: "Trabalho B", year: 2021, journal: "Evento B" });
    expect(mergeOrcidIntoValues(undone, b)).toMatchObject({
      doi: "",
      title: "Trabalho B",
      authors: [],
      abstract: "",
      venue: "Evento B",
      year: "2021",
      area_id: "12",
      keywords: ["abelhas"],
    });
  });

  it("mantém o que a pessoa editou depois da importação e o que ela tinha digitado antes", () => {
    const before = { ...typed, url: "https://meu.link", abstract: "Meu resumo" };
    const after = { ...before, doi: "10.5555/a", title: "Trabalho A", authors: ["Ana"] };
    const edited = { ...after, title: "Trabalho A (corrigido)", authors: ["Ana", "Carla"] };
    expect(undoOrcidImport(edited, { before, after })).toEqual({
      ...edited,
      doi: "",
    });
  });

  it("trata \\r\\n do <textarea> como a mesma quebra de linha", () => {
    const current = { ...afterA, abstract: "Resumo do A\r\ncom duas linhas" };
    expect(undoOrcidImport(current, { before: typed, after: afterA }).abstract).toBe("");
  });
});

describe("missingAfterOrcid", () => {
  it("lista só o que ainda falta", () => {
    expect(missingAfterOrcid(EMPTY_PAPER_VALUES)).toEqual([
      "autoras",
      "resumo",
      "o link para o paper",
    ]);
    expect(
      missingAfterOrcid({
        ...EMPTY_PAPER_VALUES,
        authors: ["Ana"],
        abstract: "x",
        url: "https://x.org",
      }),
    ).toEqual([]);
    expect(missingAfterOrcid({ ...EMPTY_PAPER_VALUES, doi: "10.5555/a" })).toEqual([
      "autoras",
      "resumo",
    ]);
  });
});

describe("rótulos", () => {
  it("traduz os tipos mais comuns", () => {
    expect(orcidWorkTypeLabel("journal-article")).toBe("Artigo em periódico");
    expect(orcidWorkTypeLabel("dissertation-thesis")).toBe("Dissertação ou tese");
    expect(orcidWorkTypeLabel("lecture-speech")).toBe("Palestra");
    expect(orcidWorkTypeLabel("algo-novo")).toBeNull();
    expect(orcidWorkTypeLabel(null)).toBeNull();
  });

  it("junta listas em pt-BR", () => {
    expect(joinPt([])).toBe("");
    expect(joinPt(["título"])).toBe("título");
    expect(joinPt(["título", "ano"])).toBe("título e ano");
    expect(joinPt(["título", "ano", "DOI"])).toBe("título, ano e DOI");
  });
});
