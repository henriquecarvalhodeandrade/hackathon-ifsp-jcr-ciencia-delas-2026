import { describe, expect, it } from "vitest";
import {
  conversationHref,
  conversationStarters,
  conversationState,
  draftState,
  groupRuns,
  latestUnreadFromOther,
  MESSAGE_COUNTER_FROM,
  MESSAGE_MAX,
  startConversationHref,
  toDirectMessages,
  unconfirmedPending,
  type ConversationStatus,
  type PendingMessage,
} from "./conversation";

const CONVERSATION = "5f0c8f1e-2b6a-4c55-9d43-0d6f1f3b2a10";
const ME = "11111111-1111-4111-8111-111111111111";
const HER = "22222222-2222-4222-8222-222222222222";

function state(status: ConversationStatus, iAmInitiator: boolean, mySentCount = 0) {
  return conversationState({ status, iAmInitiator, mySentCount, otherFirstName: "Marina" });
}

describe("links", () => {
  it("monta o link da conversa e o do rascunho (só leitura, seguro para pré-busca)", () => {
    expect(conversationHref(CONVERSATION)).toBe(`/mensagens/${CONVERSATION}`);
    expect(startConversationHref(HER)).toBe(`/mensagens/nova?com=${HER}`);
  });

  it("o contador do campo aparece a partir de 80% do limite", () => {
    expect(MESSAGE_COUNTER_FROM).toBe(1600);
  });
});

describe("conversationState", () => {
  it("conversa aceita: campo normal, sem aviso, com recibo de leitura", () => {
    for (const initiator of [true, false]) {
      expect(state("active", initiator, 3)).toEqual({
        canSend: true,
        banner: null,
        showReadReceipts: true,
        waiting: null,
        sendLabel: "Enviar",
      });
    }
  });

  it("pedido que eu comecei, ainda sem mensagem: posso mandar a única mensagem do pedido", () => {
    const s = state("request", true, 0);
    expect(s.canSend).toBe(true);
    expect(s.sendLabel).toBe("Enviar pedido");
    expect(s.banner).toMatchObject({ kind: "first-request", actions: null });
    expect(s.banner?.body).toContain("Marina");
    expect(s.showReadReceipts).toBe(false);
    expect(s.waiting).toBeNull();
  });

  it("pedido que eu comecei, já com a minha mensagem: campo desativado no lugar, sem aviso", () => {
    const s = state("request", true, 1);
    expect(s.canSend).toBe(false);
    expect(s.banner).toBeNull();
    expect(s.waiting).toEqual({
      placeholder: "Aguardando a resposta de Marina",
      note: "Seu pedido de mensagem foi enviado. Você poderá mandar mais mensagens quando Marina responder.",
    });
  });

  it("pedido recusado aparece para quem pediu igual a um pedido sem resposta (nunca revela)", () => {
    const waiting = state("request", true, 1);
    for (const count of [0, 1, 2]) {
      const declined = state("declined", true, count);
      expect(declined).toEqual(waiting);
      expect(JSON.stringify(declined).toLowerCase()).not.toContain("recus");
    }
  });

  it("pedido que recebi: posso responder (aceita) e o aviso oferece aceitar ou recusar", () => {
    const s = state("request", false, 0);
    expect(s.canSend).toBe(true);
    expect(s.banner).toMatchObject({
      kind: "incoming-request",
      title: "Marina quer conversar com você",
      actions: "respond",
    });
    expect(s.banner?.body).toContain("Responder também aceita o pedido");
    expect(s.showReadReceipts).toBe(false);
  });

  it("pedido que eu recusei: aceitar (botão) ou responder reabre a conversa", () => {
    const s = state("declined", false, 0);
    expect(s.canSend).toBe(true);
    expect(s.banner).toMatchObject({
      kind: "declined-by-me",
      body: "Você recusou este pedido. Aceitar ou responder reabre a conversa.",
      actions: "accept",
    });
  });

  it("sem o primeiro nome, usa um genérico", () => {
    const s = conversationState({
      status: "request",
      iAmInitiator: true,
      mySentCount: 1,
      otherFirstName: "",
    });
    expect(s.waiting?.note).toContain("quando ela responder");
  });
});

describe("draftState", () => {
  it("com conexão aceita a conversa nasce aceita: sem aviso", () => {
    expect(draftState({ otherFirstName: "Marina", connected: true, highSchool: true })).toEqual({
      canSend: true,
      banner: null,
      showReadReceipts: false,
      waiting: null,
      sendLabel: "Enviar",
    });
  });

  it("sem conexão: avisa que pode chegar como pedido (sem afirmar — o vínculo é do banco)", () => {
    const s = draftState({ otherFirstName: "Marina", connected: false, highSchool: false });
    expect(s.canSend).toBe(true);
    expect(s.banner).toMatchObject({ kind: "draft", variant: "info" });
    expect(s.banner?.body).toContain("Se vocês ainda não têm vínculo");
  });

  it("ensino médio: aviso de proteção, mas o campo fica ativo (mentoria/IC também valem)", () => {
    const s = draftState({ otherFirstName: "Bia", connected: false, highSchool: true });
    expect(s.canSend).toBe(true);
    expect(s.banner).toMatchObject({ kind: "draft", variant: "warning" });
    expect(s.banner?.body).toContain("Bia só recebe mensagens");
  });
});

