import { describe, expect, it } from "vitest";
import {
  MAX_AI_CANDIDATES,
  buildExplainPrompt,
  buildMenteePayload,
  heuristicExplanation,
  mergeAiExplanations,
  pseudonymizeCandidates,
  scrubPseudonyms,
} from "./pseudonymize";
import { rankMentorCandidates } from "./rank";
import { AREAS, makeCandidate, makeMentee } from "./test-fixtures";

const mentee = makeMentee();
const candidates = [
  makeCandidate({
    mentor_id: "11111111-1111-4111-8111-111111111111",
    full_name: "Helena Demo Souza",
  }),
  makeCandidate({
    mentor_id: "22222222-2222-4222-8222-222222222222",
    full_name: "Beatriz Exemplo Lima",
    area_ids: [3],
    similarity: 0.6,
    career_stage: "phd",
    mentoring_offer: "Sou a Beatriz, escreva para bia@example.com ou veja https://bia.example.com",
    headline: "Pós-doc em botânica",
  }),
  makeCandidate({
    mentor_id: "33333333-3333-4333-8333-333333333333",
    full_name: "Carla Ficticia Rocha",
    area_ids: [4],
    similarity: null,
    career_stage: "industry",
  }),
];
const ranked = rankMentorCandidates(mentee, candidates, { areas: AREAS });
const ids = ranked.map((r) => r.mentorId);

describe("pseudonimização", () => {
  it("troca ids por c1..cN e guarda o mapa só no servidor", () => {
    const { payload, idMap } = pseudonymizeCandidates(ranked, { areas: AREAS });
    expect(payload.map((p) => p.id)).toEqual(["c1", "c2", "c3"]);
    expect([...idMap.entries()]).toEqual([
      ["c1", ids[0]],
      ["c2", ids[1]],
      ["c3", ids[2]],
    ]);
  });

  it("limita a 8 candidatas", () => {
    const many = Array.from({ length: 12 }, (_, i) =>
      makeCandidate({ mentor_id: `m-${String(i).padStart(2, "0")}` }),
    );
    const { payload } = pseudonymizeCandidates(rankMentorCandidates(mentee, many));
    expect(payload).toHaveLength(MAX_AI_CANDIDATES);
  });

  it("o prompt não contém nomes, ids reais, e-mails, links, instituição nem foto", () => {
    const consent = new Map(ids.map((id) => [id, true] as const));
    const { payload } = pseudonymizeCandidates(ranked, {
      areas: AREAS,
      consentByMentorId: consent,
    });
    const prompt = buildExplainPrompt(buildMenteePayload(mentee, AREAS), payload);
    for (const forbidden of [
      "Helena",
      "Beatriz",
      "Carla",
      "Marina",
      "Souza",
      "Lima",
      "Universidade Fictícia",
      "avatar.png",
      "@",
      "http",
      "example.com",
      ...ids,
      mentee.id,
    ]) {
      expect(prompt).not.toContain(forbidden);
    }
    expect(prompt).toContain("Ecologia");
    expect(prompt).toContain('"id":"c1"');
  });

  it("mentoras sem consentimento entram só com taxonomia (sem texto escrito por elas)", () => {
    const consent = new Map([[ids[0], true] as const]);
    const { payload } = pseudonymizeCandidates(ranked, {
      areas: AREAS,
      consentByMentorId: consent,
    });
    expect(payload[0]).toHaveProperty("como_ajuda");
    expect(payload[0]).toHaveProperty("palavras_chave");
    for (const p of payload.slice(1)) {
      expect(p).not.toHaveProperty("como_ajuda");
      expect(p).not.toHaveProperty("apresentacao");
      expect(p).not.toHaveProperty("palavras_chave");
      expect(p.etapa).toBeTruthy();
    }
    // Sem mapa de consentimento: ninguém envia texto livre.
    const none = pseudonymizeCandidates(ranked, { areas: AREAS });
    expect(none.payload.every((p) => p.como_ajuda === undefined)).toBe(true);
  });

  it("mentoranda vai sem nome e com objetivos sem e-mail", () => {
    const payload = buildMenteePayload(mentee, AREAS);
    expect(JSON.stringify(payload)).not.toMatch(/Marina|marina@|@/);
    expect(payload.objetivos).toContain("[e-mail]");
    expect(payload.etapa).toBe("Mestrado");
    expect(payload.areas).toEqual(["Ecologia", "Genética"]);
  });
});

