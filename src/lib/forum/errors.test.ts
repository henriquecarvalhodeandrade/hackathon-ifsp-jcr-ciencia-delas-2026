import { describe, expect, it } from "vitest";
import { friendlyDbError, isBusinessRuleError } from "./errors";

describe("friendlyDbError", () => {
  it("mostra a mensagem pt-BR das regras de negócio (CDxxx)", () => {
    const error = { code: "CD011", message: "Este tópico está trancado e não aceita novas respostas." };
    expect(isBusinessRuleError(error)).toBe(true);
    expect(friendlyDbError(error, "fallback")).toBe("Este tópico está trancado e não aceita novas respostas.");
  });

  it("traduz códigos conhecidos do Postgres sem vazar a mensagem técnica", () => {
    expect(friendlyDbError({ code: "42501", message: "new row violates row-level security policy" }, "x")).toBe(
      "Você não tem permissão para fazer isso.",
    );
    expect(friendlyDbError({ code: "23514", message: 'violates check constraint "forum_threads_title_check"' }, "x")).toContain(
      "formato esperado",
    );
  });

  it("usa o fallback para erros desconhecidos ou de rede", () => {
    expect(friendlyDbError({ message: "TypeError: fetch failed" }, "Não conseguimos publicar.")).toBe(
      "Não conseguimos publicar.",
    );
    expect(friendlyDbError(null, "Falhou.")).toBe("Falhou.");
    expect(isBusinessRuleError({ code: "CD010", message: "" })).toBe(false);
  });
});
