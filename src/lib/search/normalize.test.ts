import { describe, expect, it } from "vitest";
import {
  SEARCH_MAX_LENGTH,
  SEARCH_MAX_TERMS,
  applySearchText,
  escapeLike,
  foldSearchText,
  normalizeSearchQuery,
  searchPatterns,
} from "./normalize";

describe("foldSearchText", () => {
  it("remove acentos e cedilha e passa para minúsculas (como lower(unaccent()) no banco)", () => {
    expect(foldSearchText("Jacareí")).toBe("jacarei");
    expect(foldSearchText("REVISÃO Sistemática")).toBe("revisao sistematica");
    expect(foldSearchText("Câmpus São José — Ação, Pôr, Über, Niño")).toBe(
      "campus sao jose - acao, por, uber, nino",
    );
  });

  it("dobra letras que o NFD não decompõe, como o unaccent faz", () => {
    expect(foldSearchText("Straße Æsir Œuvre Ørsted Łódź Đorđe")).toBe(
      "strasse aesir oeuvre orsted lodz dorde",
    );
    expect(foldSearchText("“Ciência” ‘delas’ – fim…")).toBe("\"ciencia\" 'delas' - fim...");
  });

  it("aceita texto decomposto (NFD) e ligaduras copiadas de PDFs", () => {
    expect(foldSearchText("Jacare\u0301i revisa\u0303o")).toBe("jacarei revisao");
    expect(foldSearchText("ﬁnanças „Ciência“")).toBe('financas ,,ciencia"');
  });

  it("mantém as letras que o unaccent mantém (outras escritas continuam encontráveis)", () => {
    // Cirílico: só Ё/ё perdem o acento; "й" fica (o banco guarda "андрей", não "андреи").
    expect(foldSearchText("Андрей Ёлкин")).toBe("андрей елкин");
    // Hangul e kana voltam compostos (NFC), como o texto digitado chega ao banco.
    expect(foldSearchText("한국어 연구")).toBe("한국어 연구".normalize("NFC"));
    expect(foldSearchText("한국어".normalize("NFD"))).toBe("한국어".normalize("NFC"));
    expect(foldSearchText("がくせい パン")).toBe("がくせい パン");
    expect(foldSearchText("हिंदी")).toBe("हिंदी");
    // Grego e vietnamita perdem os acentos, como no banco.
    expect(foldSearchText("Άρης Nguyễn Thị")).toBe("αρης nguyen thi");
  });

  it("colapsa espaços (inclusive quebras de linha e tabs) e apara", () => {
    expect(foldSearchText("  visão \n\t computacional  ")).toBe("visao computacional");
  });
});

describe("escapeLike", () => {
  it("escapa %, _ e a barra invertida", () => {
    expect(escapeLike("100%_a\\b")).toBe("100\\%\\_a\\\\b");
    expect(escapeLike("sem curingas")).toBe("sem curingas");
  });
});

describe("normalizeSearchQuery", () => {
  it("normaliza (NFD, sem acentos, minúsculas, espaços) e escapa curingas", () => {
    expect(normalizeSearchQuery("  Revisão   SISTEMÁTICA ")).toBe("revisao sistematica");
    expect(normalizeSearchQuery("50% de_acerto")).toBe("50\\% de\\_acerto");
  });

  it("troca * por espaço (o PostgREST trata * como %)", () => {
    expect(normalizeSearchQuery("abelha*nativa")).toBe("abelha nativa");
  });

  it("aceita vazio/nulo e corta no tamanho máximo", () => {
    expect(normalizeSearchQuery(undefined)).toBe("");
    expect(normalizeSearchQuery(null)).toBe("");
    expect(normalizeSearchQuery("á".repeat(200))).toHaveLength(SEARCH_MAX_LENGTH);
  });
});

describe("searchPatterns", () => {
  it("um padrão %palavra% normalizado por palavra", () => {
    expect(searchPatterns("Jacarei")).toEqual(["%jacarei%"]);
    expect(searchPatterns("Visão  JACAREÍ")).toEqual(["%visao%", "%jacarei%"]);
  });

  it("escapa curingas dentro das palavras", () => {
    expect(searchPatterns("100% R_2")).toEqual(["%100\\%%", "%r\\_2%"]);
  });

  it("ignora termos curtos demais ou só de curingas/espaços", () => {
    expect(searchPatterns("")).toEqual([]);
    expect(searchPatterns("   ")).toEqual([]);
    expect(searchPatterns("a")).toEqual([]);
    expect(searchPatterns("%_")).toEqual([]);
    expect(searchPatterns("***")).toEqual([]);
    expect(searchPatterns(undefined)).toEqual([]);
  });

  it("remove palavras repetidas e limita a quantidade", () => {
    expect(searchPatterns("dados Dados DADOS")).toEqual(["%dados%"]);
    const many = searchPatterns("um dois tres quatro cinco seis sete oito");
    expect(many).toHaveLength(SEARCH_MAX_TERMS);
    expect(many[0]).toBe("%um%");
  });
});

describe("applySearchText", () => {
  class FakeQuery {
    calls: Array<[string, string]> = [];
    ilike(column: string, pattern: string): FakeQuery {
      this.calls.push([column, pattern]);
      return this;
    }
  }

  it("aplica um .ilike por palavra na coluna search_text", () => {
    const query = applySearchText(new FakeQuery(), "Revisão sistemática");
    expect(query.calls).toEqual([
      ["search_text", "%revisao%"],
      ["search_text", "%sistematica%"],
    ]);
  });

  it("não filtra sem termo útil e aceita outra coluna", () => {
    expect(applySearchText(new FakeQuery(), " ").calls).toEqual([]);
    expect(applySearchText(new FakeQuery(), "ab", "outra").calls).toEqual([["outra", "%ab%"]]);
  });
});