describe("mergeAiExplanations", () => {
  const { idMap } = pseudonymizeCandidates(ranked, { areas: AREAS });

  it("descarta ids inventados e repetidos, limita notas e mistura com a heurística", () => {
    const merged = mergeAiExplanations(
      mentee,
      ranked,
      {
        ranking: [
          {
            id: "c99",
            score: 100,
            reason: "Inventada pelo modelo, não deveria aparecer.",
            starters: ["a?", "b?"],
          },
          {
            id: "C3",
            score: 150,
            reason: "Ela tem experiência com dados e pode orientar sua escrita.",
            starters: ["Como começar?", "Que curso fazer primeiro?"],
          },
          { id: "c3", score: 10, reason: "Duplicada, deve ser ignorada.", starters: [] },
          {
            id: "c1",
            score: -20,
            reason: "c1 compartilha a área de Ecologia com você e orienta em editais.",
            starters: ["Como foi o seu doutorado?"],
          },
        ],
      },
      idMap,
      AREAS,
    );

    expect(merged.map((m) => m.mentorId).sort()).toEqual([...ids].sort());
    expect(merged.some((m) => m.reason.includes("Inventada"))).toBe(false);
    expect(merged.some((m) => m.reason.includes("Duplicada"))).toBe(false);

    const third = merged.find((m) => m.mentorId === ids[2])!;
    expect(third.aiScore).toBe(100);
    expect(third.source).toBe("ai");
    expect(third.score).toBe(Math.round(0.5 * 100 + 0.5 * ranked[2].breakdown.rawScore));

    const first = merged.find((m) => m.mentorId === ids[0])!;
    expect(first.aiScore).toBe(0);
    expect(first.reason).toBe(
      "Esta mentora compartilha a área de Ecologia com você e orienta em editais.",
    );
    // Completa com perguntas heurísticas até ter ao menos 2.
    expect(first.conversationStarters.length).toBeGreaterThanOrEqual(2);
    expect(first.conversationStarters[0]).toBe("Como foi o seu doutorado?");

    // c2 foi omitida pelo modelo → continua na lista, com explicação heurística.
    const second = merged.find((m) => m.mentorId === ids[1])!;
    expect(second.source).toBe("heuristic");
    expect(second.aiScore).toBeNull();

    // Ordenado pela nota final.
    const scores = merged.map((m) => m.score);
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
    for (const m of merged) {
      expect(m.score).toBeGreaterThanOrEqual(0);
      expect(m.score).toBeLessThanOrEqual(100);
      expect(m.conversationStarters.length).toBeLessThanOrEqual(3);
    }
  });

  it("motivo vazio ou curto demais cai na heurística", () => {
    const merged = mergeAiExplanations(
      mentee,
      ranked,
      { ranking: [{ id: "c1", score: 90, reason: "  ", starters: [] }] },
      idMap,
      AREAS,
    );
    const first = merged.find((m) => m.mentorId === ids[0])!;
    expect(first.source).toBe("heuristic");
    expect(first.reason).toBe(heuristicExplanation(mentee, ranked[0], AREAS).reason);
  });

  it("scrubPseudonyms troca só os códigos enviados", () => {
    expect(
      scrubPseudonyms("c2 estuda plantas C4 e datação por C14; fale com c2.", ["c1", "c2"]),
    ).toBe("Esta mentora estuda plantas C4 e datação por C14; fale com esta mentora.");
  });
});

describe("heuristicExplanation", () => {
  it("usa os motivos heurísticos e perguntas determinísticas", () => {
    const h = heuristicExplanation(mentee, ranked[0], AREAS);
    expect(h.source).toBe("heuristic");
    expect(h.reason).toBe(ranked[0].reasons.slice(0, 2).join(" "));
    expect(h.conversationStarters).toHaveLength(3);
    expect(h.conversationStarters[0]).toBe("Como você começou a pesquisar em Ecologia?");
    expect(heuristicExplanation(mentee, ranked[0], AREAS)).toEqual(h);
  });
});
