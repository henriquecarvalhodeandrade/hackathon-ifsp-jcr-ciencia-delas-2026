import "server-only";
import { getSiteUrl, type AiProvider } from "@/lib/env";
import { getEmbeddingProviderConfig, getTextProviderChain } from "./config";
import {
  embedWithConfig,
  generateJsonWithChain,
  type GenerateJsonOptions,
  type GenerateJsonResult,
} from "./engine";
import type { EmbeddingKind } from "./providers/types";

/**
 * API pública da camada de IA (somente servidor). Chamadas via `fetch` puro, sem SDKs.
 *
 *   generateJson()  → JSON validado por zod, com fallback entre Gemini → Groq → OpenRouter
 *   embedTexts()    → vetores de 768 dimensões (Gemini), normalizados (L2)
 *   isAiEnabled()   → há algum provedor de texto configurado?
 *
 * Sem chaves, nada quebra: `generateJson` lança AiUnavailableError e `embedTexts` devolve null;
 * os chamadores caem nas heurísticas determinísticas.
 */

export { AiError, AiUnavailableError, isAiError, isAiUnavailableError } from "./errors";
export type { AiErrorCode } from "./errors";
export type { GenerateJsonOptions, GenerateJsonResult } from "./engine";
export type { EmbeddingKind, TextProviderName } from "./providers/types";

export async function generateJson<T>(
  options: GenerateJsonOptions<T>,
): Promise<GenerateJsonResult<T>> {
  return generateJsonWithChain(getTextProviderChain(), options, { siteUrl: getSiteUrl() });
}

/**
 * Gera embeddings (sempre com o Gemini, gratuito e multilíngue).
 * Retorna `null` quando não há GEMINI_API_KEY (ou AI_PROVIDER=none); lança AiError em falhas.
 */
export async function embedTexts(
  texts: string[],
  kind: EmbeddingKind,
): Promise<{ vectors: number[][]; model: string } | null> {
  const config = getEmbeddingProviderConfig();
  if (!config) return null;
  return embedWithConfig(config, texts, kind);
}

export function isAiEnabled(): boolean {
  return getTextProviderChain().length > 0;
}

export function isEmbeddingEnabled(): boolean {
  return getEmbeddingProviderConfig() !== null;
}

export interface AiProviderInfo {
  provider: AiProvider;
  model: string;
  embeddings: boolean;
  embeddingModel: string | null;
  /** Provedores de reserva, na ordem de tentativa. */
  fallbacks: string[];
}

/** Resumo seguro (sem chaves) para exibir na UI/admin ou em logs. */
export function getAiProviderInfo(): AiProviderInfo {
  const chain = getTextProviderChain();
  const embedding = getEmbeddingProviderConfig();
  const primary = chain[0];
  return {
    provider: primary?.provider ?? "none",
    model: primary?.model ?? "heuristic",
    embeddings: embedding !== null,
    embeddingModel: embedding?.model ?? null,
    fallbacks: chain.slice(1).map((c) => `${c.provider}:${c.model}`),
  };
}
