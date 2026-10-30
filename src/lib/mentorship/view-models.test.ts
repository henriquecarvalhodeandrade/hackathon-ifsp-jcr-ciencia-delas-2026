import { describe, expect, it } from "vitest";
import type { MentorSuggestion } from "@/lib/matching/service";
import type { MentorshipStatus } from "@/lib/constants";
import { loadSuggestionMatch } from "./queries";
import {
  buildMatchCard,
  buildMatchCards,
  careerStageLabel,
  lookupCandidate,
  resolveDeepLink,
  topicLabel,
  type CandidateAvailability,
  type CandidatePool,
  type MatchCardContext,
} from "./view-models";

const MENTOR = "d1000000-0000-4000-8000-000000000001";
const OTHER = "d1000000-0000-4000-8000-000000000002";
const ME = "d2000000-0000-4000-8000-000000000001";

function suggestion(overrides: Partial<MentorSuggestion> = {}): MentorSuggestion {
  return {
    mentorId: MENTOR,
    rank: 1,
    score: 87.4,
    reason: "Vocês compartilham a área de Ciência da Computação.",
    reasons: [],
    conversationStarters: ["Como foi sua escolha de mestrado?", " ", "Que eventos você recomenda?"],
    source: "heuristic",
    mentor: {
      id: MENTOR,
      full_name: "Marina Albuquerque",
      avatar_url: null,
      headline: "Docente de computação",
      institution: "IFSP — Câmpus Jacareí",
      state: "SP",
      career_stage: "professor",
      area_ids: [10, 11],
      area_names: ["Ciência da Computação", "Engenharia de Software"],
      keywords: [],
      mentorship_topics: ["programacao-dados", "pos-graduacao", "networking"],
      meeting_formats: ["online"],
      languages: ["pt"],
      open_slots: null,
      existing_request_status: null,
    },
    ...overrides,
  };
}

function pool(entries: [string, CandidateAvailability][] = [], complete = true): CandidatePool {
  return { byMentor: new Map(entries), complete };
}

function ctx(overrides: Partial<MatchCardContext> = {}): MatchCardContext {
  return {
    menteeAreaIds: [11, 99],
    menteeTopics: ["pos-graduacao", "escrita-cientifica"],
    areaNames: new Map([
      [10, "Ciência da Computação"],
      [11, "Engenharia de Software"],
    ]),
    model: null,
    candidates: pool([[MENTOR, { open_slots: 2, existing_request_status: null }]]),
    openRequests: new Map<string, MentorshipStatus>(),
    ...overrides,
  };
}

