import { describe, expect, it } from "vitest";
import {
  buildDataExport,
  EXPORT_FORMAT,
  exportFileName,
  NEWSLETTER_UNAVAILABLE,
  type ExportProfile,
  type ExportSources,
} from "./export";

const ME = "11111111-1111-4111-8111-111111111111";
const MARINA = "22222222-2222-4222-8222-222222222222";
const BIA = "33333333-3333-4333-8333-333333333333";
const T0 = "2026-10-01T12:00:00.000Z";
const T1 = "2026-10-02T12:00:00.000Z";
const T2 = "2026-10-03T12:00:00.000Z";

const profile: ExportProfile = {
  id: ME,
  full_name: "Larissa Gomes",
  pronouns: "ela/dela",
  headline: null,
  bio: "Bio",
  avatar_url: null,
  career_stage: "undergraduate",
  institution: "IFSP",
  city: "Jacareí",
  state: "SP",
  keywords: ["visão computacional", "abelhas"],
  lattes_url: null,
  orcid: "0000-0002-1825-0097",
  linkedin_url: null,
  website_url: null,
  seeks_mentorship: true,
  mentoring_goals: "Aprender",
  is_mentor: false,
  mentor_available: false,
  mentor_capacity: 0,
  mentoring_offer: null,
  mentorship_topics: ["carreira"],
  meeting_formats: ["online"],
  languages: ["pt"],
  trajectory_tags: ["escola-publica", "primeira-geracao"],
  role: "member",
  ai_consent: true,
  ai_consent_at: T0,
  onboarded_at: T0,
  created_at: T0,
  updated_at: T1,
};

function sources(overrides: Partial<ExportSources> = {}): ExportSources {
  return {
    generatedAt: new Date("2026-10-28T15:00:00.000Z"),
    account: {
      id: ME,
      email: "larissa@demo.cienciadelas.dev",
      created_at: T0,
      email_confirmed_at: T0,
      last_sign_in_at: T2,
    },
    profile,
    areas: [
      { id: 2, slug: "ecologia", name: "Ecologia", big_area: "Ciências Biológicas" },
      { id: 1, slug: "computacao", name: "Ciência da Computação", big_area: "Exatas" },
      { id: 1, slug: "computacao", name: "Ciência da Computação", big_area: "Exatas" },
    ],
    mentorshipRequests: [],
    messages: [],
    feedback: [],
    declarations: [],
    publicAnswers: [],
    suggestions: [],
    threads: [],
    posts: [],
    anonymousAuthorship: [],
    reactions: [],
    papers: [],
    votes: [],
    comments: [],
    notifications: [],
    reports: [],
    newsletter: { available: true, subscription: null },
    ...overrides,
  };
}

const request = {
  status: "accepted" as const,
  message: "Oi! Quero conversar sobre carreira em pesquisa.",
  response_message: "Vamos!",
  match_score: 87,
  match_reason: "Mesma área",
  updated_at: T1,
  responded_at: T1,
  completed_at: null,
};

