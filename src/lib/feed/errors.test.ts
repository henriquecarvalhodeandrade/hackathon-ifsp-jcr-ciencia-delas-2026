import { describe, expect, it } from "vitest";
import { feedFallbackMessage, friendlyFeedError, isBusinessRuleError } from "./errors";

describe("friendlyFeedError", () => {
  it("repassa as mensagens CDxxx do banco", () => {
    const error = { code: "CD081", message: " Muitas publicações na última hora. " };
    expect(isBusinessRuleError(error)).toBe(true);
    expect(friendlyFeedError(error, "post")).toBe("Muitas publicações na última hora.");
    expect(friendlyFeedError({ code: "CD080", message: "Anexo que não é seu." }, "post")).toBe(
      "Anexo que não é seu.",
    );
  });

  it("CD sem mensagem cai no texto da operação", () => {
    expect(isBusinessRuleError({ code: "CD082", message: "" })).toBe(false);
    expect(friendlyFeedError({ code: "CD082", message: "" }, "comment")).toBe(
      feedFallbackMessage("comment"),
    );
  });

  it("traduz códigos genéricos no contexto da operação", () => {
    expect(friendlyFeedError({ code: "23505" }, "like")).toBe("Você já curtiu esta publicação.");
    expect(friendlyFeedError({ code: "23514" }, "comment")).toContain("1.500");
    expect(friendlyFeedError({ code: "23514" }, "post")).toContain("3.000");
    expect(friendlyFeedError({ code: "23503" }, "post")).toContain("anexo");
    expect(friendlyFeedError({ code: "23503" }, "comment")).toContain("não existe mais");
    expect(friendlyFeedError({ code: "42501" }, "edit")).toBe(
      "Só a autora pode editar esta publicação.",
    );
    expect(friendlyFeedError({ code: "42501" }, "like")).toBe(
      "Você não tem permissão para fazer isso.",
    );
    expect(friendlyFeedError({ code: "PGRST301" }, "post")).toContain("sessão expirou");
  });

  it("sem erro ou com código desconhecido, usa o texto de reserva", () => {
    expect(friendlyFeedError(null, "delete")).toBe(feedFallbackMessage("delete"));
    expect(friendlyFeedError({ code: "XX000", message: "boom" }, "comment-delete")).toBe(
      feedFallbackMessage("comment-delete"),
    );
  });
});
