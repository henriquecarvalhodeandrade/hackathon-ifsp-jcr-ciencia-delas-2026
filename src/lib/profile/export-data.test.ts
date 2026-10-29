import type { User } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Escopo das consultas do "Baixar meus dados". Várias tabelas têm RLS de leitura aberta a
 * qualquer membra (forum_threads, forum_posts, forum_reactions, paper_votes, paper_comments,
 * profile_research_areas, follows, portfolio_items, research_opportunities, posts, post_likes,
 * post_comments; em connections, as aceitas): nelas, quem limita o arquivo ao que é DELA é o
 * filtro pelo id. Estes
 * testes gravam cada consulta (cliente falso) e falham se algum filtro sumir.
 */

type Op = [method: string, args: unknown[]];
interface Call {
  client: "session" | "admin";
  table: string;
  ops: Op[];
}

const mocks = vi.hoisted(() => ({
  calls: [] as Call[],
  rows: {} as Record<string, unknown[]>,
  errorOn: null as string | null,
  adminConfigured: true,
}));

function fakeClient(client: Call["client"]) {
  return {
    from(table: string) {
      const call: Call = { client, table, ops: [] };
      mocks.calls.push(call);
      const result = () => {
        if (mocks.errorOn === table) return { data: null, error: { code: "42501" } };
        const rows = mocks.rows[table] ?? [];
        const single = call.ops.some(([method]) => method === "maybeSingle");
        const range = call.ops.find(([method]) => method === "range");
        if (single) return { data: rows[0] ?? null, error: null };
        if (range) {
          const [from, to] = range[1] as [number, number];
          return { data: rows.slice(from, to + 1), error: null };
        }
        return { data: rows, error: null };
      };
      const builder: object = new Proxy(
        {},
        {
          get(_target, prop) {
            if (prop === "then") {
              return (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
                Promise.resolve(result()).then(resolve, reject);
            }
            return (...args: unknown[]) => {
              call.ops.push([String(prop), args]);
              return builder;
            };
          },
        },
      );
      return builder;
    },
  };
}

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => fakeClient("session") }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => fakeClient("admin") }));
vi.mock("@/lib/env", () => ({ isAdminConfigured: () => mocks.adminConfigured }));

const { ExportQueryError, loadMyDataExport } = await import("./export-data");

const ME = "11111111-1111-4111-8111-111111111111";
const user = {
  id: ME,
  email: "larissa@demo.cienciadelas.dev",
  created_at: "2026-10-01T00:00:00Z",
  email_confirmed_at: "2026-10-01T00:00:00Z",
  last_sign_in_at: "2026-10-28T00:00:00Z",
} as User;

const filters = (call: Call) =>
  call.ops.filter(([method]) => ["eq", "or", "in", "match", "filter"].includes(method));

beforeEach(() => {
  mocks.calls = [];
  mocks.rows = {};
  mocks.errorOn = null;
  mocks.adminConfigured = true;
});

