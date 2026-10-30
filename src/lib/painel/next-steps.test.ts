import { describe, expect, it } from "vitest";
import {
  ALL_DONE_MESSAGE,
  LOCKED_MESSAGE_STEP,
  computeNextSteps,
  missingProfileParts,
  type NextStepsInput,
} from "./next-steps";

function input(overrides: Partial<NextStepsInput> = {}): NextStepsInput {
  return {
    isMentor: false,
    seeksMentorship: true,
    headline: null,
    areaCount: 0,
    keywordCount: 0,
    mentoringOffer: null,
    mentorshipTopicCount: 0,
    mentorAvailable: true,
    mentorCapacity: 2,
    hasIntroThread: false,
    suggestionCount: 0,
    requestsAsMentee: 0,
    activeMenteeRequestId: null,
    sentMessageCount: 0,
    pendingReceivedCount: 0,
    repliedRecently: false,
    submittedPaperCount: 0,
    votedPaperCount: 0,
    ...overrides,
  };
}

const completeProfile = { headline: "Graduanda em ADS", areaCount: 1, keywordCount: 3 };

describe("computeNextSteps — trilha da mentoranda (padrão)", () => {
  it("segue a ordem combinada e começa pelo perfil", () => {
    const result = computeNextSteps(input());
    expect(result.track).toBe("mentee");
    expect(result.steps.map((s) => s.id)).toEqual([
      "perfil",
      "apresente-se",
      "encontre-mentoras",
      "envie-pedido",
      "primeira-mensagem",
    ]);
    expect(result.steps.map((s) => s.href)).toEqual([
      "/perfil#pesquisa",
      "/forum/novo?categoria=apresente-se",
      "/mentoria?aba=sugestoes",
      "/mentoria?aba=sugestoes",
      null,
    ]);
    expect(result.doneCount).toBe(0);
    expect(result.currentIndex).toBe(0);
    expect(result.allDone).toBe(false);
  });

  it("perfil só conta com frase, 1 área e 3 palavras-chave (e diz o que falta, sem cobrar opcionais)", () => {
    expect(computeNextSteps(input(completeProfile)).steps[0]!.done).toBe(true);
    expect(computeNextSteps(input({ ...completeProfile, keywordCount: 2 })).steps[0]!.done).toBe(
      false,
    );
    expect(computeNextSteps(input({ ...completeProfile, headline: "  " })).steps[0]!.done).toBe(
      false,
    );
    expect(computeNextSteps(input({ ...completeProfile, areaCount: 0 })).steps[0]!.done).toBe(
      false,
    );

    expect(missingProfileParts(input({ headline: "x", areaCount: 1, keywordCount: 1 }))).toEqual([
      "mais 2 palavras-chave",
    ]);
    const description = computeNextSteps(input()).steps[0]!.description;
    expect(description).toContain("uma frase de apresentação");
    expect(description).toContain("sua área de pesquisa");
    expect(description).toContain("mais 3 palavras-chave");
    expect(description).not.toMatch(/pronome|cidade|trajet|foto|lattes|orcid/i);
  });

  it("marca os passos feitos e aponta o primeiro pendente", () => {
    const result = computeNextSteps(
      input({ ...completeProfile, hasIntroThread: true, suggestionCount: 4 }),
    );
    expect(result.steps.map((s) => s.done)).toEqual([true, true, true, false, false]);
    expect(result.doneCount).toBe(3);
    expect(result.currentIndex).toBe(3);
    expect(result.steps[result.currentIndex]!.id).toBe("envie-pedido");
  });

  it("quem já pediu mentoria já encontrou mentoras, mesmo sem sugestões salvas", () => {
    const steps = computeNextSteps(input({ requestsAsMentee: 1 })).steps;
    expect(steps.find((s) => s.id === "encontre-mentoras")!.done).toBe(true);
    expect(steps.find((s) => s.id === "envie-pedido")!.done).toBe(true);
  });

  it("a primeira mensagem fica travada (sem link) até uma mentora aceitar", () => {
    const pending = computeNextSteps(input({ requestsAsMentee: 1 }));
    const locked = pending.steps.find((s) => s.id === "primeira-mensagem")!;
    expect(locked.href).toBeNull();
    expect(locked.done).toBe(false);
    expect(locked.description).toBe(LOCKED_MESSAGE_STEP);

    const accepted = computeNextSteps(
      input({ requestsAsMentee: 1, activeMenteeRequestId: "req-1" }),
    );
    const open = accepted.steps.find((s) => s.id === "primeira-mensagem")!;
    expect(open.href).toBe("/mentoria/conversa/req-1");
    expect(open.description).toContain("Combine com sua mentora");
    const named = computeNextSteps(
      input({
        requestsAsMentee: 1,
        activeMenteeRequestId: "req-1",
        activeMentorFirstName: "Marina",
      }),
    ).steps.find((s) => s.id === "primeira-mensagem")!;
    expect(named.description).toBe(
      "Combine com Marina o primeiro encontro pela conversa da mentoria.",
    );
    expect(open.done).toBe(false);
    expect(open.description).not.toBe(LOCKED_MESSAGE_STEP);
  });

  it("conta a mensagem enviada como feita", () => {
    const result = computeNextSteps(
      input({
        ...completeProfile,
        hasIntroThread: true,
        requestsAsMentee: 2,
        activeMenteeRequestId: "req-1",
        sentMessageCount: 1,
      }),
    );
    expect(result.allDone).toBe(true);
    expect(result.doneCount).toBe(5);
    expect(result.currentIndex).toBe(-1);
  });
});

