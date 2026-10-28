import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Testa a orquestração de service.ts com um Supabase falso em memória (sem rede):
 * consentimento, cache do embedding, colunas gravadas, persistência e fallbacks.
 */

type Row = Record<string, unknown>;
type Tables = Record<string, Row[]>;

interface Op {
  table: string;
  mode: "select" | "delete" | "insert" | "upsert";
  payload?: unknown;
  filters: Array<[string, string, unknown]>;
}

function createFakeSupabase(
  tables: Tables,
  options: {
    userId: string | null;
    rpc?: { data?: Row[]; error?: { code: string; message: string } };
    /** Resposta de claim_ai_matching_slot (cota de IA no banco). Padrão: liberada. */
    aiSlot?: boolean | { error: { code: string; message: string } };
  },
) {
  const ops: Op[] = [];
  const rpcCalls: Array<{ fn: string; args: unknown }> = [];
  let claimCalls = 0;

  class Query implements PromiseLike<{ data: unknown; error: unknown }> {
    private filters: Array<[string, string, unknown]> = [];
    private mode: Op["mode"] = "select";
    private payload: unknown;
    private single = false;
    private orderBy: { col: string; asc: boolean } | null = null;
    constructor(private table: string) {}
    select() {
      return this;
    }
    eq(col: string, value: unknown) {
      this.filters.push([col, "eq", value]);
      return this;
    }
    in(col: string, values: unknown[]) {
      this.filters.push([col, "in", values]);
      return this;
    }
    order(col: string, opts?: { ascending?: boolean }) {
      this.orderBy = { col, asc: opts?.ascending !== false };
      return this;
    }
    maybeSingle() {
      this.single = true;
      return this;
    }
    delete() {
      this.mode = "delete";
      return this;
    }
    insert(rows: unknown) {
      this.mode = "insert";
      this.payload = rows;
      return this;
    }
    upsert(rows: unknown) {
      this.mode = "upsert";
      this.payload = rows;
      return this;
    }
    private matches(row: Row) {
      return this.filters.every(([col, op, v]) =>
        op === "eq" ? row[col] === v : (v as unknown[]).includes(row[col]),
      );
    }
    private run(): { data: unknown; error: unknown } {
      ops.push({
        table: this.table,
        mode: this.mode,
        payload: this.payload,
        filters: this.filters,
      });
      const list = (tables[this.table] ??= []);
      if (this.mode === "delete") {
        tables[this.table] = list.filter((r) => !this.matches(r));
        return { data: null, error: null };
      }
      if (this.mode === "insert" || this.mode === "upsert") {
        const rows = (Array.isArray(this.payload) ? this.payload : [this.payload]) as Row[];
        for (const row of rows) {
          if (this.mode === "upsert" && this.table === "profile_embeddings") {
            tables[this.table] = tables[this.table].filter((r) => r.profile_id !== row.profile_id);
          }
          tables[this.table].push({ created_at: new Date().toISOString(), ...row });
        }
        return { data: null, error: null };
      }
      let rows = list.filter((r) => this.matches(r));
      if (this.orderBy) {
        const { col, asc } = this.orderBy;
        rows = [...rows].sort((a, b) => (Number(a[col]) - Number(b[col])) * (asc ? 1 : -1));
      }
      return { data: this.single ? (rows[0] ?? null) : rows, error: null };
    }
    then<A = { data: unknown; error: unknown }, B = never>(
      onfulfilled?: ((value: { data: unknown; error: unknown }) => A | PromiseLike<A>) | null,
      onrejected?: ((reason: unknown) => B | PromiseLike<B>) | null,
    ): PromiseLike<A | B> {
      return Promise.resolve(this.run()).then(onfulfilled, onrejected);
    }
  }

  const client = {
    auth: {
      getUser: async () => ({
        data: { user: options.userId ? { id: options.userId } : null },
        error: options.userId ? null : { message: "no session" },
      }),
    },
    from: (table: string) => new Query(table),
    rpc: async (fn: string, args: unknown) => {
      if (fn === "claim_ai_matching_slot") {
        claimCalls += 1;
        const slot = options.aiSlot ?? true;
        return typeof slot === "boolean"
          ? { data: slot, error: null }
          : { data: null, error: slot.error };
      }
      rpcCalls.push({ fn, args });
      return { data: options.rpc?.data ?? [], error: options.rpc?.error ?? null };
    },
  };
  return {
    client,
    ops,
    rpcCalls,
    tables,
    get claimCalls() {
      return claimCalls;
    },
  };
}