describe("buildMatchCard", () => {
  it("monta o cartão com interesses em comum e vagas", () => {
    const card = buildMatchCard(suggestion(), ctx());
    expect(card.score).toBe(87);
    expect(card.sharedAreas).toEqual(["Engenharia de Software"]);
    expect(card.sharedTopics).toEqual(["Ingresso na pós-graduação"]);
    expect(card.otherTopics).toEqual(["Programação e análise de dados", "Networking e eventos"]);
    expect(card.starters).toEqual([
      "Como foi sua escolha de mestrado?",
      "Que eventos você recomenda?",
    ]);
    expect(card.careerStage).toBe("Docente");
    expect(card.openSlots).toBe(2);
    expect(card.canRequest).toBe(true);
    expect(card.sourceLabel).toBe("Sugestão por afinidade");
  });

  it("selo de IA usa o modelo salvo", () => {
    const card = buildMatchCard(
      suggestion({ source: "ai" }),
      ctx({ model: "gemini-3.5-flash-lite" }),
    );
    expect(card.sourceLabel).toBe("Sugestão por IA (Gemini)");
  });

  it("bloqueia novo pedido quando já existe um pendente ou aceito", () => {
    const pending = buildMatchCard(
      suggestion(),
      ctx({ openRequests: new Map([[MENTOR, "pending"]]) }),
    );
    expect(pending.requestStatus).toBe("pending");
    expect(pending.canRequest).toBe(false);

    const accepted = buildMatchCard(
      suggestion(),
      ctx({
        candidates: pool([[MENTOR, { open_slots: 1, existing_request_status: "accepted" }]]),
      }),
    );
    expect(accepted.requestStatus).toBe("accepted");
    expect(accepted.canRequest).toBe(false);
  });

  it("ignora pedidos encerrados", () => {
    const card = buildMatchCard(
      suggestion(),
      ctx({ openRequests: new Map([[MENTOR, "declined"]]) }),
    );
    expect(card.requestStatus).toBeNull();
    expect(card.canRequest).toBe(true);
  });

  it("mentora fora da lista de disponíveis fica sem botão", () => {
    const card = buildMatchCard(suggestion(), ctx({ candidates: pool() }));
    expect(card.canRequest).toBe(false);
    expect(card.unavailableReason).toMatch(/sem vagas/);
    expect(card.openSlots).toBeNull();
  });

  it("lista cortada pelo limite da RPC: ficar de fora não bloqueia o pedido", () => {
    const card = buildMatchCard(suggestion(), ctx({ candidates: pool([], false) }));
    expect(card.canRequest).toBe(true);
    expect(card.unavailableReason).toBeNull();
    expect(card.openSlots).toBeNull();
  });

  it("sem conferir disponibilidade (RPC falhou), deixa o banco decidir", () => {
    const card = buildMatchCard(suggestion(), ctx({ candidates: null }));
    expect(card.canRequest).toBe(true);
    expect(card.openSlots).toBeNull();
  });

  it("ordena pelo rank e limita a nota a 0..100", () => {
    const cards = buildMatchCards(
      [
        suggestion({
          mentorId: OTHER,
          rank: 2,
          score: 140,
          mentor: { ...suggestion().mentor, id: OTHER },
        }),
        suggestion({ rank: 1, score: -3 }),
      ],
      ctx({ candidates: null }),
    );
    expect(cards.map((c) => c.mentorId)).toEqual([MENTOR, OTHER]);
    expect(cards[0]!.score).toBe(0);
    expect(cards[1]!.score).toBe(100);
  });
});

describe("rótulos", () => {
  it("tema e etapa desconhecidos", () => {
    expect(topicLabel("bolsas-editais")).toBe("Bolsas e editais");
    expect(topicLabel("inexistente")).toBe("inexistente");
    expect(careerStageLabel("phd")).toBe("Doutorado");
    expect(careerStageLabel("xyz")).toBeNull();
    expect(careerStageLabel(null)).toBeNull();
  });
});

describe("resolveDeepLink", () => {
  const mentor = { id: MENTOR, is_mentor: true, mentor_available: true, onboarded: true };
  const candidates = pool([[MENTOR, { open_slots: 3, existing_request_status: null }]]);
  const none = new Map<string, MentorshipStatus>();

  it("libera o pedido para mentora disponível", () => {
    expect(resolveDeepLink({ mentor, viewerId: ME, candidates, openRequests: none })).toEqual({
      kind: "ok",
      openSlots: 3,
    });
  });
  it("casos que bloqueiam", () => {
    expect(
      resolveDeepLink({ mentor: null, viewerId: ME, candidates, openRequests: none }).kind,
    ).toBe("not_found");
    expect(resolveDeepLink({ mentor, viewerId: MENTOR, candidates, openRequests: none }).kind).toBe(
      "self",
    );
    expect(
      resolveDeepLink({
        mentor: { ...mentor, is_mentor: false },
        viewerId: ME,
        candidates,
        openRequests: none,
      }).kind,
    ).toBe("not_mentor");
    expect(
      resolveDeepLink({
        mentor: { ...mentor, mentor_available: false },
        viewerId: ME,
        candidates,
        openRequests: none,
      }).kind,
    ).toBe("unavailable");
    expect(
      resolveDeepLink({ mentor, viewerId: ME, candidates: pool(), openRequests: none }).kind,
    ).toBe("unavailable");
  });
  it("lista cortada pelo limite da RPC: libera e deixa o banco validar", () => {
    expect(
      resolveDeepLink({ mentor, viewerId: ME, candidates: pool([], false), openRequests: none }),
    ).toEqual({ kind: "ok", openSlots: null });
  });
  it("pedido já aberto tem prioridade sobre falta de vaga", () => {
    expect(
      resolveDeepLink({
        mentor,
        viewerId: ME,
        candidates: pool(),
        openRequests: new Map([[MENTOR, "accepted"]]),
      }),
    ).toEqual({ kind: "open_request", status: "accepted" });
    expect(
      resolveDeepLink({
        mentor,
        viewerId: ME,
        candidates: pool([[MENTOR, { open_slots: 1, existing_request_status: "pending" }]]),
        openRequests: none,
      }),
    ).toEqual({ kind: "open_request", status: "pending" });
  });
  it("sem RPC, libera e deixa o banco validar", () => {
    expect(resolveDeepLink({ mentor, viewerId: ME, candidates: null, openRequests: none })).toEqual(
      {
        kind: "ok",
        openSlots: null,
      },
    );
  });
});

