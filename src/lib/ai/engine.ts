import type { z } from "zod";
import { AiError, AiUnavailableError, type AiAttemptSummary } from "./errors";
import { fitDimensions, formatEmbeddingInput } from "./embedding-input";
import {
  AI_REQUEST_TIMEOUT_MS,
  MAX_RETRY_AFTER_MS,
  postJson,
  type FetchLike,
  type HttpRequest,
} from "./http";
import { parseModelJson, toStrictJsonSchema, zodToStrictJsonSchema } from "./json-schema";
import {
  buildGeminiEmbedRequest,
  buildGeminiGenerateRequest,
  parseGeminiEmbedResponse,
  parseGeminiGenerateResponse,
  usesTaskType,
} from "./providers/gemini";
import {
  buildOpenAiCompatibleRequest,
  parseOpenAiCompatibleResponse,
} from "./providers/openai-compatible";
import type { EmbeddingKind, JsonGenerationRequest, TextProviderConfig } from "./providers/types";

/**
 * Núcleo da camada de IA, sem dependência de ambiente (puro e testável): recebe a cadeia de
 * provedores e um `fetch` injetável. `src/lib/ai/index.ts` liga isto às variáveis de ambiente.
 */

export interface GenerateJsonOptions<T> {
  system: string;
  prompt: string;
  schema: z.ZodType<T>;
  /** JSON Schema escrito à mão (opcional). Se ausente, é derivado do zod. */
  jsonSchema?: object;
  /** Nome curto do esquema para o response_format (a-z, 0-9, _ e -). */
  schemaName?: string;
  temperature?: number;
  maxOutputTokens?: number;
}

export interface GenerateJsonResult<T> {
  data: T;
  provider: string;
  model: string;
}

export interface EngineDeps {
  fetch?: FetchLike;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  /** Logger sem dados pessoais: recebe só provedor, modelo, código e status. */
  log?: (message: string) => void;
  timeoutMs?: number;
  /** Orçamento total de tempo da cadeia inteira (ms). */
  budgetMs?: number;
  siteUrl?: string;
}

export const DEFAULT_TEMPERATURE = 0.4;
export const DEFAULT_MAX_OUTPUT_TOKENS = 2048;
export const DEFAULT_BUDGET_MS = 45_000;
/** Espera usada quando o provedor responde 429/5xx sem retry-after. */
export const DEFAULT_RETRY_DELAY_MS = 1_000;

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function defaultLog(message: string) {
  console.warn(`[ai] ${message}`);
}

function sanitizeSchemaName(name: string | undefined): string {
  const clean = (name ?? "resposta").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64);
  return clean || "resposta";
}

function buildRequest(
  config: TextProviderConfig,
  request: JsonGenerationRequest,
  siteUrl: string | undefined,
): HttpRequest {
  if (config.provider === "gemini") return buildGeminiGenerateRequest(config, request);
  return buildOpenAiCompatibleRequest(config, request, { siteUrl });
}

function parseResponse(
  config: TextProviderConfig,
  body: unknown,
): { text: string; model?: string } {
  if (config.provider === "gemini") return parseGeminiGenerateResponse(body);
  return parseOpenAiCompatibleResponse(config.provider, body);
}

async function callProviderOnce<T>(
  config: TextProviderConfig,
  request: JsonGenerationRequest,
  schema: z.ZodType<T>,
  deps: Required<Pick<EngineDeps, "timeoutMs">> & EngineDeps,
): Promise<GenerateJsonResult<T>> {
  const http = buildRequest(config, request, deps.siteUrl);
  const body = await postJson(config.provider, http, {
    fetch: deps.fetch,
    timeoutMs: deps.timeoutMs,
  });
  const { text, model } = parseResponse(config, body);
  const parsed = parseModelJson(text, schema);
  if (!parsed.ok) {
    throw new AiError(
      `${config.provider}: ${parsed.reason === "invalid_json" ? "JSON inválido" : "JSON fora do esquema"}${parsed.issues ? ` (${parsed.issues})` : ""}`,
      { code: parsed.reason, provider: config.provider },
    );
  }
  // Para o roteador "openrouter/free" o modelo real vem na resposta.
  const reportedModel = config.provider === "openrouter" && model ? model : config.model;
  return { data: parsed.data, provider: config.provider, model: reportedModel };
}

/**
 * Gera JSON validado por zod percorrendo a cadeia de provedores.
 * - 429/5xx/timeout/rede: tenta de novo UMA vez no mesmo provedor (respeitando retry-after
 *   até 10 s); se ainda falhar, passa para o próximo.
 * - JSON inválido, bloqueio, 4xx: passa direto para o próximo provedor.
 * - Cadeia vazia → AiUnavailableError. Todos falharam → AiError("all_providers_failed").
 */
