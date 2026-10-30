import { describe, expect, it } from "vitest";
import {
  effectiveWeights,
  rankMentorCandidates,
  scoreMentorCandidate,
  scoreTrajectory,
  scoreWithoutTrajectory,
} from "./rank";
import { AREAS, makeCandidate, makeMentee, similarityFor } from "./test-fixtures";
import type { MatchComponent, MenteeForMatching, MentorCandidate } from "./types";

/**
 * Afinidade de trajetória no ranking heurístico (docs/17): só soma quando há marca em comum,
 * nunca penaliza quem não declarou (ou declarou outras marcas) e satura em 2 marcas.
 */

const FIRST_GEN = "Vocês têm em comum: as duas foram as primeiras da família na universidade.";

function sum(weights: Record<MatchComponent, number>): number {
  return Object.values(weights).reduce((a, b) => a + b, 0);
}

/** Pseudoaleatório determinístico (mulberry32) para os cenários de propriedade. */
function rng(seed: number) {
  let t = seed;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

describe("scoreTrajectory", () => {
  it("é vazio quando uma das duas não declarou nada", () => {
    expect(scoreTrajectory([], ["primeira-geracao"])).toEqual({ shared: [], coverage: 0 });
    expect(scoreTrajectory(["primeira-geracao"], null)).toEqual({ shared: [], coverage: 0 });
    expect(scoreTrajectory(undefined, undefined)).toEqual({ shared: [], coverage: 0 });
  });

  it("é vazio quando as duas declararam marcas diferentes", () => {
    expect(scoreTrajectory(["mae-cuidadora"], ["ensino-tecnico"])).toEqual({
      shared: [],
      coverage: 0,
    });
  });

  it("cobertura = em comum ÷ min(marcas da mentoranda, 2), saturando em 2", () => {
    const three = ["primeira-geracao", "escola-publica", "ensino-tecnico"];
    expect(scoreTrajectory(three, ["primeira-geracao"]).coverage).toBe(0.5);
    expect(scoreTrajectory(three, ["primeira-geracao", "escola-publica"]).coverage).toBe(1);
    expect(scoreTrajectory(three, three).coverage).toBe(1);
    // Uma marca só já é afinidade plena para quem declarou uma.
    expect(scoreTrajectory(["mae-cuidadora"], ["mae-cuidadora", "mudanca-de-area"]).coverage).toBe(
      1,
    );
  });

  it("ignora marcas fora do catálogo e repetidas; devolve na ordem do catálogo", () => {
    const r = scoreTrajectory(
      ["escola-publica", "inventada", "primeira-geracao", "primeira-geracao"],
      ["primeira-geracao", "escola-publica", "inventada"],
    );
    expect(r.shared).toEqual(["primeira-geracao", "escola-publica"]);
    expect(r.coverage).toBe(1);
  });
});

describe("sem marcas, nada muda", () => {
  const mentees: MenteeForMatching[] = [
    makeMentee(),
    makeMentee({ area_ids: [], keywords: [], mentorship_topics: [], mentoring_goals: null }),
    makeMentee({ career_stage: "undergraduate", area_ids: [4], state: "RJ" }),
  ];
  const candidates: MentorCandidate[] = [
    makeCandidate({ mentor_id: "m-1" }),
    makeCandidate({ mentor_id: "m-2", area_ids: [3], similarity: null, career_stage: "phd" }),
    makeCandidate({ mentor_id: "m-3", area_ids: [4], similarity: 0.6, state: "MG" }),
  ];

  it("pontuação, ordem, motivos e pesos são idênticos com e sem a coluna", () => {
    for (const mentee of mentees) {
      const before = rankMentorCandidates(mentee, candidates, { areas: AREAS });
      const after = rankMentorCandidates(
        { ...mentee, trajectory_tags: [] },
        candidates.map((c) => ({ ...c, trajectory_tags: [] })),
        { areas: AREAS },
      );
      expect(after.map((r) => r.mentorId)).toEqual(before.map((r) => r.mentorId));
      after.forEach((r, i) => {
        expect(r.breakdown.rawScore).toBe(before[i].breakdown.rawScore);
        expect(r.score).toBe(before[i].score);
        expect(r.reasons).toEqual(before[i].reasons);
        expect(r.breakdown.weights).toEqual(before[i].breakdown.weights);
        expect(r.breakdown.components.trajectory).toBeNull();
        expect(r.breakdown.weights.trajectory).toBe(0);
        expect(r.breakdown.sharedTrajectory).toEqual([]);
      });
    }
  });

  it("marca de um lado só (ou marcas diferentes) não muda a nota de ninguém", () => {
    const mentee = makeMentee();
    const base = scoreMentorCandidate(mentee, makeCandidate(), { areas: AREAS });
    const onlyMentor = scoreMentorCandidate(
      mentee,
      makeCandidate({ trajectory_tags: ["primeira-geracao", "mae-cuidadora"] }),
      { areas: AREAS },
    );
    const onlyMentee = scoreMentorCandidate(
      { ...mentee, trajectory_tags: ["primeira-geracao"] },
      makeCandidate(),
      { areas: AREAS },
    );
    const different = scoreMentorCandidate(
      { ...mentee, trajectory_tags: ["ensino-tecnico"] },
      makeCandidate({ trajectory_tags: ["mae-cuidadora"] }),
      { areas: AREAS },
    );
    for (const r of [onlyMentor, onlyMentee, different]) {
      expect(r.breakdown.components.trajectory).toBeNull();
      expect(r.breakdown.rawScore).toBe(base.breakdown.rawScore);
      expect(r.reasons).toEqual(base.reasons);
      expect(r.reasons.join(" ")).not.toContain("em comum:");
    }
  });
});

describe("com marcas em comum", () => {
  // Candidata mediana (sem área em comum), para o motivo de trajetória disputar o topo.
  const mentee = makeMentee({
    area_ids: [1],
    keywords: [],
    mentorship_topics: ["bolsas-editais"],
    mentoring_goals: null,
    career_stage: "undergraduate",
    trajectory_tags: ["primeira-geracao", "escola-publica", "ensino-tecnico"],
  });
  const plain = makeCandidate({
    mentor_id: "m-plain",
    area_ids: [4],
    similarity: null,
    mentorship_topics: ["networking"],
    mentoring_offer: null,
    keywords: [],
    career_stage: "professor",
  });
  const one = { ...plain, mentor_id: "m-one", trajectory_tags: ["primeira-geracao"] };
  const two = {
    ...plain,
    mentor_id: "m-two",
    trajectory_tags: ["escola-publica", "primeira-geracao", "mudanca-de-area"],
  };
  const three = {
    ...plain,
    mentor_id: "m-three",
    trajectory_tags: ["primeira-geracao", "escola-publica", "ensino-tecnico"],
  };

  it("dá um bônus pequeno e explicado, só com sobreposição", () => {
    const none = scoreMentorCandidate(mentee, plain, { areas: AREAS });
    const shared = scoreMentorCandidate(mentee, one, { areas: AREAS });
    expect(none.breakdown.components.trajectory).toBeNull();
    expect(shared.breakdown.components.trajectory).toBe(1);
    expect(shared.breakdown.sharedTrajectory).toEqual(["primeira-geracao"]);
    expect(shared.breakdown.rawScore).toBeGreaterThan(none.breakdown.rawScore);
    // "Pequeno": no máximo 0,10 de peso relativo → nunca mais que ~12,5 pontos.
    expect(shared.breakdown.rawScore - none.breakdown.rawScore).toBeLessThan(12.5);
    expect(shared.reasons).toContain(FIRST_GEN);
    expect(none.reasons.join(" ")).not.toContain("Vocês têm em comum");
  });

  it("junta até 2 marcas numa frase só, com o sujeito uma vez", () => {
    const r = scoreMentorCandidate(mentee, three, { areas: AREAS });
    expect(r.breakdown.sharedTrajectory).toEqual([
      "primeira-geracao",
      "escola-publica",
      "ensino-tecnico",
    ]);
    expect(r.reasons).toContain(
      "Vocês têm em comum: as duas foram as primeiras da família na universidade e estudaram em escola pública.",
    );
  });

  it("satura em 2 marcas em comum", () => {
    const rOne = scoreMentorCandidate(mentee, one, { areas: AREAS });
    const rTwo = scoreMentorCandidate(mentee, two, { areas: AREAS });
    const rThree = scoreMentorCandidate(mentee, three, { areas: AREAS });
    expect(rTwo.breakdown.rawScore).toBeGreaterThan(rOne.breakdown.rawScore);
    expect(rThree.breakdown.rawScore).toBe(rTwo.breakdown.rawScore);
    expect(rThree.breakdown.weights).toEqual(rTwo.breakdown.weights);
    // Uma marca de três declaradas = metade do peso relativo da afinidade.
    const applicableBase = 0.35 + 0.15 + 0.1 + 0.1; // sem similaridade
    expect(rOne.breakdown.weights.trajectory).toBeCloseTo(0.05 / (applicableBase + 0.05), 10);
    expect(rTwo.breakdown.weights.trajectory).toBeCloseTo(0.1 / (applicableBase + 0.1), 10);
  });

  it("os pesos efetivos somam 1 entre os componentes aplicáveis", () => {
    for (const candidate of [one, two, { ...two, similarity: 0.8 }]) {
      const r = scoreMentorCandidate(mentee, candidate, { areas: AREAS });
      expect(sum(r.breakdown.weights)).toBeCloseTo(1, 10);
      for (const key of Object.keys(r.breakdown.weights) as MatchComponent[]) {
        if (r.breakdown.components[key] === null) expect(r.breakdown.weights[key]).toBe(0);
      }
    }
    const w = effectiveWeights({
      areas: 1,
      similarity: null,
      topics: 1,
      seniority: 1,
      compatibility: 1,
      trajectory: 1,
    });
    expect(w.trajectory).toBeCloseTo(0.1 / 0.8, 10);
    expect(sum(w)).toBeCloseTo(1, 10);
  });

  it("calcula a nota exata com a afinidade plena", () => {
    const exactMentee = makeMentee({
      area_ids: [1],
      keywords: [],
      mentorship_topics: ["bolsas-editais"],
      mentoring_goals: null,
      career_stage: "masters",
      trajectory_tags: ["mae-cuidadora"],
    });
    const candidate = makeCandidate({
      area_ids: [1],
      similarity: similarityFor(0.5),
      mentorship_topics: ["bolsas-editais"],
      mentoring_offer: null,
      headline: null,
      keywords: [],
      career_stage: "professor",
      open_slots: 3,
      trajectory_tags: ["mae-cuidadora"],
    });
    const r = scoreMentorCandidate(exactMentee, candidate, { areas: AREAS });
    // (0.35·1 + 0.30·0.5 + 0.15·1 + 0.10·1 + 0.10·1 + 0.10·1) / 1.10
    expect(r.breakdown.rawScore).toBeCloseTo((0.95 / 1.1) * 100, 8);
    expect(r.score).toBe(86);
    expect(scoreWithoutTrajectory(r.breakdown)).toBeCloseTo(85, 8);
  });

  it("o motivo entra na disputa pela contribuição e vence o empate com a senioridade", () => {
    // pós-doc × graduação: senioridade 1 · 0,10/0,80 = trajetória plena 1 · 0,10/0,80
    const r = scoreMentorCandidate(mentee, { ...two, career_stage: "postdoc" }, { areas: AREAS });
    expect(r.breakdown.weights.trajectory).toBeCloseTo(r.breakdown.weights.seniority, 10);
    expect(r.reasons[0]).toBe(
      "Vocês têm em comum: as duas foram as primeiras da família na universidade e estudaram em escola pública.",
    );
    expect(r.reasons[1]).toMatch(/^Está alguns passos à frente na carreira/);
  });

  it("desempata a favor de quem compartilha a trajetória", () => {
    const ranked = rankMentorCandidates(mentee, [plain, two], { areas: AREAS });
    expect(ranked.map((r) => r.mentorId)).toEqual(["m-two", "m-plain"]);
  });
});

describe("propriedade: a afinidade só pode subir a nota", () => {
  it("em 300 cenários aleatórios, com marca em comum a nota nunca é menor", () => {
    const random = rng(20261028);
    const pick = <T>(list: readonly T[]) => list[Math.floor(random() * list.length)]!;
    const marks = [
      "primeira-geracao",
      "escola-publica",
      "ensino-tecnico",
      "mae-cuidadora",
      "trabalha-e-estuda",
    ];
    for (let i = 0; i < 300; i++) {
      const mentee = makeMentee({
        area_ids: random() < 0.2 ? [] : [pick([1, 2, 3, 4, 5])],
        mentorship_topics: random() < 0.3 ? [] : [pick(["bolsas-editais", "networking"])],
        career_stage: pick(["undergraduate", "masters", "phd"]),
        trajectory_tags: marks.filter(() => random() < 0.5),
      });
      const candidate = makeCandidate({
        mentor_id: `m-${i}`,
        area_ids: [pick([1, 2, 3, 4, 5])],
        similarity: random() < 0.3 ? null : random(),
        career_stage: pick(["masters", "phd", "postdoc", "professor", "industry"]),
        open_slots: Math.floor(random() * 4),
        state: pick(["SP", "RJ", "AM"]),
      });
      const tags = marks.filter(() => random() < 0.5);
      const without = scoreMentorCandidate(mentee, candidate, { areas: AREAS });
      const withTags = scoreMentorCandidate(
        mentee,
        { ...candidate, trajectory_tags: tags },
        { areas: AREAS },
      );
      expect(withTags.breakdown.rawScore).toBeGreaterThanOrEqual(without.breakdown.rawScore - 1e-9);
      expect(scoreWithoutTrajectory(withTags.breakdown)).toBeCloseTo(without.breakdown.rawScore, 9);
      expect(sum(withTags.breakdown.weights)).toBeCloseTo(1, 10);
      // O bônus nunca passa do peso efetivo da afinidade (componente = 1, nota base ≥ 0).
      expect(withTags.breakdown.rawScore - without.breakdown.rawScore).toBeLessThanOrEqual(
        100 * withTags.breakdown.weights.trajectory + 1e-9,
      );
      if (withTags.breakdown.components.trajectory === null) {
        expect(withTags.breakdown.rawScore).toBe(without.breakdown.rawScore);
      } else {
        expect(withTags.breakdown.weights.trajectory).toBeGreaterThan(0);
      }
    }
  });
});
