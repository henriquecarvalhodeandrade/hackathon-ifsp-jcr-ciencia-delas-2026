import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /auth/sair — encerra a sessão neste navegador e volta para a página inicial (303).
 * Só POST: um link ou pré-carregamento (GET) nunca desloga ninguém. Formulários de outros
 * sites são recusados (cabeçalho Origin diferente do host).
 */
export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin) {
    const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
    let originHost: string | null = null;
    try {
      originHost = new URL(origin).host;
    } catch {
      originHost = null;
    }
    if (!host || originHost !== host) {
      return new NextResponse("Origem não permitida.", { status: 403 });
    }
  }

  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) console.warn(`[auth] signOut falhou (${error.status ?? ""} ${error.code ?? ""})`);
  }

  return NextResponse.redirect(new URL("/", request.nextUrl.origin), { status: 303 });
}
