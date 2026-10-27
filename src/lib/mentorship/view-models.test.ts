import { describe, expect, it } from "vitest";
import type { MentorSuggestion } from "@/lib/matching/service";
import type { MentorshipStatus } from "@/lib/constants";
import {
  buildMatchCard,
  buildMatchCards,
  careerStageLabel,
  resolveDeepLink,
  topicLabel,
  type CandidateAvailability,
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

function ctx(overrides: Partial<MatchCardContext> = {}): MatchCardContext {
  return {
    menteeAreaIds: [11, 99],
    menteeTopics: ["pos-graduacao", "escrita-cientifica"],
    areaNames: new Map([
      [10, "Ciência da Computação"],
      [11, "Engenharia de Software"],
    ]),
    model: null,
    candidates: new Map<string, CandidateAvailability>([[MENTOR, { open_slots: 2, existing_request_status: null }]]),
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
    expect(card.starters).toEqual(["Como foi sua escolha de mestrado?", "Que eventos você recomenda?"]);
    expect(card.careerStage).toBe("Docente");
    expect(card.openSlots).toBe(2);
    expect(card.canRequest).toBe(true);
    expect(card.sourceLabel).toBe("Sugestão por afinidade");
  });

  it("selo de IA usa o modelo salvo", () => {
    const card = buildMatchCard(suggestion({ source: "ai" }), ctx({ model: "gemini-3.5-flash-lite" }));
    expect(card.sourceLabel).toBe("Sugestão por IA (Gemini)");
  });

  it("bloqueia novo pedido quando já existe um pendente ou aceito", () => {
    const pending = buildMatchCard(suggestion(), ctx({ openRequests: new Map([[MENTOR, "pending"]]) }));
    expect(pending.requestStatus).toBe("pending");
    expect(pending.canRequest).toBe(false);

    const accepted = buildMatchCard(
      suggestion(),
      ctx({ candidates: new Map([[MENTOR, { open_slots: 1, existing_request_status: "accepted" }]]) }),
    );
    expect(accepted.requestStatus).toBe("accepted");
    expect(accepted.canRequest).toBe(false);
  });

  it("ignora pedidos encerrados", () => {
    const card = buildMatchCard(suggestion(), ctx({ openRequests: new Map([[MENTOR, "declined"]]) }));
    expect(card.requestStatus).toBeNull();
    expect(card.canRequest).toBe(true);
  });

  it("mentora fora da lista de disponíveis fica sem botão", () => {
    const card = buildMatchCard(suggestion(), ctx({ candidates: new Map() }));
    expect(card.canRequest).toBe(false);
    expect(card.unavailableReason).toMatch(/sem vagas/);
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
        suggestion({ mentorId: OTHER, rank: 2, score: 140, mentor: { ...suggestion().mentor, id: OTHER } }),
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
  const candidates = new Map<string, CandidateAvailability>([[MENTOR, { open_slots: 3, existing_request_status: null }]]);
  const none = new Map<string, MentorshipStatus>();

  it("libera o pedido para mentora disponível", () => {
    expect(resolveDeepLink({ mentor, viewerId: ME, candidates, openRequests: none })).toEqual({ kind: "ok", openSlots: 3 });
  });
  it("casos que bloqueiam", () => {
    expect(resolveDeepLink({ mentor: null, viewerId: ME, candidates, openRequests: none }).kind).toBe("not_found");
    expect(resolveDeepLink({ mentor, viewerId: MENTOR, candidates, openRequests: none }).kind).toBe("self");
    expect(
      resolveDeepLink({ mentor: { ...mentor, is_mentor: false }, viewerId: ME, candidates, openRequests: none }).kind,
    ).toBe("not_mentor");
    expect(
      resolveDeepLink({ mentor: { ...mentor, mentor_available: false }, viewerId: ME, candidates, openRequests: none })
        .kind,
    ).toBe("unavailable");
    expect(resolveDeepLink({ mentor, viewerId: ME, candidates: new Map(), openRequests: none }).kind).toBe(
      "unavailable",
    );
  });
  it("pedido já aberto tem prioridade sobre falta de vaga", () => {
    expect(
      resolveDeepLink({ mentor, viewerId: ME, candidates: new Map(), openRequests: new Map([[MENTOR, "accepted"]]) }),
    ).toEqual({ kind: "open_request", status: "accepted" });
    expect(
      resolveDeepLink({
        mentor,
        viewerId: ME,
        candidates: new Map([[MENTOR, { open_slots: 1, existing_request_status: "pending" }]]),
        openRequests: none,
      }),
    ).toEqual({ kind: "open_request", status: "pending" });
  });
  it("sem RPC, libera e deixa o banco validar", () => {
    expect(resolveDeepLink({ mentor, viewerId: ME, candidates: null, openRequests: none })).toEqual({
      kind: "ok",
      openSlots: null,
    });
  });
});