const mocks = vi.hoisted(() => ({
  client: null as unknown,
  generateJson: vi.fn(),
  embedTexts: vi.fn(),
  isAiEnabled: vi.fn(() => true),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => mocks.client }));
vi.mock("@/lib/ai", () => ({
  generateJson: mocks.generateJson,
  embedTexts: mocks.embedTexts,
  isAiEnabled: mocks.isAiEnabled,
}));

import {
  AI_QUOTA_WARNING,
  MatchingError,
  findMentorsForCurrentUser,
  getMySavedSuggestions,
  isNewMentorCandidate,
  refreshMyEmbedding,
} from "./service";

const ME = "00000000-0000-4000-8000-0000000000aa";
const MENTOR_A = "00000000-0000-4000-8000-000000000001";
const MENTOR_B = "00000000-0000-4000-8000-000000000002";
const MENTOR_C = "00000000-0000-4000-8000-000000000003";

function baseTables(overrides: { consent?: boolean; onboarded?: boolean } = {}): Tables {
  return {
    research_areas: [
      { id: 1, name: "Ecologia", big_area: "Ciências Biológicas" },
      { id: 2, name: "Genética", big_area: "Ciências Biológicas" },
    ],
    profiles: [
      {
        id: ME,
        full_name: "Marina Teste Silva",
        headline: "Mestranda (marina@example.com)",
        career_stage: "masters",
        keywords: ["genômica"],
        mentorship_topics: ["bolsas-editais"],
        mentoring_goals: "Quero ajuda com editais.",
        mentoring_offer: null,
        is_mentor: false,
        meeting_formats: ["online"],
        languages: ["pt"],
        state: "SP",
        ai_consent: overrides.consent ?? true,
        onboarded_at: overrides.onboarded === false ? null : "2026-10-01T00:00:00Z",
      },
      { id: MENTOR_A, ai_consent: true },
      { id: MENTOR_B, ai_consent: false },
    ],
    profile_research_areas: [
      { profile_id: ME, area_id: 1 },
      { profile_id: ME, area_id: 2 },
    ],
    profile_embeddings: [],
    mentor_suggestions: [],
  };
}

