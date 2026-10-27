import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured } from "@/lib/env";
import { consumeAuthNext } from "@/lib/profile/auth-next";
import { safeNextPath } from "@/lib/profile/redirect";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /auth/confirm?token_hash=...&type=...&next=...
 * Destino dos links dos e-mails do Supabase (supabase/templates): confirmação de cadastro,
 * link mágico, recuperação de senha, troca de e-mail e convite. Valida o token (verifyOtp),
 * grava a sessão nos cookies e redireciona.
 */

const OTP_TYPES: readonly EmailOtpType[] = ["signup", "invite", "magiclink", "recovery", "email_change", "email"];

/** Destino padrão por tipo de link (quando não há ?next válido). */
const DEFAULT_NEXT: Record<EmailOtpType, string> = {
  signup: "/onboarding",
  email: "/forum",
  magiclink: "/forum",
  recovery: "/redefinir-senha",
  invite: "/redefinir-senha",
  email_change: "/perfil",
};

/** Tipos em que o destino guardado no cookie (pedido antes de enviar o e-mail) tem prioridade. */
const COOKIE_NEXT_TYPES = new Set<EmailOtpType>(["signup", "email", "magiclink"]);

function isOtpType(value: string | null): value is EmailOtpType {
  return value !== null && (OTP_TYPES as readonly string[]).includes(value);
}

function redirectTo(request: NextRequest, path: string) {
  return NextResponse.redirect(new URL(path, request.nextUrl.origin));
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");

  if (!isSupabaseConfigured()) return redirectTo(request, "/auth/erro?motivo=configuracao");
  if (!tokenHash || !isOtpType(type)) return redirectTo(request, "/auth/erro?motivo=link-invalido");

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
  if (error) {
    console.warn(`[auth] verifyOtp falhou (${type}: ${error.status ?? ""} ${error.code ?? ""})`);
    const expired = error.code === "otp_expired" || /expired|invalid/i.test(error.message);
    return redirectTo(request, `/auth/erro?motivo=${expired ? "link-expirado" : "link-invalido"}`);
  }

  const remembered = await consumeAuthNext();
  const fromLink = safeNextPath(searchParams.get("next"), DEFAULT_NEXT[type]);
  const destination = remembered && COOKIE_NEXT_TYPES.has(type) ? remembered : fromLink;
  return redirectTo(request, destination);
}