describe("groupRuns", () => {
  const at = (minutes: number) => new Date(Date.UTC(2026, 9, 28, 12, minutes)).toISOString();

  it("junta mensagens seguidas da mesma pessoa com até 5 minutos entre elas", () => {
    const runs = groupRuns([
      { id: "a", mine: true, created_at: at(0) },
      { id: "b", mine: true, created_at: at(4) },
      { id: "c", mine: true, created_at: at(9) },
      { id: "d", mine: true, created_at: at(15) },
      { id: "e", mine: false, created_at: at(16) },
      { id: "f", mine: false, created_at: at(17) },
      { id: "g", mine: true, created_at: at(18) },
    ]);
    expect(runs.map((r) => [r.key, r.mine, r.items.map((i) => i.id).join("")])).toEqual([
      ["a", true, "abc"],
      ["d", true, "d"],
      ["e", false, "ef"],
      ["g", true, "g"],
    ]);
  });

  it("lista vazia não tem blocos", () => {
    expect(groupRuns([])).toEqual([]);
  });
});

describe("unconfirmedPending", () => {
  const pending = (tempId: string, body: string, afterId: string | null): PendingMessage => ({
    tempId,
    body,
    afterId,
    created_at: "2026-10-28T12:00:00Z",
  });

  it("some quando a mensagem do servidor chega depois da última que estava na tela", () => {
    const messages = [
      { id: "m1", body: "ok", mine: true },
      { id: "m2", body: "Oi", mine: false },
      { id: "m3", body: "ok", mine: true },
    ];
    // A "ok" antiga (m1) não confirma a nova: só a que veio depois de m2.
    expect(unconfirmedPending([pending("t1", "ok", "m2")], messages)).toEqual([]);
    expect(unconfirmedPending([pending("t1", "ok", "m3")], messages)).toHaveLength(1);
  });

  it("casa uma a uma: 'ok' enviado duas vezes com um só confirmado deixa uma pendente", () => {
    const messages = [
      { id: "m1", body: "Oi", mine: false },
      { id: "m2", body: "ok", mine: true },
    ];
    const left = unconfirmedPending(
      [pending("t1", "ok", "m1"), pending("t2", "ok", "m1")],
      messages,
    );
    expect(left.map((p) => p.tempId)).toEqual(["t2"]);
  });

  it("ignora espaços nas pontas e mensagens da outra pessoa; conversa vazia usa afterId null", () => {
    expect(
      unconfirmedPending([pending("t1", "  Oi!  ", null)], [{ id: "m1", body: "Oi!", mine: true }]),
    ).toEqual([]);
    expect(
      unconfirmedPending([pending("t1", "Oi!", null)], [{ id: "m1", body: "Oi!", mine: false }]),
    ).toHaveLength(1);
  });
});

describe("toDirectMessages", () => {
  const rows = [
    { id: "m1", sender_id: ME, body: "Oi!", created_at: "2026-10-28T10:00:00Z" },
    { id: "m2", sender_id: HER, body: "Olá!", created_at: "2026-10-28T10:05:00Z" },
    { id: "m3", sender_id: ME, body: "Tudo bem?", created_at: "2026-10-28T10:10:00Z" },
    { id: "m4", sender_id: HER, body: "Tudo!", created_at: "2026-10-28T10:15:00Z" },
  ];

  it("marca as minhas e deriva a leitura de cada lado pela leitura da conversa", () => {
    const messages = toDirectMessages(rows, {
      userId: ME,
      myReadAt: "2026-10-28T10:06:00Z",
      otherReadAt: "2026-10-28T10:10:00Z",
    });
    expect(messages.map((m) => m.mine)).toEqual([true, false, true, false]);
    // Minhas: lidas até a leitura dela (inclusive no mesmo instante).
    expect(messages[0]!.read_at).toBe("2026-10-28T10:10:00Z");
    expect(messages[2]!.read_at).toBe("2026-10-28T10:10:00Z");
    // Dela: a m2 está coberta pela minha leitura; a m4 chegou depois.
    expect(messages[1]!.read_at).toBe("2026-10-28T10:06:00Z");
    expect(messages[3]!.read_at).toBeNull();
    expect(latestUnreadFromOther(messages)?.id).toBe("m4");
  });

  it("sem leitura nenhuma, tudo fica como não lido", () => {
    const messages = toDirectMessages(rows, { userId: ME, myReadAt: null, otherReadAt: null });
    expect(messages.every((m) => m.read_at === null)).toBe(true);
    expect(latestUnreadFromOther(messages)?.id).toBe("m4");
  });

  it("tudo lido: nenhuma não lida da outra pessoa", () => {
    const messages = toDirectMessages(rows, {
      userId: ME,
      myReadAt: "2026-10-28T11:00:00Z",
      otherReadAt: "2026-10-28T09:00:00Z",
    });
    expect(latestUnreadFromOther(messages)).toBeNull();
    expect(messages.filter((m) => m.mine).every((m) => m.read_at === null)).toBe(true);
  });

  it("aceita horários com e sem fração de segundo / fuso", () => {
    const messages = toDirectMessages(
      [{ id: "x", sender_id: HER, body: "Oi", created_at: "2026-10-28T10:00:00.123456+00:00" }],
      { userId: ME, myReadAt: "2026-10-28T07:00:01-03:00", otherReadAt: null },
    );
    expect(messages[0]!.read_at).toBe("2026-10-28T07:00:01-03:00");
  });
});

describe("conversationStarters", () => {
  it("cabem numa mensagem e usam o primeiro nome", () => {
    const starters = conversationStarters("Marina");
    expect(starters).toHaveLength(3);
    for (const starter of starters) {
      expect(starter.text.startsWith("Olá, Marina!")).toBe(true);
      expect(starter.text.length).toBeLessThanOrEqual(MESSAGE_MAX);
    }
    expect(conversationStarters("")[0]!.text.startsWith("Olá!")).toBe(true);
  });
});
