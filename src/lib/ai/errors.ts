/**
 * Erros tipados da camada de IA. Módulo puro (sem "server-only") para ser testável.
 *
 * - `AiUnavailableError`: não há provedor configurado (AI_PROVIDER=none ou nenhuma chave).
 *   Quem chama deve cair no fallback heurístico sem alarde.
 * - `AiError`: o provedor existe mas a chamada falhou (rede, 429, 5xx, JSON inválido...).
 */

export type AiErrorCode =
  | "timeout"
  | "network"
  | "rate_limited"
  | "server_error"
  | "bad_request"
  | "auth"
  | "not_found"
  | "blocked"
  | "truncated"
  | "invalid_json"
  | "invalid_response"
  | "rejected_output"
  | "budget_exceeded"
  | "all_providers_failed";

export class AiUnavailableError extends Error {
  override readonly name = "AiUnavailableError";
  constructor(
    message = "Nenhum provedor de IA configurado (defina GEMINI_API_KEY, GROQ_API_KEY ou OPENROUTER_API_KEY).",
  ) {
    super(message);
  }
}

export interface AiErrorOptions {
  code: AiErrorCode;
  provider?: string;
  status?: number;
  /** Atraso sugerido pelo provedor (cabeçalho retry-after), em ms. */
  retryAfterMs?: number;
  cause?: unknown;
  /** Falhas anteriores na cadeia de fallback (apenas para diagnóstico). */
  attempts?: AiAttemptSummary[];
}

export interface AiAttemptSummary {
  provider: string;
  model: string;
  code: AiErrorCode;
  status?: number;
}

export class AiError extends Error {
  override readonly name = "AiError";
  readonly code: AiErrorCode;
  readonly provider?: string;
  readonly status?: number;
  readonly retryAfterMs?: number;
  readonly attempts: AiAttemptSummary[];

  constructor(message: string, options: AiErrorOptions) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.code = options.code;
    this.provider = options.provider;
    this.status = options.status;
    this.retryAfterMs = options.retryAfterMs;
    this.attempts = options.attempts ?? [];
  }

  /**
   * Falhas transitórias: vale tentar de novo no mesmo provedor (uma vez). `rejected_output`
   * (JSON válido, mas reprovado por `validate`, ex.: texto sem acentos) é um acaso da
   * amostragem do modelo, então também ganha uma nova tentativa.
   */
  get retryable(): boolean {
    return (
      this.code === "rate_limited" ||
      this.code === "server_error" ||
      this.code === "timeout" ||
      this.code === "network" ||
      this.code === "rejected_output"
    );
  }
}

export function isAiError(error: unknown): error is AiError {
  return error instanceof AiError;
}

export function isAiUnavailableError(error: unknown): error is AiUnavailableError {
  return error instanceof AiUnavailableError;
}
