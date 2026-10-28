import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { AiError, AiUnavailableError } from "./errors";
import { embedWithConfig, generateJsonWithChain, type EngineDeps } from "./engine";
import { explainResponseSchema } from "@/lib/matching/pseudonymize";
import {
  GEMINI_EXPLAIN_OK,
  GEMINI_EXPLAIN_UNACCENTED,
  GEMINI_OPTIONAL_NULL,
} from "./fixtures/gemini-responses";
import { parseRetryAfter, type FetchLike } from "./http";
import { rejectUnaccentedText } from "./text";
import { GROQ_CHAT_URL, OPENROUTER_CHAT_URL } from "./providers/openai-compatible";
import type { TextProviderConfig } from "./providers/types";

const GEMINI: TextProviderConfig = {
  provider: "gemini",
  apiKey: "GEMINI-SECRET",
  model: "gemini-3.5-flash-lite",
};
const GROQ: TextProviderConfig = {
  provider: "groq",
  apiKey: "GROQ-SECRET",
  model: "openai/gpt-oss-120b",
};
const OPENROUTER: TextProviderConfig = {
  provider: "openrouter",
  apiKey: "OR-SECRET",
  model: "openrouter/free",
};

const schema = z.object({ answer: z.string(), confidence: z.number().optional() });
const OPTIONS = { system: "Sistema", prompt: "Pergunta", schema, schemaName: "teste" };

function json(
  body: unknown,
  init: { status?: number; headers?: Record<string, string> } = {},
): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { "content-type": "application/json", ...init.headers },
  });
}

const geminiOk = (text: string) =>
  json({
    candidates: [{ content: { parts: [{ text }] }, finishReason: "STOP" }],
    modelVersion: "x",
  });
const chatOk = (content: string, model?: string) =>
  json({ model, choices: [{ message: { role: "assistant", content }, finish_reason: "stop" }] });

interface Call {
  url: string;
  headers: Record<string, string>;
  body: Record<string, unknown>;
}

/** fetch falso que devolve as respostas em sequência e registra as chamadas. */
function mockFetch(...responses: Array<Response | Error>) {
  const calls: Call[] = [];
  const fn = vi.fn<FetchLike>(async (url, init) => {
    calls.push({
      url,
      headers: (init?.headers ?? {}) as Record<string, string>,
      body: JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>,
    });
    const next = responses.shift();
    if (!next) throw new Error("fetch chamado mais vezes que o esperado");
    if (next instanceof Error) throw next;
    return next;
  });
  return { fetch: fn, calls };
}

function deps(fetch: FetchLike, extra: Partial<EngineDeps> = {}) {
  const sleep = vi.fn(async (ms: number) => {
    void ms;
  });
  const log = vi.fn((message: string) => {
    void message;
  });
  return { deps: { fetch, sleep, log, ...extra } satisfies EngineDeps, sleep, log };
}

