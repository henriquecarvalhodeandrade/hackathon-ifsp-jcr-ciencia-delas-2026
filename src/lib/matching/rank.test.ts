import { describe, expect, it } from "vitest";
import {
  MATCH_WEIGHTS,
  SIMILARITY_CEIL,
  SIMILARITY_FLOOR,
  effectiveWeights,
  inferTopicsFromText,
  rankMentorCandidates,
  scoreMentorCandidate,
  scoreSeniorityGap,
  scoreSimilarity,
} from "./rank";
import { AREAS, makeCandidate, makeMentee, similarityFor } from "./test-fixtures";

/** Candidata e mentoranda montadas para que cada componente tenha valor conhecido. */
function exactScenario(similarity: number | null) {
  const mentee = makeMentee({
    area_ids: [1],
    keywords: [],
    mentorship_topics: ["bolsas-editais"],
    mentoring_goals: null,
    career_stage: "masters", // senioridade 2
    meeting_formats: ["online"],
    languages: ["pt"],
    state: "SP",
  });
  const candidate = makeCandidate({
    area_ids: [1], // áreas: sqrt(1/1) = 1
    similarity, // similarityFor(0.5) → componente 0,5
    mentorship_topics: ["bolsas-editais"], // temas: 1/1 = 1 (sem palavras-chave)
    mentoring_offer: null,
    headline: null,
    keywords: [],
    career_stage: "professor", // senioridade 5 → diferença 3 → 1
    meeting_formats: ["online"],
    languages: ["pt"],
    state: "SP",
    open_slots: 3, // compatibilidade: 0.35 + 0.35 + 0.15 + 0.15 = 1
  });
  return { mentee, candidate };
}

describe("pesos", () => {
  it("seguem a especificação (pesos relativos; sem trajetória, os cinco somam 100%)", () => {
    expect(MATCH_WEIGHTS).toEqual({
      areas: 0.35,
      similarity: 0.3,
      topics: 0.15,
      seniority: 0.1,
      compatibility: 0.1,
      trajectory: 0.1,
    });
    const { trajectory, ...withoutTrajectory } = MATCH_WEIGHTS;
    expect(trajectory).toBe(0.1);
    const total = Object.values(withoutTrajectory).reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(1, 10);
  });

  it("calcula a pontuação exata com todos os componentes", () => {
    const { mentee, candidate } = exactScenario(similarityFor(0.5));
    const r = scoreMentorCandidate(mentee, candidate, { areas: AREAS });
    expect(r.breakdown.components).toEqual({
      areas: 1,
      similarity: expect.closeTo(0.5, 10),
      topics: 1,
      seniority: 1,
      compatibility: expect.closeTo(1, 10),
      trajectory: null,
    });
    // 0.35·1 + 0.30·0.5 + 0.15·1 + 0.10·1 + 0.10·1 = 0.85
    expect(r.breakdown.rawScore).toBeCloseTo(85, 8);
    expect(r.score).toBe(85);
  });

  it("redistribui proporcionalmente o peso da similaridade quando ela é null", () => {
    const { mentee, candidate } = exactScenario(null);
    const r = scoreMentorCandidate(mentee, candidate, { areas: AREAS });
    expect(r.breakdown.components.similarity).toBeNull();
    expect(r.breakdown.weights.similarity).toBe(0);
    expect(r.breakdown.weights.areas).toBeCloseTo(0.35 / 0.7, 10);
    expect(r.breakdown.weights.topics).toBeCloseTo(0.15 / 0.7, 10);
    expect(r.breakdown.weights.seniority).toBeCloseTo(0.1 / 0.7, 10);
    expect(r.breakdown.weights.compatibility).toBeCloseTo(0.1 / 0.7, 10);
    const sum = Object.values(r.breakdown.weights).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 10);
    // Todos os componentes aplicáveis valem 1 → 100.
    expect(r.score).toBe(100);
  });

  it("effectiveWeights redistribui vários componentes ausentes", () => {
    const w = effectiveWeights({
      areas: 0.5,
      similarity: null,
      topics: null,
      seniority: 1,
      compatibility: 1,
    });
    expect(w.areas).toBeCloseTo(0.35 / 0.55, 10);
    expect(w.seniority).toBeCloseTo(0.1 / 0.55, 10);
    expect(w.topics).toBe(0);
    expect(w.similarity).toBe(0);
  });

  it("componentes inaplicáveis por falta de dados da mentoranda viram null", () => {
    const mentee = makeMentee({
      area_ids: [],
      keywords: [],
      mentorship_topics: [],
      mentoring_goals: null,
    });
    const r = scoreMentorCandidate(mentee, makeCandidate(), { areas: AREAS });
    expect(r.breakdown.components.areas).toBeNull();
    expect(r.breakdown.components.topics).toBeNull();
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
  });
});

