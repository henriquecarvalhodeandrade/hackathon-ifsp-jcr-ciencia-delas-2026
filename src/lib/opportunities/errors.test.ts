import { describe, expect, it } from "vitest";
import { ALREADY_APPLIED, fallbackMessage, friendlyOpportunityError } from "./errors";

describe("friendlyOpportunityError", () => {
  it("regras de negócio (CDxxx) chegam com a mensagem do banco", () => {
    expect(
      friendlyOpportunityError(
        { code: "CD071", message: "Esta vaga está encerrada ou fora do prazo." },
        "apply",
      ),
    ).toBe("Esta vaga está encerrada ou fora do prazo.");
    expect(friendlyOpportunityError({ code: "CD070", message: "Só pesquisadoras…" }, "save")).toBe(
      "Só pesquisadoras…",
    );
  });

  it("CD sem mensagem cai no texto do contexto", () => {
    expect(friendlyOpportunityError({ code: "CD075", message: "" }, "save")).toBe(
      fallbackMessage("save"),
    );
  });

  it("unicidade da candidatura vira o texto do CD073", () => {
    expect(friendlyOpportunityError({ code: "23505", message: "duplicate key" }, "apply")).toBe(
      ALREADY_APPLIED,
    );
    expect(friendlyOpportunityError({ code: "23505" }, "save")).toBe("Esse registro já existe.");
  });

  it("nunca mostra a mensagem técnica do Postgres", () => {
    const text = friendlyOpportunityError(
      { code: "XX000", message: "internal error at relation research_opportunities" },
      "respond",
    );
    expect(text).toBe(fallbackMessage("respond"));
    expect(friendlyOpportunityError(null, "load")).toBe(fallbackMessage("load"));
    expect(friendlyOpportunityError({ code: "42501" }, "respond")).toBe(
      "Só a dona da vaga responde às candidaturas.",
    );
    expect(friendlyOpportunityError({ code: "23514" }, "apply")).toMatch(/entre 30 e 2.000/);
  });
});
