import { beforeEach, describe, expect, it, vi } from "vitest";

const aiMock = vi.hoisted(() => ({
  generateJson: vi.fn(),
  isAiEnabled: vi.fn(() => true),
}));
vi.mock("@/lib/ai", () => aiMock);

import { explainMatchesWithAi } from "./ai-explain";
import { rankMentorCandidates } from "./rank";
import { AREAS, makeCandidate, makeMentee } from "./test-fixtures";

const mentee = makeMentee();
const ranked = rankMentorCandidates(
  mentee,
  [
    makeCandidate({ mentor_id: "aaaa", full_name: "Helena Demo" }),
    makeCandidate({ mentor_id: "bbbb", full_name: "Rita Demo", area_ids: [4], similarity: 0.55 }),
  ],
  { areas: AREAS },
);

beforeEach(() => {
  aiMock.generateJson.mockReset();
  aiMock.isAiEnabled.mockReset();
  aiMock.isAiEnabled.mockReturnValue(true);
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("explainMatchesWithAi", () => {
  it("usa a IA e devolve provedor/modelo", async () => {
    aiMock.generateJson.mockResolvedValue({
      data: {
        ranking: [
          {
            id: "c2",
            score: 95,
            reason: "Ela trabalha com computação aplicada à genética, como você quer.",
            starters: ["Como você uniu as áreas?", "Que linguagem estudar?"],
          },
          {
            id: "c1",
            score: 70,
            reason: "Vocês compartilham ecologia e genética e ela orienta em editais.",
            starters: ["Como montar um projeto?", "Qual edital indicar?"],
          },
        ],
      },
      provider: "gemini",
      model: "gemini-3.5-flash-lite",
    });

    const res = await explainMatchesWithAi(mentee, ranked, { areas: AREAS });
    expect(res.source).toBe("ai");
    expect(res.provider).toBe("gemini");
    expect(res.model).toBe("gemini-3.5-flash-lite");
    expect(res.matches.every((m) => m.source === "ai")).toBe(true);
    expect(res.warning).toBeUndefined();

    const call = aiMock.generateJson.mock.calls[0][0] as { prompt: string; system: string };
    expect(call.prompt).not.toContain("Helena");
    expect(call.prompt).not.toContain("aaaa");
    expect(call.system).toContain("Nunca invente códigos");
  });

  it("sem IA configurada → heurística, sem chamar o modelo", async () => {
    aiMock.isAiEnabled.mockReturnValue(false);
    const res = await explainMatchesWithAi(mentee, ranked, { areas: AREAS });
    expect(res.source).toBe("heuristic");
    expect(res.matches.map((m) => m.mentorId)).toEqual(ranked.map((r) => r.mentorId));
    expect(aiMock.generateJson).not.toHaveBeenCalled();
  });

  it("falha da IA → heurística com aviso, sem lançar", async () => {
    aiMock.generateJson.mockRejectedValue(new Error("429 em todos os provedores"));
    const res = await explainMatchesWithAi(mentee, ranked, { areas: AREAS });
    expect(res.source).toBe("heuristic");
    expect(res.provider).toBeNull();
    expect(res.warning).toMatch(/indisponível/);
    expect(res.matches).toHaveLength(2);
    expect(res.matches[0].reason.length).toBeGreaterThan(10);
  });

  it("resposta só com ids inventados → heurística", async () => {
    aiMock.generateJson.mockResolvedValue({
      data: {
        ranking: [
          {
            id: "c42",
            score: 99,
            reason: "Mentora que não existe na lista enviada.",
            starters: [],
          },
        ],
      },
      provider: "groq",
      model: "openai/gpt-oss-120b",
    });
    const res = await explainMatchesWithAi(mentee, ranked, { areas: AREAS });
    expect(res.source).toBe("heuristic");
    expect(res.matches.map((m) => m.mentorId).sort()).toEqual(["aaaa", "bbbb"]);
    expect(res.warning).toBeDefined();
  });

  it("lista vazia não chama a IA", async () => {
    const res = await explainMatchesWithAi(mentee, []);
    expect(res.matches).toEqual([]);
    expect(aiMock.generateJson).not.toHaveBeenCalled();
  });
});
