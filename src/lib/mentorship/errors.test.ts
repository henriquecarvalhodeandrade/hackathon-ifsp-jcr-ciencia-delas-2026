import { describe, expect, it } from "vitest";
import { fallbackMessage, friendlyMentorshipError } from "./errors";

describe("friendlyMentorshipError", () => {
  it("mostra a mensagem pt-BR dos erros CDxxx do banco", () => {
    const message =
      "Você já atingiu o limite de 1 mentoria(s) simultânea(s). Conclua uma mentoria ou aumente sua capacidade no perfil para aceitar este pedido.";
    expect(friendlyMentorshipError({ code: "CD001", message }, "respond")).toBe(message);
    expect(
      friendlyMentorshipError(
        { code: "CD004", message: "Você já tem um pedido em aberto." },
        "request",
      ),
    ).toBe("Você já tem um pedido em aberto.");
  });

  it("não vaza mensagens técnicas em inglês", () => {
    const out = friendlyMentorshipError(
      { code: "42501", message: "new row violates row-level security policy for table" },
      "request",
    );
    expect(out).toBe("Esta mentora não está recebendo pedidos no momento.");
    expect(friendlyMentorshipError({ code: "42501", message: "permission denied" }, "cancel")).toBe(
      "Você não tem permissão para fazer isso.",
    );
    expect(friendlyMentorshipError({ code: "XX000", message: "internal error" }, "complete")).toBe(
      fallbackMessage("complete"),
    );
  });

  it("trata duplicidade e CHECK", () => {
    expect(friendlyMentorshipError({ code: "23505" }, "request")).toMatch(/pedido em aberto/);
    expect(friendlyMentorshipError({ code: "23514" }, "request")).toMatch(/20 e 1\.500/);
  });

  it("CD sem mensagem cai no texto padrão", () => {
    expect(friendlyMentorshipError({ code: "CD002", message: "" }, "respond")).toBe(
      fallbackMessage("respond"),
    );
  });

  it("aceita erro nulo", () => {
    expect(friendlyMentorshipError(null)).toBe(fallbackMessage("generic"));
    expect(friendlyMentorshipError(undefined, "consent")).toBe(fallbackMessage("consent"));
  });

  it("sessão expirada", () => {
    expect(friendlyMentorshipError({ code: "PGRST301" }, "request")).toMatch(/sessão expirou/);
  });
});