describe("montagem das requisições", () => {
  it("Gemini: generateContent com responseJsonSchema estrito e chave no cabeçalho", async () => {
    const { fetch, calls } = mockFetch(geminiOk('{"answer":"oi"}'));
    const res = await generateJsonWithChain(
      [GEMINI],
      { ...OPTIONS, temperature: 0.2, maxOutputTokens: 300 },
      deps(fetch).deps,
    );

    expect(res).toEqual({
      data: { answer: "oi" },
      provider: "gemini",
      model: "gemini-3.5-flash-lite",
    });
    const call = calls[0];
    expect(call.url).toBe(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent",
    );
    expect(call.headers["x-goog-api-key"]).toBe("GEMINI-SECRET");
    expect(call.url).not.toContain("SECRET");
    expect(call.body).toEqual({
      systemInstruction: { parts: [{ text: "Sistema" }] },
      contents: [{ role: "user", parts: [{ text: "Pergunta" }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseJsonSchema: {
          type: "object",
          properties: { answer: { type: "string" }, confidence: { type: ["number", "null"] } },
          required: ["answer", "confidence"],
          additionalProperties: false,
        },
        temperature: 0.2,
        maxOutputTokens: 300,
      },
    });
  });

  it("Groq: chat completions com json_schema strict e reasoning_effort low", async () => {
    const { fetch, calls } = mockFetch(chatOk('{"answer":"oi"}'));
    const res = await generateJsonWithChain([GROQ], OPTIONS, deps(fetch).deps);

    expect(res.provider).toBe("groq");
    expect(res.model).toBe("openai/gpt-oss-120b");
    const call = calls[0];
    expect(call.url).toBe(GROQ_CHAT_URL);
    expect(call.headers.authorization).toBe("Bearer GROQ-SECRET");
    expect(call.body).toMatchObject({
      model: "openai/gpt-oss-120b",
      reasoning_effort: "low",
      messages: [
        { role: "system", content: "Sistema" },
        { role: "user", content: "Pergunta" },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "teste",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["answer", "confidence"],
          },
        },
      },
    });
    expect(call.body.max_completion_tokens).toBeGreaterThan(2048);
  });

  it("OpenRouter: mesmo formato, modelo openrouter/free e modelo real devolvido", async () => {
    const { fetch, calls } = mockFetch(
      chatOk('```json\n{"answer":"oi"}\n```', "meta/llama-free:free"),
    );
    const res = await generateJsonWithChain(
      [OPENROUTER],
      OPTIONS,
      deps(fetch, { siteUrl: "https://delas.dev" }).deps,
    );

    expect(res).toEqual({
      data: { answer: "oi" },
      provider: "openrouter",
      model: "meta/llama-free:free",
    });
    expect(calls[0].url).toBe(OPENROUTER_CHAT_URL);
    expect(calls[0].headers.authorization).toBe("Bearer OR-SECRET");
    expect(calls[0].headers["HTTP-Referer"]).toBe("https://delas.dev");
    expect(calls[0].body).toMatchObject({
      model: "openrouter/free",
      max_tokens: 2048,
      response_format: { type: "json_schema", json_schema: { strict: true } },
    });
    expect(calls[0].body).not.toHaveProperty("reasoning_effort");
  });

  it("Gemini: ignora partes de pensamento e aceita null em campo opcional", async () => {
    const { fetch } = mockFetch(
      json({
        candidates: [
          {
            content: {
              parts: [
                { text: "pensando...", thought: true },
                { text: '{"answer":"ok","confidence":null}' },
              ],
            },
            finishReason: "STOP",
          },
        ],
      }),
    );
    const res = await generateJsonWithChain([GEMINI], OPTIONS, deps(fetch).deps);
    expect(res.data).toEqual({ answer: "ok" });
  });
});

