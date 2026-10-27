import { describe, expect, it } from "vitest";
import { editionSlug, formatEditionPeriod, getEditionWeek, isoWeekOf, zonedDate } from "./week";

// Referência: to_char(d, 'IYYY-"s"IW') no Postgres (mesma regra do seed).
const POSTGRES_REFERENCE: Array<[string, string]> = [
  ["2021-01-03", "2020-s53"],
  ["2020-12-28", "2020-s53"],
  ["2024-12-30", "2025-s01"],
  ["2026-01-01", "2026-s01"],
  ["2026-10-26", "2026-s44"],
  ["2026-10-25", "2026-s43"],
  ["2027-01-03", "2026-s53"],
  ["2027-01-04", "2027-s01"],
  ["2015-12-31", "2015-s53"],
  ["2016-01-03", "2015-s53"],
  ["2026-12-31", "2026-s53"],
  ["2020-12-31", "2020-s53"],
];

describe("isoWeekOf", () => {
  it.each(POSTGRES_REFERENCE)("%s → %s (igual ao Postgres)", (ymd, expected) => {
    const [year, month, day] = ymd.split("-").map(Number) as [number, number, number];
    expect(editionSlug(isoWeekOf({ year, month, day }))).toBe(expected);
  });
});

describe("zonedDate", () => {
  it("usa o fuso de São Paulo (UTC−3)", () => {
    // 02:00 UTC de terça = 23:00 de segunda em São Paulo.
    expect(zonedDate(new Date("2026-10-27T02:00:00Z"))).toEqual({ year: 2026, month: 10, day: 26 });
  });
});

describe("getEditionWeek", () => {
  it("cron de segunda 12:00 UTC gera a edição da semana que terminou (como o seed)", () => {
    const week = getEditionWeek(new Date("2026-10-26T12:00:00Z"));
    expect(week.slug).toBe("2026-s43");
    expect(week.title).toBe("Boletim Delas — semana 43 de 2026");
    expect(week.periodStart).toBe("2026-10-19");
    expect(week.periodEnd).toBe("2026-10-25");
    expect(week.windowEnd.toISOString()).toBe("2026-10-26T12:00:00.000Z");
    expect(week.windowStart.toISOString()).toBe("2026-10-19T12:00:00.000Z");
  });

  it("execuções repetidas na mesma semana reaproveitam o slug (idempotência)", () => {
    const tuesday = getEditionWeek(new Date("2026-10-27T15:00:00Z"));
    const nextMonday = getEditionWeek(new Date("2026-11-02T12:00:00Z"));
    expect(tuesday.slug).toBe("2026-s44");
    expect(nextMonday.slug).toBe("2026-s44");
    expect(getEditionWeek(new Date("2026-11-03T12:00:00Z")).slug).toBe("2026-s45");
  });

  it("virada de ano ISO", () => {
    expect(getEditionWeek(new Date("2027-01-04T12:00:00Z")).slug).toBe("2026-s53");
    expect(getEditionWeek(new Date("2027-01-11T12:00:00Z")).slug).toBe("2027-s01");
  });
});

describe("formatEditionPeriod", () => {
  it("mesmo mês", () => {
    expect(formatEditionPeriod("2026-10-19", "2026-10-25")).toBe("19 a 25 de out. de 2026");
  });
  it("meses diferentes", () => {
    expect(formatEditionPeriod("2026-09-28", "2026-10-04")).toBe("28 de set. a 4 de out. de 2026");
  });
  it("anos diferentes", () => {
    expect(formatEditionPeriod("2026-12-28", "2027-01-03")).toBe("28 de dez. de 2026 a 3 de jan. de 2027");
  });
  it("datas ausentes", () => {
    expect(formatEditionPeriod(null, null)).toBeNull();
    expect(formatEditionPeriod("2026-10-19", null)).toBe("19 de out. de 2026");
  });
});
