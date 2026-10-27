import { describe, expect, it } from "vitest";
import { displayUrl, normalizeOrcid, normalizeProfileUrl, orcidCheckDigit, orcidUrl } from "./links";

describe("normalizeProfileUrl", () => {
  it("completa https:// quando falta", () => {
    expect(normalizeProfileUrl("lattes.cnpq.br/1234567890", "lattes")).toEqual({
      ok: true,
      value: "https://lattes.cnpq.br/1234567890",
    });
    expect(normalizeProfileUrl("www.minhapesquisa.org", "website")).toEqual({
      ok: true,
      value: "https://www.minhapesquisa.org/",
    });
  });

  it("mantém http(s) e recusa outros protocolos", () => {
    expect(normalizeProfileUrl("http://exemplo.com.br/x", "website")).toEqual({
      ok: true,
      value: "http://exemplo.com.br/x",
    });
    expect(normalizeProfileUrl("javascript:alert(1)", "website").ok).toBe(false);
    expect(normalizeProfileUrl("ftp://exemplo.com", "website").ok).toBe(false);
    expect(normalizeProfileUrl("mailto:eu@exemplo.com", "website").ok).toBe(false);
  });

  it("confere o domínio do Lattes e do LinkedIn", () => {
    expect(normalizeProfileUrl("https://lattes.cnpq.br/123", "lattes").ok).toBe(true);
    expect(normalizeProfileUrl("https://evil.com/lattes.cnpq.br", "lattes").ok).toBe(false);
    expect(normalizeProfileUrl("https://br.linkedin.com/in/ana", "linkedin").ok).toBe(true);
    expect(normalizeProfileUrl("https://linkedin.com.evil.io/in/ana", "linkedin").ok).toBe(false);
  });

  it("recusa endereços sem domínio, com espaço, com credenciais ou longos demais", () => {
    expect(normalizeProfileUrl("localhost", "website").ok).toBe(false);
    expect(normalizeProfileUrl("exemplo .com", "website").ok).toBe(false);
    expect(normalizeProfileUrl("https://ana:senha@exemplo.com", "website").ok).toBe(false);
    expect(normalizeProfileUrl(`https://exemplo.com/${"a".repeat(300)}`, "website").ok).toBe(false);
    expect(normalizeProfileUrl("   ", "website").ok).toBe(false);
  });
});

describe("ORCID", () => {
  it("calcula o dígito verificador (ISO 7064 11,2)", () => {
    expect(orcidCheckDigit("000000021825009")).toBe("7");
    expect(orcidCheckDigit("000000015109370")).toBe("0");
    expect(orcidCheckDigit("000000021694233")).toBe("X");
  });

  it("aceita iD puro, URL e dígitos colados", () => {
    expect(normalizeOrcid("0000-0002-1825-0097")).toEqual({ ok: true, value: "0000-0002-1825-0097" });
    expect(normalizeOrcid("https://orcid.org/0000-0002-1825-0097")).toEqual({ ok: true, value: "0000-0002-1825-0097" });
    expect(normalizeOrcid("orcid.org/000000021694233x")).toEqual({ ok: true, value: "0000-0002-1694-233X" });
  });

  it("recusa formato errado e dígito verificador que não confere", () => {
    expect(normalizeOrcid("1234").ok).toBe(false);
    const wrong = normalizeOrcid("0000-0002-1825-0098");
    expect(wrong.ok).toBe(false);
    if (!wrong.ok) expect(wrong.error).toMatch(/não confere/);
  });

  it("monta o link público", () => {
    expect(orcidUrl("0000-0002-1825-0097")).toBe("https://orcid.org/0000-0002-1825-0097");
    expect(orcidUrl("https://orcid.org/0000-0002-1825-0097")).toBe("https://orcid.org/0000-0002-1825-0097");
  });
});

describe("displayUrl", () => {
  it("encurta o endereço para exibir", () => {
    expect(displayUrl("https://www.exemplo.com.br/")).toBe("exemplo.com.br");
    expect(displayUrl("https://exemplo.com/um/caminho/bem/comprido/demais/mesmo", 20)).toBe("exemplo.com/um/cami…");
  });
});
