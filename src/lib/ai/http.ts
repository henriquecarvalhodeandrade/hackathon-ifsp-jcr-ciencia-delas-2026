import { AiError, type AiErrorCode } from "./errors";

/** Timeout padrão de cada requisição a um provedor de IA. */
export const AI_REQUEST_TIMEOUT_MS = 15_000;

/** Maior espera aceitável por `retry-after` antes de desistir e ir para o próximo provedor. */
export const MAX_RETRY_AFTER_MS = 10_000;

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface HttpRequest {
  url: string;
  headers: Record<string, string>;
  body: unknown;
}

/**
 * Interpreta o cabeçalho `retry-after` (segundos, inclusive fracionados, ou data HTTP) e
 * devolve o atraso em ms. Retorna `undefined` quando ausente ou ilegível.
 */
export function parseRetryAfter(value: string | null | undefined, now: number = Date.now()): number | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    return Math.max(0, Math.round(Number(trimmed) * 1000));
  }
  const date = Date.parse(trimmed);
  if (Number.isNaN(date)) return undefined;
  return Math.max(0, date - now);
}

function codeForStatus(status: number): AiErrorCode {
  if (status === 429) return "rate_limited";
  if (status === 401 || status === 403) return "auth";
  if (status === 404) return "not_found";
  if (status >= 500) return "server_error";
  return "bad_request";
}

/** Mensagem curta de erro do corpo da resposta (sem ecoar o prompt). */
function errorSnippet(body: unknown): string | undefined {
  if (body && typeof body === "object") {
    const err = (body as { error?: unknown }).error;
    if (typeof err === "string") return err.slice(0, 200);
    if (err && typeof err === "object") {
      const message = (err as { message?: unknown }).message;
      if (typeof message === "string") return message.slice(0, 200);
    }
  }
  return undefined;
}

function isAbortLike(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === "TimeoutError" || error.name === "AbortError")
  );
}

/**
 * POST JSON com timeout (AbortSignal.timeout). Converte qualquer falha em `AiError` tipado.
 * Nunca inclui cabeçalhos (chaves de API) nem o corpo enviado nas mensagens de erro.
 */
export async function postJson(
  provider: string,
  request: HttpRequest,
  options: { fetch?: FetchLike; timeoutMs?: number } = {},
): Promise<unknown> {
  const doFetch = options.fetch ?? (globalThis.fetch as FetchLike);
  const timeoutMs = options.timeoutMs ?? AI_REQUEST_TIMEOUT_MS;

  let response: Response;
  try {
    response = await doFetch(request.url, {
      method: "POST",
      headers: { "content-type": "application/json", ...request.headers },
      body: JSON.stringify(request.body),
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
  } catch (error) {
    if (isAbortLike(error)) {
      throw new AiError(`${provider}: tempo esgotado após ${timeoutMs} ms`, {
        code: "timeout",
        provider,
        cause: error,
      });
    }
    throw new AiError(`${provider}: falha de rede`, { code: "network", provider, cause: error });
  }

  let body: unknown;
  let bodyReadFailed = false;
  try {
    const text = await response.text();
    body = text ? JSON.parse(text) : undefined;
  } catch (error) {
    if (isAbortLike(error)) {
      throw new AiError(`${provider}: tempo esgotado lendo a resposta`, {
        code: "timeout",
        provider,
        cause: error,
      });
    }
    bodyReadFailed = true;
  }

  if (!response.ok) {
    const code = codeForStatus(response.status);
    const snippet = errorSnippet(body);
    throw new AiError(
      `${provider}: HTTP ${response.status}${snippet ? ` — ${snippet}` : ""}`,
      {
        code,
        provider,
        status: response.status,
        retryAfterMs: parseRetryAfter(response.headers.get("retry-after")),
      },
    );
  }

  if (bodyReadFailed || body === undefined) {
    throw new AiError(`${provider}: resposta HTTP ${response.status} sem JSON válido`, {
      code: "invalid_response",
      provider,
      status: response.status,
    });
  }

  return body;
}
