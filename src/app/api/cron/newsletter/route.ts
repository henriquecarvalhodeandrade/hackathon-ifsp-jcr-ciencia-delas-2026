import { timingSafeEqual } from "node:crypto";
import { env, isAdminConfigured } from "@/lib/env";
import { runWeeklyNewsletterJob } from "@/lib/newsletter/service";

/**
 * Job semanal da newsletter: gera + publica + envia a edição da semana (idempotente pelo slug).
 *
 *   Vercel Cron (vercel.json, "0 12 * * 1" = segunda 09:00 BRT) → GET com Authorization: Bearer $CRON_SECRET
 *   pg_cron + pg_net (opcional, docs/03 §16)                   → GET ou POST com o mesmo cabeçalho
 *
 * Responde JSON. 401 sem o segredo correto. O proxy não intercepta /api/cron (a Vercel não segue redirects).
 */

export const maxDuration = 60;

const NO_STORE = { "Cache-Control": "no-store" };

function isAuthorized(request: Request): boolean {
  const secret = env.cronSecret;
  if (!secret) {
    console.warn("[cron] CRON_SECRET não configurado: o job da newsletter está bloqueado.");
    return false;
  }
  const header = request.headers.get("authorization") ?? "";
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(header);
  return received.length === expected.length && timingSafeEqual(received, expected);
}

async function handle(request: Request) {
  if (!isAuthorized(request)) {
    return Response.json({ ok: false, error: "Não autorizado." }, { status: 401, headers: NO_STORE });
  }
  if (!isAdminConfigured()) {
    return Response.json(
      { ok: false, error: "SUPABASE_SECRET_KEY não configurada: a newsletter precisa do cliente admin." },
      { status: 503, headers: NO_STORE },
    );
  }

  const startedAt = Date.now();
  try {
    const result = await runWeeklyNewsletterJob();
    console.info(
      `[cron] newsletter ${result.slug}: ${result.send ? `${result.send.sent} enviados, ${result.send.failed} falhas` : "sem envio"}`,
    );
    return Response.json({ ok: true, durationMs: Date.now() - startedAt, ...result }, { headers: NO_STORE });
  } catch (error) {
    console.error("[cron] newsletter falhou", error);
    const message = error instanceof Error ? error.message : "Erro desconhecido.";
    return Response.json({ ok: false, error: message }, { status: 500, headers: NO_STORE });
  }
}

export const GET = handle;
export const POST = handle;
