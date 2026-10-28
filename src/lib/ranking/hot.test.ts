import { describe, expect, it } from "vitest";
import { RANKING_PERIODS } from "@/lib/constants";
import { VITRINE_ORDER_EXPLANATIONS } from "@/lib/papers/params";
import {
  HOT_FORMULA_TEXT,
  RANKING_PERIOD_EXPLANATIONS,
  ageInHours,
  hotScore,
  periodStart,
} from "./hot";

const NOW = new Date("2026-10-27T12:00:00Z");
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000);

describe("hotScore (= SQL: vote_count / (age_hours + 2)^1.5)", () => {
  it("bate com a fórmula", () => {
    expect(hotScore(10, NOW, NOW)).toBeCloseTo(10 / Math.pow(2, 1.5), 12);
    expect(hotScore(10, hoursAgo(10), NOW)).toBeCloseTo(10 / Math.pow(12, 1.5), 12);
    expect(hotScore(3, hoursAgo(0.5), NOW)).toBeCloseTo(3 / Math.pow(2.5, 1.5), 12);
    expect(hotScore(0, hoursAgo(1), NOW)).toBe(0);
  });

  it("aceita datas como string ISO ou número", () => {
    expect(hotScore(5, hoursAgo(4).toISOString(), NOW.toISOString())).toBeCloseTo(
      5 / Math.pow(6, 1.5),
      12,
    );
    expect(hotScore(5, hoursAgo(4).getTime(), NOW.getTime())).toBeCloseTo(5 / Math.pow(6, 1.5), 12);
  });

  it("decai com o tempo e cresce com os votos", () => {
    expect(hotScore(10, hoursAgo(1), NOW)).toBeGreaterThan(hotScore(10, hoursAgo(48), NOW));
    expect(hotScore(20, hoursAgo(5), NOW)).toBeGreaterThan(hotScore(10, hoursAgo(5), NOW));
    // Um paper novo com poucos votos pode passar um antigo com muitos.
    expect(hotScore(5, hoursAgo(2), NOW)).toBeGreaterThan(hotScore(40, hoursAgo(72), NOW));
  });

  it("datas no futuro contam como idade zero", () => {
    expect(ageInHours(new Date(NOW.getTime() + 3_600_000), NOW)).toBe(0);
    expect(hotScore(4, new Date(NOW.getTime() + 3_600_000), NOW)).toBeCloseTo(
      4 / Math.pow(2, 1.5),
      12,
    );
  });
});

describe("periodStart (= now() - interval '7/30/365 days' na RPC)", () => {
  it("semana = 7 dias", () => {
    expect(periodStart("week", NOW)?.toISOString()).toBe("2026-10-20T12:00:00.000Z");
  });

  it("mês = 30 dias e ano = 365 dias (janelas fixas, como a RPC)", () => {
    expect(periodStart("month", NOW)?.toISOString()).toBe("2026-09-27T12:00:00.000Z");
    expect(periodStart("month", new Date("2026-03-31T08:30:00Z"))?.toISOString()).toBe(
      "2026-03-01T08:30:00.000Z",
    );
    expect(periodStart("year", NOW)?.toISOString()).toBe("2025-10-27T12:00:00.000Z");
    expect(periodStart("year", new Date("2028-12-31T10:00:00Z"))?.toISOString()).toBe(
      "2028-01-01T10:00:00.000Z",
    );
  });

  it("'all' e 'hot' não têm janela", () => {
    expect(periodStart("all", NOW)).toBeNull();
    expect(periodStart("hot", NOW)).toBeNull();
  });
});

describe("RANKING_PERIOD_EXPLANATIONS (fonte única dos textos do ranking)", () => {
  it("tem um texto para cada período", () => {
    expect(Object.keys(RANKING_PERIOD_EXPLANATIONS).sort()).toEqual(
      Object.keys(RANKING_PERIODS).sort(),
    );
  });

  it("fala sempre em destaques, nunca em votos", () => {
    for (const text of Object.values(RANKING_PERIOD_EXPLANATIONS)) {
      expect(text).toMatch(/destaques/);
      expect(text).not.toMatch(/\bvotos?\b/i);
    }
  });

  it("descreve o Em alta exatamente como a fórmula", () => {
    expect(HOT_FORMULA_TEXT).toBe("destaques ÷ (horas desde a publicação + 2)^1,5");
    expect(RANKING_PERIOD_EXPLANATIONS.hot).toContain(HOT_FORMULA_TEXT);
  });

  it("a Vitrine reaproveita os mesmos textos", () => {
    for (const [period, text] of Object.entries(RANKING_PERIOD_EXPLANATIONS)) {
      expect(VITRINE_ORDER_EXPLANATIONS[period as keyof typeof RANKING_PERIOD_EXPLANATIONS]).toBe(
        text,
      );
    }
  });
});