describe("componentes", () => {
  it("similaridade é reescalada e limitada a 0..1", () => {
    expect(scoreSimilarity(null)).toBeNull();
    expect(scoreSimilarity(0.2)).toBe(0);
    expect(scoreSimilarity(SIMILARITY_FLOOR)).toBe(0);
    expect(scoreSimilarity(similarityFor(0.5))).toBeCloseTo(0.5, 10);
    expect(scoreSimilarity(SIMILARITY_CEIL)).toBeCloseTo(1, 10);
    expect(scoreSimilarity(0.95)).toBe(1);
    expect(scoreSimilarity(1.2)).toBe(1);
    expect(scoreSimilarity(Number.NaN)).toBeNull();
  });

  it("calibração com embeddings reais (docs/04 §4.1): separa pares relacionados dos sem relação", () => {
    expect([SIMILARITY_FLOOR, SIMILARITY_CEIL]).toEqual([0.78, 0.87]);
    // Percentis medidos nos 216 pares do seed (gemini-embedding-2, 768 dim.).
    const different = { p50: 0.789, p90: 0.82 };
    const sameArea = { p25: 0.829, p50: 0.844, p75: 0.865 };
    expect(scoreSimilarity(different.p50)).toBeLessThan(0.15); // sem relação típico ≈ 0,1
    expect(scoreSimilarity(different.p90)).toBeLessThan(0.5);
    expect(scoreSimilarity(sameArea.p25)).toBeGreaterThan(0.5);
    expect(scoreSimilarity(sameArea.p50)).toBeGreaterThan(0.65); // relacionado típico ≈ 0,7
    expect(scoreSimilarity(sameArea.p75)).toBeGreaterThan(0.9);
    // Com a faixa antiga (0,5–0,9), o par sem relação típico valia ~0,72.
    expect((different.p50 - 0.5) / 0.4).toBeGreaterThan(0.7);
  });

  it("senioridade: mentora precisa estar à frente, ideal de 1 a 3 etapas", () => {
    expect(scoreSeniorityGap(null)).toBeNull();
    expect(scoreSeniorityGap(-2)).toBe(0);
    expect(scoreSeniorityGap(0)).toBe(0);
    expect(scoreSeniorityGap(1)).toBe(1);
    expect(scoreSeniorityGap(3)).toBe(1);
    expect(scoreSeniorityGap(4)).toBe(0.6);
    expect(scoreSeniorityGap(5)).toBe(0.4);
  });

  it("usa a senioridade de CAREER_STAGES (mestrado → docente = 3; graduação mentorando mestrado = -1)", () => {
    const mentee = makeMentee({ career_stage: "masters" });
    expect(
      scoreMentorCandidate(mentee, makeCandidate({ career_stage: "professor" })).breakdown
        .seniorityGap,
    ).toBe(3);
    const junior = scoreMentorCandidate(mentee, makeCandidate({ career_stage: "undergraduate" }));
    expect(junior.breakdown.seniorityGap).toBe(-1);
    expect(junior.breakdown.components.seniority).toBe(0);
    const unknown = scoreMentorCandidate(mentee, makeCandidate({ career_stage: null }));
    expect(unknown.breakdown.components.seniority).toBeNull();
  });

  it("dá crédito parcial para a mesma grande área sem área em comum", () => {
    const mentee = makeMentee({ area_ids: [1] });
    const sameBig = scoreMentorCandidate(mentee, makeCandidate({ area_ids: [3] }), {
      areas: AREAS,
    });
    const otherBig = scoreMentorCandidate(mentee, makeCandidate({ area_ids: [4] }), {
      areas: AREAS,
    });
    expect(sameBig.breakdown.components.areas).toBe(0.3);
    expect(sameBig.breakdown.sameBigArea).toBe(true);
    expect(otherBig.breakdown.components.areas).toBe(0);
  });

  it("áreas: a primeira em comum pesa mais (raiz quadrada) e satura em 3", () => {
    const mentee = makeMentee({ area_ids: [1, 2, 3, 4] });
    const one = scoreMentorCandidate(mentee, makeCandidate({ area_ids: [1] }));
    const three = scoreMentorCandidate(mentee, makeCandidate({ area_ids: [1, 2, 3] }));
    expect(one.breakdown.components.areas).toBeCloseTo(Math.sqrt(1 / 3), 10);
    expect(three.breakdown.components.areas).toBe(1);
  });

  it("formato híbrido é compatível com on-line e presencial", () => {
    const mentee = makeMentee({ meeting_formats: ["in_person"] });
    const hybrid = scoreMentorCandidate(mentee, makeCandidate({ meeting_formats: ["hybrid"] }));
    const online = scoreMentorCandidate(mentee, makeCandidate({ meeting_formats: ["online"] }));
    expect(hybrid.breakdown.formatOverlap).toEqual(["hybrid"]);
    expect(online.breakdown.formatOverlap).toEqual([]);
    expect(hybrid.breakdown.components.compatibility!).toBeGreaterThan(
      online.breakdown.components.compatibility!,
    );
  });

  it("palavras-chave casam sem acento e também no texto da oferta", () => {
    const mentee = makeMentee({
      keywords: ["Genomica", "aprendizado de máquina"],
      mentorship_topics: [],
    });
    const r = scoreMentorCandidate(
      mentee,
      makeCandidate({
        keywords: ["genômica"],
        mentoring_offer: "Trabalho com aprendizado de maquina aplicado.",
      }),
    );
    expect(r.breakdown.sharedKeywords).toEqual(["Genomica", "aprendizado de máquina"]);
  });

  it("infere temas de mentoria a partir de texto livre", () => {
    expect(inferTopicsFromText("Posso ajudar com editais da FAPESP e escrita de artigos")).toEqual(
      expect.arrayContaining(["bolsas-editais", "escrita-cientifica"]),
    );
    expect(inferTopicsFromText("")).toEqual([]);
    expect(inferTopicsFromText(null)).toEqual([]);
  });
});