const candidates: Row[] = [
  {
    mentor_id: MENTOR_A,
    full_name: "Helena Demo Souza",
    avatar_url: null,
    headline: "Docente de genética",
    institution: "Universidade Fictícia",
    state: "SP",
    career_stage: "professor",
    keywords: ["genômica"],
    mentorship_topics: ["bolsas-editais"],
    meeting_formats: ["online"],
    languages: ["pt"],
    mentoring_offer: "Ajudo com editais.",
    area_ids: [1, 2],
    similarity: 0.8,
    open_slots: 2,
    existing_request_status: null,
  },
  {
    mentor_id: MENTOR_B,
    full_name: "Beatriz Demo Lima",
    avatar_url: null,
    headline: "Pós-doc em ecologia",
    institution: "Instituto Fictício",
    state: "RJ",
    career_stage: "postdoc",
    keywords: [],
    mentorship_topics: ["networking"],
    meeting_formats: ["hybrid"],
    languages: ["pt"],
    mentoring_offer: "Texto privado da Beatriz sem consentimento.",
    area_ids: [1],
    similarity: null,
    open_slots: 1,
    existing_request_status: "pending",
  },
];

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
  vi.stubEnv("AI_PROVIDER", "");
  vi.stubEnv("GEMINI_API_KEY", "test-key");
  vi.stubEnv("GEMINI_EMBEDDING_MODEL", "");
  mocks.generateJson.mockReset();
  mocks.embedTexts.mockReset();
  mocks.isAiEnabled.mockReset();
  mocks.isAiEnabled.mockReturnValue(true);
  mocks.embedTexts.mockResolvedValue({ vectors: [[0.6, 0.8]], model: "gemini-embedding-2" });
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("findMentorsForCurrentUser", () => {
  it("exige sessão e onboarding", async () => {
    mocks.client = createFakeSupabase(baseTables(), { userId: null }).client;
    await expect(findMentorsForCurrentUser()).rejects.toMatchObject({ code: "not_authenticated" });

    mocks.client = createFakeSupabase(baseTables({ onboarded: false }), { userId: ME }).client;
    const error = await findMentorsForCurrentUser().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(MatchingError);
    expect((error as MatchingError).code).toBe("not_onboarded");
  });

  it("sem consentimento: só heurística, nada vai para a IA, e as sugestões são gravadas", async () => {
    const fake = createFakeSupabase(baseTables({ consent: false }), {
      userId: ME,
      rpc: { data: candidates },
    });
    mocks.client = fake.client;

    const res = await findMentorsForCurrentUser({ limit: 5 });

    expect(mocks.embedTexts).not.toHaveBeenCalled();
    expect(mocks.generateJson).not.toHaveBeenCalled();
    expect(res.source).toBe("heuristic");
    expect(res.provider).toBeNull();
    expect(res.warnings.join(" ")).toMatch(/nenhum dado seu foi enviado a serviços de IA/);
    expect(fake.rpcCalls).toEqual([{ fn: "get_mentor_candidates", args: { p_limit: 30 } }]);
    expect(res.suggestions.map((s) => s.mentorId)).toEqual([MENTOR_A, MENTOR_B]);
    expect(res.suggestions[0].mentor.area_names).toEqual(["Ecologia", "Genética"]);
    expect(res.suggestions[1].mentor.existing_request_status).toBe("pending");

    const deleteOp = fake.ops.find((o) => o.table === "mentor_suggestions" && o.mode === "delete");
    const insertOp = fake.ops.find((o) => o.table === "mentor_suggestions" && o.mode === "insert");
    expect(deleteOp?.filters).toEqual([["mentee_id", "eq", ME]]);
    const rows = insertOp?.payload as Row[];
    expect(rows.map((r) => r.rank)).toEqual([1, 2]);
    for (const row of rows) {
      expect(Object.keys(row).sort()).toEqual(
        [
          "conversation_starters",
          "mentee_id",
          "mentor_id",
          "model",
          "rank",
          "reason",
          "score",
          "source",
        ].sort(),
      );
      expect(row.source).toBe("heuristic");
      expect(row.model).toBeNull();
    }
  });

  it("com consentimento: atualiza o embedding, usa a IA pseudonimizada e grava o modelo", async () => {
    const fake = createFakeSupabase(baseTables(), { userId: ME, rpc: { data: candidates } });
    mocks.client = fake.client;
    mocks.generateJson.mockResolvedValue({
      data: {
        ranking: [
          {
            id: "c1",
            score: 90,
            reason: "Vocês pesquisam genética e ela orienta em editais.",
            starters: ["Como montar um projeto?", "Qual edital indicar?"],
          },
          {
            id: "c2",
            score: 60,
            reason: "Ela atua em ecologia e pode ampliar sua rede.",
            starters: ["Que eventos indica?", "Como fazer contatos?"],
          },
        ],
      },
      provider: "gemini",
      model: "gemini-3.5-flash-lite",
    });

    const res = await findMentorsForCurrentUser({ limit: 1 });

    // Embedding: texto sem nome/e-mail e só as colunas com GRANT.
    expect(mocks.embedTexts).toHaveBeenCalledTimes(1);
    const [texts, kind] = mocks.embedTexts.mock.calls[0] as [string[], string];
    expect(kind).toBe("query");
    expect(texts[0]).not.toMatch(/Marina|marina@/);
    const upsert = fake.ops.find((o) => o.table === "profile_embeddings" && o.mode === "upsert");
    expect(Object.keys(upsert?.payload as Row).sort()).toEqual(
      ["content_hash", "embedding", "model", "profile_id"].sort(),
    );
    expect((upsert?.payload as Row).embedding).toBe("[0.6,0.8]");

    // Prompt: sem nomes, ids reais ou texto da mentora sem consentimento.
    const prompt = (mocks.generateJson.mock.calls[0][0] as { prompt: string }).prompt;
    for (const forbidden of ["Helena", "Beatriz", "Marina", MENTOR_A, MENTOR_B, "Texto privado"]) {
      expect(prompt).not.toContain(forbidden);
    }
    expect(prompt).toContain("Ajudo com editais."); // mentora A consentiu

    expect(res.source).toBe("ai");
    expect(res.provider).toBe("gemini");
    expect(res.suggestions).toHaveLength(1);
    expect(res.suggestions[0].reason).toBe("Vocês pesquisam genética e ela orienta em editais.");
    const insert = fake.ops.find((o) => o.table === "mentor_suggestions" && o.mode === "insert");
    expect(insert?.payload).toMatchObject([
      { source: "ai", model: "gemini-3.5-flash-lite", rank: 1 },
    ]);
  });

  it("não recalcula o embedding quando o texto não mudou", async () => {
    const tables = baseTables();
    const first = createFakeSupabase(tables, { userId: ME });
    mocks.client = first.client;
    expect(await refreshMyEmbedding()).toEqual({ status: "updated", model: "gemini-embedding-2" });
    expect(await refreshMyEmbedding()).toEqual({
      status: "unchanged",
      model: "gemini-embedding-2",
    });
    expect(mocks.embedTexts).toHaveBeenCalledTimes(1);
  });

  it("refreshMyEmbedding respeita a falta de consentimento e de chave, sem lançar", async () => {
    mocks.client = createFakeSupabase(baseTables({ consent: false }), { userId: ME }).client;
    expect(await refreshMyEmbedding()).toEqual({ status: "skipped", reason: "no_consent" });

    vi.stubEnv("GEMINI_API_KEY", "");
    mocks.client = createFakeSupabase(baseTables(), { userId: ME }).client;
    expect(await refreshMyEmbedding()).toEqual({
      status: "skipped",
      reason: "no_embedding_config",
    });

    vi.stubEnv("GEMINI_API_KEY", "test-key");
    mocks.embedTexts.mockRejectedValue(new Error("429"));
    expect(await refreshMyEmbedding()).toEqual({ status: "skipped", reason: "error" });
  });

  it("IA falhando → heurística com aviso", async () => {
    mocks.client = createFakeSupabase(baseTables(), {
      userId: ME,
      rpc: { data: candidates },
    }).client;
    mocks.generateJson.mockRejectedValue(new Error("todos os provedores falharam"));
    const res = await findMentorsForCurrentUser();
    expect(res.source).toBe("heuristic");
    expect(res.suggestions).toHaveLength(2);
    expect(res.warnings.join(" ")).toMatch(/IA está indisponível/);
  });

  it("cota de IA do banco negada → só heurística, sem embedding nem IA, com aviso", async () => {
    // Auditoria de segurança: apagar as próprias sugestões zerava a espera de 60 s e liberava
    // chamadas de IA sem limite. A reserva no banco (claim_ai_matching_slot) decide agora.
    const fake = createFakeSupabase(baseTables(), {
      userId: ME,
      rpc: { data: candidates },
      aiSlot: false,
    });
    mocks.client = fake.client;
    const res = await findMentorsForCurrentUser();
    expect(fake.claimCalls).toBe(1);
    expect(mocks.embedTexts).not.toHaveBeenCalled();
    expect(mocks.generateJson).not.toHaveBeenCalled();
    expect(res.source).toBe("heuristic");
    expect(res.suggestions.length).toBeGreaterThan(0);
    expect(res.warnings).toContain(AI_QUOTA_WARNING);
  });

  it("erro ao reservar a cota de IA falha fechado (sem chamar a IA)", async () => {
    const fake = createFakeSupabase(baseTables(), {
      userId: ME,
      rpc: { data: candidates },
      aiSlot: { error: { code: "PGRST202", message: "function not found" } },
    });
    mocks.client = fake.client;
    const res = await findMentorsForCurrentUser();
    expect(mocks.generateJson).not.toHaveBeenCalled();
    expect(mocks.embedTexts).not.toHaveBeenCalled();
    expect(res.source).toBe("heuristic");
  });

  it("apagar as sugestões salvas não libera outra chamada de IA quando a cota negou", async () => {
    const tables = baseTables();
    const first = createFakeSupabase(tables, { userId: ME, rpc: { data: candidates } });
    mocks.client = first.client;
    mocks.generateJson.mockRejectedValue(new Error("sem IA neste teste"));
    await findMentorsForCurrentUser();
    expect(first.claimCalls).toBe(1);
    tables.mentor_suggestions = []; // a usuária apaga as próprias sugestões pela API
    const second = createFakeSupabase(tables, {
      userId: ME,
      rpc: { data: candidates },
      aiSlot: false,
    });
    mocks.client = second.client;
    mocks.generateJson.mockClear();
    mocks.embedTexts.mockClear();
    const res = await findMentorsForCurrentUser();
    expect(second.claimCalls).toBe(1);
    expect(mocks.generateJson).not.toHaveBeenCalled();
    expect(mocks.embedTexts).not.toHaveBeenCalled();
    expect(res.warnings).toContain(AI_QUOTA_WARNING);
  });

  it("sem consentimento a cota de IA nem é consultada", async () => {
    const fake = createFakeSupabase(baseTables({ consent: false }), {
      userId: ME,
      rpc: { data: candidates },
    });
    mocks.client = fake.client;
    await findMentorsForCurrentUser();
    expect(fake.claimCalls).toBe(0);
  });

  it("erro na RPC vira MatchingError(db_error)", async () => {
    mocks.client = createFakeSupabase(baseTables({ consent: false }), {
      userId: ME,
      rpc: { error: { code: "42501", message: "boom" } },
    }).client;
    await expect(findMentorsForCurrentUser()).rejects.toMatchObject({ code: "db_error" });
  });

  it("gerar de novo em menos de 60 s devolve as sugestões salvas sem chamar RPC nem IA", async () => {
    const tables = baseTables();
    tables.mentor_suggestions = [
      {
        mentee_id: ME,
        mentor_id: MENTOR_A,
        rank: 1,
        score: 88,
        reason: "Motivo salvo.",
        conversation_starters: ["Pergunta salva?"],
        source: "ai",
        model: "gemini-3.5-flash-lite",
        created_at: new Date(Date.now() - 10_000).toISOString(),
      },
    ];
    tables.profiles.push({
      id: MENTOR_A,
      full_name: "Helena Demo Souza",
      avatar_url: null,
      headline: "Docente",
      institution: null,
      state: "SP",
      career_stage: "professor",
      keywords: [],
      mentorship_topics: [],
      meeting_formats: ["online"],
      languages: ["pt"],
    });
    tables.profiles = tables.profiles.filter((p) => !(p.id === MENTOR_A && !("full_name" in p)));
    const fake = createFakeSupabase(tables, { userId: ME, rpc: { data: candidates } });
    mocks.client = fake.client;

    const res = await findMentorsForCurrentUser();
    expect(fake.rpcCalls).toHaveLength(0);
    expect(mocks.generateJson).not.toHaveBeenCalled();
    expect(res.suggestions.map((s) => s.reason)).toEqual(["Motivo salvo."]);
    expect(res.warnings[0]).toMatch(/acabou de gerar/);
  });
  it("não sugere quem já é mentora dela (mentoria aceita), mas mantém pedidos pendentes", async () => {
    const accepted: Row = {
      ...candidates[0],
      mentor_id: MENTOR_C,
      full_name: "Carla Demo Rocha",
      similarity: 0.99,
      open_slots: 3,
      existing_request_status: "accepted",
    };
    const fake = createFakeSupabase(baseTables(), {
      userId: ME,
      rpc: { data: [accepted, ...candidates] },
    });
    mocks.client = fake.client;
    mocks.generateJson.mockRejectedValue(new Error("sem IA neste teste"));

    const res = await findMentorsForCurrentUser({ limit: 5 });

    expect(res.suggestions.map((s) => s.mentorId)).toEqual([MENTOR_A, MENTOR_B]);
    expect(res.suggestions.map((s) => s.mentor.existing_request_status)).toEqual([null, "pending"]);
    const prompt = (mocks.generateJson.mock.calls[0]?.[0] as { prompt: string } | undefined)
      ?.prompt;
    expect(prompt ?? "").not.toContain("Carla");
    const insert = fake.ops.find((o) => o.table === "mentor_suggestions" && o.mode === "insert");
    expect((insert?.payload as Row[]).map((r) => r.mentor_id)).not.toContain(MENTOR_C);
  });

  it("isNewMentorCandidate só exclui o status 'accepted'", () => {
    expect(isNewMentorCandidate({ existing_request_status: "accepted" })).toBe(false);
    expect(isNewMentorCandidate({ existing_request_status: "pending" })).toBe(true);
    expect(isNewMentorCandidate({ existing_request_status: null })).toBe(true);
  });

  it("depois de autorizar a IA, gerar de novo ignora a espera de 60 s das sugestões por regras", async () => {
    const tables = baseTables();
    tables.mentor_suggestions = [
      {
        mentee_id: ME,
        mentor_id: MENTOR_A,
        rank: 1,
        score: 70,
        reason: "Motivo por regras.",
        conversation_starters: [],
        source: "heuristic",
        model: null,
        created_at: new Date(Date.now() - 10_000).toISOString(),
      },
    ];
    const fake = createFakeSupabase(tables, { userId: ME, rpc: { data: candidates } });
    mocks.client = fake.client;
    mocks.generateJson.mockRejectedValue(new Error("IA fora do ar"));

    const res = await findMentorsForCurrentUser();
    expect(fake.rpcCalls).toHaveLength(1);
    expect(res.warnings.join(" ")).not.toMatch(/acabou de gerar/);

    // Sem consentimento a espera continua valendo.
    const noConsent = baseTables({ consent: false });
    noConsent.mentor_suggestions = tables.mentor_suggestions.map((r) => ({
      ...r,
      created_at: new Date(Date.now() - 5_000).toISOString(),
    }));
    noConsent.profiles.push({
      id: MENTOR_A,
      full_name: "Helena Demo Souza",
      avatar_url: null,
      headline: null,
      institution: null,
      state: "SP",
      career_stage: "professor",
      keywords: [],
      mentorship_topics: [],
      meeting_formats: ["online"],
      languages: ["pt"],
    });
    const second = createFakeSupabase(noConsent, { userId: ME, rpc: { data: candidates } });
    mocks.client = second.client;
    const again = await findMentorsForCurrentUser();
    expect(second.rpcCalls).toHaveLength(0);
    expect(again.warnings[0]).toMatch(/acabou de gerar/);
  });
});

