import { describe, expect, it } from "vitest";
import {
  buildInbox,
  inboxBadge,
  inboxHref,
  inboxTabOf,
  parseInboxTab,
  previewText,
  resolveInboxTab,
  toInboxItem,
  type InboxRow,
} from "./inbox";

const ME = "11111111-1111-4111-8111-111111111111";
const HER = "22222222-2222-4222-8222-222222222222";

function row(overrides: Partial<InboxRow> = {}): InboxRow {
  return {
    id: "c1",
    status: "active",
    initiator_id: ME,
    last_message_at: "2026-10-28T10:00:00Z",
    last_message_preview: "Oi, tudo bem?",
    last_sender_id: HER,
    unread: false,
    other_id: HER,
    other_name: "Marina Souza",
    other_avatar_url: null,
    other_headline: "Física de materiais",
    other_career_stage: "professor",
    created_at: "2026-10-27T10:00:00Z",
    ...overrides,
  };
}

describe("parseInboxTab / inboxHref", () => {
  it("só aceita as abas conhecidas", () => {
    expect(parseInboxTab("pedidos")).toBe("pedidos");
    expect(parseInboxTab(["conversas", "pedidos"])).toBe("conversas");
    expect(parseInboxTab("recusadas")).toBeNull();
    expect(parseInboxTab(undefined)).toBeNull();
  });

  it("Conversas é a página sem parâmetro", () => {
    expect(inboxHref()).toBe("/mensagens");
    expect(inboxHref("pedidos")).toBe("/mensagens?aba=pedidos");
  });
});

describe("inboxTabOf", () => {
  it("aceitas vão para Conversas, seja quem for que começou", () => {
    expect(inboxTabOf(row({ initiator_id: ME }), ME)).toBe("conversas");
    expect(inboxTabOf(row({ initiator_id: HER }), ME)).toBe("conversas");
  });

  it("pedido que recebi vai para Pedidos", () => {
    expect(inboxTabOf(row({ status: "request", initiator_id: HER }), ME)).toBe("pedidos");
  });

  it("pedido que mandei fica em Conversas (aguardando), recusado ou não", () => {
    expect(inboxTabOf(row({ status: "request", initiator_id: ME, last_sender_id: ME }), ME)).toBe(
      "conversas",
    );
    expect(inboxTabOf(row({ status: "declined", initiator_id: ME, last_sender_id: ME }), ME)).toBe(
      "conversas",
    );
  });

  it("pedido que eu recusei continua ao alcance em Conversas (responder reabre)", () => {
    expect(inboxTabOf(row({ status: "declined", initiator_id: HER }), ME)).toBe("conversas");
  });

  it("conversa vazia aberta pela outra pessoa não aparece; a minha aparece", () => {
    const empty = { last_message_at: null, last_message_preview: null, last_sender_id: null };
    expect(inboxTabOf(row({ ...empty, initiator_id: HER }), ME)).toBeNull();
    expect(inboxTabOf(row({ ...empty, status: "request", initiator_id: HER }), ME)).toBeNull();
    expect(inboxTabOf(row({ ...empty, initiator_id: ME }), ME)).toBe("conversas");
    expect(inboxTabOf(row({ ...empty, status: "request", initiator_id: ME }), ME)).toBe(
      "conversas",
    );
  });
});

describe("inboxBadge", () => {
  it("quem pediu nunca vê 'recusado'", () => {
    expect(inboxBadge(row({ status: "request", initiator_id: ME, last_sender_id: ME }), ME)).toBe(
      "waiting",
    );
    expect(inboxBadge(row({ status: "declined", initiator_id: ME, last_sender_id: ME }), ME)).toBe(
      "waiting",
    );
    expect(
      inboxBadge(
        row({
          status: "declined",
          initiator_id: ME,
          last_sender_id: null,
          last_message_preview: null,
        }),
        ME,
      ),
    ).toBe("waiting");
  });

  it("pedido aberto por mim sem mensagem: falta escrever", () => {
    expect(
      inboxBadge(
        row({
          status: "request",
          initiator_id: ME,
          last_sender_id: null,
          last_message_preview: null,
        }),
        ME,
      ),
    ).toBe("draft");
  });

  it("quem recebeu vê o pedido e a própria recusa; conversa aceita não tem selo", () => {
    expect(inboxBadge(row({ status: "request", initiator_id: HER }), ME)).toBe("request");
    expect(inboxBadge(row({ status: "declined", initiator_id: HER }), ME)).toBe("declined-by-me");
    expect(inboxBadge(row({ status: "active" }), ME)).toBeNull();
  });
});

