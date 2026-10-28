/**
 * Token do link de acompanhamento: 24 bytes aleatórios em base64url sem preenchimento
 * (32 caracteres), gerado pelo banco em `submit_public_question`. O banco guarda só o SHA-256;
 * o token aparece uma única vez, na tela de sucesso.
 */

export const TRACKING_TOKEN_RE = /^[A-Za-z0-9_-]{32}$/;

export function isTrackingToken(value: unknown): value is string {
  return typeof value === "string" && TRACKING_TOKEN_RE.test(value);
}

/** Caminho da página de acompanhamento (o token vai no caminho, nunca num redirect). */
export function trackingPath(token: string): string {
  return `/pergunte/acompanhar/${token}`;
}

/** Endereço completo para copiar e guardar. */
export function trackingUrl(origin: string, token: string): string {
  return `${origin.replace(/\/+$/, "")}${trackingPath(token)}`;
}
