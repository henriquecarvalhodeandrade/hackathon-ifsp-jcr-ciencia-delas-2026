import "server-only";
import { env, isEmailConfigured } from "@/lib/env";
import { getMailpitUrl, isProductionRuntime } from "./config";
import { sendBatchViaMailpit, sendViaMailpit } from "./mailpit";
import * as resend from "./resend";
import type { EmailMessage, EmailTransport, SendBatchResult, SendEmailResult, SendOptions } from "./types";

/**
 * Fachada de envio usada pela aplicação. Escolhe o transporte:
 *   1. Resend, quando RESEND_API_KEY existe (produção);
 *   2. Mailpit do Supabase local, só fora de produção (para testar o fluxo de verdade);
 *   3. nenhum — devolve `skipped` e quem chama registra o link no console (dev) ou avisa (produção).
 */

export type { EmailMessage, EmailTransport, SendBatchResult, SendEmailResult, SendOptions } from "./types";
export { RESEND_BATCH_LIMIT } from "./resend";

export function getEmailTransport(): EmailTransport {
  if (isEmailConfigured()) return "resend";
  if (getMailpitUrl()) return "mailpit";
  return "none";
}

export interface EmailTransportInfo {
  transport: EmailTransport;
  /** Remetente configurado (NEWSLETTER_FROM). */
  from: string;
  /** Endereço da caixa do Mailpit quando o transporte é o de desenvolvimento. */
  devInboxUrl: string | null;
  /** O remetente padrão do Resend só entrega para a dona da conta. */
  usingResendTestSender: boolean;
  production: boolean;
}

/** Resumo seguro (sem chaves) para mostrar em telas de administração e avisos. */
export function getEmailTransportInfo(): EmailTransportInfo {
  const transport = getEmailTransport();
  return {
    transport,
    from: env.newsletterFrom,
    devInboxUrl: transport === "mailpit" ? getMailpitUrl() : null,
    usingResendTestSender: /onboarding@resend\.dev/i.test(env.newsletterFrom),
    production: isProductionRuntime(),
  };
}

export async function sendEmail(message: EmailMessage, options: SendOptions = {}): Promise<SendEmailResult> {
  const transport = getEmailTransport();
  if (transport === "resend") return resend.sendEmail(message, options);
  if (transport === "mailpit") return sendViaMailpit(getMailpitUrl()!, message);
  return { ok: false, skipped: true, reason: "Nenhum serviço de e-mail configurado (RESEND_API_KEY)." };
}

export async function sendBatch(messages: EmailMessage[], options: SendOptions = {}): Promise<SendBatchResult> {
  const transport = getEmailTransport();
  if (transport === "resend") return resend.sendBatch(messages, options);
  if (transport === "mailpit") return sendBatchViaMailpit(getMailpitUrl()!, messages);
  return { ok: false, skipped: true, reason: "Nenhum serviço de e-mail configurado (RESEND_API_KEY)." };
}
