import { describe, expect, it } from "vitest";
import { friendlyDbError, GENERIC_ERROR } from "./errors";

describe("friendlyDbError", () => {
  it("mostra a mensagem pt-BR dos erros de regra de negócio (CD…)", () => {
    expect(friendlyDbError({ code: "CD015", message: "Paper não encontrado." })).toBe("Paper não encontrado.");
  });

  it("traduz códigos conhecidos do Postgres/PostgREST", () => {
    expect(friendlyDbError({ code: "42501", message: "permission denied for table reports" })).toBe(
      "Você não tem permissão para fazer isso.",
    );
    expect(friendlyDbError({ code: "PGRST116" })).toMatch(/Não encontramos/);
    expect(friendlyDbError({ code: "23514" })).toMatch(/formato/);
  });

  it("nunca vaza mensagens cruas desconhecidas", () => {
    expect(friendlyDbError({ code: "XX000", message: "internal error at line 3" })).toBe(GENERIC_ERROR);
    expect(friendlyDbError({ code: "CD999", message: "  " })).toBe(GENERIC_ERROR);
    expect(friendlyDbError(null, "Falhou.")).toBe("Falhou.");
  });
});
