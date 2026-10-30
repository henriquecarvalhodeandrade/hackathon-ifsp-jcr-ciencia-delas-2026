/**
 * Validação (zod) dos formulários de autenticação. Mensagens em pt-BR, iguais para todas.
 * Módulo puro (testado em auth-schemas.test.ts).
 */
import { z } from "zod";
import type { AuthFieldErrors } from "./types";

export const PASSWORD_MIN = 8;
/** O bcrypt do Supabase Auth considera só os primeiros 72 bytes. */
export const PASSWORD_MAX = 72;

export const emailField = z
  .string({ error: "Digite seu e-mail." })
  .trim()
  .min(1, { error: "Digite seu e-mail." })
  .max(254, { error: "Esse e-mail é longo demais." })
  .toLowerCase()
  .pipe(z.email({ error: "Digite um e-mail válido, como nome@instituicao.edu.br." }));

const newPassword = z
  .string({ error: "Crie uma senha." })
  .min(PASSWORD_MIN, { error: `Use pelo menos ${PASSWORD_MIN} caracteres.` })
  .refine((value) => new TextEncoder().encode(value).length <= PASSWORD_MAX, {
    error: `Use no máximo ${PASSWORD_MAX} caracteres.`,
  })
  .refine((value) => value.trim().length > 0, { error: "A senha não pode ser só espaços." });

export const loginSchema = z.object({
  email: emailField,
  password: z.string({ error: "Digite sua senha." }).min(1, { error: "Digite sua senha." }),
});

export const magicLinkSchema = z.object({ email: emailField });

export const signupSchema = z.object({
  full_name: z
    .string({ error: "Conte seu nome completo." })
    .trim()
    .min(3, { error: "Conte seu nome completo (pelo menos 3 letras)." })
    .max(120, { error: "Use no máximo 120 caracteres." }),
  email: emailField,
  password: newPassword,
  terms: z.literal("on", {
    error: "Para participar, é preciso aceitar o código de conduta e a política de privacidade.",
  }),
});

export const resetPasswordSchema = z
  .object({
    password: newPassword,
    password_confirm: z.string({ error: "Repita a nova senha." }),
  })
  .refine((data) => data.password === data.password_confirm, {
    path: ["password_confirm"],
    error: "As duas senhas não são iguais. Digite de novo.",
  });

export function authFieldErrors(error: z.ZodError): AuthFieldErrors {
  return z.flattenError(error).fieldErrors as AuthFieldErrors;
}

/** Lê um campo de texto do FormData (string vazia quando ausente). */
export function formText(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}
