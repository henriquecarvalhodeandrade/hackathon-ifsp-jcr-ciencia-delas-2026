import { env } from "@/lib/env";

/**
 * Configuração do transporte de e-mail.
 *
 * Variáveis próprias deste módulo (ainda não estão em src/lib/env.ts):
 *   MAILPIT_URL — só fora de produção. Caixa de e-mails falsa do Supabase local
 *                 (padrão: deduzida de NEXT_PUBLIC_SUPABASE_URL http://127.0.0.1:54321 → :54324).
 *                 Use MAILPIT_URL=off para desligar.
 */

const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "0.0.0.0", "[::1]"]);

export function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === "production";
}

/** URL do Mailpit para o ambiente de desenvolvimento, ou null (produção / desligado / Supabase remoto). */
export function getMailpitUrl(): string | null {
  if (isProductionRuntime()) return null;
  const explicit = process.env.MAILPIT_URL?.trim();
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
