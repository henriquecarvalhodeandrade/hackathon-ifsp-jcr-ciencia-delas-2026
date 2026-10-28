/**
 * Código público de verificação da declaração (puro). Mesma regra de
 * `private.normalize_declaration_code()` no banco:
 *   - formato canônico: ART-XXXX-XXXX-XXXX, em Crockford base32 (0–9 e A–Z sem I, L, O, U);
 *   - quem digita pode usar minúsculas, espaços, hífens ou nada, com ou sem o prefixo ART, e
 *     trocar 0 por O e 1 por I/L — tudo vira o código canônico.
 */

/** Alfabeto Crockford base32 (sem I, L, O, U). */
export const CROCKFORD_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

export const DECLARATION_CODE_PATTERN =
  /^ART-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/;

/** Código fixo da declaração de demonstração (seed 20_reconhecimento.sql, slide do pitch). */
export const DEMO_DECLARATION_CODE = "ART-7K2M-Q9XD-4HNP";

/** Exemplo exibido nos formulários. */
export const DECLARATION_CODE_EXAMPLE = "ART-7K2M-Q9XD-4HNP";

const MAX_INPUT = 64;
const BODY = /^[0-9A-HJKMNP-TV-Z]{12}$/;

/** Código canônico a partir do que a pessoa digitou, ou null se não for um código possível. */
export function normalizeDeclarationCode(input: unknown): string | null {
  if (typeof input !== "string" || input.length > MAX_INPUT) return null;
  let value = input.toUpperCase().replace(/[^0-9A-Z]/g, "");
  if (value.length === 15 && value.startsWith("ART")) value = value.slice(3);
  value = value.replace(/O/g, "0").replace(/[IL]/g, "1");
  if (!BODY.test(value)) return null;
  return `ART-${value.slice(0, 4)}-${value.slice(4, 8)}-${value.slice(8, 12)}`;
}

/** Já está no formato canônico (ART-XXXX-XXXX-XXXX, maiúsculas, Crockford). */
export function isDeclarationCode(value: unknown): value is string {
  return typeof value === "string" && DECLARATION_CODE_PATTERN.test(value);
}

/** Caminho da página pública de verificação de um código canônico. */
export function verificationPath(code: string): string {
  return `/verificar/${encodeURIComponent(code)}`;
}

/** URL absoluta de verificação (para o QR code e a linha do currículo). */
export function verificationUrl(siteUrl: string, code: string): string {
  return `${siteUrl.replace(/\/+$/, "")}${verificationPath(code)}`;
}
