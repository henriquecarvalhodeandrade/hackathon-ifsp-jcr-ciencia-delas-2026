import { describe, expect, it } from "vitest";
import { fallbackMessage, friendlyRecognitionError } from "./errors";

describe("friendlyRecognitionError", () => {
  it("repassa as mensagens de regra de negócio do banco (CD030–CD037, CD013)", () => {
    for (const [code, message] of [
      ["CD030", "Você poderá contar como foi quando a mentoria for concluída."],
      ["CD031", "Não encontramos esta mentoria."],
      ["CD032", "Você já contou como foi esta mentoria. Obrigada!"],
      ["CD034", "Já existe uma declaração para esta mentoria."],
      ["CD035", "Esta declaração foi revogada. Peça uma nova, se quiserem."],
      ["CD013", "Autoria inválida: envie o retorno sempre com a sua própria conta."],
    ] as const) {
      expect(friendlyRecognitionError({ code, message }, "feedback")).toBe(message);
    }
  });

  it("traduz corridas e permissões", () => {
    expect(friendlyRecognitionError({ code: "23505", message: "dup" }, "feedback")).toBe(
      "Você já contou como foi esta mentoria. Obrigada!",
    );
    expect(friendlyRecognitionError({ code: "23505", message: "dup" }, "declaration-request")).toBe(
      "Já existe uma declaração para esta mentoria.",
    );
    expect(friendlyRecognitionError({ code: "42501", message: "denied" }, "feedback")).toMatch(
      /permissão/,
    );
    expect(friendlyRecognitionError({ code: "PGRST301", message: "jwt" }, "feedback")).toMatch(
      /sessão expirou/,
    );
  });

  it("não vaza mensagens técnicas", () => {
    const message = friendlyRecognitionError(
      { code: "XX000", message: 'relation "x" does not exist' },
      "declaration-revoke",
    );
    expect(message).toBe(fallbackMessage("declaration-revoke"));
    expect(friendlyRecognitionError(null, "declaration-consent")).toBe(
      fallbackMessage("declaration-consent"),
    );
  });
});
