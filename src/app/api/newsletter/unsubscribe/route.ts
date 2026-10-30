import type { NextRequest } from "next/server";
import { isUuid } from "@/lib/newsletter/config";
import { unsubscribeByToken } from "@/lib/newsletter/subscriptions";

/**
 * Descadastro "one-click" (RFC 8058). Os provedores de e-mail (Gmail, Yahoo, Apple…) chamam
 *   POST /api/newsletter/unsubscribe?token=<unsubscribe_token>   (corpo: List-Unsubscribe=One-Click)
 * a partir do cabeçalho List-Unsubscribe. Sem cookies e SEM redirect: responde 200 vazio.
 * O proxy (src/proxy.ts) não intercepta /api/newsletter.
 *
 * GET (alguém abriu o link no navegador) NUNCA descadastra: leva para a página com botão.
 */

const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token")?.trim() ?? "";
  if (!isUuid(token)) return new Response(null, { status: 400, headers: NO_STORE });

  try {
    // Token desconhecido também responde 200: não revela quais tokens existem.
    await unsubscribeByToken(token);
    return new Response(null, { status: 200, headers: NO_STORE });
  } catch (error) {
    console.error("[newsletter] descadastro one-click falhou", error);
    return new Response(null, { status: 500, headers: NO_STORE });
  }
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token")?.trim() ?? "";
  const target = new URL("/newsletter/cancelar", request.nextUrl.origin);
  if (isUuid(token)) target.searchParams.set("token", token);
  return Response.redirect(target, 303);
}
