import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

// Next.js 16: "middleware" agora se chama "proxy".
export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // Tudo, exceto assets estáticos, imagens e as rotas de máquina:
    // - api/cron: a Vercel Cron não segue redirects;
    // - api/newsletter: o descadastro "one-click" (RFC 8058) chega sem cookies e não pode redirecionar.
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|api/cron|api/newsletter|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)",
  ],
};
