import { describe, expect, it } from "vitest";
import {
  conversationHref,
  conversationStarters,
  conversationState,
  latestUnreadFromOther,
  MESSAGE_MAX,
  startConversationHref,
  toDirectMessages,
  type ConversationStatus,
} from "./conversation";

const CONVERSATION = "5f0c8f1e-2b6a-4c55-9d43-0d6f1f3b2a10";
const ME = "11111111-1111-4111-8111-111111111111";
const HER = "22222222-2222-4222-8222-222222222222";

function state(status: ConversationStatus, iAmInitiator: boolean, mySentCount = 0) {
  return conversationState({ status, iAmInitiator, mySentCount, otherFirstName: "Marina" });
}

describe("links", () => {
  it("monta o link da conversa e o de começar uma conversa", () => {
    expect(conversationHref(CONVERSATION)).toBe(`/mensagens/${CONVERSATION}`);
    expect(startConversationHref(HER)).toBe(`/mensagens?com=${HER}`);
  });
});

describe("conversationState", () => {
  it("conversa aceita: campo normal, sem aviso, com recibo de leitura", () => {
    for (const initiator of [true, false]) {
      expect(state("active", initiator, 3)).toEqual({
        canSend: true,
        banner: null,
        showReadReceipts: true,
      });
    }
  });

  it("pedido que eu comecei, ainda sem mensagem: posso mandar a única mensagem do pedido", () => {
    const s = state("request", true, 0);
    expect(s.canSend).toBe(true);
    expect(s.banner?.kind).toBe("first-request");
    expect(s.banner?.body).toContain("Marina");
    expect(s.showReadReceipts).toBe(false);
  });

  it("pedido que eu comecei, já com a minha mensagem: espero a resposta", () => {
    const s = state("request", true, 1);
    expect(s.canSend).toBe(false);
    expect(s.banner).toMatchObject({ kind: "waiting", variant: "info" });
    expect(s.banner?.body).toBe(
      "Seu pedido de mensagem foi enviado. Você poderá mandar mais mensagens quando Marina responder.",
    );
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
    });
    expect(s.banner?.body).toContain("Responder também aceita o pedido.");
    expect(s.showReadReceipts).toBe(false);
  });

  it("pedido que eu recusei: responder reabre a conversa", () => {
    const s = state("declined", false, 0);
    expect(s.canSend).toBe(true);
    expect(s.banner).toMatchObject({
      kind: "declined-by-me",
      body: "Você recusou este pedido. Responder reabre a conversa.",
    });
  });

  it("sem o primeiro nome, usa um genérico", () => {
    const s = conversationState({
      status: "request",
      iAmInitiator: true,
      mySentCount: 1,
      otherFirstName: "",
    });
    expect(s.banner?.body).toContain("quando ela responder");
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
