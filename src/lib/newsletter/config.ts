import { DEFAULT_MAX_PER_RUN } from "./constants";

/**
 * Configuração da newsletter vinda do ambiente.
 *   NEWSLETTER_MAX_PER_RUN — teto de e-mails por execução (padrão 90; o Resend gratuito permite 100/dia).
 * (Ainda não está em src/lib/env.ts — ver docs/08-newsletter.md.)
 */
export function getMaxPerRun(): number {
  const raw = process.env.NEWSLETTER_MAX_PER_RUN?.trim();
  if (!raw) return DEFAULT_MAX_PER_RUN;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) return DEFAULT_MAX_PER_RUN;
  return Math.min(Math.floor(value), 10_000);
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Tokens de confirmação/descadastro são uuid: valide antes de consultar o banco. */
export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value.trim());
}
