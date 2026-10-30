import { env, getSiteUrl } from "@/lib/env";

/**
 * Opções de autenticação lidas do ambiente.
 * (Ficam aqui, e não em src/lib/env.ts, porque são exclusivas das telas de login.)
 */

/** "Entrar com Google" só aparece quando o provedor foi configurado no Supabase (docs/11 §Google). */
export function isGoogleAuthEnabled(): boolean {
  return process.env.NEXT_PUBLIC_AUTH_GOOGLE_ENABLED?.trim() === "true";
}

/** URL absoluta para links de e-mail/OAuth (precisa estar nas Redirect URLs do Supabase). */
export function authRedirectUrl(path: string): string {
  return `${getSiteUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * Em desenvolvimento com o Supabase local, os e-mails de autenticação ficam no Mailpit.
 * Devolve a URL dele (para um aviso na tela) ou null em produção/Cloud.
 */
export function localMailboxUrl(): string | null {
  if (process.env.NODE_ENV === "production") return null;
  const url = env.supabaseUrl;
  if (!url) return null;
  try {
    const { hostname, protocol } = new URL(url);
    if (hostname !== "127.0.0.1" && hostname !== "localhost") return null;
    return `${protocol}//${hostname}:54324`;
  } catch {
    return null;
  }
}
