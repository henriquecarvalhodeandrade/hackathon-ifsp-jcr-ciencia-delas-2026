import { describe, expect, it } from "vitest";
import { pickWaitingConversations, type InboxRow } from "./network";

/** Quais conversas diretas entram em "O que está esperando você" (regra pura). */

const ME = "eu";

const row = (over: Partial<InboxRow>): InboxRow => ({
  id: "c",
  status: "active",
  initiator_id: "outra",
  unread: false,
  last_message_at: "2026-10-28T10:00:00Z",
  created_at: "2026-10-27T10:00:00Z",
  other_id: "outra",
  other_name: "Outra Pessoa",
  other_avatar_url: null,
  ...over,
});

describe("pickWaitingConversations", () => {
  it("pedidos recebidos (lidos ou não) e conversas aceitas com mensagem nova; pedidos primeiro", () => {
    const picked = pickWaitingConversations(
      [
        row({ id: "nova", unread: true, last_message_at: "2026-10-28T12:00:00Z" }),
        row({ id: "lida", unread: false }),
        row({ id: "pedido-lido", status: "request", unread: false }),
        row({ id: "pedido-meu", status: "request", initiator_id: ME, unread: false }),
        row({ id: "recusada", status: "declined", unread: true }),
        row({
          id: "pedido-novo",
          status: "request",
          unread: true,
          other_name: "Renata Carvalho",
          last_message_at: "2026-10-28T11:00:00Z",
        }),
      ],
      ME,
    );
    expect(picked.map((c) => [c.id, c.kind])).toEqual([
      ["pedido-novo", "request"],
      ["pedido-lido", "request"],
      ["nova", "message"],
    ]);
    expect(picked[0]!.person).toEqual({ id: "outra", name: "Renata Carvalho", avatarUrl: null });
  });

  it("sem mensagem ainda, usa a data de criação para ordenar", () => {
    const picked = pickWaitingConversations(
      [
        row({
          id: "a",
          status: "request",
          last_message_at: null,
          created_at: "2026-10-20T00:00:00Z",
        }),
        row({ id: "b", status: "request", last_message_at: "2026-10-21T00:00:00Z" }),
      ],
      ME,
    );
    expect(picked.map((c) => [c.id, c.at])).toEqual([
      ["b", "2026-10-21T00:00:00Z"],
      ["a", "2026-10-20T00:00:00Z"],
    ]);
  });
});