describe("computeNextSteps — quem não busca mentoria", () => {
  it("troca os passos 3–5 por Vitrine e pesquisadoras", () => {
    const result = computeNextSteps(input({ seeksMentorship: false }));
    expect(result.track).toBe("explorer");
    expect(result.steps.map((s) => s.id)).toEqual([
      "perfil",
      "apresente-se",
      "vitrine",
      "pesquisadoras",
    ]);
    expect(result.steps[2]!.href).toBe("/papers");
    expect(result.steps[3]!.href).toBe("/pesquisadoras");
    expect(result.steps.some((s) => s.href?.startsWith("/mentoria"))).toBe(false);
  });

  it("Vitrine conta voto ou envio; pesquisadoras conta uma conversa recente no fórum", () => {
    const voted = computeNextSteps(input({ seeksMentorship: false, votedPaperCount: 1 }));
    expect(voted.steps.find((s) => s.id === "vitrine")!.done).toBe(true);
    const submitted = computeNextSteps(input({ seeksMentorship: false, submittedPaperCount: 1 }));
    expect(submitted.steps.find((s) => s.id === "vitrine")!.done).toBe(true);
    const replied = computeNextSteps(input({ seeksMentorship: false, repliedRecently: true }));
    expect(replied.steps.find((s) => s.id === "pesquisadoras")!.done).toBe(true);
  });
});

describe("computeNextSteps — trilha da mentora", () => {
  const mentor = input({ isMentor: true, seeksMentorship: false });

  it("tem os 5 passos da mentora, na ordem, mesmo que ela também busque mentoria", () => {
    for (const seeksMentorship of [false, true]) {
      const result = computeNextSteps({ ...mentor, seeksMentorship });
      expect(result.track).toBe("mentor");
      expect(result.steps.map((s) => s.id)).toEqual([
        "conte-como-ajuda",
        "disponibilidade",
        "responda-pedidos",
        "ajude-forum",
        "divulgue-paper",
      ]);
    }
  });

  it("aplica as regras de cada passo", () => {
    const result = computeNextSteps({
      ...mentor,
      mentoringOffer: "Ajudo com o primeiro projeto de IC.",
      mentorshipTopicCount: 2,
      mentorAvailable: true,
      mentorCapacity: 3,
      pendingReceivedCount: 2,
      repliedRecently: false,
      submittedPaperCount: 0,
    });
    expect(result.steps.map((s) => s.done)).toEqual([true, true, false, false, false]);
    expect(result.steps[2]!.href).toBe("/mentoria?aba=recebidas");
    expect(result.steps[2]!.description).toContain("2 pesquisadoras");
    expect(result.currentIndex).toBe(2);
  });

  it("disponibilidade leva ao lugar do que falta: pedidos em /mentoria, vagas no perfil", () => {
    const paused = computeNextSteps({ ...mentor, mentorAvailable: false, mentorCapacity: 0 });
    expect(paused.steps[1]!.href).toBe("/mentoria?aba=recebidas");
    const noSeats = computeNextSteps({ ...mentor, mentorAvailable: true, mentorCapacity: 0 });
    expect(noSeats.steps[1]!.href).toBe("/perfil#mentoria");
    const open = computeNextSteps({ ...mentor, mentorAvailable: true, mentorCapacity: 2 });
    expect(open.steps[1]!.href).toBe("/mentoria?aba=recebidas");
  });

  it("oferta sem tema, pedidos pausados ou capacidade zero não contam", () => {
    const steps = computeNextSteps({
      ...mentor,
      mentoringOffer: "Ajudo com escrita.",
      mentorshipTopicCount: 0,
      mentorAvailable: true,
      mentorCapacity: 0,
    }).steps;
    expect(steps[0]!.done).toBe(false);
    expect(steps[1]!.done).toBe(false);
    expect(
      computeNextSteps({ ...mentor, mentorAvailable: false, mentorCapacity: 2 }).steps[1]!.done,
    ).toBe(false);
  });

  it("tudo feito: nenhum passo pendente", () => {
    const result = computeNextSteps({
      ...mentor,
      mentoringOffer: "Ajudo com o primeiro projeto de IC.",
      mentorshipTopicCount: 1,
      mentorAvailable: true,
      mentorCapacity: 1,
      pendingReceivedCount: 0,
      repliedRecently: true,
      submittedPaperCount: 1,
    });
    expect(result.allDone).toBe(true);
    expect(result.doneCount).toBe(result.steps.length);
    expect(ALL_DONE_MESSAGE).toBe("Tudo em dia por aqui. Obrigada por fazer a rede andar.");
  });
});
