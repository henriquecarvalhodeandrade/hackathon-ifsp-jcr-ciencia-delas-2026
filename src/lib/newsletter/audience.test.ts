import { describe, expect, it } from "vitest";
import {
  buildBigAreaMap,
  chunk,
  claimMarker,
  isClaimActive,
  planDeliveries,
  type AudienceSubscriber,
} from "./audience";

const AREAS = [
  { id: 1, name: "Ciências Exatas e da Terra", big_area: "Ciências Exatas e da Terra" },
  { id: 2, name: "Ciências Biológicas", big_area: "Ciências Biológicas" },
  { id: 3, name: "Engenharias", big_area: "Engenharias" },
  { id: 10, name: "Ciência da Computação", big_area: "Ciências Exatas e da Terra" },
  { id: 11, name: "Ecologia", big_area: "Ciências Biológicas" },
];
const bigAreaMap = buildBigAreaMap(AREAS);
const NOW = new Date("2026-10-26T12:00:00Z");

function sub(id: string, area_ids: number[] = []): AudienceSubscriber {
  return { id, email: `${id}@exemplo.org`, area_ids, unsubscribe_token: `tok-${id}` };
}

describe("buildBigAreaMap", () => {
  it("leva subárea e grande área para o id da grande área", () => {
    expect(bigAreaMap.get(10)).toBe(1);
    expect(bigAreaMap.get(1)).toBe(1);
    expect(bigAreaMap.get(11)).toBe(2);
  });
});

describe("planDeliveries", () => {
  it("filtra por área (subárea do paper casa com a grande área da inscrita)", () => {
    const plan = planDeliveries({
      subscribers: [sub("todas"), sub("exatas", [1]), sub("bio", [2]), sub("eng", [3])],
      deliveries: [],
      editionAreaIds: [10, 11],
      bigAreaMap,
      maxPerRun: 90,
      now: NOW,
    });
    expect(plan.toSend.map((s) => s.id)).toEqual(["todas", "exatas", "bio"]);
    expect(plan.outsideAreas).toBe(1);
  });

  it("edição sem papers só vai para quem não escolheu áreas", () => {
    const plan = planDeliveries({
      subscribers: [sub("todas"), sub("exatas", [1])],
      deliveries: [],
      editionAreaIds: [],
      bigAreaMap,
      maxPerRun: 90,
      now: NOW,
    });
    expect(plan.toSend.map((s) => s.id)).toEqual(["todas"]);
  });

  it("nunca reenvia: pula entregues e envios em andamento; retoma falhas e reivindicações vencidas", () => {
    const plan = planDeliveries({
      subscribers: [sub("a"), sub("b"), sub("c"), sub("d"), sub("e")],
      deliveries: [
        { subscriber_id: "a", sent_at: "2026-10-26T11:00:00Z", error: null },
        { subscriber_id: "b", sent_at: null, error: claimMarker(new Date(NOW.getTime() - 60_000)) },
        {
          subscriber_id: "c",
          sent_at: null,
          error: claimMarker(new Date(NOW.getTime() - 60 * 60_000)),
        },
        { subscriber_id: "d", sent_at: null, error: "Resend respondeu 500" },
      ],
      editionAreaIds: [],
      bigAreaMap,
      maxPerRun: 90,
      now: NOW,
    });
    expect(plan.alreadySent).toBe(1);
    expect(plan.inProgress).toBe(1);
    expect(plan.toSend.map((s) => s.id)).toEqual(["c", "d", "e"]);
    expect([...plan.retryIds].sort()).toEqual(["c", "d"]);
  });

  it("respeita o teto por execução e informa o que ficou para depois", () => {
    const subscribers = Array.from({ length: 95 }, (_, i) => sub(`s${i}`));
    const plan = planDeliveries({
      subscribers,
      deliveries: [],
      editionAreaIds: [],
      bigAreaMap,
      maxPerRun: 90,
      now: NOW,
    });
    expect(plan.toSend).toHaveLength(90);
    expect(plan.eligible).toBe(95);
    expect(plan.remaining).toBe(5);
  });
});

describe("isClaimActive", () => {
  it("só vale para o marcador recente", () => {
    expect(isClaimActive(claimMarker(NOW), NOW)).toBe(true);
    expect(isClaimActive(claimMarker(new Date(NOW.getTime() - 16 * 60_000)), NOW)).toBe(false);
    expect(isClaimActive("Resend respondeu 429", NOW)).toBe(false);
    expect(isClaimActive("em_andamento:lixo", NOW)).toBe(false);
    expect(isClaimActive(null, NOW)).toBe(false);
  });
});

describe("chunk", () => {
  it("quebra em lotes", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 100)).toEqual([]);
  });
});