describe("buildDataExport", () => {
  it("tem o cabeçalho, a conta, o perfil, as áreas (sem repetir) e as palavras-chave", () => {
    const data = buildDataExport(sources());
    expect(data.sobre).toMatchObject({
      formato: EXPORT_FORMAT,
      versao: 1,
      gerado_em: "2026-10-28T15:00:00.000Z",
    });
    expect(data.conta.email).toBe("larissa@demo.cienciadelas.dev");
    expect(data.perfil).toEqual(profile);
    expect(data.areas_de_pesquisa.map((a) => a.slug)).toEqual(["computacao", "ecologia"]);
    expect(data.palavras_chave).toEqual(["visão computacional", "abelhas"]);
  });

  it("não deixa passar colunas fora da lista (search_text, tokens, notas da moderação)", () => {
    const leaky = sources({
      profile: { ...profile, search_text: "indice interno" } as ExportProfile,
      reports: [
        {
          id: "r1",
          target_type: "post",
          target_id: "p9",
          reason: "harassment",
          details: "Relato",
          status: "resolved",
          created_at: T0,
          resolved_at: T1,
          resolution_note: "Nota interna da moderação",
          resolved_by: MARINA,
        } as ExportSources["reports"][number],
      ],
      newsletter: {
        available: true,
        subscription: {
          email: "larissa@demo.cienciadelas.dev",
          status: "active",
          area_ids: [],
          consent_text: "Aceito",
          consented_at: T0,
          confirmed_at: T0,
          unsubscribed_at: null,
          created_at: T0,
          updated_at: T0,
          confirm_token: "segredo-1",
          unsubscribe_token: "segredo-2",
          confirmation_sent_count: 1,
        } as never,
      },
    });
    const json = JSON.stringify(buildDataExport(leaky));
    for (const secret of [
      "indice interno",
      "search_text",
      "Nota interna",
      "resolution_note",
      "resolved_by",
      "segredo-1",
      "segredo-2",
      "confirmation_sent_count",
    ]) {
      expect(json).not.toContain(secret);
    }
    const data = buildDataExport(leaky);
    expect(data.denuncias_feitas[0]).toEqual({
      id: "r1",
      target_type: "post",
      target_id: "p9",
      reason: "harassment",
      details: "Relato",
      status: "resolved",
      created_at: T0,
      resolved_at: T1,
    });
    expect(data.newsletter).toMatchObject({
      disponivel: true,
      inscricao: { email: "larissa@demo.cienciadelas.dev", status: "active" },
    });
  });

  it("separa pedidos enviados e recebidos e mostra da outra pessoa só id e nome", () => {
    const data = buildDataExport(
      sources({
        mentorshipRequests: [
          {
            ...request,
            id: "m2",
            created_at: T1,
            mentee_id: BIA,
            mentor_id: ME,
            mentee: { id: BIA, full_name: "Bia", email: "bia@x.dev", bio: "privada" } as never,
            mentor: { id: ME, full_name: "Larissa Gomes" },
          },
          {
            ...request,
            id: "m1",
            created_at: T0,
            mentee_id: ME,
            mentor_id: MARINA,
            mentee: { id: ME, full_name: "Larissa Gomes" },
            mentor: { id: MARINA, full_name: "Marina Albuquerque" },
          },
          {
            ...request,
            id: "de-outras",
            created_at: T0,
            mentee_id: BIA,
            mentor_id: MARINA,
            mentee: null,
            mentor: null,
          },
        ],
      }),
    );
    expect(data.mentoria.pedidos_enviados).toEqual([
      {
        id: "m1",
        status: "accepted",
        message: request.message,
        response_message: "Vamos!",
        match_score: 87,
        match_reason: "Mesma área",
        created_at: T0,
        updated_at: T1,
        responded_at: T1,
        completed_at: null,
        mentora: { id: MARINA, full_name: "Marina Albuquerque" },
      },
    ]);
    expect(data.mentoria.pedidos_recebidos).toHaveLength(1);
    expect(data.mentoria.pedidos_recebidos[0]!.mentoranda).toEqual({ id: BIA, full_name: "Bia" });
    expect(JSON.stringify(data.mentoria)).not.toMatch(/bia@x\.dev|privada|de-outras/);
  });

  it("traz as conversas das mentorias dela, com da outra pessoa só id e nome", () => {
    const message = (id: string, requestId: string, sender: string, createdAt: string) => ({
      id,
      request_id: requestId,
      sender_id: sender,
      body: `Mensagem ${id}`,
      created_at: createdAt,
      read_at: null,
    });
    const data = buildDataExport(
      sources({
        mentorshipRequests: [
          {
            ...request,
            id: "m1",
            created_at: T0,
            mentee_id: ME,
            mentor_id: MARINA,
            mentee: { id: ME, full_name: "Larissa Gomes" },
            mentor: {
              id: MARINA,
              full_name: "Marina Albuquerque",
              email: "marina@x.dev",
            } as never,
          },
          {
            ...request,
            id: "m2",
            created_at: T1,
            mentee_id: BIA,
            mentor_id: ME,
            mentee: { id: BIA, full_name: "Bia" },
            mentor: { id: ME, full_name: "Larissa Gomes" },
          },
          {
            ...request,
            id: "sem-mensagens",
            created_at: T2,
            mentee_id: ME,
            mentor_id: BIA,
            mentee: { id: ME, full_name: "Larissa Gomes" },
            mentor: { id: BIA, full_name: "Bia" },
          },
        ],
        messages: [
          message("c", "m1", ME, T2),
          message("a", "m1", MARINA, T0),
          // repetida (veio em duas páginas): entra uma vez
          message("a", "m1", MARINA, T0),
          message("b", "m2", BIA, T1),
          // de um pedido que não é dela e de alguém fora do pedido: ficam de fora
          { ...message("x", "de-outras", BIA, T0), body: "conversa alheia" },
          { ...message("y", "m1", BIA, T1), body: "intrusa" },
          { ...message("z", "m2", ME, T2), search_text: "interno" } as never,
        ],
      }),
    );
    expect(data.mentoria.conversas).toEqual([
      {
        request_id: "m1",
        papel: "mentoranda",
        outra_participante: { id: MARINA, full_name: "Marina Albuquerque" },
        mensagens: [
          { id: "a", sender_id: MARINA, body: "Mensagem a", created_at: T0, read_at: null },
          { id: "c", sender_id: ME, body: "Mensagem c", created_at: T2, read_at: null },
        ],
      },
      {
        request_id: "m2",
        papel: "mentora",
        outra_participante: { id: BIA, full_name: "Bia" },
        mensagens: [
          { id: "b", sender_id: BIA, body: "Mensagem b", created_at: T1, read_at: null },
          { id: "z", sender_id: ME, body: "Mensagem z", created_at: T2, read_at: null },
        ],
      },
    ]);
    const json = JSON.stringify(data.mentoria.conversas);
    expect(json).not.toMatch(
      /marina@x\.dev|conversa alheia|intrusa|search_text|request_id":"de-outras/,
    );
  });

  it("traz as marcas de trajetória no perfil (dados dela, opcionais)", () => {
    const data = buildDataExport(sources());
    expect(data.perfil?.trajectory_tags).toEqual(["escola-publica", "primeira-geracao"]);
    const empty = buildDataExport(sources({ profile: { ...profile, trajectory_tags: [] } }));
    expect(empty.perfil?.trajectory_tags).toEqual([]);
  });

  it("traz só as respostas dela no Pergunte a uma cientista, sem quem ocultou", () => {
    const answer = (id: string, author: string, createdAt: string, extra: object = {}) => ({
      id,
      question_id: "q1",
      author_id: author,
      body: `Resposta ${id}`,
      show_identity: true,
      is_hidden: false,
      hidden_at: null,
      created_at: createdAt,
      ...extra,
    });
    const data = buildDataExport(
      sources({
        publicAnswers: [
          answer("a2", ME, T2, { show_identity: false }),
          answer("a1", ME, T1, { is_hidden: true, hidden_at: T2, hidden_by: MARINA } as object),
          // De outra pessoa: nunca entra, mesmo se viesse na consulta.
          answer("a3", MARINA, T0),
          // Repetida.
          answer("a2", ME, T2, { show_identity: false }),
        ],
      }),
    );
    expect(data.respostas_pergunte_a_uma_cientista).toEqual([
      {
        id: "a1",
        question_id: "q1",
        body: "Resposta a1",
        show_identity: true,
        is_hidden: true,
        hidden_at: T2,
        created_at: T1,
      },
      {
        id: "a2",
        question_id: "q1",
        body: "Resposta a2",
        show_identity: false,
        is_hidden: false,
        hidden_at: null,
        created_at: T2,
      },
    ]);
    expect(JSON.stringify(data.respostas_pergunte_a_uma_cientista)).not.toMatch(
      /hidden_by|author_id|a3/,
    );
    expect(data.sobre.observacoes.join(" ")).toMatch(/nenhuma pergunta aparece como sua/);
  });

  it("traz só os retornos que ela escreveu e as declarações das mentorias dela", () => {
    const requests = [
      {
        ...request,
        status: "completed" as const,
        id: "m1",
        created_at: T0,
        mentee_id: ME,
        mentor_id: MARINA,
        mentee: { id: ME, full_name: "Larissa Gomes" },
        mentor: { id: MARINA, full_name: "Marina Albuquerque" },
      },
      {
        ...request,
        status: "completed" as const,
        id: "m2",
        created_at: T1,
        mentee_id: BIA,
        mentor_id: ME,
        mentee: { id: BIA, full_name: "Bia" },
        mentor: { id: ME, full_name: "Larissa Gomes" },
      },
    ];
    const feedback = (requestId: string, author: string, note: string, createdAt = T1) => ({
      request_id: requestId,
      author_id: author,
      role: author === ME ? ("mentee" as const) : ("mentor" as const),
      helpfulness: 5,
      outcomes: ["menos-sozinha"],
      would_recommend: true,
      note,
      created_at: createdAt,
    });
    const declaration = (requestId: string, code: string, extra: object = {}) => ({
      request_id: requestId,
      code,
      mentee_consented_at: T0,
      mentor_consented_at: null,
      issued_at: null,
      revoked_at: null,
      revoke_reason: null,
      ...extra,
    });
    const data = buildDataExport(
      sources({
        mentorshipRequests: requests,
        feedback: [
          feedback("m1", ME, "Minha nota", T2),
          feedback("m2", ME, "Outra nota minha", T1),
          // O retorno da outra participante NUNCA entra, mesmo se viesse na consulta.
          feedback("m1", MARINA, "nota privada da Marina"),
          // De uma mentoria que não é dela.
          feedback("de-outras", ME, "estranha"),
          { ...feedback("m1", ME, "repetida", T2), search_text: "interno" } as never,
        ],
        declarations: [
          declaration("m1", "ART-0000-0000-0001", {
            mentor_consented_at: T1,
            issued_at: T1,
            requested_by: MARINA,
            revoked_by: null,
          } as object),
          declaration("m2", "ART-0000-0000-0002", { revoked_at: T2, revoke_reason: "Mudei" }),
          declaration("m2", "ART-0000-0000-0003", {
            mentor_consented_at: T1,
            issued_at: T1,
            revoked_at: T2,
          }),
          declaration("m2", "ART-0000-0000-0004"),
          declaration("de-outras", "ART-0000-0000-0005"),
        ],
      }),
    );
    expect(data.retornos_de_mentoria).toEqual([
      {
        request_id: "m2",
        role: "mentee",
        helpfulness: 5,
        outcomes: ["menos-sozinha"],
        would_recommend: true,
        note: "Outra nota minha",
        created_at: T1,
      },
      {
        request_id: "m1",
        role: "mentee",
        helpfulness: 5,
        outcomes: ["menos-sozinha"],
        would_recommend: true,
        note: "Minha nota",
        created_at: T2,
      },
    ]);
    expect(JSON.stringify(data.retornos_de_mentoria)).not.toMatch(
      /Marina|author_id|search_text|estranha|de-outras/,
    );
    expect(data.declaracoes_de_mentoria.map((d) => [d.code, d.status])).toEqual([
      ["ART-0000-0000-0001", "emitida"],
      ["ART-0000-0000-0002", "cancelada"],
      ["ART-0000-0000-0003", "revogada"],
      ["ART-0000-0000-0004", "aguardando_autorizacao"],
    ]);
    expect(data.declaracoes_de_mentoria[1]).toEqual({
      request_id: "m2",
      code: "ART-0000-0000-0002",
      mentee_consented_at: T0,
      mentor_consented_at: null,
      issued_at: null,
      revoked_at: T2,
      revoke_reason: "Mudei",
      status: "cancelada",
    });
    expect(JSON.stringify(data.declaracoes_de_mentoria)).not.toMatch(/requested_by|revoked_by/);
    expect(data.sobre.observacoes.join(" ")).toContain("O retorno da outra participante");
  });

  it("mantém só id e nome da mentora nas sugestões salvas, na ordem do ranking", () => {
    const data = buildDataExport(
      sources({
        suggestions: [
          {
            mentor_id: BIA,
            score: 70,
            rank: 2,
            reason: "B",
            conversation_starters: [],
            source: "heuristic",
            model: null,
            created_at: T0,
            mentor: null,
          },
          {
            mentor_id: MARINA,
            score: 90,
            rank: 1,
            reason: "A",
            conversation_starters: ["Como começou?"],
            source: "ai",
            model: "gemini",
            created_at: T0,
            mentor: { id: MARINA, full_name: "Marina Albuquerque", headline: "x" } as never,
          },
        ],
      }),
    );
    expect(data.mentoria.sugestoes_salvas.map((s) => s.mentora)).toEqual([
      { id: MARINA, full_name: "Marina Albuquerque" },
      { id: BIA, full_name: null },
    ]);
    expect(JSON.stringify(data.mentoria.sugestoes_salvas)).not.toContain("headline");
  });

  it("marca como anônimos os tópicos e respostas que estão na autoria anônima dela", () => {
    const thread = {
      category_id: 3,
      body: "Texto",
      tags: [],
      is_pinned: false,
      is_locked: false,
      solution_post_id: null,
      reply_count: 0,
      updated_at: T0,
      edited_at: null,
      category: { slug: "apoio", name: "Apoio" },
    };
    const data = buildDataExport(
      sources({
        threads: [
          { ...thread, id: "t-anon", title: "Anônimo", is_anonymous: true, created_at: T1 },
          { ...thread, id: "t-nome", title: "Com nome", is_anonymous: false, created_at: T0 },
          // o mesmo tópico pode chegar pelas duas consultas: entra uma vez só
          { ...thread, id: "t-anon", title: "Anônimo", is_anonymous: true, created_at: T1 },
          // autoria anônima é a fonte da verdade mesmo se a flag vier falsa
          { ...thread, id: "t-flag", title: "Flag", is_anonymous: false, created_at: T2 },
        ],
        posts: [
          {
            id: "p1",
            thread_id: "t-x",
            body: "Resposta anônima",
            is_anonymous: false,
            created_at: T0,
            updated_at: T0,
            edited_at: null,
          },
        ],
        anonymousAuthorship: [
          { thread_id: "t-anon", post_id: null },
          { thread_id: "t-flag", post_id: null },
          { thread_id: null, post_id: "p1" },
        ],
      }),
    );
    expect(data.forum.topicos.map((t) => [t.id, t.is_anonymous])).toEqual([
      ["t-nome", false],
      ["t-anon", true],
      ["t-flag", true],
    ]);
    expect(data.forum.topicos[0]!.category).toEqual({ slug: "apoio", name: "Apoio" });
    expect(data.forum.respostas).toEqual([
      {
        id: "p1",
        thread_id: "t-x",
        body: "Resposta anônima",
        is_anonymous: true,
        created_at: T0,
        updated_at: T0,
        edited_at: null,
      },
    ]);
  });

  it("traz destaques com o título do paper (ou null se ele estiver oculto)", () => {
    const data = buildDataExport(
      sources({
        votes: [
          { paper_id: "b2", created_at: T1, paper: null },
          { paper_id: "b1", created_at: T0, paper: { title: "Abelhas" } },
        ],
      }),
    );
    expect(data.vitrine.destaques).toEqual([
      { paper_id: "b1", created_at: T0, paper_title: "Abelhas" },
      { paper_id: "b2", created_at: T1, paper_title: null },
    ]);
  });

  it("explica quando a situação da newsletter não pôde ser consultada", () => {
    const data = buildDataExport(sources({ newsletter: { available: false } }));
    expect(data.newsletter).toEqual({ disponivel: false, motivo: NEWSLETTER_UNAVAILABLE });
    expect(data.sobre.observacoes).toContain(NEWSLETTER_UNAVAILABLE);
  });

  it("funciona para uma conta sem perfil e sem nada publicado", () => {
    const data = buildDataExport(sources({ profile: null, areas: [] }));
    expect(data.perfil).toBeNull();
    expect(data.palavras_chave).toEqual([]);
    expect(data.forum).toEqual({ topicos: [], respostas: [], reacoes: [] });
    expect(data.vitrine).toEqual({ papers_enviados: [], destaques: [], comentarios: [] });
  });
});

describe("exportFileName", () => {
  it("usa a data de São Paulo", () => {
    expect(exportFileName(new Date("2026-10-28T15:00:00Z"))).toBe(
      "artemis-meus-dados-2026-10-28.json",
    );
    // 01:30 UTC do dia 29 ainda é dia 28 em São Paulo (UTC−3)
    expect(exportFileName(new Date("2026-10-29T01:30:00Z"))).toBe(
      "artemis-meus-dados-2026-10-28.json",
    );
  });
});
