import { beforeEach, describe, expect, it, vi } from "vitest";
import { getTextProviderChain } from "./config";

const VARS = [
  "AI_PROVIDER",
  "GEMINI_API_KEY",
  "GOOGLE_API_KEY",
  "GEMINI_MODEL",
  "GROQ_API_KEY",
  "GROQ_MODEL",
  "OPENROUTER_API_KEY",
  "OPENROUTER_MODEL",
];

beforeEach(() => {
  for (const name of VARS) vi.stubEnv(name, "");
});

describe("getTextProviderChain", () => {
  it("sem chaves → cadeia vazia (IA desligada)", () => {
    expect(getTextProviderChain()).toEqual([]);
  });

  it("sem AI_PROVIDER usa a ordem Gemini → Groq → OpenRouter, só com quem tem chave", () => {
    vi.stubEnv("OPENROUTER_API_KEY", "or-key");
    vi.stubEnv("GEMINI_API_KEY", "gm-key");
    expect(getTextProviderChain().map((c) => c.provider)).toEqual(["gemini", "openrouter"]);
  });

  it("AI_PROVIDER escolhe o principal; os demais com chave viram fallback", () => {
    vi.stubEnv("AI_PROVIDER", "groq");
    vi.stubEnv("GEMINI_API_KEY", "gm-key");
    vi.stubEnv("GROQ_API_KEY", "gq-key");
    vi.stubEnv("GROQ_MODEL", "qwen/qwen3.8-27b");
    const chain = getTextProviderChain();
    expect(chain.map((c) => c.provider)).toEqual(["groq", "gemini"]);
    expect(chain[0]).toEqual({ provider: "groq", apiKey: "gq-key", model: "qwen/qwen3.8-27b" });
    expect(chain[1].model).toBe("gemini-3.5-flash-lite");
  });

  it("AI_PROVIDER=none desliga tudo mesmo com chaves", () => {
    vi.stubEnv("AI_PROVIDER", "none");
    vi.stubEnv("GEMINI_API_KEY", "gm-key");
    expect(getTextProviderChain()).toEqual([]);
  });

  it("provedor pedido sem chave: usa os que têm chave", () => {
    vi.stubEnv("AI_PROVIDER", "openrouter");
    vi.stubEnv("GROQ_API_KEY", "gq-key");
    expect(getTextProviderChain()).toEqual([
      { provider: "groq", apiKey: "gq-key", model: "openai/gpt-oss-120b" },
    ]);
  });

  it("chaves só com espaços contam como ausentes", () => {
    vi.stubEnv("GEMINI_API_KEY", "   ");
    expect(getTextProviderChain()).toEqual([]);
  });
});
