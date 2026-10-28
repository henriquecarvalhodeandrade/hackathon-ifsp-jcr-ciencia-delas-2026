import { describe, expect, it } from "vitest";
import {
  DECLARATION_DISCLAIMER,
  buildCvLine,
  buildDeclarationText,
  displayHost,
  formatDeclarationPeriod,
  formatList,
  formatMonthYear,
  formatPeriodRange,
  formatThemesInline,
  themeLabels,
  toMonthYear,
} from "./declaration-text";

describe("meses em pt-BR", () => {
  it("lê datas do banco sem voltar um dia no fuso de São Paulo", () => {
    expect(toMonthYear("2026-08-01")).toEqual({ year: 2026, month: 8 });
    expect(formatMonthYear("2026-08-01")).toBe("agosto de 2026");
    expect(formatMonthYear("2026-03-01")).toBe("março de 2026");
    expect(formatMonthYear("2026-12-31")).toBe("dezembro de 2026");
  });

  it("datas completas usam o fuso de São Paulo", () => {
    // 1º de setembro, 02:00 UTC = 31 de agosto, 23:00 em São Paulo.
    expect(formatMonthYear(new Date("2026-09-01T02:00:00Z"))).toBe("agosto de 2026");
    expect(formatMonthYear(new Date("2026-09-01T12:00:00Z"))).toBe("setembro de 2026");
  });

  it("valores inválidos viram texto vazio", () => {
    expect(formatMonthYear(null)).toBe("");
    expect(formatMonthYear("ontem")).toBe("");
    expect(formatMonthYear("2026-13-01")).toBe("");
    expect(formatMonthYear(new Date("x"))).toBe("");
  });
});

describe("período", () => {
  it("na declaração: 'entre … e …' ou 'em …' no mesmo mês", () => {
    expect(formatDeclarationPeriod("2026-08-01", "2026-10-01")).toBe(
      "entre agosto de 2026 e outubro de 2026",
    );
    expect(formatDeclarationPeriod("2026-10-01", "2026-10-01")).toBe("em outubro de 2026");
    expect(formatDeclarationPeriod("2026-10-01", null)).toBe("em outubro de 2026");
    expect(formatDeclarationPeriod(null, null)).toBe("");
  });

  it("compacto (currículo)", () => {
    expect(formatPeriodRange("2026-08-01", "2026-10-01")).toBe("agosto a outubro de 2026");
    expect(formatPeriodRange("2025-11-01", "2026-02-01")).toBe(
      "novembro de 2025 a fevereiro de 2026",
    );
    expect(formatPeriodRange("2026-10-01", "2026-10-01")).toBe("outubro de 2026");
  });
});

describe("temas", () => {
  it("traduz os slugs e ignora os desconhecidos", () => {
    expect(themeLabels(["bolsas-editais", "inventado", "saude-mental"])).toEqual([
      "Bolsas e editais",
      "Saúde mental e equilíbrio",
    ]);
    expect(themeLabels(null)).toEqual([]);
  });

  it("no meio da frase: minúsculas e ponto e vírgula (os rótulos já têm 'e')", () => {
    expect(formatThemesInline(["Bolsas e editais", "Saúde mental e equilíbrio"])).toBe(
      "bolsas e editais; saúde mental e equilíbrio",
    );
  });

  it("lista em português", () => {
    expect(formatList([])).toBe("");
    expect(formatList(["A"])).toBe("A");
    expect(formatList(["A", "B", "C"])).toBe("A, B e C");
  });
});

describe("buildDeclarationText", () => {
  const data = {
    menteeName: "Débora Alves",
    mentorName: "Patrícia Santos",
    periodStart: "2026-08-01",
    periodEnd: "2026-10-01",
    themes: ["Saúde mental e equilíbrio", "Bolsas e editais"],
  };

  it("segue o texto combinado (mentora, mentoranda, período e temas)", () => {
    expect(buildDeclarationText(data)).toBe(
      "A plataforma Artemis declara que Patrícia Santos participou como mentora e Débora Alves como mentoranda de uma mentoria entre pesquisadoras realizada pela plataforma entre agosto de 2026 e outubro de 2026, com os temas: saúde mental e equilíbrio; bolsas e editais.",
    );
  });

  it("sem temas, termina no período", () => {
    expect(buildDeclarationText({ ...data, themes: [] })).toMatch(
      /entre agosto de 2026 e outubro de 2026\.$/,
    );
  });

  it("não fala em horas nem em certificado", () => {
    const text = buildDeclarationText(data);
    expect(text).not.toMatch(/hora|certific|carga/i);
  });

  it("o aviso deixa claro que não é certificado institucional e não tem vínculo com CNPq/Lattes", () => {
    expect(DECLARATION_DISCLAIMER).toContain("Não substitui certificado institucional");
    expect(DECLARATION_DISCLAIMER).toContain(
      "não tem vínculo com o CNPq nem com a Plataforma Lattes",
    );
  });
});

describe("buildCvLine", () => {
  it("monta a linha do currículo com papel, período e link de verificação", () => {
    expect(
      buildCvLine({
        role: "mentor",
        periodStart: "2026-08-01",
        periodEnd: "2026-10-01",
        siteUrl: "https://artemis.example",
        code: "ART-7K2M-Q9XD-4HNP",
      }),
    ).toBe(
      "Mentoria entre pesquisadoras (como mentora), plataforma Artemis, agosto a outubro de 2026. Verificação: https://artemis.example/verificar/ART-7K2M-Q9XD-4HNP",
    );
    expect(
      buildCvLine({
        role: "mentee",
        periodStart: null,
        periodEnd: null,
        siteUrl: "http://localhost:3000/",
        code: "ART-0000-0000-0000",
      }),
    ).toBe(
      "Mentoria entre pesquisadoras (como mentoranda), plataforma Artemis. Verificação: http://localhost:3000/verificar/ART-0000-0000-0000",
    );
  });

  it("endereço curto para imprimir", () => {
    expect(displayHost("https://artemis.example/")).toBe("artemis.example");
    expect(displayHost("http://localhost:3000")).toBe("localhost:3000");
  });
});