describe("loadMyDataExport", () => {
  it("filtra toda consulta da sessão pelo id dela (o RLS de várias tabelas é aberto)", async () => {
    mocks.rows.forum_anonymous_authorship = [
      { thread_id: "t-anon", post_id: null },
      { thread_id: null, post_id: "p-anon" },
    ];
    await loadMyDataExport(user);

    const expected: Record<string, Op> = {
      profiles: ["eq", ["id", ME]],
      profile_research_areas: ["eq", ["profile_id", ME]],
      mentorship_requests: ["or", [`mentee_id.eq.${ME},mentor_id.eq.${ME}`]],
      mentor_suggestions: ["eq", ["mentee_id", ME]],
      forum_anonymous_authorship: ["eq", ["user_id", ME]],
      forum_reactions: ["eq", ["user_id", ME]],
      papers: ["eq", ["submitted_by", ME]],
      paper_votes: ["eq", ["user_id", ME]],
      paper_comments: ["eq", ["author_id", ME]],
      notifications: ["eq", ["user_id", ME]],
      reports: ["eq", ["reporter_id", ME]],
      // Retornos: só os que ELA escreveu (nunca o da outra participante).
      mentorship_feedback: ["eq", ["author_id", ME]],
      // Pergunte a uma cientista: só as respostas dela (perguntas não têm autora).
      public_answers: ["eq", ["author_id", ME]],
      // Rede social: conexões aceitas de todas são visíveis; portfólio e feed são abertos.
      connections: ["or", [`requester_id.eq.${ME},addressee_id.eq.${ME}`]],
      portfolio_items: ["eq", ["owner_id", ME]],
      posts: ["eq", ["author_id", ME]],
      post_likes: ["eq", ["user_id", ME]],
      post_comments: ["eq", ["author_id", ME]],
      research_opportunities: ["eq", ["owner_id", ME]],
      // Sem vagas dela, só a consulta das candidaturas que ELA enviou.
      opportunity_applications: ["eq", ["applicant_id", ME]],
      direct_conversations: ["or", [`user_a.eq.${ME},user_b.eq.${ME}`]],
    };
    const session = mocks.calls.filter((c) => c.client === "session");
    for (const [table, filter] of Object.entries(expected)) {
      const calls = session.filter((c) => c.table === table);
      expect(calls, table).toHaveLength(1);
      expect(filters(calls[0]!), table).toEqual([filter]);
    }

    // Tópicos e respostas: os assinados (author_id) e os anônimos DELA (ids da autoria anônima).
    for (const [table, anonId] of [
      ["forum_threads", "t-anon"],
      ["forum_posts", "p-anon"],
    ] as const) {
      const calls = session.filter((c) => c.table === table).map(filters);
      expect(calls, table).toEqual([[["eq", ["author_id", ME]]], [["in", ["id", [anonId]]]]]);
    }

    // Seguir: quem ela segue e quem a segue (follows é aberto a todas as membras).
    expect(session.filter((c) => c.table === "follows").map(filters)).toEqual([
      [["eq", ["follower_id", ME]]],
      [["eq", ["followee_id", ME]]],
    ]);

    // Nenhuma outra tabela é lida com a sessão; a newsletter nunca passa pela sessão.
    const known = new Set([...Object.keys(expected), "forum_threads", "forum_posts", "follows"]);
    expect(session.filter((c) => !known.has(c.table))).toEqual([]);
  });

  it("busca as mensagens diretas só pelos ids das conversas dela, sem a prévia", async () => {
    mocks.rows.direct_conversations = [
      {
        id: "d1",
        user_a: ME,
        user_b: "outra",
        initiator_id: ME,
        status: "active",
        created_at: "2026-10-01T00:00:00Z",
      },
      {
        id: "d2",
        user_a: "outra",
        user_b: ME,
        initiator_id: "outra",
        status: "request",
        created_at: "2026-10-02T00:00:00Z",
      },
    ];
    await loadMyDataExport(user);
    const conversations = mocks.calls.filter((c) => c.table === "direct_conversations");
    const conversationColumns = String(conversations[0]!.ops.find(([m]) => m === "select")![1][0]);
    expect(conversationColumns).not.toMatch(/last_message_preview|read_at|last_sender_id/);
    const calls = mocks.calls.filter((c) => c.table === "direct_messages");
    expect(calls).toHaveLength(1);
    expect(calls[0]!.client).toBe("session");
    expect(filters(calls[0]!)).toEqual([["in", ["conversation_id", ["d1", "d2"]]]]);
    const columns = String(calls[0]!.ops.find(([m]) => m === "select")![1][0]);
    expect(columns).toBe("id, conversation_id, sender_id, body, created_at");
  });

  it("busca as candidaturas recebidas só pelas vagas dela; da candidata, só id e nome", async () => {
    mocks.rows.research_opportunities = [
      { id: "v1", owner_id: ME, created_at: "2026-10-01T00:00:00Z" },
    ];
    await loadMyDataExport(user);
    const vagas = mocks.calls.filter((c) => c.table === "research_opportunities");
    const vagaColumns = String(vagas[0]!.ops.find(([m]) => m === "select")![1][0]);
    expect(vagaColumns).not.toMatch(/search_text/);
    const calls = mocks.calls.filter((c) => c.table === "opportunity_applications");
    expect(calls.map((c) => c.client)).toEqual(["session", "session"]);
    expect(calls.map(filters)).toEqual([
      [["eq", ["applicant_id", ME]]],
      [["in", ["opportunity_id", ["v1"]]]],
    ]);
    const columns = String(calls[1]!.ops.find(([m]) => m === "select")![1][0]);
    expect(columns).toMatch(
      /applicant:profiles!opportunity_applications_applicant_id_fkey\(id, full_name\)$/,
    );
  });

  it("sem vagas nem conversas, não consulta candidaturas recebidas nem mensagens diretas", async () => {
    await loadMyDataExport(user);
    expect(mocks.calls.filter((c) => c.table === "direct_messages")).toEqual([]);
    expect(
      mocks.calls.filter(
        (c) => c.table === "opportunity_applications" && c.ops.some(([m]) => m === "in"),
      ),
    ).toEqual([]);
  });

  it("busca as mensagens da mentoria só pelos ids dos pedidos dela", async () => {
    mocks.rows.mentorship_requests = [
      { id: "m1", mentee_id: ME, mentor_id: "outra", created_at: "2026-10-01T00:00:00Z" },
      { id: "m2", mentee_id: "outra", mentor_id: ME, created_at: "2026-10-02T00:00:00Z" },
    ];
    mocks.rows.mentorship_messages = [];
    await loadMyDataExport(user);
    const calls = mocks.calls.filter((c) => c.table === "mentorship_messages");
    expect(calls).toHaveLength(1);
    expect(calls[0]!.client).toBe("session");
    expect(filters(calls[0]!)).toEqual([["in", ["request_id", ["m1", "m2"]]]]);
    const columns = String(calls[0]!.ops.find(([m]) => m === "select")![1][0]);
    expect(columns).toBe("id, request_id, sender_id, body, created_at, read_at");
  });

  it("sem pedidos de mentoria, não consulta mensagens nem declarações", async () => {
    await loadMyDataExport(user);
    expect(mocks.calls.filter((c) => c.table === "mentorship_messages")).toEqual([]);
    expect(mocks.calls.filter((c) => c.table === "mentorship_declarations")).toEqual([]);
  });

  it("busca as declarações só pelos ids dos pedidos dela, sem quem pediu ou revogou", async () => {
    mocks.rows.mentorship_requests = [
      { id: "m1", mentee_id: ME, mentor_id: "outra", created_at: "2026-10-01T00:00:00Z" },
    ];
    await loadMyDataExport(user);
    const calls = mocks.calls.filter((c) => c.table === "mentorship_declarations");
    expect(calls).toHaveLength(1);
    expect(calls[0]!.client).toBe("session");
    expect(filters(calls[0]!)).toEqual([["in", ["request_id", ["m1"]]]]);
    const columns = String(calls[0]!.ops.find(([m]) => m === "select")![1][0]);
    expect(columns).not.toMatch(/requested_by|revoked_by/);
  });

  it("lê as respostas públicas dela sem hidden_by e nunca consulta as perguntas", async () => {
    await loadMyDataExport(user);
    const calls = mocks.calls.filter((c) => c.table === "public_answers");
    expect(calls).toHaveLength(1);
    expect(calls[0]!.client).toBe("session");
    const columns = String(calls[0]!.ops.find(([m]) => m === "select")![1][0]);
    expect(columns).not.toMatch(/hidden_by/);
    expect(mocks.calls.filter((c) => c.table === "public_questions")).toEqual([]);
  });

  it("lê os retornos da mentoria com o filtro da autora", async () => {
    await loadMyDataExport(user);
    const calls = mocks.calls.filter((c) => c.table === "mentorship_feedback");
    expect(calls).toHaveLength(1);
    expect(filters(calls[0]!)).toEqual([["eq", ["author_id", ME]]]);
  });

  it("lê a newsletter com o cliente admin só pelo e-mail da própria conta, sem tokens", async () => {
    await loadMyDataExport(user);
    const admin = mocks.calls.filter((c) => c.client === "admin");
    expect(admin).toHaveLength(1);
    expect(admin[0]!.table).toBe("newsletter_subscribers");
    expect(filters(admin[0]!)).toEqual([["eq", ["email", "larissa@demo.cienciadelas.dev"]]]);
    const columns = String(admin[0]!.ops.find(([m]) => m === "select")![1][0]);
    expect(columns).not.toMatch(/token|profile_id|sent_count/);
  });

  it("sem a chave secreta não usa o cliente admin e avisa no arquivo", async () => {
    mocks.adminConfigured = false;
    const data = await loadMyDataExport(user);
    expect(mocks.calls.filter((c) => c.client === "admin")).toEqual([]);
    expect(data.newsletter).toMatchObject({ disponivel: false });
  });

  it("não busca anônimos de ninguém quando ela não tem autoria anônima", async () => {
    await loadMyDataExport(user);
    const byId = mocks.calls.filter((c) => c.ops.some(([m, a]) => m === "in" && a[0] === "id"));
    expect(byId).toEqual([]);
  });

  it("pagina listas longas de 1.000 em 1.000", async () => {
    mocks.rows.notifications = Array.from({ length: 1500 }, (_, i) => ({
      id: `n${i}`,
      type: "system",
      title: "t",
      body: null,
      link: null,
      read_at: null,
      created_at: `2026-10-01T00:00:${String(i % 60).padStart(2, "0")}Z`,
    }));
    const data = await loadMyDataExport(user);
    const ranges = mocks.calls
      .filter((c) => c.table === "notifications")
      .map((c) => c.ops.find(([m]) => m === "range")![1]);
    expect(ranges).toEqual([
      [0, 999],
      [1000, 1999],
    ]);
    expect(data.notificacoes).toHaveLength(1500);
  });

  it("qualquer consulta com erro derruba a exportação (nada de arquivo incompleto)", async () => {
    mocks.errorOn = "forum_reactions";
    await expect(loadMyDataExport(user)).rejects.toBeInstanceOf(ExportQueryError);
  });
});
