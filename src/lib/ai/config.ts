import { getAiConfig, getEmbeddingConfig, type EmbeddingConfig } from "@/lib/env";
import type { TextProviderConfig, TextProviderName } from "./providers/types";

/**
 * Resolve a cadeia de provedores de texto:
 *   1. o provedor principal de `getAiConfig()` (AI_PROVIDER ou a primeira chave encontrada);
 *   2. depois, os outros provedores que também têm chave — usados como fallback quando o
 *      principal responde 429/5xx, estoura o timeout ou devolve JSON inválido.
 *
 * `AI_PROVIDER=none` desliga tudo (cadeia vazia), mesmo com chaves presentes.
 *
 * Observação: `src/lib/env.ts` só expõe a configuração do provedor principal; as chaves dos
 * provedores de fallback são lidas aqui com a mesma regra de limpeza (trim, vazio = ausente).
 */

const PROVIDER_ORDER: TextProviderName[] = ["gemini", "groq", "openrouter"];

// Mesmos padrões de src/lib/env.ts (modelos gratuitos verificados em out/2026).
const DEFAULT_TEXT_MODELS: Record<TextProviderName, string> = {
  gemini: "gemini-3.5-flash-lite",
  groq: "openai/gpt-oss-120b",
  openrouter: "openrouter/free",
};

function read(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function keyFor(provider: TextProviderName): string | undefined {
  switch (provider) {
    case "gemini":
      return read("GEMINI_API_KEY") ?? read("GOOGLE_API_KEY");
    case "groq":
      return read("GROQ_API_KEY");
    case "openrouter":
      return read("OPENROUTER_API_KEY");
  }
}

function modelFor(provider: TextProviderName): string {
  const fromEnv = {
    gemini: read("GEMINI_MODEL"),
    groq: read("GROQ_MODEL"),
    openrouter: read("OPENROUTER_MODEL"),
  }[provider];
  return fromEnv ?? DEFAULT_TEXT_MODELS[provider];
}

export function isAiExplicitlyDisabled(): boolean {
  return read("AI_PROVIDER")?.toLowerCase() === "none";
}

/** Cadeia de provedores na ordem em que serão tentados (vazia = IA desligada). */
export function getTextProviderChain(): TextProviderConfig[] {
  if (isAiExplicitlyDisabled()) return [];

  const chain: TextProviderConfig[] = [];
  const primary = getAiConfig();
  if (primary.provider !== "none" && primary.apiKey) {
    chain.push({ provider: primary.provider, apiKey: primary.apiKey, model: primary.model });
  }

  for (const provider of PROVIDER_ORDER) {
    if (chain.some((c) => c.provider === provider)) continue;
    const apiKey = keyFor(provider);
    if (apiKey) chain.push({ provider, apiKey, model: modelFor(provider) });
  }
  return chain;
}

export function getEmbeddingProviderConfig(): EmbeddingConfig | null {
  return getEmbeddingConfig();
}
