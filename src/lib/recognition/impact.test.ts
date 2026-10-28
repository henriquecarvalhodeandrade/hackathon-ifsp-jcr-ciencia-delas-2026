import { describe, expect, it } from "vitest";
import {
  CELL_MIN,
  K_MIN,
  SUPPRESSED_LABEL,
  formatAverage,
  missingForResults,
  outcomeValueLabel,
  parseImpact,
  sharePercent,
} from "./impact";

const full = {
  completed: 7,
  mentee_feedback: 5,
  outcomes: [
    { slug: "menos-sozinha", count: 4 },
    { slug: "plano-definido", count: 4 },
    { slug: "iniciacao-cientifica", count: null },
    { slug: "candidatura", count: null },
    { slug: "trabalho-apresentado", count: null },
    { slug: "rede-ampliada", count: 3 },
  ],
  helpfulness_avg: 4.6,
  declarations_issued: 1,
  k_min: 5,
  is_demo: true,
};

describe("parseImpact", () => {
  it("lê o JSON do banco com rótulos no plural, na ordem do catálogo", () => {
    const data = parseImpact(full);
    expect(data).toMatchObject({
      completed: 7,
      menteeFeedback: 5,
      declarationsIssued: 1,
      kMin: 5,
      allowed: true,
      helpfulnessAvg: 4.6,
      isDemo: true,
    });
    expect(data!.outcomes.map((o) => o.slug)).toEqual([
      "menos-sozinha",
      "plano-definido",
      "iniciacao-cientifica",
      "candidatura",
      "trabalho-apresentado",
      "rede-ampliada",
    ]);
    expect(data!.outcomes[0]).toEqual({
      slug: "menos-sozinha",
      label: "Se sentiram menos sozinhas na pesquisa",
      count: 4,
      percent: 80,
    });
    expect(data!.outcomes[2]).toMatchObject({ count: null, percent: null });
  });

  it("com menos de 5 retornos não mostra opções nem média (mesmo se o banco mandasse)", () => {
    const data = parseImpact({ ...full, mentee_feedback: 4 });
    expect(data).toMatchObject({ allowed: false, outcomes: [], helpfulnessAvg: null });
    expect(parseImpact({ ...full, outcomes: null, helpfulness_avg: null })).toMatchObject({
      allowed: false,
    });
  });

  it("suprime de novo células abaixo de 3 que viessem com número", () => {
    const data = parseImpact({
      ...full,
      outcomes: [
        { slug: "menos-sozinha", count: 2 },
        { slug: "plano-definido", count: 0 },
      ],
    });
    expect(data!.outcomes.find((o) => o.slug === "menos-sozinha")).toMatchObject({ count: null });
    expect(data!.outcomes.find((o) => o.slug === "plano-definido")).toMatchObject({ count: null });
    // Opção ausente no JSON também aparece como "menos de 3".
    expect(data!.outcomes.find((o) => o.slug === "rede-ampliada")).toMatchObject({ count: null });
  });

  it("nunca usa um k menor que 5, mesmo se o JSON disser", () => {
    expect(parseImpact({ ...full, k_min: 2, mentee_feedback: 3 })).toMatchObject({
      kMin: 5,
      allowed: false,
    });
    expect(parseImpact({ ...full, k_min: 10, mentee_feedback: 6 })).toMatchObject({
      kMin: 10,
      allowed: false,
    });
  });

  it("ignora opções que não são da mentoranda", () => {
    const data = parseImpact({
      ...full,
      outcomes: [...full.outcomes, { slug: "aprendi-tambem", count: 9 }],
    });
    expect(data!.outcomes.some((o) => o.slug === "aprendi-tambem")).toBe(false);
  });

  it("JSON fora do formato vira null (a seção some)", () => {
    expect(parseImpact(null)).toBeNull();
    expect(parseImpact("oi")).toBeNull();
    expect(parseImpact([])).toBeNull();
  });

  it("campos estranhos caem em valores seguros", () => {
    const data = parseImpact({ completed: "3", mentee_feedback: -1, is_demo: "sim" });
    expect(data).toMatchObject({
      completed: 3,
      menteeFeedback: 0,
      allowed: false,
      isDemo: false,
      declarationsIssued: 0,
    });
  });
});

describe("formatação", () => {
  it("porcentagem de quem respondeu", () => {
    expect(sharePercent(4, 5)).toBe(80);
    expect(sharePercent(1, 3)).toBe(33);
    expect(sharePercent(3, 0)).toBe(0);
  });

  it("rótulo do valor: '80% (4 de 5)' ou 'menos de 3'", () => {
    const data = parseImpact(full)!;
    expect(outcomeValueLabel(data.outcomes[0]!, 5)).toBe("80% (4 de 5)");
    expect(outcomeValueLabel(data.outcomes[2]!, 5)).toBe(SUPPRESSED_LABEL);
    expect(SUPPRESSED_LABEL).toBe("menos de 3");
  });

  it("média com vírgula", () => {
    expect(formatAverage(4.6)).toBe("4,6");
    expect(formatAverage(5)).toBe("5,0");
  });

  it("quantos retornos faltam para mostrar os resultados", () => {
    expect(missingForResults({ menteeFeedback: 2, kMin: 5 })).toBe(3);
    expect(missingForResults({ menteeFeedback: 9, kMin: 5 })).toBe(0);
  });

  it("limiares documentados", () => {
    expect(K_MIN).toBe(5);
    expect(CELL_MIN).toBe(3);
  });
});
