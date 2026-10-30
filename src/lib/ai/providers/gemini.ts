import { AiError } from "../errors";
import type { HttpRequest } from "../http";
import type { EmbeddingKind, JsonGenerationRequest, TextProviderConfig } from "./types";

/**
 * Gemini API (Google AI Studio) via REST puro.
 * Docs: https://ai.google.dev/api/generate-content e https://ai.google.dev/api/embeddings
 */
export const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

function modelPath(model: string): string {
  const clean = model.replace(/^models\//, "");
  return `models/${clean}`;
}

export function buildGeminiGenerateRequest(
  config: TextProviderConfig,
  request: JsonGenerationRequest,
): HttpRequest {
  return {
    url: `${GEMINI_BASE_URL}/${modelPath(config.model)}:generateContent`,
    headers: { "x-goog-api-key": config.apiKey },
    body: {
      systemInstruction: { parts: [{ text: request.system }] },
      contents: [{ role: "user", parts: [{ text: request.prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseJsonSchema: request.jsonSchema,
        temperature: request.temperature,
        maxOutputTokens: request.maxOutputTokens,
      },
    },
  };
}

interface GeminiPart {
  text?: unknown;
  thought?: unknown;
}

interface GeminiGenerateResponse {
  candidates?: Array<{
    content?: { parts?: GeminiPart[] };
    finishReason?: string;
  }>;
  promptFeedback?: { blockReason?: string };
  modelVersion?: string;
}

/** Extrai o texto (JSON) da resposta; ignora partes de "pensamento" (thought: true). */
export function parseGeminiGenerateResponse(body: unknown): { text: string; model?: string } {
  const res = (body ?? {}) as GeminiGenerateResponse;

  if (res.promptFeedback?.blockReason) {
    throw new AiError(`gemini: prompt bloqueado (${res.promptFeedback.blockReason})`, {
      code: "blocked",
      provider: "gemini",
    });
  }

  const candidate = res.candidates?.[0];
  if (!candidate) {
    throw new AiError("gemini: resposta sem candidates", {
      code: "invalid_response",
      provider: "gemini",
    });
  }

  const text = (candidate.content?.parts ?? [])
    .filter((p) => p.thought !== true && typeof p.text === "string")
    .map((p) => p.text as string)
    .join("");

  const finish = candidate.finishReason;
  if (!text) {
    const blocked = finish && finish !== "STOP" && finish !== "MAX_TOKENS";
    throw new AiError(`gemini: resposta vazia (finishReason=${finish ?? "?"})`, {
      code: blocked ? "blocked" : finish === "MAX_TOKENS" ? "truncated" : "invalid_response",
      provider: "gemini",
    });
  }
  if (finish === "SAFETY" || finish === "PROHIBITED_CONTENT" || finish === "BLOCKLIST") {
    throw new AiError(`gemini: resposta bloqueada (finishReason=${finish})`, {
      code: "blocked",
      provider: "gemini",
    });
  }

  return { text, model: typeof res.modelVersion === "string" ? res.modelVersion : undefined };
}

// ---------------------------------------------------------------------------
// Embeddings
// ---------------------------------------------------------------------------

/**
 * Modelos antigos (gemini-embedding-001, text-embedding-004) usam `taskType`;
 * o gemini-embedding-2 dispensa taskType e usa prefixos no texto (ver embedding-input.ts).
 */
export function usesTaskType(model: string): boolean {
  return /gemini-embedding-001|text-embedding-00\d|embedding-001/.test(model);
}

export function buildGeminiEmbedRequest(
  config: { apiKey: string; model: string; dimensions: number },
  inputs: string[],
  kind: EmbeddingKind,
): HttpRequest {
  const model = modelPath(config.model);
  const taskType = usesTaskType(config.model)
    ? kind === "document"
      ? "RETRIEVAL_DOCUMENT"
      : "RETRIEVAL_QUERY"
    : undefined;
  return {
    url: `${GEMINI_BASE_URL}/${model}:batchEmbedContents`,
    headers: { "x-goog-api-key": config.apiKey },
    body: {
      requests: inputs.map((text) => ({
        model,
        content: { parts: [{ text }] },
        output_dimensionality: config.dimensions,
        ...(taskType ? { taskType } : {}),
      })),
    },
  };
}

export function parseGeminiEmbedResponse(body: unknown, expectedCount: number): number[][] {
  const embeddings = (body as { embeddings?: Array<{ values?: unknown }> } | undefined)?.embeddings;
  if (!Array.isArray(embeddings) || embeddings.length !== expectedCount) {
    throw new AiError(
      `gemini: batchEmbedContents devolveu ${Array.isArray(embeddings) ? embeddings.length : 0} vetores (esperado ${expectedCount})`,
      { code: "invalid_response", provider: "gemini" },
    );
  }
  return embeddings.map((e, i) => {
    const values = e?.values;
    if (
      !Array.isArray(values) ||
      values.length === 0 ||
      !values.every((v) => typeof v === "number" && Number.isFinite(v))
    ) {
      throw new AiError(`gemini: vetor ${i} inválido`, {
        code: "invalid_response",
        provider: "gemini",
      });
    }
    return values as number[];
  });
}
