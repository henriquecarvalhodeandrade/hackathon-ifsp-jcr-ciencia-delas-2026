import { AiError } from "../errors";
import type { HttpRequest } from "../http";
import type { JsonGenerationRequest, TextProviderConfig } from "./types";

/**
 * Groq e OpenRouter expõem a API de Chat Completions compatível com a da OpenAI.
 * Saída estruturada: response_format { type: "json_schema", json_schema: { name, strict, schema } }.
 */
export const GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions";
export const OPENROUTER_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions";

/** Folga de tokens para o raciocínio dos modelos gpt-oss (conta no limite de saída). */
const GROQ_REASONING_BUDGET = 1024;

export function buildOpenAiCompatibleRequest(
  config: TextProviderConfig,
  request: JsonGenerationRequest,
  options: { siteUrl?: string } = {},
): HttpRequest {
  const messages = [
    { role: "system", content: request.system },
    { role: "user", content: request.prompt },
  ];
  const response_format = {
    type: "json_schema",
    json_schema: { name: request.schemaName, strict: true, schema: request.jsonSchema },
  };

  if (config.provider === "groq") {
    const isReasoningModel = /gpt-oss|qwen3|deepseek-r1/i.test(config.model);
    return {
      url: GROQ_CHAT_URL,
      headers: { authorization: `Bearer ${config.apiKey}` },
      body: {
        model: config.model,
        messages,
        temperature: request.temperature,
        max_completion_tokens:
          request.maxOutputTokens + (isReasoningModel ? GROQ_REASONING_BUDGET : 0),
        ...(isReasoningModel ? { reasoning_effort: "low" } : {}),
        response_format,
      },
    };
  }

  if (config.provider === "openrouter") {
    return {
      url: OPENROUTER_CHAT_URL,
      headers: {
        authorization: `Bearer ${config.apiKey}`,
        // Atribuição opcional recomendada pelo OpenRouter (valores ASCII).
        ...(options.siteUrl ? { "HTTP-Referer": options.siteUrl } : {}),
        "X-Title": "Ciencia Delas",
      },
      body: {
        model: config.model,
        messages,
        temperature: request.temperature,
        max_tokens: request.maxOutputTokens,
        response_format,
      },
    };
  }

  throw new Error(`Provedor não compatível com a API OpenAI: ${config.provider}`);
}

interface ChatCompletionResponse {
  model?: unknown;
  choices?: Array<{
    finish_reason?: unknown;
    message?: { content?: unknown; refusal?: unknown };
  }>;
}

export function parseOpenAiCompatibleResponse(
  provider: string,
  body: unknown,
): { text: string; model?: string } {
  const res = (body ?? {}) as ChatCompletionResponse;
  const choice = res.choices?.[0];
  if (!choice) {
    throw new AiError(`${provider}: resposta sem choices`, { code: "invalid_response", provider });
  }
  const message = choice.message ?? {};
  if (typeof message.refusal === "string" && message.refusal) {
    throw new AiError(`${provider}: o modelo recusou a tarefa`, { code: "blocked", provider });
  }
  const content = message.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new AiError(
      `${provider}: resposta vazia (finish_reason=${String(choice.finish_reason ?? "?")})`,
      { code: choice.finish_reason === "length" ? "truncated" : "invalid_response", provider },
    );
  }
  if (choice.finish_reason === "content_filter") {
    throw new AiError(`${provider}: resposta filtrada`, { code: "blocked", provider });
  }
  return { text: content, model: typeof res.model === "string" ? res.model : undefined };
}
