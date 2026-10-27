import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured } from "@/lib/env";
import { safeNextPath } from "@/lib/profile/redirect";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /auth/callback?code=...&next=...
 * Retorno do OAuth (Google) e de links no fluxo PKCE: troca o `code` pela sessão
 * (o code verifier está num cookie gravado quando o login começou) e redireciona.
 */

function redirectTo(request: NextRequest, path: string) {
  return NextResponse.redirect(new URL(path, request.nextUrl.origin));
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const next = safeNextPath(searchParams.get("next"), "/forum");

  if (!isSupabaseConfigured()) return redirectTo(request, "/auth/erro?motivo=configuracao");

  // O provedor pode devolver erro (ex.: a pessoa cancelou no Google).
  if (searchParams.get("error")) {
    console.warn(`[auth] retorno OAuth com erro (${searchParams.get("error")})`);
    return redirectTo(request, "/auth/erro?motivo=oauth");
  }

  const code = searchParams.get("code");
  if (!code) return redirectTo(request, "/auth/erro?motivo=link-invalido");

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    console.warn(`[auth] exchangeCodeForSession falhou (${error.status ?? ""} ${error.code ?? ""})`);
    const motivo = error.code === "bad_code_verifier" || error.code === "flow_state_not_found" ? "outro-navegador" : "link-expirado";
    return redirectTo(request, `/auth/erro?motivo=${motivo}`);
  }
  return redirectTo(request, next);
}
