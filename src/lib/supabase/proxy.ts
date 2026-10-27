import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/database.types";
import { AUTH_ROUTES, PROTECTED_PREFIXES } from "@/lib/constants";
import { env, isSupabaseConfigured } from "@/lib/env";

function matchesPrefix(pathname: string, prefixes: readonly string[]) {
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** Copia cookies e cabeçalhos anti-cache da resposta do Supabase para outra resposta. */
function withSessionCookies(target: NextResponse, source: NextResponse) {
  source.cookies.getAll().forEach((cookie) => target.cookies.set(cookie));
  for (const header of ["cache-control", "expires", "pragma"]) {
    const value = source.headers.get(header);
    if (value) target.headers.set(header, value);
  }
  return target;
}

/**
 * Renova a sessão do Supabase a cada requisição e faz a checagem otimista de rotas
 * protegidas. A autorização de verdade acontece no RLS e em cada Server Action.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  // Sem Supabase configurado, o site ainda abre (páginas públicas mostram um aviso).
  if (!isSupabaseConfigured()) return supabaseResponse;

  const supabase = createServerClient<Database>(env.supabaseUrl!, env.supabasePublishableKey!, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
        Object.entries(headers ?? {}).forEach(([key, value]) =>
          supabaseResponse.headers.set(key, value),
        );
      },
    },
  });

  // Não coloque código entre createServerClient e getClaims(): isso causa logouts aleatórios.
  const { data } = await supabase.auth.getClaims();
  const isLoggedIn = Boolean(data?.claims?.sub);
  const { pathname, search } = request.nextUrl;

  if (!isLoggedIn && matchesPrefix(pathname, PROTECTED_PREFIXES)) {
    const url = request.nextUrl.clone();
    url.pathname = "/entrar";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return withSessionCookies(NextResponse.redirect(url), supabaseResponse);
  }

  if (isLoggedIn && matchesPrefix(pathname, AUTH_ROUTES)) {
    const url = request.nextUrl.clone();
    url.pathname = "/forum";
    url.search = "";
    return withSessionCookies(NextResponse.redirect(url), supabaseResponse);
  }

  return supabaseResponse;
}
