/**
 * Acesso centralizado às variáveis de ambiente.
 *
 * - Variáveis `NEXT_PUBLIC_*` precisam ser lidas de forma literal (process.env.NEXT_PUBLIC_X)
 *   para o Next.js conseguir embuti-las no bundle do navegador.
 * - Tudo é lido de forma preguiçosa: a aplicação sobe mesmo sem o Supabase configurado
 *   e mostra um aviso amigável em vez de quebrar.
 */

export type AiProvider = "gemini" | "groq" | "openrouter" | "none";

function clean(value: string | undefined): string | undefined {
  const v = value?.trim();
  return v ? v : undefined;
}

export const env = {
  get siteUrl() {
    return clean(process.env.NEXT_PUBLIC_SITE_URL);
  },
  get supabaseUrl() {
    return clean(process.env.NEXT_PUBLIC_SUPABASE_URL);
  },
  /** Chave publicável (sb_publishable_...) ou a anon key legada. */
  get supabasePublishableKey() {
    return (
      clean(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) ??
      clean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
    );
  },
  /** Chave secreta (sb_secret_...) ou a service_role legada. NUNCA expor no cliente. */
  get supabaseSecretKey() {
    return clean(process.env.SUPABASE_SECRET_KEY) ?? clean(process.env.SUPABASE_SERVICE_ROLE_KEY);
  },
  get resendApiKey() {
    return clean(process.env.RESEND_API_KEY);
  },
  get newsletterFrom() {
    return clean(process.env.NEWSLETTER_FROM) ?? "Ciência Delas <onboarding@resend.dev>";
  },
  get cronSecret() {
    return clean(process.env.CRON_SECRET);
  },
};

export function isSupabaseConfigured(): boolean {
  return Boolean(env.supabaseUrl && env.supabasePublishableKey);
}

export function isAdminConfigured(): boolean {
  return Boolean(env.supabaseUrl && env.supabaseSecretKey);
}

export function isEmailConfigured(): boolean {
  return Boolean(env.resendApiKey);
}

/** URL pública do site, sem barra no final. Usada em links de e-mail e redirects de auth. */
export function getSiteUrl(): string {
  const explicit = env.siteUrl;
  if (explicit) return explicit.replace(/\/+$/, "");
  const vercel = clean(process.env.VERCEL_PROJECT_PRODUCTION_URL) ?? clean(process.env.VERCEL_URL);
  if (vercel) return `https://${vercel.replace(/\/+$/, "")}`;
  return "http://localhost:3000";
}

export interface AiConfig {
  provider: AiProvider;
  apiKey?: string;
  model: string;
}

export interface EmbeddingConfig {
  apiKey: string;
  model: string;
  dimensions: number;
}

// Modelos gratuitos verificados em out/2026 (ver docs/04-mentoria-com-ia.md).
// Os Llama 3.x do Groq foram desligados no plano free em 16/08/2026.
const DEFAULT_MODELS: Record<Exclude<AiProvider, "none">, string> = {
  gemini: "gemini-3.5-flash-lite",
  groq: "openai/gpt-oss-120b",
  openrouter: "openrouter/free",
};

export const DEFAULT_EMBEDDING_MODEL = "gemini-embedding-2";
export const EMBEDDING_DIMENSIONS = 768;

/**
 * Resolve o provedor de IA. Se AI_PROVIDER não for definido, escolhe o primeiro
 * provedor que tiver chave (Gemini → Groq → OpenRouter). Sem chave nenhuma → "none"
 * e toda a aplicação usa os fallbacks heurísticos.
 */
export function getAiConfig(): AiConfig {
  const requested = clean(process.env.AI_PROVIDER)?.toLowerCase() as AiProvider | undefined;
  const keys = {
    gemini: clean(process.env.GEMINI_API_KEY) ?? clean(process.env.GOOGLE_API_KEY),
    groq: clean(process.env.GROQ_API_KEY),
    openrouter: clean(process.env.OPENROUTER_API_KEY),
  };

  const provider: AiProvider =
    requested && ["gemini", "groq", "openrouter", "none"].includes(requested)
      ? requested
      : keys.gemini
        ? "gemini"
        : keys.groq
          ? "groq"
          : keys.openrouter
            ? "openrouter"
            : "none";

  if (provider === "none" || !keys[provider]) {
    return { provider: "none", model: "heuristic" };
  }

  const modelEnv = {
    gemini: clean(process.env.GEMINI_MODEL),
    groq: clean(process.env.GROQ_MODEL),
    openrouter: clean(process.env.OPENROUTER_MODEL),
  }[provider];

  return {
    provider,
    apiKey: keys[provider],
    model: modelEnv ?? DEFAULT_MODELS[provider],
  };
}

/**
 * Embeddings vêm sempre do Gemini (gratuito e multilíngue), independentemente do
 * provedor de texto escolhido. Sem GEMINI_API_KEY → null e o matching usa só heurísticas.
 */
export function getEmbeddingConfig(): EmbeddingConfig | null {
  if (clean(process.env.AI_PROVIDER)?.toLowerCase() === "none") return null;
  const apiKey = clean(process.env.GEMINI_API_KEY) ?? clean(process.env.GOOGLE_API_KEY);
  if (!apiKey) return null;
  return {
    apiKey,
    model: clean(process.env.GEMINI_EMBEDDING_MODEL) ?? DEFAULT_EMBEDDING_MODEL,
    dimensions: EMBEDDING_DIMENSIONS,
  };
}
