import { describe, expect, it } from "vitest";
import {
  CROCKFORD_ALPHABET,
  DECLARATION_CODE_PATTERN,
  DEMO_DECLARATION_CODE,
  isDeclarationCode,
  normalizeDeclarationCode,
  verificationPath,
  verificationUrl,
} from "./code";

describe("normalizeDeclarationCode", () => {
  it("devolve o código canônico como está", () => {
    expect(normalizeDeclarationCode("ART-7K2M-Q9XD-4HNP")).toBe("ART-7K2M-Q9XD-4HNP");
  });

  it("aceita minúsculas, espaços, hífens a mais ou a menos e sem prefixo", () => {
    for (const typed of [
      "art-7k2m-q9xd-4hnp",
      " ART 7K2M Q9XD 4HNP ",
      "ART7K2MQ9XD4HNP",
      "7k2m-q9xd-4hnp",
      "7K2MQ9XD4HNP",
      "art – 7k2m – q9xd – 4hnp",
    ]) {
      expect(normalizeDeclarationCode(typed), typed).toBe("ART-7K2M-Q9XD-4HNP");
    }
  });

  it("troca O por 0 e I/L por 1 (letras que não existem no alfabeto)", () => {
    expect(normalizeDeclarationCode("ART-OIL0-0000-1111")).toBe("ART-0110-0000-1111");
    expect(normalizeDeclarationCode("art-o0o0-iiii-llll")).toBe("ART-0000-1111-1111");
  });

  it("recusa o que não pode ser um código", () => {
    for (const bad of [
      "",
      "ART",
      "ART-0000-0000",
      "ART-0000-0000-0000-0000",
      "ART-UUUU-0000-0000", // U não existe no Crockford base32
      "ART-0000-0000-000!",
      "XYZ-0000-0000-0000",
      "a".repeat(65),
      null,
      undefined,
      42,
    ]) {
      expect(normalizeDeclarationCode(bad), String(bad)).toBeNull();
    }
  });

  it("o resultado sempre bate com o formato canônico", () => {
    for (const ch of CROCKFORD_ALPHABET) {
      const code = normalizeDeclarationCode(`ART-${ch.repeat(4)}-${ch.repeat(4)}-${ch.repeat(4)}`);
      expect(code && DECLARATION_CODE_PATTERN.test(code), ch).toBe(true);
    }
  });
});

describe("isDeclarationCode", () => {
  it("só aceita o formato canônico (maiúsculas, com hífens e prefixo)", () => {
    expect(isDeclarationCode(DEMO_DECLARATION_CODE)).toBe(true);
    expect(isDeclarationCode("art-7k2m-q9xd-4hnp")).toBe(false);
    expect(isDeclarationCode("7K2M-Q9XD-4HNP")).toBe(false);
    expect(isDeclarationCode("ART-7K2M-Q9XD-4HNO")).toBe(false);
    expect(isDeclarationCode("ART-IIII-0000-0000")).toBe(false);
    expect(isDeclarationCode(undefined)).toBe(false);
  });

  it("o alfabeto é o Crockford base32 (32 símbolos, sem I, L, O, U)", () => {
    expect(CROCKFORD_ALPHABET).toHaveLength(32);
    expect(new Set(CROCKFORD_ALPHABET).size).toBe(32);
    expect(CROCKFORD_ALPHABET).not.toMatch(/[ILOU]/);
  });
});

describe("verificationUrl", () => {
  it("monta o caminho e a URL absoluta (sem barra dupla)", () => {
    expect(verificationPath("ART-7K2M-Q9XD-4HNP")).toBe("/verificar/ART-7K2M-Q9XD-4HNP");
    expect(verificationUrl("https://artemis.example/", "ART-7K2M-Q9XD-4HNP")).toBe(
      "https://artemis.example/verificar/ART-7K2M-Q9XD-4HNP",
    );
  });
});
