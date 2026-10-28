import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { describeKinds, detectPersonalData, normalizeForPii, PII_PATTERNS } from "./pii";

const MIGRATION = fileURLToPath(
  new URL("../../../supabase/migrations/20261028190100_public_questions.sql", import.meta.url),
);

/** Lê a lista (tipo, expressão) de private.detect_personal_data na migration. */
function sqlPatterns(): Array<[string, string]> {
  const sql = readFileSync(MIGRATION, "utf8");
  const start = sql.indexOf("-- PII_PATTERNS (início)");
  const end = sql.indexOf("-- PII_PATTERNS (fim)");
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  const block = sql.slice(start, end);
  return [...block.matchAll(/\('([a-z_]+)', '((?:[^']|'')*)'\)/g)].map((m) => [
    m[1]!,
    m[2]!.replaceAll("''", "'"),
  ]);
}

describe("detectPersonalData — positivos", () => {
  it.each([
    ["ana.souza@gmail.com", "email"],
    ["me escreve: ANA.SOUZA@GMAIL.COM", "email"],
    ["ana arroba gmail ponto com", "email"],
    ["(12) 99876-5432", "telefone"],
    ["12 998765432", "telefone"],
    ["+55 12 9 9876-5432", "telefone"],
    ["99876-5432", "telefone"],
    ["(12) 3951-1234", "telefone"],
    ["123.456.789-09", "documento"],
    ["12345678909", "documento"],
    ["RG 12.345.678-9", "documento"],
    ["@ana_sci", "rede_social"],
    ["me segue lá @ana.cientista", "rede_social"],
    ["instagram.com/ana", "rede_social"],
    ["https://www.instagram.com/ana", "rede_social"],
    ["wa.me/5512998765432", "rede_social"],
    ["t.me/ana_sci", "rede_social"],
    ["linktr.ee/ana", "rede_social"],
    ["https://bit.ly/3xYz", "rede_social"],
    ["https://www.gov.br", "link"],
    ["www.exemplo.com.br", "link"],
    ["meusite.com", "link"],
  ] as const)("%s → %s", (text, kind) => {
    expect(detectPersonalData(text)).toContain(kind);
  });

  it("encontra telefone escrito com caracteres invisíveis ou largos", () => {
    expect(detectPersonalData("99876​5432")).toContain("telefone");
    expect(detectPersonalData("ana＠gmail.com")).toContain("email");
    expect(detectPersonalData("（12）９９８７６-５４３２")).toContain("telefone");
  });

  it("devolve cada tipo uma vez, na ordem da lista", () => {
    expect(detectPersonalData("ana@gmail.com, (12) 99876-5432 e @ana_sci")).toEqual([
      "email",
      "telefone",
      "rede_social",
    ]);
  });
});

describe("detectPersonalData — negativos (números comuns em perguntas de ciência)", () => {
  it.each([
    "em 2026",
    "10.000 células",
    "CO2",
    "pH 7,4",
    "Lei 9.394",
    "capítulo 12",
    "Fiz IC de 2019-2022 e quero voltar em 2025",
    "Uma solução a 0,9% e outra com 1.000.000 de bactérias",
    "Temperatura de 37 °C por 48 horas",
    "Preciso ser muito boa em matemática para fazer pesquisa em biologia?",
    "O símbolo @ aparece em e-mails",
    "Página 123, exercício 45",
  ])("%s → nada", (text) => {
    expect(detectPersonalData(text)).toEqual([]);
  });
});

describe("links em respostas", () => {
  it("respostas podem indicar sites oficiais (https)", () => {
    expect(detectPersonalData("Veja https://www.gov.br", { allowLinks: true })).toEqual([]);
    expect(detectPersonalData("Veja https://www.gov.br")).toEqual(["link"]);
  });

  it("mas nunca redes sociais, e-mail ou telefone", () => {
    expect(
      detectPersonalData("Me siga em https://instagram.com/ana", { allowLinks: true }),
    ).toEqual(["rede_social"]);
    expect(detectPersonalData("me chama no wa.me/5512998765432", { allowLinks: true })).toEqual([
      "telefone",
      "rede_social",
    ]);
    expect(detectPersonalData("escreva para ana@gmail.com", { allowLinks: true })).toEqual([
      "email",
    ]);
    // Encurtadores e linktree escondem para onde levam (um contato, muitas vezes).
    expect(detectPersonalData("veja em https://bit.ly/abc", { allowLinks: true })).toEqual([
      "rede_social",
    ]);
  });
});

describe("paridade com o banco (private.detect_personal_data)", () => {
  it("a migration tem exatamente as mesmas expressões, na mesma ordem", () => {
    const fromSql = sqlPatterns();
    expect(fromSql.length).toBe(PII_PATTERNS.length);
    expect(fromSql).toEqual(PII_PATTERNS.map(([kind, source]) => [kind, source]));
  });

  it("as expressões do banco, rodadas aqui, dão o mesmo resultado", () => {
    const fromSql = sqlPatterns().map(([kind, source]) => [kind, new RegExp(source, "i")] as const);
    const viaSql = (text: string) => {
      const value = normalizeForPii(text);
      const found: string[] = [];
      for (const [kind, re] of fromSql) {
        if (!found.includes(kind) && re.test(value)) found.push(kind);
      }
      return found;
    };
    for (const text of [
      "ana.souza@gmail.com",
      "(12) 99876-5432",
      "123.456.789-09",
      "@ana_sci",
      "instagram.com/ana",
      "https://www.gov.br",
      "pH 7,4 e Lei 9.394",
    ]) {
      expect(viaSql(text)).toEqual(detectPersonalData(text));
    }
  });

  it("a normalização do banco também tira invisíveis e aplica NFKC", () => {
    const sql = readFileSync(MIGRATION, "utf8");
    expect(sql).toContain("normalize(coalesce(p_text, ''), nfkc)");
    expect(sql).toContain(String.raw`'[​-‍⁠﻿­]'`);
    expect(normalizeForPii("a­b﻿c")).toBe("abc");
  });
});

describe("describeKinds", () => {
  it("monta a lista em pt-BR", () => {
    expect(describeKinds([])).toBe("");
    expect(describeKinds(["email"])).toBe("e-mail");
    expect(describeKinds(["email", "telefone", "link"])).toBe("e-mail, telefone e link");
  });
});
