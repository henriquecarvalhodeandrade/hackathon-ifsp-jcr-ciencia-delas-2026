/**
 * Utilitários puros de endereço de e-mail (sem dependências de servidor — testáveis).
 */

export interface ParsedAddress {
  email: string;
  name: string | null;
}

/** "Ciência Delas <onboarding@resend.dev>" → { name: "Ciência Delas", email: "onboarding@resend.dev" }. */
export function parseAddress(value: string): ParsedAddress {
  const trimmed = value.trim();
  const match = /^(.*?)\s*<\s*([^<>\s]+@[^<>\s]+)\s*>$/.exec(trimmed);
  if (match) {
    const name = match[1]!.trim().replace(/^"(.*)"$/, "$1").trim();
    return { email: match[2]!, name: name || null };
  }
  return { email: trimmed, name: null };
}

/** Normaliza para gravar/comparar: sem espaços e em minúsculas. */
export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Esconde parte do endereço para exibir numa página aberta por link (ex.: descadastro):
 * "larissa.gomes@demo.cienciadelas.dev" → "la•••••••••s@demo.cienciadelas.dev".
 */
export function maskEmail(value: string): string {
  const email = value.trim();
  const at = email.lastIndexOf("@");
  if (at <= 0) return "•••";
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  if (local.length <= 2) return `${local[0]}•@${domain}`;
  const visibleStart = local.length <= 4 ? 1 : 2;
  const hidden = Math.max(1, Math.min(local.length - visibleStart - 1, 10));
  return `${local.slice(0, visibleStart)}${"•".repeat(hidden)}${local.slice(-1)}@${domain}`;
}

/** Converte o cabeçalho Retry-After (segundos ou data HTTP) em milissegundos. */
export function parseRetryAfter(value: string | null | undefined, now: number = Date.now()): number | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (/^\d+(\.\d+)?$/.test(trimmed)) return Math.round(Number(trimmed) * 1000);
  const date = Date.parse(trimmed);
  if (Number.isNaN(date)) return null;
  return Math.max(0, date - now);
}
