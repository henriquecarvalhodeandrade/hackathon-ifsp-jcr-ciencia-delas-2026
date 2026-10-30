import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { env } from "@/lib/env";

/**
 * Cliente com a chave secreta (service role): IGNORA o RLS.
 * Use SOMENTE em rotinas de servidor que não pertencem a uma usuária:
 * newsletter (inscrição/envio), cron e tarefas administrativas.
 */
export function createAdminClient() {
  if (!env.supabaseUrl || !env.supabaseSecretKey) {
    throw new Error(
      "SUPABASE_SECRET_KEY não configurada. Defina-a no .env.local (veja docs/07-setup-e-deploy.md).",
    );
  }
  return createClient<Database>(env.supabaseUrl, env.supabaseSecretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
