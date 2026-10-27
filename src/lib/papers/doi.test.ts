import { describe, expect, it } from "vitest";
import { doiUrl, isValidDoi, normalizeDoi } from "./doi";

describe("normalizeDoi", () => {
  it("remove prefixos de URL e 'doi:' e converte para minúsculas", () => {
    expect(normalizeDoi("https://doi.org/10.1590/S0100-ABC")).toBe("10.1590/s0100-abc");
    expect(normalizeDoi("http://dx.doi.org/10.1000/xyz")).toBe("10.1000/xyz");
    expect(normalizeDoi("doi: 10.5555/Demo.2026.001")).toBe("10.5555/demo.2026.001");
    expect(normalizeDoi("DOI:10.5555/x")).toBe("10.5555/x");
  });

  it("apara espaços e pontuação final colada por engano", () => {
    expect(normalizeDoi("  10.1038/nature12373.  ")).toBe("10.1038/nature12373");
    expect(normalizeDoi("10.1038/nature12373;")).toBe("10.1038/nature12373");
  });

  it("decodifica DOIs copiados já codificados", () => {
    expect(normalizeDoi("https://doi.org/10.1002%2F(SICI)1097")).toBe("10.1002/(sici)1097");
  });

  it("lida com vazio, null e % inválido", () => {
    expect(normalizeDoi("")).toBe("");
    expect(normalizeDoi(null)).toBe("");
    expect(normalizeDoi(undefined)).toBe("");
    expect(normalizeDoi("10.1000/abc%zz")).toBe("10.1000/abc%zz");
  });
});

describe("isValidDoi", () => {
  it("aceita DOIs no formato do CHECK do banco", () => {
    expect(isValidDoi("10.1590/s0100-123")).toBe(true);
    expect(isValidDoi("10.5555/demo.2026.001")).toBe(true);
    expect(isValidDoi("10.123456789/a")).toBe(true);
  });

  it("recusa formatos inválidos", () => {
    expect(isValidDoi("")).toBe(false);
    expect(isValidDoi("11.1590/abc")).toBe(false);
    expect(isValidDoi("10.12/abc")).toBe(false);
    expect(isValidDoi("10.1590/")).toBe(false);
    expect(isValidDoi("10.1590/com espaço")).toBe(false);
    expect(isValidDoi(`10.1590/${"a".repeat(260)}`)).toBe(false);
  });
});

describe("doiUrl", () => {
  it("gera o link resolvível com segmentos codificados", () => {
    expect(doiUrl("10.5555/demo.2026.001")).toBe("https://doi.org/10.5555/demo.2026.001");
    expect(doiUrl("10.1000/a<b>")).toBe("https://doi.org/10.1000/a%3Cb%3E");
  });
});
