import { describe, expect, it } from "vitest";
import {
  isOpenQuestionFor,
  rankQuestionsForMember,
  type QuestionMember,
  type QuestionThread,
} from "./questions-for-you";

const NOW = Date.parse("2026-10-28T12:00:00Z");
const DAY = 24 * 60 * 60 * 1000;

function daysAgo(days: number): string {
  return new Date(NOW - days * DAY).toISOString();
}

let seq = 0;
function thread(overrides: Partial<QuestionThread> = {}): QuestionThread {
  seq += 1;
  return {
    id: `t-${String(seq).padStart(3, "0")}`,
    title: "Uma dúvida qualquer sobre a vida acadêmica",
    body: "Alguém pode me ajudar com isso? Obrigada desde já.",
    tags: [],
    isAnonymous: false,
    authorId: "outra",
    authorName: "Outra Pessoa",
    categoryName: "Dúvidas de pesquisa",
    isLocked: false,
    replyCount: 0,
    createdAt: daysAgo(1),
    ...overrides,
  };
}

const member: QuestionMember = {
  id: "eu",
  keywords: ["Estatistica", "python"],
  areaNames: ["Ecologia"],
  mentorshipTopics: ["pos-graduacao"],
};

describe("rankQuestionsForMember", () => {
  it("'Estatistica' do perfil combina com a tag 'estatística' (sem acento e sem caixa)", () => {
    const t = thread({ tags: ["estatística"], title: "Como escolher o teste certo?" });
    const [first] = rankQuestionsForMember([t], member, { now: NOW });
    expect(first!.thread.id).toBe(t.id);
    expect(first!.reason).toBe("estatística");
    expect(first!.score).toBeGreaterThan(0);
  });

  it("também encontra a palavra-chave no título e no corpo, como palavra inteira", () => {
    const inTitle = thread({ title: "Primeiros passos com Python no laboratório" });
    const inBody = thread({ body: "Uso PYTHON e R para tudo, mas me perco nos gráficos." });
    const partial = thread({ title: "Pythonic ou não? Estilo de código" });
    const ranked = rankQuestionsForMember([partial, inBody, inTitle], member, { now: NOW });
    expect(ranked.map((r) => r.thread.id).slice(0, 2)).toEqual([inTitle.id, inBody.id]);
    expect(ranked[0]!.reason).toBe("python");
    expect(ranked[2]!.reason).toBeNull();
  });

  it("combina área de pesquisa e tema de mentoria inferido do texto", () => {
    const area = thread({ body: "Faço ecologia de campo e queria trocar ideias." });
    const topic = thread({ title: "Processo seletivo da pós-graduação: por onde começo?" });
    const ranked = rankQuestionsForMember([area, topic], member, { now: NOW });
    expect(ranked.find((r) => r.thread.id === area.id)!.reason).toBe("Ecologia");
    expect(ranked.find((r) => r.thread.id === topic.id)!.reason).toBe("ingresso na pós-graduação");
  });

  it("exclui o tópico dela, inclusive o anônimo que ela mesma escreveu", () => {
    const own = thread({ authorId: "eu", tags: ["python"] });
    const ownAnonymous = thread({ authorId: null, isAnonymous: true, tags: ["python"] });
    const othersAnonymous = thread({ authorId: null, isAnonymous: true, tags: ["python"] });
    const ranked = rankQuestionsForMember(
      [own, ownAnonymous, othersAnonymous],
      { ...member, ownAnonymousThreadIds: [ownAnonymous.id] },
      { now: NOW },
    );
    expect(ranked.map((r) => r.thread.id)).toEqual([othersAnonymous.id]);
  });

  it("exclui tópicos trancados, já respondidos e com mais de 30 dias", () => {
    const locked = thread({ isLocked: true, tags: ["python"] });
    const answered = thread({ replyCount: 2, tags: ["python"] });
    const old = thread({ createdAt: daysAgo(31), tags: ["python"] });
    const fresh = thread({ createdAt: daysAgo(29), tags: ["python"] });
    const ranked = rankQuestionsForMember([locked, answered, old, fresh], member, { now: NOW });
    expect(ranked.map((r) => r.thread.id)).toEqual([fresh.id]);
    expect(isOpenQuestionFor(old, member, NOW)).toBe(false);
    expect(isOpenQuestionFor(fresh, member, NOW)).toBe(true);
  });

  it("sem nenhuma combinação, mostra as 3 mais recentes sem motivo", () => {
    const threads = [5, 1, 3, 2, 4].map((d) => thread({ createdAt: daysAgo(d) }));
    const ranked = rankQuestionsForMember(threads, member, { now: NOW });
    expect(ranked).toHaveLength(3);
    expect(ranked.every((r) => r.reason === null)).toBe(true);
    expect(ranked.map((r) => r.thread.createdAt)).toEqual([daysAgo(1), daysAgo(2), daysAgo(3)]);
  });

  it("devolve no máximo 3, com as que combinam antes das recentes", () => {
    const threads = [
      thread({ createdAt: daysAgo(0.5) }),
      thread({ tags: ["python"], createdAt: daysAgo(10) }),
      thread({ tags: ["estatística", "python"], createdAt: daysAgo(12) }),
      thread({ createdAt: daysAgo(2) }),
      thread({ createdAt: daysAgo(3) }),
    ];
    const ranked = rankQuestionsForMember(threads, member, { now: NOW });
    expect(ranked).toHaveLength(3);
    expect(ranked[0]!.thread.id).toBe(threads[2]!.id); // duas tags valem mais
    expect(ranked[1]!.thread.id).toBe(threads[1]!.id);
    expect(ranked[2]!.reason).toBeNull();
    expect(ranked[2]!.thread.id).toBe(threads[0]!.id); // a mais recente completa a lista
  });

  it("palavra-chave de uma letra só vale como tag exata", () => {
    const shortMember = { ...member, keywords: ["r"], areaNames: [], mentorshipTopics: [] };
    const inText = thread({ body: "Uso o software R no mestrado." });
    const asTag = thread({ tags: ["r"] });
    const ranked = rankQuestionsForMember([inText, asTag], shortMember, { now: NOW });
    expect(ranked[0]!.thread.id).toBe(asTag.id);
    expect(ranked[0]!.reason).toBe("r");
    expect(ranked[1]!.reason).toBeNull();
  });

  it("ignora tópicos repetidos e respeita o limite pedido", () => {
    const t = thread({ tags: ["python"] });
    expect(rankQuestionsForMember([t, t], member, { now: NOW })).toHaveLength(1);
    expect(rankQuestionsForMember([t], member, { now: NOW, limit: 0 })).toEqual([]);
  });
});
