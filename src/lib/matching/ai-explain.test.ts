import { beforeEach, describe, expect, it, vi } from "vitest";

const aiMock = vi.hoisted(() => ({
  generateJson: vi.fn(),
  isAiEnabled: vi.fn(() => true),
}));
vi.mock("@/lib/ai", () => aiMock);

import { GEMINI_EXPLAIN_OK, GEMINI_EXPLAIN_UNACCENTED } from "@/lib/ai/fixtures/gemini-responses";
import { countUnaccentedWords } from "@/lib/ai/text";
import { explainMatchesWithAi } from "./ai-explain";
import { heuristicExplanation, type ExplainResponse } from "./pseudonymize";
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

  it("pede a revisão de acentos: a resposta real sem acentos é reprovada, a com acentos passa", async () => {
    aiMock.generateJson.mockResolvedValue({
      data: { ranking: [] },
      provider: "gemini",
      model: "gemini-3.5-flash-lite",
    });
    await explainMatchesWithAi(mentee, ranked, { areas: AREAS });
    const { validate, prompt } = aiMock.generateJson.mock.calls[0][0] as {
      validate: (d: ExplainResponse) => string | null;
      prompt: string;
    };
    const parse = (body: typeof GEMINI_EXPLAIN_OK) =>
      JSON.parse(body.candidates[0].content.parts[0].text) as ExplainResponse;
    expect(validate(parse(GEMINI_EXPLAIN_UNACCENTED))).toMatch(/sem acentos/);
    expect(validate(parse(GEMINI_EXPLAIN_OK))).toBeNull();
    // O formato pedido traz um exemplo COM acentos (sem ele, o flash-lite "achatava" o texto).
    expect(prompt).toMatch(/com os acentos:\n\{"ranking"/);
    expect(prompt).toContain("você");
  });

  it("os textos da heurística nunca parecem 'sem acentos'", () => {
    for (const r of ranked) {
      const h = heuristicExplanation(mentee, r, AREAS);
      expect(
        countUnaccentedWords([h.reason, ...h.reasons, ...h.conversationStarters].join(" ")),
      ).toBe(0);
    }
  });

  it("lista vazia não chama a IA", async () => {
    const res = await explainMatchesWithAi(mentee, []);
    expect(res.matches).toEqual([]);
    expect(aiMock.generateJson).not.toHaveBeenCalled();
  });
});