describe("cadeia de fallback", () => {
  it("cadeia vazia → AiUnavailableError", async () => {
    await expect(generateJsonWithChain([], OPTIONS)).rejects.toBeInstanceOf(AiUnavailableError);
  });

  it("429 com retry-after curto: espera, tenta de novo uma vez e depois cai para o próximo", async () => {
    const { fetch, calls } = mockFetch(
      json({ error: { message: "quota" } }, { status: 429, headers: { "retry-after": "2" } }),
      json({ error: { message: "quota" } }, { status: 429, headers: { "retry-after": "2" } }),
      chatOk('{"answer":"do groq"}'),
    );
    const { deps: d, sleep } = deps(fetch);
    const res = await generateJsonWithChain([GEMINI, GROQ], OPTIONS, d);

    expect(res.provider).toBe("groq");
    expect(res.data.answer).toBe("do groq");
    expect(calls.map((c) => c.url)).toEqual([
      expect.stringContaining("generativelanguage"),
      expect.stringContaining("generativelanguage"),
      GROQ_CHAT_URL,
    ]);
    expect(sleep).toHaveBeenCalledTimes(1);
    expect(sleep).toHaveBeenCalledWith(2000);
  });

  it("429 com retry-after longo (cota diária) vai direto para o próximo provedor", async () => {
    const { fetch, calls } = mockFetch(
      json({}, { status: 429, headers: { "retry-after": "3600" } }),
      chatOk('{"answer":"ok"}'),
    );
    const { deps: d, sleep } = deps(fetch);
    const res = await generateJsonWithChain([GEMINI, OPENROUTER], OPTIONS, d);
    expect(res.provider).toBe("openrouter");
    expect(calls).toHaveLength(2);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("5xx seguido de sucesso no mesmo provedor", async () => {
    const { fetch, calls } = mockFetch(json({}, { status: 503 }), geminiOk('{"answer":"ok"}'));
    const { deps: d, sleep } = deps(fetch);
    const res = await generateJsonWithChain([GEMINI, GROQ], OPTIONS, d);
    expect(res.provider).toBe("gemini");
    expect(calls).toHaveLength(2);
    expect(sleep).toHaveBeenCalledWith(1000);
  });

  it("JSON inválido não repete no mesmo provedor: passa para o próximo", async () => {
    const { fetch, calls } = mockFetch(geminiOk("isto não é JSON"), chatOk('{"answer":"ok"}'));
    const res = await generateJsonWithChain([GEMINI, GROQ], OPTIONS, deps(fetch).deps);
    expect(res.provider).toBe("groq");
    expect(calls).toHaveLength(2);
  });

  it("JSON fora do esquema também cai para o próximo", async () => {
    const { fetch } = mockFetch(chatOk('{"resposta":"x"}'), geminiOk('{"answer":"ok"}'));
    const res = await generateJsonWithChain([GROQ, GEMINI], OPTIONS, deps(fetch).deps);
    expect(res.provider).toBe("gemini");
  });

  it("resposta reprovada por validate: tenta de novo no mesmo provedor, sem esperar", async () => {
    const { fetch, calls } = mockFetch(
      geminiOk('{"answer":"voce nao"}'),
      geminiOk('{"answer":"você não"}'),
    );
    const { deps: d, sleep, log } = deps(fetch);
    const validate = vi.fn((data: { answer: string }) =>
      data.answer.includes("voce") ? "texto sem acentos" : null,
    );
    const res = await generateJsonWithChain([GEMINI, GROQ], { ...OPTIONS, validate }, d);
    expect(res).toMatchObject({ provider: "gemini", data: { answer: "você não" } });
    expect(calls).toHaveLength(2);
    expect(validate).toHaveBeenCalledTimes(2);
    expect(sleep).not.toHaveBeenCalled();
    const logged = log.mock.calls.flat().join("\n");
    expect(logged).toContain("rejected_output");
    expect(logged).not.toContain("voce"); // o texto do modelo nunca vai para o log
  });

  it("reprovada duas vezes: passa para o próximo provedor", async () => {
    const { fetch, calls } = mockFetch(
      geminiOk('{"answer":"voce"}'),
      geminiOk('{"answer":"voce"}'),
      chatOk('{"answer":"você"}'),
    );
    const validate = (data: { answer: string }) => (data.answer === "voce" ? "sem acentos" : null);
    const res = await generateJsonWithChain(
      [GEMINI, GROQ],
      { ...OPTIONS, validate },
      deps(fetch).deps,
    );
    expect(res.provider).toBe("groq");
    expect(calls).toHaveLength(3);
  });

  it("respostas reais do Gemini: a sem acentos é reprovada e a nova tentativa vale", async () => {
    const { fetch, calls } = mockFetch(json(GEMINI_EXPLAIN_UNACCENTED), json(GEMINI_EXPLAIN_OK));
    const res = await generateJsonWithChain(
      [GEMINI],
      {
        system: "Sistema",
        prompt: "Pergunta",
        schema: explainResponseSchema,
        validate: (d) => rejectUnaccentedText(d.ranking.flatMap((r) => [r.reason, ...r.starters])),
      },
      deps(fetch).deps,
    );
    expect(calls).toHaveLength(2);
    expect(res.data.ranking.map((r) => r.id)).toEqual(["c1", "c3", "c4"]);
    expect(res.data.ranking[0].reason).toContain("Vocês compartilham");
  });

  it("resposta real com campo opcional em null (type [string, null]) vira campo ausente", async () => {
    const { fetch, calls } = mockFetch(json(GEMINI_OPTIONAL_NULL));
    const res = await generateJsonWithChain(
      [GEMINI],
      {
        system: "Sistema",
        prompt: "Pergunta",
        schema: z.object({ titulo: z.string(), subtitulo: z.string().optional() }),
      },
      deps(fetch).deps,
    );
    expect(res.data).toEqual({ titulo: "Abelhas Nativas" });
    const sent = calls[0].body.generationConfig as { responseJsonSchema: Record<string, unknown> };
    expect(sent.responseJsonSchema).toMatchObject({
      properties: { subtitulo: { type: ["string", "null"] } },
      required: ["titulo", "subtitulo"],
    });
  });

  it("timeout: tenta de novo sem esperar e depois cai para o próximo", async () => {
    const timeout = new DOMException("The operation timed out.", "TimeoutError");
    const { fetch, calls } = mockFetch(timeout, timeout, chatOk('{"answer":"ok"}'));
    const { deps: d, sleep } = deps(fetch);
    const res = await generateJsonWithChain([GROQ, OPENROUTER], OPTIONS, d);
    expect(res.provider).toBe("openrouter");
    expect(calls).toHaveLength(3);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("401 (chave inválida) e bloqueio de segurança não repetem", async () => {
    const { fetch, calls } = mockFetch(
      json({ error: { message: "API key not valid" } }, { status: 401 }),
      json({ promptFeedback: { blockReason: "SAFETY" } }),
      chatOk('{"answer":"ok"}'),
    );
    const res = await generateJsonWithChain([GROQ, GEMINI, OPENROUTER], OPTIONS, deps(fetch).deps);
    expect(res.provider).toBe("openrouter");
    expect(calls).toHaveLength(3);
  });

  it("todos falham → AiError all_providers_failed com o resumo das tentativas, sem vazar chaves", async () => {
    const { fetch } = mockFetch(
      json({ error: { message: "bad" } }, { status: 400 }),
      chatOk("nada de json"),
    );
    const { deps: d, log } = deps(fetch);
    const error = await generateJsonWithChain([GEMINI, GROQ], OPTIONS, d).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AiError);
    const aiError = error as AiError;
    expect(aiError.code).toBe("all_providers_failed");
    expect(aiError.attempts).toEqual([
      { provider: "gemini", model: "gemini-3.5-flash-lite", code: "bad_request", status: 400 },
      { provider: "groq", model: "openai/gpt-oss-120b", code: "invalid_json", status: undefined },
    ]);
    const logged = log.mock.calls.map((c) => String(c[0])).join("\n");
    for (const text of [aiError.message, logged]) {
      expect(text).not.toContain("SECRET");
      expect(text).not.toContain("Pergunta");
    }
  });

  it("respeita o orçamento total de tempo", async () => {
    let t = 0;
    const { fetch } = mockFetch(json({}, { status: 500 }), json({}, { status: 500 }));
    const { deps: d } = deps(fetch, {
      now: () => t,
      budgetMs: 1000,
      sleep: async (ms: number) => {
        t += ms + 5000;
      },
    });
    const error = await generateJsonWithChain([GEMINI, GROQ], OPTIONS, d).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AiError);
    expect((error as AiError).code).toBe("budget_exceeded");
  });
});

describe("parseRetryAfter", () => {
  it("aceita segundos e datas HTTP", () => {
    expect(parseRetryAfter("3")).toBe(3000);
    expect(parseRetryAfter("1.5")).toBe(1500);
    const now = Date.parse("2026-10-27T12:00:00Z");
    expect(parseRetryAfter("Tue, 27 Oct 2026 12:00:10 GMT", now)).toBe(10_000);
    expect(parseRetryAfter(null)).toBeUndefined();
    expect(parseRetryAfter("amanhã")).toBeUndefined();
  });
});

describe("embeddings (Gemini batchEmbedContents)", () => {
  const CONFIG = { apiKey: "GEMINI-SECRET", model: "gemini-embedding-2", dimensions: 4 };

  it("envia prefixos de tarefa, output_dimensionality e nenhum taskType", async () => {
    const { fetch, calls } = mockFetch(
      json({ embeddings: [{ values: [3, 4, 0, 0] }, { values: [1, 1, 1, 1] }] }),
    );
    const res = await embedWithConfig(
      CONFIG,
      ["perfil A", "perfil B"],
      "document",
      deps(fetch).deps,
    );

    expect(calls[0].url).toBe(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-2:batchEmbedContents",
    );
    expect(calls[0].headers["x-goog-api-key"]).toBe("GEMINI-SECRET");
    expect(calls[0].body).toEqual({
      requests: [
        {
          model: "models/gemini-embedding-2",
          content: { parts: [{ text: "title: none | text: perfil A" }] },
          output_dimensionality: 4,
        },
        {
          model: "models/gemini-embedding-2",
          content: { parts: [{ text: "title: none | text: perfil B" }] },
          output_dimensionality: 4,
        },
      ],
    });
    expect(res.model).toBe("gemini-embedding-2");
    expect(res.vectors[0]).toEqual([0.6, 0.8, 0, 0]);
    expect(res.vectors[1].map((v) => Number(v.toFixed(6)))).toEqual([0.5, 0.5, 0.5, 0.5]);
  });

  it("consulta usa o prefixo de busca", async () => {
    const { fetch, calls } = mockFetch(json({ embeddings: [{ values: [1, 0, 0, 0] }] }));
    await embedWithConfig(CONFIG, ["minha busca"], "query", deps(fetch).deps);
    const body = calls[0].body as {
      requests: Array<{ content: { parts: Array<{ text: string }> } }>;
    };
    expect(body.requests[0].content.parts[0].text).toBe("task: search result | query: minha busca");
  });

  it("modelos antigos usam taskType e texto sem prefixo", async () => {
    const { fetch, calls } = mockFetch(json({ embeddings: [{ values: [1, 0, 0, 0] }] }));
    await embedWithConfig(
      { ...CONFIG, model: "gemini-embedding-001" },
      ["x"],
      "query",
      deps(fetch).deps,
    );
    expect(calls[0].body).toMatchObject({
      requests: [{ taskType: "RETRIEVAL_QUERY", content: { parts: [{ text: "x" }] } }],
    });
  });

  it("trunca vetores maiores (Matryoshka) e rejeita menores", async () => {
    const big = mockFetch(json({ embeddings: [{ values: [0, 0, 3, 4, 9, 9] }] }));
    const res = await embedWithConfig(CONFIG, ["x"], "query", deps(big.fetch).deps);
    expect(res.vectors[0]).toEqual([0, 0, 0.6, 0.8]);

    const small = mockFetch(json({ embeddings: [{ values: [1, 2] }] }));
    await expect(
      embedWithConfig(CONFIG, ["x"], "query", deps(small.fetch).deps),
    ).rejects.toMatchObject({
      code: "invalid_response",
    });
  });

  it("quantidade de vetores diferente da pedida é erro", async () => {
    const { fetch } = mockFetch(json({ embeddings: [{ values: [1, 0, 0, 0] }] }));
    await expect(
      embedWithConfig(CONFIG, ["a", "b"], "query", deps(fetch).deps),
    ).rejects.toBeInstanceOf(AiError);
  });

  it("divide em lotes de 100 e repete uma vez em 429", async () => {
    const texts = Array.from({ length: 150 }, (_, i) => `t${i}`);
    const vec = { values: [1, 0, 0, 0] };
    const { fetch, calls } = mockFetch(
      json({ embeddings: Array(100).fill(vec) }),
      json({}, { status: 429, headers: { "retry-after": "1" } }),
      json({ embeddings: Array(50).fill(vec) }),
    );
    const { deps: d, sleep } = deps(fetch);
    const res = await embedWithConfig(CONFIG, texts, "document", d);
    expect(res.vectors).toHaveLength(150);
    expect(calls).toHaveLength(3);
    expect(sleep).toHaveBeenCalledWith(1000);
  });

  it("lista vazia não chama a API", async () => {
    const { fetch } = mockFetch();
    expect(await embedWithConfig(CONFIG, [], "query", deps(fetch).deps)).toEqual({
      vectors: [],
      model: "gemini-embedding-2",
    });
    expect(fetch).not.toHaveBeenCalled();
  });
});
