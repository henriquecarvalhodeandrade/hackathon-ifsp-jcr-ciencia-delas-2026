import { describe, expect, it } from "vitest";
import { MESSAGE_MAX } from "./conversation";
import { fallbackMessage, friendlyMessagesError, SESSION_EXPIRED } from "./errors";
import {
  conversationIdSchema,
  directMessageSchema,
  fieldErrorsOf,
  respondConversationSchema,
  startConversationSchema,
} from "./schema";

const CONVERSATION = "5f0c8f1e-2b6a-4c55-9d43-0d6f1f3b2a10";
const PROFILE = "22222222-2222-4222-8222-222222222222";

describe("directMessageSchema", () => {
  it("apara o texto e aceita de 1 a 2.000 caracteres", () => {
    const parsed = directMessageSchema.parse({ conversation_id: CONVERSATION, body: "  Oi!  " });
    expect(parsed).toEqual({ conversation_id: CONVERSATION, body: "Oi!" });
    expect(
      directMessageSchema.safeParse({
        conversation_id: CONVERSATION,
        body: "a".repeat(MESSAGE_MAX),
      }).success,
    ).toBe(true);
  });

  it("recusa vazia (ou só espaços) e longa demais, com mensagem em pt-BR", () => {
    const blank = directMessageSchema.safeParse({ conversation_id: CONVERSATION, body: " \n " });
    expect(blank.success).toBe(false);
    if (!blank.success) {
      expect(fieldErrorsOf(blank.error).body).toEqual(["Escreva uma mensagem antes de enviar."]);
    }
    const long = directMessageSchema.safeParse({
      conversation_id: CONVERSATION,
      body: "a".repeat(MESSAGE_MAX + 1),
    });
    expect(long.success).toBe(false);
    if (!long.success) {
      expect(fieldErrorsOf(long.error).body).toEqual(["Use no máximo 2.000 caracteres."]);
    }
  });

  it("conta CRLF como uma quebra de linha só (igual ao contador do campo)", () => {
    const body = "a\r\n".repeat(MESSAGE_MAX / 2 - 1) + "ab";
    const parsed = directMessageSchema.safeParse({ conversation_id: CONVERSATION, body });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.body).not.toContain("\r");
  });

  it("exige um id de conversa válido", () => {
    const parsed = directMessageSchema.safeParse({ conversation_id: "abc", body: "Oi" });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(fieldErrorsOf(parsed.error).conversation_id?.[0]).toContain("Não encontramos");
    }
    expect(conversationIdSchema.safeParse(CONVERSATION).success).toBe(true);
    expect(conversationIdSchema.safeParse("../admin").success).toBe(false);
  });
});

describe("respondConversationSchema", () => {
  it("transforma a escolha em booleano", () => {
    expect(
      respondConversationSchema.parse({ conversation_id: CONVERSATION, accept: "true" }).accept,
    ).toBe(true);
    expect(
      respondConversationSchema.parse({ conversation_id: CONVERSATION, accept: "false" }).accept,
    ).toBe(false);
    expect(
      respondConversationSchema.safeParse({ conversation_id: CONVERSATION, accept: "talvez" })
        .success,
    ).toBe(false);
  });
});

describe("startConversationSchema", () => {
  it("só aceita um id de perfil", () => {
    expect(startConversationSchema.safeParse({ profile_id: PROFILE }).success).toBe(true);
    expect(startConversationSchema.safeParse({ profile_id: "" }).success).toBe(false);
  });
});

describe("friendlyMessagesError", () => {
  it("regras de negócio do banco passam direto (já vêm em pt-BR)", () => {
    for (const code of ["CD060", "CD065", "CD084", "CD085", "CD086", "CD088", "CD089"]) {
      expect(friendlyMessagesError({ code, message: ` Texto do ${code}. ` }, "start")).toBe(
        `Texto do ${code}.`,
      );
    }
  });

  it("CD sem texto e códigos desconhecidos caem no texto da operação", () => {
    expect(friendlyMessagesError({ code: "CD084", message: "" }, "start")).toBe(
      fallbackMessage("start"),
    );
    expect(friendlyMessagesError({ code: "XX000", message: "boom" }, "send")).toBe(
      fallbackMessage("send"),
    );
    expect(friendlyMessagesError(null, "respond")).toBe(fallbackMessage("respond"));
  });

  it("nunca mostra o texto técnico do Postgres", () => {
    const text = friendlyMessagesError(
      { code: "42501", message: "new row violates row-level security policy" },
      "send",
    );
    expect(text).toBe("Esta conversa não está aberta para novas mensagens. Recarregue a página.");
    expect(friendlyMessagesError({ code: "23514", message: "check" }, "send")).toContain("2.000");
    expect(friendlyMessagesError({ code: "22P02", message: "invalid uuid" }, "start")).toContain(
      "pesquisadora",
    );
    expect(friendlyMessagesError({ code: "PGRST301", message: "JWT expired" }, "read")).toBe(
      SESSION_EXPIRED,
    );
  });
});
