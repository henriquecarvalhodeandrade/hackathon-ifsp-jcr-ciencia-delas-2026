import "server-only";
import { randomUUID } from "node:crypto";
import { getEmailTransport, sendEmail, type EmailTransport } from "@/lib/email";
import { maskEmail, normalizeEmail } from "@/lib/email/address";
import { isProductionRuntime } from "@/lib/email/config";
import { getSiteUrl, isAdminConfigured } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { getConfirmationsPerDay, isUuid } from "./config";
import {
  buildConsentRecord,
  CONFIRM_TOKEN_TTL_DAYS,
  CONFIRMATION_RESEND_COOLDOWN_MS,
  CONFIRMATIONS_PER_ADDRESS_PER_DAY,
} from "./constants";
import { absoluteUrl, renderConfirmationEmail } from "./render";

/**
 * Inscrição (double opt-in), confirmação, descadastro e exclusão de dados — sempre pelo servidor
 * com o cliente admin: a tabela newsletter_subscribers não tem nenhuma política para a API.
 *
 * Privacidade: as respostas para quem se inscreve são NEUTRAS (não revelam se o e-mail já existe).
 *
 * Anti-abuso dos e-mails de confirmação (cada um sai do nosso limite no provedor e pode ser usado
 * para encher a caixa de alguém): intervalo mínimo de 2 min por endereço, no máximo 3 por endereço
 * a cada 24 h e um teto diário somando todos os endereços — reservados de forma atômica pela RPC
 * `newsletter_reserve_confirmation` (colunas confirmation_sent_count/confirmation_sent_at).
 */

const TTL_MS = CONFIRM_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000;

/** Inscrições exigem um transporte de e-mail; em desenvolvimento o link vai para o console/Mailpit. */
export function canAcceptSubscriptions(): boolean {
  if (!isAdminConfigured()) return false;
  return getEmailTransport() !== "none" || !isProductionRuntime();
}

export interface SubscribeInput {
  email: string;
  /** ids de research_areas (grandes áreas). Vazio = todas. */
  areaIds: number[];
  /** Perfil da membra logada quando o e-mail é o da conta dela. */
  profileId: string | null;
}

export type SubscribeOutcome =
  | "created"
  | "resent"
  | "reactivated"
  | "throttled"
  | "already_active"
  /** Este endereço já recebeu 3 e-mails de confirmação nas últimas 24 h: nada foi enviado. */
  | "address_limit"
  /** O teto diário de e-mails de confirmação foi atingido: nada foi enviado. */
  | "daily_limit";

export type SubscribeResult =
  | { ok: true; outcome: SubscribeOutcome; emailSent: boolean; transport: EmailTransport }
  | { ok: false; error: string };

function confirmUrlFor(token: string) {
  return absoluteUrl(getSiteUrl(), `/newsletter/confirmar?token=${encodeURIComponent(token)}`);
}

function removeUrlFor(token: string) {
  return absoluteUrl(getSiteUrl(), `/newsletter/cancelar?token=${encodeURIComponent(token)}`);
}

async function sendConfirmation(email: string, confirmToken: string, unsubscribeToken: string) {
  const confirmUrl = confirmUrlFor(confirmToken);
  const rendered = renderConfirmationEmail({
    siteUrl: getSiteUrl(),
    confirmUrl,
    removeUrl: removeUrlFor(unsubscribeToken),
  });
  const transport = getEmailTransport();
  if (!isProductionRuntime() && transport !== "resend") {
    // Sem Resend no desenvolvimento: o link fica no console (e no Mailpit, se estiver rodando).
    console.info(`[newsletter] Link de confirmação para ${email}: ${confirmUrl}`);
  }
  const result = await sendEmail(
    {
      to: email,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      tags: [{ name: "category", value: "newsletter-confirmation" }],
    },
    // Chave única por pedido: protege só as novas tentativas automáticas desta chamada.
    { idempotencyKey: `newsletter-confirm-${randomUUID()}` },
  );
  return { result, transport };
}