describe("lookupCandidate", () => {
  const entry: [string, CandidateAvailability] = [
    MENTOR,
    { open_slots: 1, existing_request_status: null },
  ];
  it("distingue disponível, sem vaga confirmada e desconhecido", () => {
    expect(lookupCandidate(pool([entry]), MENTOR).kind).toBe("available");
    expect(lookupCandidate(pool([entry]), OTHER).kind).toBe("unavailable");
    expect(lookupCandidate(pool([entry], false), OTHER).kind).toBe("unknown");
    expect(lookupCandidate(null, MENTOR).kind).toBe("unknown");
  });
});

describe("buildMatchCard — trajetória em comum", () => {
  const larissa = ["primeira-geracao", "escola-publica", "ensino-tecnico"];

  it("sem o parâmetro (chamada antiga), não mostra nada e o resto não muda", () => {
    const before = buildMatchCard(suggestion(), ctx());
    expect(before.sharedTrajectory).toEqual([]);
    const withPool = buildMatchCard(
      suggestion(),
      ctx({
        candidates: pool([
          [
            MENTOR,
            { open_slots: 2, existing_request_status: null, trajectory_tags: ["escola-publica"] },
          ],
        ]),
      }),
    );
    expect(withPool).toEqual(before);
  });

  it("calcula na hora com as marcas atuais da mentora (RPC), na ordem do catálogo", () => {
    const card = buildMatchCard(
      suggestion(),
      ctx({
        menteeTrajectory: larissa,
        candidates: pool([
          [
            MENTOR,
            {
              open_slots: 2,
              existing_request_status: null,
              trajectory_tags: ["escola-publica", "mae-cuidadora", "primeira-geracao"],
            },
          ],
        ]),
      }),
    );
    expect(card.sharedTrajectory).toEqual([
      "Primeira da família na universidade",
      "Escola pública",
    ]);
  });

  it("vale para sugestões salvas: sem a mentora no conjunto, usa as marcas da sugestão", () => {
    const saved = suggestion({
      mentor: { ...suggestion().mentor, trajectory_tags: ["ensino-tecnico"] },
    });
    const card = buildMatchCard(saved, ctx({ menteeTrajectory: larissa, candidates: null }));
    expect(card.sharedTrajectory).toEqual(["Ensino técnico"]);
  });

  it("vazio quando uma não declarou nada ou os caminhos são diferentes", () => {
    const pooled = (tags: string[] | null) =>
      pool([[MENTOR, { open_slots: 2, existing_request_status: null, trajectory_tags: tags }]]);
    expect(
      buildMatchCard(suggestion(), ctx({ menteeTrajectory: [], candidates: pooled(larissa) }))
        .sharedTrajectory,
    ).toEqual([]);
    expect(
      buildMatchCard(suggestion(), ctx({ menteeTrajectory: larissa, candidates: pooled(null) }))
        .sharedTrajectory,
    ).toEqual([]);
    expect(
      buildMatchCard(
        suggestion(),
        ctx({ menteeTrajectory: ["mae-cuidadora"], candidates: pooled(["mudanca-de-area"]) }),
      ).sharedTrajectory,
    ).toEqual([]);
  });

  it("buildMatchCards repassa o contexto a todos os cartões", () => {
    const cards = buildMatchCards(
      [
        suggestion({ rank: 2, mentorId: OTHER, mentor: { ...suggestion().mentor, id: OTHER } }),
        suggestion({ rank: 1 }),
      ],
      ctx({
        menteeTrajectory: larissa,
        candidates: pool([
          [MENTOR, { open_slots: 1, existing_request_status: null, trajectory_tags: larissa }],
          [OTHER, { open_slots: 1, existing_request_status: null, trajectory_tags: [] }],
        ]),
      }),
    );
    expect(cards.map((c) => [c.mentorId, c.sharedTrajectory.length])).toEqual([
      [MENTOR, 3],
      [OTHER, 0],
    ]);
  });
});

