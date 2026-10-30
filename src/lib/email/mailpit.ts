import "server-only";
import { env } from "@/lib/env";
import { parseAddress } from "./address";
import type { EmailMessage, SendBatchResult, SendEmailResult } from "./types";

/**
 * Transporte de DESENVOLVIMENTO: entrega na caixa falsa do Mailpit que vem com o Supabase local
 * (http://127.0.0.1:54324, API `POST /api/v1/send`). Nunca é usado em produção.
 */

const TIMEOUT_MS = 5_000;

export async function sendViaMailpit(
  baseUrl: string,
  message: EmailMessage,
  fetchImpl: typeof fetch = fetch,
): Promise<SendEmailResult> {
  const from = parseAddress(env.newsletterFrom);
  try {
    const response = await fetchImpl(`${baseUrl}/api/v1/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        From: { Email: from.email, Name: from.name ?? "" },
        To: [{ Email: message.to }],
        Subject: message.subject,
        Text: message.text,
        HTML: message.html,
        Headers: message.headers ?? {},
        Tags: (message.tags ?? []).map((t) => `${t.name}-${t.value}`).slice(0, 10),
        ...(message.replyTo ? { ReplyTo: [{ Email: message.replyTo }] } : {}),
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      return {
        ok: false,
        status: response.status,
        error: `Mailpit respondeu ${response.status}: ${text.slice(0, 200)}`,
      };
    }
    const json = (await response.json().catch(() => null)) as { ID?: unknown } | null;
    return { ok: true, provider: "mailpit", id: typeof json?.ID === "string" ? json.ID : null };
  } catch (error) {
    const detail = error instanceof Error ? error.message : "erro desconhecido";
    return { ok: false, error: `Mailpit indisponível em ${baseUrl}: ${detail}` };
  }
}

/** O Mailpit não tem lote: envia um por um e para no primeiro erro. */
export async function sendBatchViaMailpit(
  baseUrl: string,
  messages: EmailMessage[],
  fetchImpl: typeof fetch = fetch,
): Promise<SendBatchResult> {
  const ids: Array<string | null> = [];
  for (const message of messages) {
    const result = await sendViaMailpit(baseUrl, message, fetchImpl);
    if (!result.ok) {
      if (result.skipped) return result;
      return { ok: false, error: result.error, status: result.status };
    }
    ids.push(result.id);
  }
  return { ok: true, provider: "mailpit", ids };
}
