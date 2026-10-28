import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Profile } from "@/lib/auth";

/**
 * loadPainelData com um cliente Supabase falso: no máximo 6 idas ao banco, todas com limite,
 * e cada bloco falhando sozinho. A montagem (buildWaiting/buildNews) também é coberta.
 */

type Call = { table: string; methods: Array<[string, unknown[]]> };
type Response = { data: unknown; error: { code?: string; message: string } | null };

const state = vi.hoisted(() => ({
  calls: [] as Call[],
  respond: (() => ({ data: null, error: null })) as (call: Call) => Response,
}));

function fakeClient() {
  return {
    from(table: string) {
      const call: Call = { table, methods: [] };
      state.calls.push(call);
      const builder: unknown = new Proxy(
        {},
        {
          get(_target, prop) {
            if (prop === "then") {
              return (resolve: (v: Response) => unknown, reject: (e: unknown) => unknown) =>
                Promise.resolve(state.respond(call)).then(resolve, reject);
            }
            return (...args: unknown[]) => {
              call.methods.push([String(prop), args]);
              return builder;
            };
          },
        },
      );
      return builder;
    },
  };
}

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => fakeClient() }));

const { buildNews, buildWaiting, loadPainelData, PAINEL_LIMITS } = await import("./queries");

const NOW = Date.parse("2026-10-28T12:00:00Z");
const DAY = 24 * 60 * 60 * 1000;
const ago = (days: number) => new Date(NOW - days * DAY).toISOString();
const ME = "d1000000-0000-4000-8000-000000000001";

const profile = {
  id: ME,
  full_name: "Marina Albuquerque",
  headline: "Docente de computação",
  keywords: ["python", "visão computacional", "aprendizado de máquina"],
  mentorship_topics: ["programacao-dados", "pos-graduacao"],
  mentoring_offer: "Ajudo nos primeiros passos.",
  is_mentor: true,
  seeks_mentorship: false,
  mentor_available: true,
  mentor_capacity: 3,
} as unknown as Profile;

const selectOf = (call: Call) => String(call.methods.find(([m]) => m === "select")?.[1][0] ?? "");

function happyPath(call: Call): Response {
  const select = selectOf(call);
  switch (call.table) {
    case "profiles":
      if (select.includes("suggestions:"))
        return {
          error: null,
          data: {
            id: ME,
            areas: [{ area: { id: 13, name: "Ciência da Computação" } }],
            suggestions: [{ count: 0 }],
            sent: [{ count: 2 }],
            intro: [],
            replies: [{ count: 0 }],
            anon: [{ thread_id: "anon-mine", post_id: null, created_at: ago(2) }],
            papers: [{ count: 0 }],
            votes: [{ count: 3 }],
            unread: [{ count: 4 }],
          },
        };
      return {
        error: null,
        data: [
          {
            id: "nova-1",
            full_name: "Yasmin Oliveira",
            avatar_url: null,
            headline: "Graduanda em química",
            onboarded_at: ago(3),
            areas: [{ area_id: 40 }],
          },
          {
            id: "nova-2",
            full_name: "Bia Souza",
            avatar_url: null,
            headline: null,
            onboarded_at: ago(5),
            areas: [{ area_id: 13 }],
          },
        ],
      };
    case "mentorship_requests":
      return {
        error: null,
        data: [
          {
            id: "req-pend",
            status: "pending",
            created_at: ago(2),
            responded_at: null,
            mentee_id: "yasmin",
            mentor_id: ME,
            mentee: { full_name: "Yasmin Oliveira" },
            mentor: { full_name: "Marina Albuquerque" },
            unread: [{ count: 0 }],
          },
          {
            id: "req-ativa",
            status: "accepted",
            created_at: ago(30),
            responded_at: ago(29),
            mentee_id: "larissa",
            mentor_id: ME,
            mentee: { full_name: "Larissa Gomes" },
            mentor: { full_name: "Marina Albuquerque" },
            unread: [{ count: 3 }],
          },
        ],
      };
    case "forum_threads":
      return {
        error: null,
        data: [
          {
            id: "t-python",
            title: "Como começo a analisar meus dados em Python?",
            body: "Nunca programei.",
            tags: ["python", "estatística"],
            is_anonymous: false,
            is_locked: false,
            reply_count: 0,
            created_at: ago(2),
            author_id: "yasmin",
            author: { full_name: "Yasmin Oliveira" },
            category: { name: "Dúvidas de pesquisa" },
          },
          {
            id: "anon-mine",
            title: "Pergunta anônima minha sobre python",
            body: "Texto.",
            tags: ["python"],
            is_anonymous: true,
            is_locked: false,
            reply_count: 0,
            created_at: ago(1),
            author_id: null,
            author: null,
            category: { name: "Saúde mental" },
          },
        ],
      };
    case "papers":
      return {
        error: null,
        data: [
          {
            id: "p-1",
            title: "Queimadas",
            area_id: 20,
            vote_count: 6,
            created_at: ago(5),
            area: { name: "Geociências" },
          },
          {
            id: "p-2",
            title: "Visão computacional no café",
            area_id: 13,
            vote_count: 1,
            created_at: ago(2),
            area: { name: "Ciência da Computação" },
          },
        ],
      };
    case "newsletter_editions":
      return {
        error: null,
        data: { slug: "2026-s43", title: "Boletim #43", summary: null, published_at: ago(2) },
      };
    default:
      return { data: null, error: { message: `tabela inesperada ${call.table}` } };
  }
}

