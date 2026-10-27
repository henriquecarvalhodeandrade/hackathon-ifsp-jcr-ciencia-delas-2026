import { describe, expect, it } from "vitest";
import {
  GENERIC_AUTH_ERROR,
  GENERIC_SAVE_ERROR,
  RATE_LIMIT_EMAIL_ERROR,
  authErrorMessage,
  dbErrorMessage,
  isEmailNotConfirmedError,
  isRateLimitError,
  isUnknownAccountError,
} from "./errors";

describe("authErrorMessage", () => {
  it("traduz códigos conhecidos do Supabase Auth", () => {
    expect(authErrorMessage({ code: "invalid_credentials" })).toMatch(/E-mail ou senha incorretos/);
    expect(authErrorMessage({ code: "same_password" })).toMatch(/diferente da senha atual/);
    expect(authErrorMessage({ code: "over_email_send_rate_limit", status: 429 })).toBe(RATE_LIMIT_EMAIL_ERROR);
  });

  it("cai para a mensagem quando o código não vem", () => {
    expect(authErrorMessage({ message: "Invalid login credentials" })).toMatch(/incorretos/);
    expect(authErrorMessage({ message: "Email not confirmed" })).toMatch(/não foi confirmado/);
    expect(authErrorMessage({ message: "email rate limit exceeded", status: 429 })).toBe(RATE_LIMIT_EMAIL_ERROR);
  });

  it("nunca devolve texto técnico em inglês", () => {
    expect(authErrorMessage({ code: "unexpected_failure", message: "Database error saving new user" })).toBe(
      GENERIC_AUTH_ERROR,
    );
    expect(authErrorMessage(null)).toBe(GENERIC_AUTH_ERROR);
  });
});

describe("classificação de erros de Auth", () => {
  it("reconhece conta inexistente no link mágico (sem revelar)", () => {
    expect(isUnknownAccountError({ code: "otp_disabled", message: "Signups not allowed for otp" })).toBe(true);
    expect(isUnknownAccountError({ message: "Signups not allowed for otp" })).toBe(true);
    expect(isUnknownAccountError({ code: "invalid_credentials" })).toBe(false);
  });

  it("reconhece e-mail não confirmado e limite de envio", () => {
    expect(isEmailNotConfirmedError({ code: "email_not_confirmed" })).toBe(true);
    expect(isEmailNotConfirmedError({ code: "invalid_credentials" })).toBe(false);
    expect(isRateLimitError({ status: 429 })).toBe(true);
    expect(isRateLimitError({ code: "over_request_rate_limit" })).toBe(true);
    expect(isRateLimitError({ code: "invalid_credentials", status: 400 })).toBe(false);
  });
});

describe("dbErrorMessage", () => {
  it("mostra a mensagem pt-BR das regras de negócio (CD***)", () => {
    expect(dbErrorMessage({ code: "CD003", message: "Esta mentora não está recebendo novos pedidos no momento." })).toBe(
      "Esta mentora não está recebendo novos pedidos no momento.",
    );
  });

  it("traduz erros comuns do Postgres", () => {
    expect(dbErrorMessage({ code: "23514", message: "new row violates check constraint" })).toMatch(/formato/);
    expect(dbErrorMessage({ code: "42501", message: "permission denied" })).toMatch(/permissão/);
  });

  it("usa a mensagem genérica (ou a informada) para o resto", () => {
    expect(dbErrorMessage({ code: "XX000", message: "boom" })).toBe(GENERIC_SAVE_ERROR);
    expect(dbErrorMessage(undefined, "Outra coisa")).toBe("Outra coisa");
  });
});
