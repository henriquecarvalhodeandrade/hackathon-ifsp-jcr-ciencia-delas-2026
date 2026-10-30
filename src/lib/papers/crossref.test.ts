import { describe, expect, it } from "vitest";
import {
  cleanAbstract,
  crossrefWorkUrl,
  decodeEntities,
  parseCrossrefWork,
  stripMarkup,
} from "./crossref";

describe("decodeEntities / stripMarkup", () => {
  it("decodifica entidades nomeadas e numéricas", () => {
    expect(decodeEntities("Ci&#234;ncia &amp; inova&#x00E7;&#227;o &lt;3")).toBe(
      "Ciência & inovação <3",
    );
    expect(decodeEntities("&desconhecida; &#0;")).toBe("&desconhecida; &#0;");
  });

  it("remove tags HTML/MathML e colapsa espaços", () => {
    expect(stripMarkup("<p>Um</p><p>Dois</p>")).toBe("Um Dois");
    expect(stripMarkup("Efeito <i>Hall</i>   quântico\n em <sub>2</sub>D")).toBe(
      "Efeito Hall quântico em 2D",
    );
  });

  it("não deixa espaço antes de pontuação quando o JATS vem indentado", () => {
    const jats =
      'Jinek\n  <jats:italic>et al.</jats:italic>\n  (p.\n  <jats:related-article page="816">816</jats:related-article>\n' +
      "  , published online; see the Perspective by\n  <jats:related-article>Brouns</jats:related-article>\n  ) found [\n 1 ]\n  .";
    expect(stripMarkup(jats)).toBe(
      "Jinek et al. (p. 816, published online; see the Perspective by Brouns) found [1].",
    );
    expect(stripMarkup("Apps em <i>.NET</i> e arquivos .csv , com 0 .5 s")).toBe(
      "Apps em .NET e arquivos .csv, com 0 .5 s",
    );
  });
});

describe("cleanAbstract", () => {
  it("converte JATS em parágrafos e remove o título 'Abstract'", () => {
    const jats =
      "<jats:title>Abstract</jats:title><jats:p>Primeiro parágrafo com <jats:italic>itálico</jats:italic>.</jats:p>" +
      "<jats:p>Segundo &amp; último.</jats:p>";
    expect(cleanAbstract(jats)).toBe("Primeiro parágrafo com itálico.\n\nSegundo & último.");
  });

  it("remove o prefixo 'Abstract' colado no texto", () => {
    expect(cleanAbstract("<p>Abstract: Estudamos abelhas.</p>")).toBe("Estudamos abelhas.");
    expect(cleanAbstract("Resumo Estudamos abelhas nativas.")).toBe("Estudamos abelhas nativas.");
  });
});

const work = {
  status: "ok",
  message: {
    DOI: "10.1038/NATURE12373",
    title: ["Nanometre-scale thermometry in a <i>living</i> cell"],
    author: [
      { given: "G.", family: "Kucsko", sequence: "first" },
      { given: "P. C.", family: "Maurer" },
      { name: "Consórcio Demo" },
      { given: "G.", family: "Kucsko" },
      { family: "" },
    ],
    "container-title": ["Nature"],
    publisher: "Springer Science and Business Media LLC",
    issued: { "date-parts": [[2013, 7, 31]] },
    created: { "date-parts": [[2013, 8, 1]] },
    abstract: "<jats:p>Sensitive probing of temperature variations on nanometre scales.</jats:p>",
  },
};

describe("parseCrossrefWork", () => {
  it("mapeia título, autoras, revista, ano e resumo", () => {
    expect(parseCrossrefWork(work)).toEqual({
      doi: "10.1038/nature12373",
      title: "Nanometre-scale thermometry in a living cell",
      authors: ["G. Kucsko", "P. C. Maurer", "Consórcio Demo"],
      venue: "Nature",
      year: 2013,
      abstract: "Sensitive probing of temperature variations on nanometre scales.",
    });
  });

  it("aceita só o objeto message, usa a editora quando não há revista e cai em outras datas", () => {
    const data = parseCrossrefWork(
      {
        title: ["Livro demo"],
        subtitle: ["um subtítulo"],
        publisher: "Editora Demo",
        "published-online": { "date-parts": [["2021"]] },
      },
      "10.5555/livro",
    );
    expect(data).toMatchObject({
      doi: "10.5555/livro",
      title: "Livro demo: um subtítulo",
      venue: "Editora Demo",
      year: 2021,
      abstract: null,
      authors: [],
    });
  });

  it("corta textos longos nos limites do banco", () => {
    const data = parseCrossrefWork({
      DOI: "10.5555/longo",
      title: [`${"palavra ".repeat(60)}`],
      abstract: `<p>${"x".repeat(6000)}</p>`,
      author: Array.from({ length: 60 }, (_, i) => ({ given: "Autora", family: `Número ${i}` })),
    });
    expect(data?.title?.length).toBeLessThanOrEqual(300);
    expect(data?.abstract?.length).toBeLessThanOrEqual(5000);
    expect(data?.authors).toHaveLength(50);
  });

  it("devolve null para formatos inesperados ou sem DOI", () => {
    expect(parseCrossrefWork(null)).toBeNull();
    expect(parseCrossrefWork({ message: { title: "não é lista" } })).toBeNull();
    expect(parseCrossrefWork({ message: { title: ["Sem DOI"] } })).toBeNull();
  });

  it("ignora anos fora da faixa", () => {
    expect(
      parseCrossrefWork({ DOI: "10.5555/a", issued: { "date-parts": [[1500]] } })?.year,
    ).toBeNull();
    expect(
      parseCrossrefWork({ DOI: "10.5555/a", issued: { "date-parts": [[null]] } })?.year,
    ).toBeNull();
  });
});

describe("crossrefWorkUrl", () => {
  it("preserva as barras e codifica o resto", () => {
    expect(crossrefWorkUrl("10.1002/(sici)1097#x")).toBe(
      "https://api.crossref.org/works/10.1002/(sici)1097%23x",
    );
  });
});
