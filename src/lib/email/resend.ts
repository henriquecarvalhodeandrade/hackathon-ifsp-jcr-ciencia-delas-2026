import "server-only";
import { env } from "@/lib/env";
import { parseRetryAfter } from "./address";
import type { EmailMessage, SendBatchResult, SendEmailResult, SendOptions } from "./types";

/**
 * Cliente mínimo da API REST do Resend (https://resend.com/docs/api-reference) via fetch.
 *
 * - `POST /emails` (um e-mail) e `POST /emails/batch` (até 100, sem anexos).
 * - Plano gratuito: 100 e-mails/dia, 3.000/mês, 10 req/s. 429 → respeita Retry-After uma vez.
 * - Sem RESEND_API_KEY nada é lançado: devolve `{ ok: false, skipped: true }`.
 * - `onboarding@resend.dev` só entrega para o e-mail da dona da conta Resend; para enviar de
 *   verdade, verifique um domínio e ajuste NEWSLETTER_FROM (docs/08-newsletter.md).
 */

const RESEND_API_URL = "https://api.resend.com";
export const RESEND_BATCH_LIMIT = 100;
const TIMEOUT_MS = 15_000;
const MAX_RETRY_WAIT_MS = 10_000;

export interface ResendClientOptions {
  apiKey?: string;
  from?: string;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

type ResendPayload = {
  from: string;
  to: string[];
  subject: string;
  html: string;
  text: string;
  headers?: Record<string, string>;
  tags?: Array<{ name: string; value: string }>;
  reply_to?: string;
};

function toPayload(message: EmailMessage, from: string): ResendPayload {
  return {
    from,
    to: [message.to],
    subject: message.subject,
    html: message.html,
    text: message.text,
    ...(message.headers && Object.keys(message.headers).length ? { headers: message.headers } : {}),
    ...(message.tags?.length ? { tags: message.tags } : {}),
    ...(message.replyTo ? { reply_to: message.replyTo } : {}),
  };
}

type RequestResult = { ok: true; json: unknown } | { ok: false; error: string; status?: number };

async function resendRequest(
  path: string,
  body: unknown,
  apiKey: string,
  options: SendOptions & { fetchImpl: typeof fetch; sleep: (ms: number) => Promise<void> },
): Promise<RequestResult> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "User-Agent": "Artemis/1.0",
  };
  if (options.idempotencyKey) headers["Idempotency-Key"] = options.idempotencyKey.slice(0, 256);

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const isLastAttempt = attempt === 1;
    let response: Response;
    try {
      response = await options.fetchImpl(`${RESEND_API_URL}${path}`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(TIMEOUT_MS),
        cache: "no-store",
      });
    } catch (error) {
      // Erro de rede/timeout: só repete se houver chave de idempotência (sem risco de duplicar).
      if (!isLastAttempt && options.idempotencyKey) {
        await options.sleep(1_000);
        continue;
      }
      const detail = error instanceof Error ? error.message : "erro desconhecido";
      return { ok: false, error: `Falha de rede ao falar com o Resend: ${detail}` };
    }

    if (response.ok) {
      return { ok: true, json: await response.json().catch(() => null) };
    }

    // 429 nunca foi processado → pode repetir. 5xx só com idempotência.
    const retryable =
      response.status === 429 || (response.status >= 500 && Boolean(options.idempotencyKey));
    if (!isLastAttempt && retryable) {
      const wait = parseRetryAfter(response.headers.get("retry-after")) ?? 1_000;
      await options.sleep(Math.min(wait, MAX_RETRY_WAIT_MS));
      continue;
    }

    const detail = (await response.json().catch(() => null)) as {
      message?: string;
      name?: string;
    } | null;
    return {
      ok: false,
      status: response.status,
      error:
        `Resend respondeu ${response.status}: ${detail?.message ?? response.statusText ?? "erro"}`.slice(
          0,
          500,
        ),
    };
  }
  return { ok: false, error: "Resend indisponível." };
}

function resolve(options: ResendClientOptions) {
  return {
    apiKey: options.apiKey ?? env.resendApiKey,
    from: options.from ?? env.newsletterFrom,
    fetchImpl: options.fetchImpl ?? fetch,
    sleep: options.sleep ?? defaultSleep,
  };
}

/** Envia um e-mail pelo Resend. Nunca lança: devolve sucesso, falha ou "pulado" (sem chave). */
export async function sendEmail(
  message: EmailMessage,
  options: SendOptions = {},
  client: ResendClientOptions = {},
): Promise<SendEmailResult> {
  const { apiKey, from, fetchImpl, sleep } = resolve(client);
  if (!apiKey) return { ok: false, skipped: true, reason: "RESEND_API_KEY não configurada." };

  const result = await resendRequest("/emails", toPayload(message, from), apiKey, {
    ...options,
    fetchImpl,
    sleep,
  });
  if (!result.ok) return { ok: false, error: result.error, status: result.status };
  const id = (result.json as { id?: unknown } | null)?.id;
  return { ok: true, provider: "resend", id: typeof id === "string" ? id : null };
}

/**
 * Envia até 100 e-mails numa única requisição (`/emails/batch`). Os ids voltam na mesma ordem.
 * Lotes maiores devem ser quebrados por quem chama (veja RESEND_BATCH_LIMIT).
 */
export async function sendBatch(
  messages: EmailMessage[],
  options: SendOptions = {},
  client: ResendClientOptions = {},
): Promise<SendBatchResult> {
  const { apiKey, from, fetchImpl, sleep } = resolve(client);
  if (!apiKey) return { ok: false, skipped: true, reason: "RESEND_API_KEY não configurada." };
  if (messages.length === 0) return { ok: true, provider: "resend", ids: [] };
  if (messages.length > RESEND_BATCH_LIMIT) {
    return {
      ok: false,
      error: `O Resend aceita no máximo ${RESEND_BATCH_LIMIT} e-mails por lote.`,
    };
  }

  const payload = messages.map((m) => toPayload(m, from));
  const result = await resendRequest("/emails/batch", payload, apiKey, {
    ...options,
    fetchImpl,
    sleep,
  });
  if (!result.ok) return { ok: false, error: result.error, status: result.status };

  const data = (result.json as { data?: Array<{ id?: unknown }> } | null)?.data ?? [];
  const ids = messages.map((_, i) => {
    const id = data[i]?.id;
    return typeof id === "string" ? id : null;
  });
  return { ok: true, provider: "resend", ids };
}