export async function generateJsonWithChain<T>(
  chain: TextProviderConfig[],
  options: GenerateJsonOptions<T>,
  deps: EngineDeps = {},
): Promise<GenerateJsonResult<T>> {
  if (chain.length === 0) throw new AiUnavailableError();

  const sleep = deps.sleep ?? defaultSleep;
  const now = deps.now ?? Date.now;
  const log = deps.log ?? defaultLog;
  const timeoutMs = deps.timeoutMs ?? AI_REQUEST_TIMEOUT_MS;
  const budgetMs = deps.budgetMs ?? DEFAULT_BUDGET_MS;
  const startedAt = now();

  const jsonSchema = options.jsonSchema
    ? toStrictJsonSchema(options.jsonSchema)
    : zodToStrictJsonSchema(options.schema);

  const request: JsonGenerationRequest = {
    system: options.system,
    prompt: options.prompt,
    jsonSchema,
    schemaName: sanitizeSchemaName(options.schemaName),
    temperature: options.temperature ?? DEFAULT_TEMPERATURE,
    maxOutputTokens: options.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS,
  };

  const attempts: AiAttemptSummary[] = [];
  let lastError: AiError | undefined;

  for (const config of chain) {
    for (let attempt = 0; attempt < 2; attempt++) {
      if (now() - startedAt > budgetMs) {
        attempts.push({ provider: config.provider, model: config.model, code: "budget_exceeded" });
        throw new AiError("IA: orçamento de tempo esgotado", {
          code: "budget_exceeded",
          attempts,
          cause: lastError,
        });
      }
      try {
        return await callProviderOnce(config, request, options.schema, { ...deps, timeoutMs });
      } catch (error) {
        const aiError =
          error instanceof AiError
            ? error
            : new AiError(`${config.provider}: erro inesperado`, {
                code: "invalid_response",
                provider: config.provider,
                cause: error,
              });
        lastError = aiError;
        attempts.push({
          provider: config.provider,
          model: config.model,
          code: aiError.code,
          status: aiError.status,
        });
        log(
          `${config.provider}/${config.model} falhou (${aiError.code}${aiError.status ? ` ${aiError.status}` : ""}, tentativa ${attempt + 1})`,
        );

        const canRetry =
          attempt === 0 &&
          aiError.retryable &&
          (aiError.retryAfterMs === undefined || aiError.retryAfterMs <= MAX_RETRY_AFTER_MS);
        if (!canRetry) break;

        const delay =
          aiError.retryAfterMs ?? (aiError.code === "timeout" ? 0 : DEFAULT_RETRY_DELAY_MS);
        if (delay > 0) await sleep(delay);
      }
    }
  }

  throw new AiError(
    `IA: todos os provedores falharam (${attempts.map((a) => `${a.provider}:${a.code}`).join(", ")})`,
    { code: "all_providers_failed", attempts, cause: lastError },
  );
}

// ---------------------------------------------------------------------------
// Embeddings (sempre Gemini)
// ---------------------------------------------------------------------------

export interface EmbeddingProviderConfig {
  apiKey: string;
  model: string;
  dimensions: number;
}

/** Máximo de textos por chamada batchEmbedContents. */
export const EMBED_BATCH_SIZE = 100;

export async function embedWithConfig(
  config: EmbeddingProviderConfig,
  texts: string[],
  kind: EmbeddingKind,
  deps: EngineDeps = {},
): Promise<{ vectors: number[][]; model: string }> {
  if (texts.length === 0) return { vectors: [], model: config.model };

  const sleep = deps.sleep ?? defaultSleep;
  const log = deps.log ?? defaultLog;
  const timeoutMs = deps.timeoutMs ?? AI_REQUEST_TIMEOUT_MS;
  const usePrefix = !usesTaskType(config.model);
  const inputs = texts.map((t) => formatEmbeddingInput(t, kind, { usePrefix }));

  const vectors: number[][] = [];
  for (let start = 0; start < inputs.length; start += EMBED_BATCH_SIZE) {
    const chunk = inputs.slice(start, start + EMBED_BATCH_SIZE);
    const http = buildGeminiEmbedRequest(config, chunk, kind);

    let raw: number[][] | undefined;
    for (let attempt = 0; attempt < 2 && raw === undefined; attempt++) {
      try {
        const body = await postJson("gemini", http, { fetch: deps.fetch, timeoutMs });
        raw = parseGeminiEmbedResponse(body, chunk.length);
      } catch (error) {
        const aiError =
          error instanceof AiError
            ? error
            : new AiError("gemini: erro inesperado nos embeddings", {
                code: "invalid_response",
                provider: "gemini",
                cause: error,
              });
        log(
          `embeddings ${config.model} falhou (${aiError.code}${aiError.status ? ` ${aiError.status}` : ""}, tentativa ${attempt + 1})`,
        );
        const canRetry =
          attempt === 0 &&
          aiError.retryable &&
          (aiError.retryAfterMs === undefined || aiError.retryAfterMs <= MAX_RETRY_AFTER_MS);
        if (!canRetry) throw aiError;
        const delay =
          aiError.retryAfterMs ?? (aiError.code === "timeout" ? 0 : DEFAULT_RETRY_DELAY_MS);
        if (delay > 0) await sleep(delay);
      }
    }

    for (const vector of raw ?? []) {
      const fitted = fitDimensions(vector, config.dimensions);
      if (!fitted) {
        throw new AiError(
          `gemini: vetor com ${vector.length} dimensões (esperado ${config.dimensions})`,
          { code: "invalid_response", provider: "gemini" },
        );
      }
      vectors.push(fitted);
    }
  }

  return { vectors, model: config.model };
}
