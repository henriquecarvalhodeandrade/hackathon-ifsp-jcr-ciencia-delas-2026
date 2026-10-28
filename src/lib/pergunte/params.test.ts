import { describe, expect, it } from "vitest";
import {
  filterHref,
  filterParams,
  parseAreaId,
  parsePage,
  parseQuestionFilters,
  parseStage,
} from "./params";

describe("filtros de /pergunte", () => {
  it("etapa: só valores do banco", () => {
    expect(parseStage("graduacao")).toBe("graduacao");
    expect(parseStage(["ensino_medio_tecnico", "outro"])).toBe("ensino_medio_tecnico");
    expect(parseStage("doutorado")).toBeNull();
    expect(parseStage(undefined)).toBeNull();
  });

  it("área: inteiro positivo de smallint, opcionalmente entre as que existem", () => {
    expect(parseAreaId("3")).toBe(3);
    expect(parseAreaId("0")).toBeNull();
    expect(parseAreaId("-1")).toBeNull();
    expect(parseAreaId("3.5")).toBeNull();
    expect(parseAreaId("99999")).toBeNull();
    expect(parseAreaId("abc")).toBeNull();
    expect(parseAreaId("3", new Set([1, 2]))).toBeNull();
    expect(parseAreaId("2", new Set([1, 2]))).toBe(2);
  });

  it("página", () => {
    expect(parsePage("2")).toBe(2);
    expect(parsePage("0")).toBe(1);
    expect(parsePage("x")).toBe(1);
    expect(parsePage("5000", 100)).toBe(100);
  });

  it("junta tudo", () => {
    expect(parseQuestionFilters({ etapa: "outro", area: "9", pagina: "3" })).toEqual({
      stage: "outro",
      areaId: 9,
      page: 3,
    });
    expect(parseQuestionFilters({})).toEqual({ stage: null, areaId: null, page: 1 });
  });

  it("links de filtro voltam à primeira página e ancoram na lista", () => {
    expect(filterParams({ stage: "graduacao", areaId: 2 })).toEqual({
      etapa: "graduacao",
      area: "2",
    });
    expect(filterHref({ stage: null, areaId: null })).toBe("/pergunte#perguntas-respondidas");
    expect(filterHref({ stage: "outro", areaId: 4 })).toBe(
      "/pergunte?etapa=outro&area=4#perguntas-respondidas",
    );
  });
});
