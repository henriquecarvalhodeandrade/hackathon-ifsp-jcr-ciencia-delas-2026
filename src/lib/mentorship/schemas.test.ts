import { describe, expect, it } from "vitest";
import { defaultRequestMessage } from "./presentation";
import {
  availabilitySchema,
  consentSchema,
  fieldErrorsOf,
  requestIdSchema,
  requestSchema,
  respondSchema,
} from "./schemas";

const MENTOR = "d1000000-0000-4000-8000-000000000001";

describe("requestSchema", () => {
  it("aceita uma mensagem válida e corta espaços", () => {
    const parsed = requestSchema.parse({
      mentor_id: MENTOR,
      message: "   Olá! Faço mestrado em ecologia e queria ajuda com editais.  ",
    });
    expect(parsed.message).toBe("Olá! Faço mestrado em ecologia e queria ajuda com editais.");
  });

  it("exige de 20 a 1.500 caracteres", () => {
    const short = requestSchema.safeParse({ mentor_id: MENTOR, message: "Oi, tudo bem?" });
    expect(short.success).toBe(false);
    if (!short.success) expect(fieldErrorsOf(short.error).message?.[0]).toMatch(/pelo menos 20/);

    const long = requestSchema.safeParse({ mentor_id: MENTOR, message: "a".repeat(1501) });
    expect(long.success).toBe(false);
    if (!long.success) expect(fieldErrorsOf(long.error).message?.[0]).toMatch(/1\.500/);
  });

  it("recusa o rascunho padrão sem personalizar", () => {
    const parsed = requestSchema.safeParse({
      mentor_id: MENTOR,
      message: defaultRequestMessage("Marina"),
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) expect(fieldErrorsOf(parsed.error).message?.[0]).toMatch(/colchetes/);
  });

  it("aceita colchetes que não são do rascunho", () => {
    const parsed = requestSchema.safeParse({
      mentor_id: MENTOR,
      message: "Estudo o modelo [Smith 2020] e queria conversar sobre métodos.",
    });
    expect(parsed.success).toBe(true);
  });

  it("valida o id da mentora", () => {
    const parsed = requestSchema.safeParse({ mentor_id: "1 or 1=1", message: "x".repeat(30) });
    expect(parsed.success).toBe(false);
    if (!parsed.success) expect(fieldErrorsOf(parsed.error).mentor_id?.[0]).toMatch(/mentora/);
  });
});

describe("respondSchema", () => {
  it("resposta vazia vira null", () => {
    const parsed = respondSchema.parse({
      request_id: MENTOR,
      decision: "accepted",
      response_message: "   ",
    });
    expect(parsed.response_message).toBeNull();
  });
  it("só aceita aceitar/recusar", () => {
    expect(
      respondSchema.safeParse({ request_id: MENTOR, decision: "completed", response_message: "" })
        .success,
    ).toBe(false);
  });
  it("limita a resposta a 1.000 caracteres", () => {
    const parsed = respondSchema.safeParse({
      request_id: MENTOR,
      decision: "declined",
      response_message: "a".repeat(1001),
    });
    expect(parsed.success).toBe(false);
  });
});

describe("outros esquemas", () => {
  it("requestId exige uuid", () => {
    expect(
      requestIdSchema.safeParse({ request_id: "c1000000-0000-4000-8000-000000000003" }).success,
    ).toBe(true);
    expect(requestIdSchema.safeParse({ request_id: "" }).success).toBe(false);
  });
  it("disponibilidade vira booleano", () => {
    expect(availabilitySchema.parse({ available: "true" }).available).toBe(true);
    expect(availabilitySchema.parse({ available: "false" }).available).toBe(false);
    expect(availabilitySchema.safeParse({ available: "talvez" }).success).toBe(false);
  });
  it("consentimento exige a caixa marcada", () => {
    expect(consentSchema.safeParse({ ai_consent: "on" }).success).toBe(true);
    const missing = consentSchema.safeParse({ ai_consent: undefined });
    expect(missing.success).toBe(false);
    if (!missing.success)
      expect(fieldErrorsOf(missing.error).ai_consent?.[0]).toMatch(/marque a caixa/);
  });
});