describe("rankMentorCandidates", () => {
  const mentee = makeMentee();
  const strong = makeCandidate({ mentor_id: "id-strong" });
  const medium = makeCandidate({
    mentor_id: "id-medium",
    area_ids: [3],
    similarity: 0.6,
    mentorship_topics: ["networking"],
    keywords: [],
    mentoring_offer: null,
    career_stage: "phd",
    state: "RJ",
  });
  const junior = makeCandidate({
    mentor_id: "id-junior",
    career_stage: "undergraduate",
    area_ids: [5],
    similarity: 0.4,
  });

  it("ordena da melhor para a pior candidata", () => {
    const ranked = rankMentorCandidates(mentee, [junior, medium, strong], { areas: AREAS });
    expect(ranked.map((r) => r.mentorId)).toEqual(["id-strong", "id-medium", "id-junior"]);
    for (const r of ranked) {
      expect(Number.isInteger(r.score)).toBe(true);
      expect(r.score).toBeGreaterThanOrEqual(0);
      expect(r.score).toBeLessThanOrEqual(100);
    }
  });

  it("é determinística: empates resolvidos pelo id, independente da ordem de entrada", () => {
    const a = makeCandidate({ mentor_id: "aaa" });
    const b = makeCandidate({ mentor_id: "bbb" });
    const c = makeCandidate({ mentor_id: "ccc" });
    const r1 = rankMentorCandidates(mentee, [c, a, b], { areas: AREAS });
    const r2 = rankMentorCandidates(mentee, [b, c, a], { areas: AREAS });
    expect(r1.map((r) => r.mentorId)).toEqual(["aaa", "bbb", "ccc"]);
    expect(r2).toEqual(r1);
  });

  it("remove a própria mentoranda e duplicatas", () => {
    const self = makeCandidate({ mentor_id: mentee.id });
    const ranked = rankMentorCandidates(mentee, [strong, self, strong], { areas: AREAS });
    expect(ranked.map((r) => r.mentorId)).toEqual(["id-strong"]);
  });

  it("não altera a lista de entrada", () => {
    const input = [junior, strong];
    const copy = structuredClone(input);
    rankMentorCandidates(mentee, input, { areas: AREAS });
    expect(input).toEqual(copy);
  });

  it("gera 2 a 3 motivos em pt-BR sem citar nome, e-mail ou instituição", () => {
    const ranked = rankMentorCandidates(mentee, [strong, medium, junior], { areas: AREAS });
    for (const r of ranked) {
      expect(r.reasons.length).toBeGreaterThanOrEqual(2);
      expect(r.reasons.length).toBeLessThanOrEqual(3);
      const text = r.reasons.join(" ");
      expect(text).not.toContain("Helena");
      expect(text).not.toContain("@");
      expect(text).not.toContain("Universidade Fictícia");
    }
    expect(ranked[0].reasons[0]).toBe("Vocês compartilham as áreas de Ecologia e Genética.");
    expect(ranked[0].reasons).toContain(
      "Ela pode ajudar com “Bolsas e editais” e “Escrita e publicação científica”, temas que você quer desenvolver.",
    );
  });

  it("motivos citam a senioridade quando a diferença é adequada", () => {
    const r = scoreMentorCandidate(
      makeMentee({ area_ids: [], mentorship_topics: [], keywords: [], mentoring_goals: null }),
      makeCandidate({ career_stage: "phd", similarity: null }),
      { areas: AREAS },
    );
    expect(r.reasons.join(" ")).toContain("Está um passo à frente na carreira (Doutorado)");
  });
});
