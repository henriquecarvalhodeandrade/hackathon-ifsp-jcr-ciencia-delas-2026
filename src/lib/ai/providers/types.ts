import type { JsonSchema } from "../json-schema";

export type TextProviderName = "gemini" | "groq" | "openrouter";

export interface TextProviderConfig {
  provider: TextProviderName;
  apiKey: string;
  model: string;
}

/** Pedido de geração já normalizado (o esquema JSON já passou por toStrictJsonSchema). */
export interface JsonGenerationRequest {
  system: string;
  prompt: string;
  jsonSchema: JsonSchema;
  /** Nome curto do esquema (exigido pelo formato json_schema do OpenAI/Groq). */
  schemaName: string;
  temperature: number;
  maxOutputTokens: number;
}

export type EmbeddingKind = "document" | "query";
