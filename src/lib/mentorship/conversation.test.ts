import { describe, expect, it } from "vitest";
import {
  conversationHref,
  conversationStarters,
  conversationState,
  countByRequest,
  dayKey,
  dayLabel,
  groupByDay,
  hasConversation,
  MESSAGE_MAX,
  otherRoleLabel,
  unreadLabel,
} from "./conversation";
import { friendlyMentorshipError } from "./errors";
import { messageSchema } from "./schemas";

const REQUEST = "5f0c8f1e-2b6a-4c55-9d43-0d6f1f3b2a10";

describe("hasConversation", () => {
  it("só depois do aceite: ativa, concluída ou cancelada depois de aceita", () => {
    expect(hasConversation({ status: "accepted", responded_at: "2026-10-01T10:00:00Z" })).toBe(
      true,
    );
    expect(hasConversation({ status: "completed", responded_at: "2026-10-01T10:00:00Z" })).toBe(
      true,
    );
    expect(hasConversation({ status: "cancelled", responded_at: "2026-10-01T10:00:00Z" })).toBe(
      true,
    );
    expect(hasConversation({ status: "cancelled", responded_at: null })).toBe(false);
    expect(hasConversation({ status: "pending", responded_at: null })).toBe(false);
    expect(hasConversation({ status: "declined", responded_at: "2026-10-01T10:00:00Z" })).toBe(
      false,
    );
  });

  it("monta o link da conversa", () => {
    expect(conversationHref(REQUEST)).toBe(`/mentoria/conversa/${REQUEST}`);
  });
});

describe("conversationState", () => {
  it("aberta só com a mentoria aceita", () => {
    expect(conversationState("accepted", "mentee", "Marina")).toEqual({
      canSend: true,
      banner: null,
    });
  });

  it("concluída e cancelada ficam só para leitura", () => {
    const done = conversationState("completed", "mentee", "Marina");
    expect(done.canSend).toBe(false);
    expect(done.banner).toMatchObject({ title: "Mentoria concluída" });
    expect(done.banner?.body).toContain("Marina");
    expect(done.banner?.body).toContain("só para leitura");
    expect(conversationState("cancelled", "mentor", "Larissa")).toMatchObject({
      canSend: false,
      banner: { title: "Mentoria cancelada" },
    });
  });

  it("cancelado antes do aceite não é conversa guardada", () => {
    expect(conversationState("cancelled", "mentee", "Marina", false)).toEqual({
      canSend: false,
      banner: {
        variant: "info",
        title: "Pedido cancelado",
        body: "O pedido foi cancelado antes do aceite: esta conversa não chegou a ser aberta.",
      },
    });
    // Concluída não depende disso (só existe depois do aceite).
    expect(conversationState("completed", "mentee", "Marina", false).banner?.title).toBe(
      "Mentoria concluída",
    );
  });

  it("pendente explica quem precisa aceitar", () => {
    expect(conversationState("pending", "mentor", "Larissa").banner?.body).toBe(
      "A conversa abre assim que você aceitar o pedido.",
    );
    expect(conversationState("pending", "mentee", "Marina").banner?.body).toBe(
      "A conversa abre assim que Marina aceitar o seu pedido.",
    );
    expect(conversationState("declined", "mentee", "Marina")).toMatchObject({
      canSend: false,
      banner: { variant: "warning" },
    });
  });

  it("sem nome, usa o papel", () => {
    expect(conversationState("completed", "mentee", "").banner?.body).toContain("sua mentora");
    expect(conversationState("completed", "mentor", "").banner?.body).toContain("sua mentoranda");
  });

  it("rótulo do papel da outra participante", () => {
    expect(otherRoleLabel("mentee")).toBe("Mentora");
    expect(otherRoleLabel("mentor")).toBe("Mentoranda");
  });
});

describe("dias da conversa (fuso de São Paulo)", () => {
  const now = new Date("2026-10-28T15:00:00Z"); // 12:00 em São Paulo

  it("dayKey usa o dia de São Paulo, não o de UTC", () => {
    expect(dayKey("2026-10-28T02:30:00Z")).toBe("2026-10-27"); // 23:30 do dia 27 em SP
    expect(dayKey("2026-10-28T03:30:00Z")).toBe("2026-10-28");
  });

  it("hoje, ontem e datas por extenso (com ano só se for outro)", () => {
    expect(dayLabel("2026-10-28", now)).toBe("Hoje");
    expect(dayLabel("2026-10-27", now)).toBe("Ontem");
    expect(dayLabel("2026-10-26", now)).toBe("segunda-feira, 26 de outubro");
    expect(dayLabel("2025-12-31", now)).toBe("quarta-feira, 31 de dezembro de 2025");
  });

  it("agrupa mensagens consecutivas do mesmo dia, mantendo a ordem", () => {
    const groups = groupByDay(
      [
        { id: "a", created_at: "2026-10-26T13:00:00Z" },
        { id: "b", created_at: "2026-10-28T02:59:00Z" }, // 23:59 do dia 27 em SP
        { id: "c", created_at: "2026-10-28T03:01:00Z" }, // 00:01 do dia 28 em SP
        { id: "d", created_at: "2026-10-28T14:00:00Z" },
      ],
      now,
    );
    expect(groups.map((g) => [g.label, g.items.map((i) => i.id)])).toEqual([
      ["segunda-feira, 26 de outubro", ["a"]],
      ["Ontem", ["b"]],
      ["Hoje", ["c", "d"]],
    ]);
    expect(groupByDay([], now)).toEqual([]);
  });
});