beforeEach(() => {
  state.calls = [];
  state.respond = happyPath;
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("loadPainelData", () => {
  it("faz no máximo 6 idas ao Supabase, todas com limite explícito", async () => {
    await loadPainelData(profile, NOW);
    expect(state.calls.length).toBeLessThanOrEqual(6);
    expect(state.calls.map((c) => c.table).sort()).toEqual([
      "forum_threads",
      "mentorship_requests",
      "newsletter_editions",
      "papers",
      "profiles",
      "profiles",
    ]);
    for (const call of state.calls) {
      const names = call.methods.map(([m]) => m);
      const bounded =
        names.includes("limit") || (names.includes("maybeSingle") && names.includes("eq"));
      expect(bounded, `${call.table}: ${names.join(",")}`).toBe(true);
    }
  });

  it("listas embutidas também têm limite e os filtros de segurança estão lá", async () => {
    await loadPainelData(profile, NOW);
    const self = state.calls.find((c) => selectOf(c).includes("suggestions:"))!;
    const referencedLimits = self.methods
      .filter(
        ([m, args]) => m === "limit" && (args[1] as { referencedTable?: string })?.referencedTable,
      )
      .map(([, args]) => (args[1] as { referencedTable: string }).referencedTable)
      .sort();
    expect(referencedLimits).toEqual(["anon", "areas", "intro"]);
    expect(self.methods).toContainEqual(["eq", ["id", ME]]);

    const threads = state.calls.find((c) => c.table === "forum_threads")!;
    expect(threads.methods).toContainEqual(["eq", ["reply_count", 0]]);
    expect(threads.methods).toContainEqual(["eq", ["is_locked", false]]);
    // Anônimos (author_id NULL) não podem sumir por causa do "diferente de mim".
    expect(threads.methods).toContainEqual(["or", [`author_id.is.null,author_id.neq.${ME}`]]);
    expect(threads.methods).toContainEqual(["limit", [PAINEL_LIMITS.questions]]);

    const edition = state.calls.find((c) => c.table === "newsletter_editions")!;
    expect(edition.methods).toContainEqual(["in", ["status", ["published", "sent"]]]);
    const papers = state.calls.find((c) => c.table === "papers")!;
    expect(papers.methods).toContainEqual(["eq", ["is_hidden", false]]);
  });

  it("monta passos, pendências, perguntas e novidades", async () => {
    const data = await loadPainelData(profile, NOW);
    expect(data.now).toBe(NOW);
    expect(data.steps).toMatchObject({
      isMentor: true,
      areaCount: 1,
      keywordCount: 3,
      pendingReceivedCount: 1,
      sentMessageCount: 2,
      votedPaperCount: 3,
      requestsAsMentee: 0,
      activeMenteeRequestId: null,
    });
    expect(data.waiting.unreadNotifications).toBe(4);
    expect(data.waiting.pendingReceived).toEqual({ count: 1, oldestAt: ago(2) });
    expect(data.waiting.conversations).toEqual([
      { requestId: "req-ativa", name: "Larissa Gomes", unread: 3 },
    ]);
    // O tópico anônimo que ela mesma escreveu não volta para ela.
    expect(data.questions.map((q) => q.thread.id)).toEqual(["t-python"]);
    expect(data.questions[0]!.reason).toBe("python");
    expect(data.news.papersMode).toBe("area");
    expect(data.news.papers.map((p) => p.id)).toEqual(["p-2"]);
    expect(data.news.members.map((m) => [m.id, m.sharedArea])).toEqual([
      ["nova-2", "Ciência da Computação"],
      ["nova-1", null],
    ]);
    expect(data.news.edition?.slug).toBe("2026-s43");
    expect([data.stepsFailed, data.waitingFailed, data.questionsFailed, data.newsFailed]).toEqual([
      false,
      false,
      false,
      false,
    ]);
  });

  it("Novidades: uma parte que falha fica marcada, sem derrubar as outras partes", async () => {
    state.respond = (call) =>
      call.table === "newsletter_editions"
        ? { data: null, error: { code: "57014", message: "timeout" } }
        : happyPath(call);
    const data = await loadPainelData(profile, NOW);
    expect(data.newsFailed).toBe(false);
    expect(data.news.sectionsFailed).toEqual({ papers: false, members: false, edition: true });
    expect(data.news.edition).toBeNull();
    expect(data.news.papers.map((p) => p.id)).toEqual(["p-2"]);
  });

  it("um bloco que falha não derruba os outros", async () => {
    state.respond = (call) =>
      call.table === "forum_threads"
        ? { data: null, error: { code: "57014", message: "timeout" } }
        : happyPath(call);
    const data = await loadPainelData(profile, NOW);
    expect(data.questionsFailed).toBe(true);
    expect(data.questions).toEqual([]);
    expect(data.stepsFailed).toBe(false);
    expect(data.waiting.pendingReceived.count).toBe(1);
  });
});

describe("buildWaiting", () => {
  const row = (over: Partial<Parameters<typeof buildWaiting>[0][number]>) => ({
    id: "r",
    status: "pending" as const,
    createdAt: ago(1),
    respondedAt: null,
    role: "mentee" as const,
    otherName: "Fulana",
    unread: 0,
    ...over,
  });

  it("separa recebidos e enviados, do mais antigo ao mais novo, e corta a lista", () => {
    const waiting = buildWaiting(
      [
        row({ id: "s1", createdAt: ago(1), otherName: "A" }),
        row({ id: "s2", createdAt: ago(5), otherName: "B" }),
        row({ id: "s3", createdAt: ago(3), otherName: "C" }),
        row({ id: "s4", createdAt: ago(2), otherName: "D" }),
        row({ id: "r1", role: "mentor", createdAt: ago(4) }),
        row({ id: "r2", role: "mentor", createdAt: ago(9) }),
      ],
      0,
    );
    expect(waiting.pendingSent.map((s) => s.mentorName)).toEqual(["B", "C", "D"]);
    expect(waiting.pendingSentTotal).toBe(4);
    expect(waiting.pendingReceived).toEqual({ count: 2, oldestAt: ago(9) });
  });

  it("só conta mensagens não lidas de conversas que existem (aceita, concluída)", () => {
    const waiting = buildWaiting(
      [
        row({ id: "a", status: "accepted", respondedAt: ago(1), unread: 2 }),
        row({ id: "p", status: "pending", unread: 5 }),
        row({ id: "d", status: "declined", respondedAt: ago(1), unread: 1 }),
      ],
      0,
    );
    expect(waiting.conversations.map((c) => c.requestId)).toEqual(["a"]);
  });
});

describe("buildNews", () => {
  it("sem papers nas áreas dela, mostra os mais destacados da semana", () => {
    const news = buildNews(
      [
        { id: "x", title: "X", areaId: 1, areaName: "A", voteCount: 9, createdAt: ago(1) },
        { id: "y", title: "Y", areaId: 2, areaName: "B", voteCount: 2, createdAt: ago(2) },
      ],
      [],
      [99],
      new Map(),
      null,
    );
    expect(news.papersMode).toBe("votes");
    expect(news.papers.map((p) => p.id)).toEqual(["x", "y"]);
    expect(news.papers.every((p) => !p.inMyArea)).toBe(true);
  });

  it("no máximo 3 papers e 3 pessoas", () => {
    const papers = Array.from({ length: 6 }, (_, i) => ({
      id: `p${i}`,
      title: `P${i}`,
      areaId: 1,
      areaName: "A",
      voteCount: 6 - i,
      createdAt: ago(1),
    }));
    const members = Array.from({ length: 6 }, (_, i) => ({
      id: `m${i}`,
      fullName: `M${i}`,
      avatarUrl: null,
      headline: null,
      areaIds: [1],
    }));
    const news = buildNews(papers, members, [1], new Map([[1, "A"]]), null);
    expect(news.papers).toHaveLength(3);
    expect(news.members).toHaveLength(3);
    expect(news.members.every((m) => m.sharedArea === "A")).toBe(true);
  });
});
