import { describe, expect, it } from "vitest";
import { authFieldErrors, loginSchema, resetPasswordSchema, signupSchema } from "./auth-schemas";

describe("signupSchema", () => {
  it("aceita um cadastro válido e normaliza o e-mail", () => {
    const parsed = signupSchema.parse({
      full_name: "  Ana Clara Souza ",
      email: " Ana.Souza@IFSP.edu.br ",
      password: "uma frase longa",
      terms: "on",
    });
    expect(parsed).toEqual({
      full_name: "Ana Clara Souza",
      email: "ana.souza@ifsp.edu.br",
      password: "uma frase longa",
      terms: "on",
    });
  });

  it("explica cada problema em pt-BR", () => {
    const result = signupSchema.safeParse({ full_name: "A", email: "ana@", password: "curta" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = authFieldErrors(result.error);
      expect(errors.full_name?.[0]).toMatch(/nome completo/);
      expect(errors.email?.[0]).toMatch(/e-mail válido/);
      expect(errors.password?.[0]).toMatch(/8 caracteres/);
      expect(errors.terms?.[0]).toMatch(/código de conduta/);
    }
  });

  it("limita a senha a 72 bytes (bcrypt) e recusa só espaços", () => {
    expect(
      signupSchema.safeParse({
        full_name: "Ana Souza",
        email: "a@b.co",
        password: "é".repeat(37),
        terms: "on",
      }).success,
    ).toBe(false);
    expect(
      signupSchema.safeParse({
        full_name: "Ana Souza",
        email: "a@b.co",
        password: "        ",
        terms: "on",
      }).success,
    ).toBe(false);
  });
});

describe("loginSchema e resetPasswordSchema", () => {
  it("exige e-mail e senha no login", () => {
    const result = loginSchema.safeParse({ email: "", password: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = authFieldErrors(result.error);
      expect(errors.email?.[0]).toBe("Digite seu e-mail.");
      expect(errors.password?.[0]).toBe("Digite sua senha.");
    }
  });

  it("confere a confirmação da nova senha", () => {
    const result = resetPasswordSchema.safeParse({
      password: "senha-nova-123",
      password_confirm: "senha-nova-321",
    });
    expect(result.success).toBe(false);
    if (!result.success)
      expect(authFieldErrors(result.error).password_confirm?.[0]).toMatch(/não são iguais/);
    expect(
      resetPasswordSchema.safeParse({
        password: "senha-nova-123",
        password_confirm: "senha-nova-123",
      }).success,
    ).toBe(true);
  });
});