describe("getMySavedSuggestions", () => {
  it("esconde sugestões salvas de quem já é mentora dela (aceite depois da busca), mantém pendentes", async () => {
    const tables = baseTables({ consent: false });
    const mentor = (id: string, name: string) => ({
      id,
      full_name: name,
      avatar_url: null,
      headline: null,
      institution: null,
      state: "SP",
      career_stage: "professor",
      keywords: [],
      mentorship_topics: [],
      meeting_formats: ["online"],
      languages: ["pt"],
    });
    tables.profiles = [
      ...tables.profiles.filter((p) => p.id === ME),
      mentor(MENTOR_A, "Helena Demo Souza"),
      mentor(MENTOR_B, "Paula Demo Lima"),
    ];
    const saved = (mentorId: string, rank: number) => ({
      mentee_id: ME,
      mentor_id: mentorId,
      rank,
      score: 80 - rank,
      reason: `Motivo ${rank}.`,
      conversation_starters: [],
      source: "heuristic",
      model: null,
      created_at: "2026-10-27T12:00:00Z",
    });
    tables.mentor_suggestions = [saved(MENTOR_A, 1), saved(MENTOR_B, 2)];
    tables.mentorship_requests = [
      { mentee_id: ME, mentor_id: MENTOR_A, status: "accepted" },
      { mentee_id: ME, mentor_id: MENTOR_B, status: "pending" },
    ];
    const fake = createFakeSupabase(tables, { userId: ME });

    // O cliente falso só implementa o que o serviço usa.
    const res = await getMySavedSuggestions({ supabase: fake.client as never, userId: ME });
    expect(res?.suggestions.map((s) => s.mentorId)).toEqual([MENTOR_B]);
  });
});