describe("não lidas", () => {
  it("conta por conversa", () => {
    const counts = countByRequest([{ request_id: "a" }, { request_id: "b" }, { request_id: "a" }]);
    expect(Object.fromEntries(counts)).toEqual({ a: 2, b: 1 });
  });

  it("texto para leitor de tela", () => {
    expect(unreadLabel(1)).toBe("1 mensagem não lida");
    expect(unreadLabel(4)).toBe("4 mensagens não lidas");
  });
});

describe("conversationStarters", () => {
  it("sugere o primeiro encontro com o nome da outra participante", () => {
    const mentee = conversationStarters("mentee", "Marina");
    expect(mentee).toHaveLength(3);
    expect(mentee[0]!.text).toMatch(/^Olá, Marina! Muito obrigada por aceitar a mentoria\./);
    const mentor = conversationStarters("mentor", "Larissa");
    expect(mentor[0]!.text).toMatch(/^Olá, Larissa! Que bom começar esta mentoria\./);
    expect(mentor.map((s) => s.label)).toContain("Perguntar o objetivo");
    for (const starter of [...mentee, ...mentor]) {
      expect(starter.text.length).toBeLessThanOrEqual(MESSAGE_MAX);
      expect(starter.text).not.toMatch(/\[|\]/);
    }
    expect(conversationStarters("mentee", "")[0]!.text).toMatch(/^Olá! /);
  });
});

describe("messageSchema", () => {
  it("aceita de 1 a 2.000 caracteres depois de tirar os espaços das pontas", () => {
    expect(messageSchema.parse({ request_id: REQUEST, body: "  Oi!\n " })).toEqual({
      request_id: REQUEST,
      body: "Oi!",
    });
    expect(messageSchema.safeParse({ request_id: REQUEST, body: " \n\t " }).success).toBe(false);
    expect(
      messageSchema.safeParse({ request_id: REQUEST, body: "a".repeat(MESSAGE_MAX) }).success,
    ).toBe(true);
    expect(
      messageSchema.safeParse({ request_id: REQUEST, body: "a".repeat(MESSAGE_MAX + 1) }).success,
    ).toBe(false);
  });

  it("troca CRLF (como o navegador envia o textarea) por LF antes de contar", () => {
    expect(messageSchema.parse({ request_id: REQUEST, body: "Linha 1\r\nLinha 2\r" }).body).toBe(
      "Linha 1\nLinha 2",
    );
    const lines = Array.from({ length: 1000 }, () => "a").join("\r\n"); // 1.999 com LF
    expect(messageSchema.safeParse({ request_id: REQUEST, body: lines }).success).toBe(true);
  });

  it("recusa id de conversa inválido", () => {
    const result = messageSchema.safeParse({ request_id: "x", body: "Oi" });
    expect(result.success).toBe(false);
  });
});

describe("erros ao enviar mensagem", () => {
  it("mostra as mensagens pt-BR do banco (conversa fechada, limite, conversa alheia)", () => {
    for (const [code, message] of [
      ["CD027", "Esta mentoria foi concluída: a conversa fica guardada só para leitura."],
      ["CD026", "Você enviou muitas mensagens na última hora. Respire e tente de novo."],
      ["CD015", "Não encontramos esta conversa."],
    ] as const) {
      expect(friendlyMentorshipError({ code, message }, "message")).toBe(message);
    }
  });

  it("traduz CHECK, permissão e falhas genéricas", () => {
    expect(friendlyMentorshipError({ code: "23514" }, "message")).toBe(
      "A mensagem precisa ter entre 1 e 2.000 caracteres.",
    );
    expect(friendlyMentorshipError({ code: "42501", message: "rls" }, "message")).toMatch(
      /não está aberta/,
    );
    expect(friendlyMentorshipError({ code: "XX000" }, "message")).toMatch(/texto continua aqui/);
    expect(friendlyMentorshipError({ code: "XX000" }, "read")).toMatch(/como lidas/);
  });
});
