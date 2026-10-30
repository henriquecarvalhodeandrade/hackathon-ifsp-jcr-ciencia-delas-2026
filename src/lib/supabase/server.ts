import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/database.types";
import { env } from "@/lib/env";

/**
 * Cliente Supabase para Server Components, Server Actions e Route Handlers.
 * Usa a sessão da usuária (cookies), então todas as consultas passam pelo RLS.
 * Crie um cliente novo a cada requisição — nunca guarde em variável de módulo.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(env.supabaseUrl!, env.supabasePublishableKey!, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Chamado a partir de um Server Component: não dá para gravar cookies aqui.
          // Tudo bem — o proxy (src/proxy.ts) renova a sessão a cada requisição.
        }
      },
    },
  });
}
