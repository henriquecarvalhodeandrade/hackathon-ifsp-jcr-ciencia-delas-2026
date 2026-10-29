import { describe, expect, it } from "vitest";
import {
  firstNameOf,
  networkCountItems,
  networkTabHref,
  parseNetworkTab,
  suggestionReason,
  suggestionReasonParts,
  SUGGESTION_FALLBACK_REASON,
  toNetworkCounts,
} from "./presentation";

describe("suggestionReason", () => {
  it("junta os três sinais na ordem de peso", () => {
    expect(
      suggestionReason({ shared_areas: 3, mutual_connections: 2, same_institution: true }),
    ).toBe("3 áreas em comum · 2 conexões em comum · Mesma instituição");
  });

  it("usa o singular", () => {
    expect(
      suggestionReason({ shared_areas: 1, mutual_connections: 1, same_institution: false }),
    ).toBe("1 área em comum · 1 conexão em comum");
  });

  it("omite zeros", () => {
    expect(
      suggestionReason({ shared_areas: 0, mutual_connections: 4, same_institution: true }),
    ).toBe("4 conexões em comum · Mesma instituição");
    expect(
      suggestionReason({ shared_areas: 2, mutual_connections: 0, same_institution: null }),
    ).toBe("2 áreas em comum");
  });

  it("só a instituição", () => {
    expect(
      suggestionReason({ shared_areas: 0, mutual_connections: 0, same_institution: true }),
    ).toBe("Mesma instituição");
  });

  it("nada em comum → texto padrão", () => {
    expect(
      suggestionReason({ shared_areas: 0, mutual_connections: 0, same_institution: false }),
    ).toBe(SUGGESTION_FALLBACK_REASON);
    expect(
      suggestionReason({
        shared_areas: null,
        mutual_connections: undefined,
        same_institution: null,
      }),
    ).toBe(SUGGESTION_FALLBACK_REASON);
    expect(
      suggestionReasonParts({ shared_areas: 0, mutual_connections: 0, same_institution: false }),
    ).toEqual([]);
  });

  it("ignora valores negativos e formata milhares em pt-BR", () => {
    expect(
      suggestionReason({ shared_areas: -2, mutual_connections: 1200, same_institution: false }),
    ).toBe("1.200 conexões em comum");
  });
});

describe("abas", () => {
  it("aceita só abas conhecidas", () => {
    expect(parseNetworkTab("convites")).toBe("convites");
    expect(parseNetworkTab(["seguidoras", "x"])).toBe("seguidoras");
    expect(parseNetworkTab("admin")).toBeNull();
    expect(parseNetworkTab(undefined)).toBeNull();
  });

  it("a aba padrão não leva ?aba=", () => {
    expect(networkTabHref("sugestoes")).toBe("/rede");
    expect(networkTabHref("conexoes")).toBe("/rede?aba=conexoes");
  });
});

describe("números", () => {
  it("normaliza a linha da RPC", () => {
    expect(toNetworkCounts(null)).toEqual({ connections: 0, followers: 0, following: 0 });
    expect(toNetworkCounts({ connections: 3, followers: null, following: -1 })).toEqual({
      connections: 3,
      followers: 0,
      following: 0,
    });
  });

  it("rótulos no singular e no plural", () => {
    expect(
      networkCountItems({ connections: 1, followers: 1, following: 1 }).map((i) => i.label),
    ).toEqual(["conexão", "seguidora", "seguindo"]);
    expect(
      networkCountItems({ connections: 0, followers: 5, following: 2 }).map((i) => i.label),
    ).toEqual(["conexões", "seguidoras", "seguindo"]);
  });
});

describe("firstNameOf", () => {
  it("pula títulos", () => {
    expect(firstNameOf("Dra. Marina Souza")).toBe("Marina");
    expect(firstNameOf("  ")).toBe("");
    expect(firstNameOf(null)).toBe("");
  });
});
