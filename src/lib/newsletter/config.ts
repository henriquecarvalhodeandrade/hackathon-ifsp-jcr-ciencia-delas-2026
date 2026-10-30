import { DEFAULT_CONFIRMATIONS_PER_DAY, DEFAULT_MAX_PER_RUN } from "./constants";

/**
 * Configuração da newsletter vinda do ambiente.
 *   NEWSLETTER_MAX_PER_RUN — teto de e-mails por execução (padrão 90; o Resend gratuito permite 100/dia).
 *   NEWSLETTER_CONFIRMATIONS_PER_DAY — teto diário de e-mails de confirmação, somando todos os
 *     endereços (padrão 80; 0 pausa as confirmações).
 * Documentada em .env.example e docs/08-newsletter.md.
 */
function readLimit(raw: string | undefined, fallback: number): number {
  const text = raw?.trim();
  if (!text) return fallback;
  const value = Number(text);
  if (!Number.isFinite(value) || value < 0) return fallback;
  return Math.min(Math.floor(value), 10_000);
}

export function getMaxPerRun(): number {
  return readLimit(process.env.NEWSLETTER_MAX_PER_RUN, DEFAULT_MAX_PER_RUN);
}

export function getConfirmationsPerDay(): number {
  return readLimit(process.env.NEWSLETTER_CONFIRMATIONS_PER_DAY, DEFAULT_CONFIRMATIONS_PER_DAY);
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Tokens de confirmação/descadastro são uuid: valide antes de consultar o banco. */
export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value.trim());
}