export async function subscribe(input: SubscribeInput): Promise<SubscribeResult> {
  const admin = createAdminClient();
  const email = normalizeEmail(input.email);
  const nowIso = new Date().toISOString();
  const consent = { consent_text: buildConsentRecord(), consented_at: nowIso };

  const { data: existing, error: findError } = await admin
    .from("newsletter_subscribers")
    .select(
      "id, status, confirm_token, unsubscribe_token, updated_at, profile_id, confirmation_sent_at",
    )
    .eq("email", email)
    .maybeSingle();
  if (findError) {
    console.error(`[newsletter] falha ao consultar inscrita: ${findError.message}`);
    return {
      ok: false,
      error: "Não conseguimos registrar sua inscrição agora. Tente de novo em alguns minutos.",
    };
  }

  const transport = getEmailTransport();
  if (existing?.status === "active")
    return { ok: true, outcome: "already_active", emailSent: false, transport };
  if (
    existing?.status === "pending" &&
    Date.now() - Date.parse(existing.confirmation_sent_at ?? existing.updated_at) <
      CONFIRMATION_RESEND_COOLDOWN_MS
  ) {
    return { ok: true, outcome: "throttled", emailSent: false, transport };
  }

  let tokens: { id: string; confirm_token: string; unsubscribe_token: string };
  let outcome: SubscribeOutcome;

  if (!existing) {
    const { data, error } = await admin
      .from("newsletter_subscribers")
      .insert({
        email,
        area_ids: input.areaIds,
        profile_id: input.profileId,
        status: "pending",
        ...consent,
      })
      .select("id, confirm_token, unsubscribe_token")
      .single();
    if (error) {
      // Corrida: duas inscrições simultâneas do mesmo e-mail — a outra já cuidou do envio.
      if (error.code === "23505")
        return { ok: true, outcome: "throttled", emailSent: false, transport };
      console.error(`[newsletter] falha ao inscrever: ${error.message}`);
      return {
        ok: false,
        error: "Não conseguimos registrar sua inscrição agora. Tente de novo em alguns minutos.",
      };
    }
    tokens = data;
    outcome = "created";
  } else {
    const reactivating = existing.status === "unsubscribed";
    const { data, error } = await admin
      .from("newsletter_subscribers")
      .update({
        area_ids: input.areaIds,
        profile_id: input.profileId ?? existing.profile_id,
        ...consent,
        ...(reactivating
          ? {
              status: "pending" as const,
              confirmed_at: null,
              unsubscribed_at: null,
              confirm_token: randomUUID(),
              unsubscribe_token: randomUUID(),
            }
          : {}),
      })
      .eq("id", existing.id)
      .select("id, confirm_token, unsubscribe_token")
      .single();
    if (error) {
      console.error(`[newsletter] falha ao atualizar inscrita: ${error.message}`);
      return {
        ok: false,
        error: "Não conseguimos registrar sua inscrição agora. Tente de novo em alguns minutos.",
      };
    }
    tokens = data;
    outcome = reactivating ? "reactivated" : "resent";
  }

  // Reserva atômica do envio (3 por endereço a cada 24 h + teto diário global).
  const { data: reservation, error: reserveError } = await admin.rpc(
    "newsletter_reserve_confirmation",
    {
      p_subscriber_id: tokens.id,
      p_max_per_address: CONFIRMATIONS_PER_ADDRESS_PER_DAY,
      p_max_per_day: getConfirmationsPerDay(),
    },
  );
  if (reserveError || reservation === "not_found") {
    console.error(
      `[newsletter] falha ao reservar o e-mail de confirmação: ${reserveError?.message ?? reservation}`,
    );
    return {
      ok: false,
      error: "Não conseguimos registrar sua inscrição agora. Tente de novo em alguns minutos.",
    };
  }
  if (reservation === "address_limit" || reservation === "daily_limit") {
    console.warn(`[newsletter] confirmação não enviada (${reservation}) para ${maskEmail(email)}`);
    return { ok: true, outcome: reservation, emailSent: false, transport };
  }

  const { result } = await sendConfirmation(email, tokens.confirm_token, tokens.unsubscribe_token);
  if (result.ok) return { ok: true, outcome, emailSent: true, transport };
  if (result.skipped) return { ok: true, outcome, emailSent: false, transport };

  console.error(`[newsletter] falha ao enviar confirmação: ${result.error}`);
  return {
    ok: false,
    error: "Não conseguimos enviar o e-mail de confirmação agora. Tente de novo em alguns minutos.",
  };
}

// -----------------------------------------------------------------------------
// Confirmação
// -----------------------------------------------------------------------------

export type ConfirmLookup =
  | { state: "invalid" }
  | { state: "expired" }
  | { state: "pending"; maskedEmail: string }
  | { state: "active"; maskedEmail: string; confirmedAt: string | null }
  | { state: "unsubscribed" };