describe("motivo salvo × marcas de agora", () => {
  const SAVED =
    "Ela atua na mesma grande área que você (Ciências Exatas e da Terra). Vocês têm em comum: as duas foram as primeiras da família na universidade e estudaram em escola pública.";
  const withTags = (tags: string[]) =>
    pool([[MENTOR, { open_slots: 2, existing_request_status: null, trajectory_tags: tags }]]);

  it("refaz a frase quando uma das duas tirou uma marca", () => {
    const card = buildMatchCard(
      suggestion({ reason: SAVED }),
      ctx({ menteeTrajectory: ["escola-publica"], candidates: withTags(["escola-publica"]) }),
    );
    expect(card.reason).toBe(
      "Ela atua na mesma grande área que você (Ciências Exatas e da Terra). Vocês têm em comum: as duas estudaram em escola pública.",
    );
  });

  it("tira a frase quando não há mais nada em comum", () => {
    const card = buildMatchCard(
      suggestion({ reason: SAVED }),
      ctx({ menteeTrajectory: ["escola-publica"], candidates: withTags([]) }),
    );
    expect(card.reason).toBe(
      "Ela atua na mesma grande área que você (Ciências Exatas e da Terra).",
    );
    expect(card.sharedTrajectory).toEqual([]);
  });

  it("sem saber as marcas de agora (chamada antiga ou RPC fora do ar), não mexe no texto", () => {
    expect(buildMatchCard(suggestion({ reason: SAVED }), ctx()).reason).toBe(SAVED);
    expect(
      buildMatchCard(suggestion({ reason: SAVED }), ctx({ menteeTrajectory: [], candidates: null }))
        .reason,
    ).toBe(SAVED);
  });
});

describe("loadSuggestionMatch", () => {
  function fakeClient(row: { score: number; reason: string } | null) {
    const query = {
      select: () => query,
      eq: () => query,
      maybeSingle: async () => ({ data: row, error: null }),
    };
    return { from: () => query } as unknown as Parameters<typeof loadSuggestionMatch>[0];
  }

  it("não copia a frase de trajetória para o pedido", async () => {
    const match = await loadSuggestionMatch(
      fakeClient({
        score: 55,
        reason:
          "Ela atua na mesma grande área que você. Vocês têm em comum: as duas foram as primeiras da família na universidade.",
      }),
      ME,
      MENTOR,
    );
    expect(match).toEqual({ score: 55, reason: "Ela atua na mesma grande área que você." });
  });

  it("sem frase de trajetória, o motivo vai como estava; vazio vira null", async () => {
    expect(
      await loadSuggestionMatch(fakeClient({ score: 80, reason: "Mesma área." }), ME, MENTOR),
    ).toEqual({ score: 80, reason: "Mesma área." });
    expect(await loadSuggestionMatch(fakeClient({ score: 1, reason: "  " }), ME, MENTOR)).toEqual({
      score: 1,
      reason: null,
    });
    expect(
      await loadSuggestionMatch(
        fakeClient({
          score: 40,
          reason: "Vocês têm em comum: as duas estudaram em escola pública.",
        }),
        ME,
        MENTOR,
      ),
    ).toEqual({ score: 40, reason: null });
    expect(await loadSuggestionMatch(fakeClient(null), ME, MENTOR)).toEqual({
      score: null,
      reason: null,
    });
  });
});
