import "server-only";
import { cookies } from "next/headers";
import { AUTH_NEXT_COOKIE, safeNextPath } from "./redirect";

/**
 * Os modelos de e-mail do Supabase (supabase/templates) apontam para um destino fixo
 * (`next=/forum` no link mágico, `next=/onboarding` na confirmação). Para respeitar o
 * `?next=` de quem pediu o link, guardamos o destino num cookie curto, httpOnly, que o
 * `/auth/confirm` consome. Se o link for aberto em outro navegador, vale o destino do e-mail.
 */

const MAX_AGE_SECONDS = 60 * 60; // o link vale 1 hora

export async function rememberAuthNext(next: string | null): Promise<void> {
  const store = await cookies();
  const safe = next ? safeNextPath(next, "") : "";
  if (!safe) {
    store.delete(AUTH_NEXT_COOKIE);
    return;
  }
  store.set(AUTH_NEXT_COOKIE, safe, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

/** Lê e apaga o destino guardado (só em Route Handlers/Server Actions, que podem gravar cookies). */
export async function consumeAuthNext(): Promise<string | null> {
  const store = await cookies();
  const value = store.get(AUTH_NEXT_COOKIE)?.value;
  if (value !== undefined) store.delete(AUTH_NEXT_COOKIE);
  const safe = value ? safeNextPath(value, "") : "";
  return safe || null;
}