export async function lookupConfirmToken(token: string): Promise<ConfirmLookup> {
  if (!isUuid(token)) return { state: "invalid" };
  const { data, error } = await createAdminClient()
    .from("newsletter_subscribers")
    .select("email, status, consented_at, confirmed_at")
    .eq("confirm_token", token)
    .maybeSingle();
  if (error) throw new Error(`Falha ao consultar o link de confirmação: ${error.message}`);
  if (!data) return { state: "invalid" };
  if (data.status === "active")
    return { state: "active", maskedEmail: maskEmail(data.email), confirmedAt: data.confirmed_at };
  if (data.status === "unsubscribed") return { state: "unsubscribed" };
  if (Date.now() - Date.parse(data.consented_at) > TTL_MS) return { state: "expired" };
  return { state: "pending", maskedEmail: maskEmail(data.email) };
}

export type ConfirmOutcome = "confirmed" | "already_active" | "expired" | "invalid";

export async function confirmSubscription(token: string): Promise<ConfirmOutcome> {
  if (!isUuid(token)) return "invalid";
  const cutoff = new Date(Date.now() - TTL_MS).toISOString();
  const { data, error } = await createAdminClient()
    .from("newsletter_subscribers")
    .update({ status: "active", confirmed_at: new Date().toISOString() })
    .eq("confirm_token", token)
    .eq("status", "pending")
    .gte("consented_at", cutoff)
    .select("id");
  if (error) throw new Error(`Falha ao confirmar a inscrição: ${error.message}`);
  if (data.length > 0) return "confirmed";

  const lookup = await lookupConfirmToken(token);
  if (lookup.state === "active") return "already_active";
  if (lookup.state === "expired") return "expired";
  return "invalid";
}

// -----------------------------------------------------------------------------
// Descadastro e exclusão
// -----------------------------------------------------------------------------

export type UnsubscribeLookup =
  { state: "invalid" } | { state: "active" | "pending" | "unsubscribed"; maskedEmail: string };

export async function lookupUnsubscribeToken(token: string): Promise<UnsubscribeLookup> {
  if (!isUuid(token)) return { state: "invalid" };
  const { data, error } = await createAdminClient()
    .from("newsletter_subscribers")
    .select("email, status")
    .eq("unsubscribe_token", token)
    .maybeSingle();
  if (error) throw new Error(`Falha ao consultar o link de descadastro: ${error.message}`);
  if (!data) return { state: "invalid" };
  return { state: data.status, maskedEmail: maskEmail(data.email) };
}

export type UnsubscribeOutcome = "unsubscribed" | "already" | "invalid";

/** Descadastra (status 'unsubscribed'). Mantém a linha para não reenviar e para registrar o pedido. */
export async function unsubscribeByToken(token: string): Promise<UnsubscribeOutcome> {
  if (!isUuid(token)) return "invalid";
  const { data, error } = await createAdminClient()
    .from("newsletter_subscribers")
    .update({ status: "unsubscribed", unsubscribed_at: new Date().toISOString() })
    .eq("unsubscribe_token", token)
    .neq("status", "unsubscribed")
    .select("id");
  if (error) throw new Error(`Falha ao cancelar a inscrição: ${error.message}`);
  if (data.length > 0) return "unsubscribed";
  const lookup = await lookupUnsubscribeToken(token);
  return lookup.state === "invalid" ? "invalid" : "already";
}

/** LGPD: apaga a inscrição (e o histórico de envios, em cascata). */
export async function deleteSubscriberByToken(token: string): Promise<"deleted" | "invalid"> {
  if (!isUuid(token)) return "invalid";
  const { data, error } = await createAdminClient()
    .from("newsletter_subscribers")
    .delete()
    .eq("unsubscribe_token", token)
    .select("id");
  if (error) throw new Error(`Falha ao excluir os dados: ${error.message}`);
  return data.length > 0 ? "deleted" : "invalid";
}

/** Situação da inscrição de um e-mail — só para a própria membra logada (e-mail da conta). */
export async function getSubscriptionForEmail(
  email: string,
): Promise<{ status: "active" | "pending" | "unsubscribed"; unsubscribeToken: string } | null> {
  if (!isAdminConfigured()) return null;
  const { data, error } = await createAdminClient()
    .from("newsletter_subscribers")
    .select("status, unsubscribe_token")
    .eq("email", normalizeEmail(email))
    .maybeSingle();
  if (error || !data) return null;
  return { status: data.status, unsubscribeToken: data.unsubscribe_token };
}