describe("previewText", () => {
  it("prefixa 'Você: ' quando a última mensagem é minha", () => {
    expect(previewText(row({ last_sender_id: ME }), ME)).toBe("Você: Oi, tudo bem?");
    expect(previewText(row({ last_sender_id: HER }), ME)).toBe("Oi, tudo bem?");
  });

  it("junta as quebras de linha e some sem mensagem", () => {
    expect(previewText(row({ last_message_preview: "Oi!\n\nTudo  bem?" }), ME)).toBe(
      "Oi! Tudo bem?",
    );
    expect(previewText(row({ last_message_preview: null, last_sender_id: null }), ME)).toBeNull();
    expect(previewText(row({ last_message_preview: "   " }), ME)).toBeNull();
  });
});

describe("toInboxItem / buildInbox", () => {
  it("monta a linha com link, prévia e não lida", () => {
    const item = toInboxItem(row({ unread: true }), ME);
    expect(item).toMatchObject({
      href: "/mensagens/c1",
      tab: "conversas",
      preview: "Oi, tudo bem?",
      unread: true,
      badge: null,
      at: "2026-10-28T10:00:00Z",
      other: { id: HER, name: "Marina Souza" },
    });
  });

  it("não marca como não lida quando a última mensagem é minha", () => {
    expect(toInboxItem(row({ unread: true, last_sender_id: ME }), ME)?.unread).toBe(false);
  });

  it("sem mensagem, usa a criação como horário", () => {
    const item = toInboxItem(
      row({ last_message_at: null, last_sender_id: null, last_message_preview: null }),
      ME,
    );
    expect(item?.at).toBe("2026-10-27T10:00:00Z");
    expect(item?.preview).toBeNull();
  });

  it("separa as abas, ordena pelas mais recentes e conta as não lidas", () => {
    const inbox = buildInbox(
      [
        row({ id: "old", last_message_at: "2026-10-20T10:00:00Z", unread: true }),
        row({ id: "req", status: "request", initiator_id: HER, unread: true }),
        row({ id: "new", last_message_at: "2026-10-28T12:00:00Z" }),
        row({
          id: "hidden",
          initiator_id: HER,
          last_message_at: null,
          last_sender_id: null,
          last_message_preview: null,
        }),
        row({ id: "mine-declined", status: "declined", initiator_id: ME, last_sender_id: ME }),
      ],
      ME,
    );
    expect(inbox.conversas.map((i) => i.id)).toEqual(["new", "mine-declined", "old"]);
    expect(inbox.pedidos.map((i) => i.id)).toEqual(["req"]);
    expect(inbox.unreadConversations).toBe(1);
  });
});

describe("resolveInboxTab", () => {
  const empty = { conversas: [], pedidos: [], unreadConversations: 0 };
  const withRequest = buildInbox([row({ status: "request", initiator_id: HER })], ME);

  it("respeita a aba pedida", () => {
    expect(resolveInboxTab("pedidos", empty)).toBe("pedidos");
    expect(resolveInboxTab("conversas", withRequest)).toBe("conversas");
  });

  it("sem aba na URL: Conversas, ou Pedidos quando só há pedidos", () => {
    expect(resolveInboxTab(null, empty)).toBe("conversas");
    expect(resolveInboxTab(null, withRequest)).toBe("pedidos");
  });
});
