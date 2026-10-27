import { describe, expect, it } from "vitest";
import { friendlyDbError } from "./errors";

describe("friendlyDbError", () => {
  it("repassa as mensagens pt-BR dos erros CD***", () => {
    expect(
      friendlyDbError({ code: "CD012", message: "Você não pode votar no paper que você mesma enviou." }, "vote"),
    ).toBe("Você não pode votar no paper que você mesma enviou.");
  });

  it("traduz DOI duplicado", () => {
    expect(
      friendlyDbError(
        { code: "23505", message: 'duplicate key value violates unique constraint "papers_doi_key"' },
        "save",
      ),
    ).toMatch(/DOI já está na Vitrine/);
    expect(friendlyDbError({ code: "23505", message: "paper_votes_pkey" }, "vote")).toBe("Você já destacou este paper.");
  });

  it("usa mensagens genéricas amigáveis para o resto", () => {
    expect(friendlyDbError({ code: "42501", message: "permission denied for table papers" }, "save")).toMatch(
      /permissão/,
    );
    expect(friendlyDbError({ code: "XX000", message: "internal" }, "comment")).toMatch(/comentário/);
    expect(friendlyDbError(null, "delete")).toMatch(/excluir/);
    expect(friendlyDbError({ code: "CD999" }, "load")).toMatch(/carregar/);
  });
});
