import { env } from "@/lib/env";

/**
 * Configuração do transporte de e-mail.
 *
 * Variáveis próprias deste módulo (documentadas em .env.example):
 *   MAILPIT_URL — caixa de e-mails falsa do Supabase local. Fora de produção é deduzida de
 *                 NEXT_PUBLIC_SUPABASE_URL (http://127.0.0.1:54321 → :54324); MAILPIT_URL=off desliga.
 *                 Num build de produção rodando LOCALMENTE (`next build && next start`, ex.: testes
 *                 E2E) só vale quando informada explicitamente e apontando para o próprio computador
 *                 (127.0.0.1/localhost) — um deploy de verdade nunca entrega e-mails de usuárias a ela.
 */

const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "0.0.0.0", "[::1]"]);

export function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === "production";
}

function isLoopbackUrl(value: string): boolean {
  try {
    return LOCAL_HOSTS.has(new URL(value).hostname);
  } catch {
    return false;
  }
}

/**
 * URL do Mailpit, ou null (desligado / Supabase remoto / produção sem MAILPIT_URL local explícita).
 */
export function getMailpitUrl(): string | null {
  const explicit = process.env.MAILPIT_URL?.trim();
  if (isProductionRuntime()) {
    // Produção: só um Mailpit no próprio computador, informado de propósito (build local de teste).
    if (!explicit || !isLoopbackUrl(explicit)) return null;
    return explicit.replace(/\/+$/, "");
  }
  if (explicit) {
    if (["off", "false", "0", "none"].includes(explicit.toLowerCase())) return null;
    return explicit.replace(/\/+$/, "");
  }
  const supabaseUrl = env.supabaseUrl;
  if (!supabaseUrl) return null;
  try {
    const url = new URL(supabaseUrl);
    if (LOCAL_HOSTS.has(url.hostname) && url.port === "54321") {
      return `${url.protocol}//${url.hostname}:54324`;
    }
  } catch {
    // URL inválida: sem Mailpit.
  }
  return null;
}
