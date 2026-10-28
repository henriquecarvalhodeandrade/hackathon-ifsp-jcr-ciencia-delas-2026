import { beforeEach, describe, expect, it, vi } from "vitest";

const aiMock = vi.hoisted(() => ({
  generateJson: vi.fn(),
  isAiEnabled: vi.fn(() => true),
}));
vi.mock("@/lib/ai", () => aiMock);

import { TRAJECTORY_MARKS } from "@/lib/trajectory/catalog";
import { explainMatchesWithAi } from "./ai-explain";
import { buildProfileText } from "./profile-text";
import { buildExplainPrompt, buildMenteePayload, pseudonymizeCandidates } from "./pseudonymize";
import { rankMentorCandidates } from "./rank";
import { AREAS, makeCandidate, makeMentee } from "./test-fixtures";
import type { MenteeForMatching, MentorCandidate } from "./types";

/**
 * LGPD (docs/17): marcas de trajetória NUNCA vão para a IA — nem os slugs, nem os rótulos, nem
 * as frases, nem a nota com o bônus. O pedido à IA é idêntico, byte a byte, ao de quem não
 * declarou nada.
 */

const ALL_TAGS = TRAJECTORY_MARKS.map((m) => m.slug);

/** Tudo o que denunciaria uma marca dentro de um texto. */
const FORBIDDEN = [
  ...TRAJECTORY_MARKS.flatMap((m) => [m.slug, m.label, m.chip, m.shared]),
  "trajet",
  "Vocês têm em comum",
  "primeira da família",
  "primeiras da família",
  "escola pública",
  "ensino técnico",
  "cuidadora",
  "fora das capitais",
];

function expectNoMarks(text: string) {
  for (const forbidden of FORBIDDEN) {
    expect(text.toLowerCase()).not.toContain(forbidden.toLowerCase());
  }
}

const mentee: MenteeForMatching = makeMentee({ trajectory_tags: ALL_TAGS });
const candidates: MentorCandidate[] = [
  makeCandidate({ mentor_id: "11111111-1111-4111-8111-111111111111", trajectory_tags: ALL_TAGS }),
  makeCandidate({
    mentor_id: "22222222-2222-4222-8222-222222222222",
    full_name: "Beatriz Exemplo Lima",
    area_ids: [3],
    similarity: 0.6,
    career_stage: "phd",
    trajectory_tags: ["primeira-geracao", "escola-publica"],
  }),
];
const consent = new Map(candidates.map((c) => [c.mentor_id, true] as const));

function promptFor(m: MenteeForMatching, list: MentorCandidate[]): string {
  const ranked = rankMentorCandidates(m, list, { areas: AREAS });
  const { payload } = pseudonymizeCandidates(ranked, { areas: AREAS, consentByMentorId: consent });
  return buildExplainPrompt(buildMenteePayload(m, AREAS), payload);
}

const withoutMarks = {
  mentee: { ...mentee, trajectory_tags: [] },
  candidates: candidates.map((c) => ({ ...c, trajectory_tags: null })),
};

beforeEach(() => {
  aiMock.generateJson.mockReset();
  aiMock.isAiEnabled.mockReturnValue(true);
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("marcas de trajetória nunca chegam à IA", () => {
  it("o prompt não contém slugs, rótulos nem frases (mesmo com consentimento de todas)", () => {
    const ranked = rankMentorCandidates(mentee, candidates, { areas: AREAS });
    // As marcas existem e mudaram o ranking heurístico...
    expect(ranked.every((r) => r.breakdown.sharedTrajectory.length > 0)).toBe(true);
    expect(ranked.some((r) => r.reasons.join(" ").includes("Vocês têm em comum"))).toBe(true);
    // ...mas nada disso vai no pedido.
    expectNoMarks(promptFor(mentee, candidates));
  });

  it("o prompt é idêntico ao de quem não declarou marca nenhuma (inclusive a nota)", () => {
    const ranked = rankMentorCandidates(mentee, candidates, { areas: AREAS });
    const plain = rankMentorCandidates(withoutMarks.mentee, withoutMarks.candidates, {
      areas: AREAS,
    });
    expect(ranked.map((r) => r.mentorId)).toEqual(plain.map((r) => r.mentorId));
    // O bônus existe no servidor...
    ranked.forEach((r, i) =>
      expect(r.breakdown.rawScore).toBeGreaterThan(plain[i].breakdown.rawScore),
    );
    expect(promptFor(mentee, candidates)).toBe(
      promptFor(withoutMarks.mentee, withoutMarks.candidates),
    );
    const { payload } = pseudonymizeCandidates(ranked, { areas: AREAS });
    expect(payload.map((p) => p.nota_heuristica)).toEqual(plain.map((r) => r.score));
  });

  it("o pedido real ao modelo (system + prompt) não leva nenhuma marca", async () => {
    aiMock.generateJson.mockResolvedValue({
      data: { ranking: [] },
      provider: "gemini",
      model: "teste",
    });
    const ranked = rankMentorCandidates(mentee, candidates, { areas: AREAS });
    await explainMatchesWithAi(mentee, ranked, { areas: AREAS, consentByMentorId: consent });
    expect(aiMock.generateJson).toHaveBeenCalledTimes(1);
    const request = aiMock.generateJson.mock.calls[0][0] as { system: string; prompt: string };
    expectNoMarks(`${request.system}\n${request.prompt}`);
  });

  it("o texto do embedding do perfil também não leva marcas", () => {
    const text = buildProfileText(
      {
        full_name: "Ana Teste",
        headline: "Mestranda em ecologia",
        career_stage: "masters",
        keywords: ["polinização"],
        mentorship_topics: ["metodologia"],
        mentoring_goals: "Quero aprender desenho amostral.",
        is_mentor: false,
        // Campo extra de propósito: o construtor só lê os campos acadêmicos.
        ...({ trajectory_tags: ALL_TAGS } as object),
      },
      ["Ecologia"],
    );
    expect(text).toContain("Ecologia");
    expectNoMarks(text);
  });
});
