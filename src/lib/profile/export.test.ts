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
    follows: [],
    connections: [],
    portfolioItems: [],
    feedPosts: [],
    feedLikes: [],
    feedComments: [],
    opportunities: [],
    applications: [],
    receivedApplications: [],
    directConversations: [],
    directMessages: [],
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
    expect(data.rede_social).toEqual({
      seguindo: [],
      seguidoras: [],
      conexoes: [],
      portfolio: [],
      publicacoes: [],
      curtidas: [],
      comentarios_no_feed: [],
      oportunidades_publicadas: [],
      candidaturas: [],
      candidaturas_recebidas: [],
      mensagens_diretas: [],
    });
  });
});

describe("buildDataExport · rede social", () => {
  const marina = { id: MARINA, full_name: "Marina Albuquerque" };
  const bia = { id: BIA, full_name: "Bia" };
  const larissa = { id: ME, full_name: "Larissa Gomes" };
  // id menor que o dela: nas conversas diretas ela fica como user_b
  const ANA = "0aaaaaaa-0000-4000-8000-000000000000";
  const ana = { id: ANA, full_name: "Ana" };

  it("traz quem ela segue e quem a segue, da outra pessoa só id e nome, mais antigas primeiro", () => {
    const follow = (follower: string, followee: string, createdAt: string) => ({
      follower_id: follower,
      followee_id: followee,
      created_at: createdAt,
      follower: follower === ME ? larissa : follower === MARINA ? marina : bia,
      followee: followee === ME ? larissa : followee === MARINA ? marina : bia,
    });
    const data = buildDataExport(
      sources({
        follows: [
          follow(ME, BIA, T2),
          {
            ...follow(ME, MARINA, T0),
            followee: { ...marina, email: "marina@x.dev", headline: "privada" } as never,
          },
          // repetida (as duas consultas podem trazer a mesma linha): entra uma vez
          follow(ME, BIA, T2),
          follow(BIA, ME, T1),
          // perfil apagado/sem cadastro: fica o id
          { ...follow(MARINA, ME, T0), follower: null },
          // de outras pessoas (o RLS de follows é aberto): nunca entra
          follow(MARINA, BIA, T0),
        ],
      }),
    );
    expect(data.rede_social.seguindo).toEqual([
      { pessoa: marina, created_at: T0 },
      { pessoa: bia, created_at: T2 },
    ]);
    expect(data.rede_social.seguidoras).toEqual([
      { pessoa: { id: MARINA, full_name: null }, created_at: T0 },
      { pessoa: bia, created_at: T1 },
    ]);
    expect(JSON.stringify(data.rede_social)).not.toMatch(/marina@x\.dev|privada|follower_id/);
  });

  it("traz as conexões dela com o papel e sem revelar a recusa de um convite que ela enviou", () => {
    const connection = (
      id: string,
      requester: string,
      addressee: string,
      status: "pending" | "accepted" | "declined",
      createdAt: string,
      extra: object = {},
    ) => ({
      id,
      requester_id: requester,
      addressee_id: addressee,
      status,
      message: `Recado ${id}`,
      created_at: createdAt,
      responded_at: status === "pending" ? null : T2,
      requester: requester === ME ? larissa : requester === MARINA ? marina : bia,
      addressee: addressee === ME ? larissa : addressee === MARINA ? marina : bia,
      ...extra,
    });
    const data = buildDataExport(
      sources({
        connections: [
          connection("c-recusada-por-ela", BIA, ME, "declined", T2),
          connection("c-aceita", ME, MARINA, "accepted", T0, {
            addressee: { ...marina, email: "marina@x.dev" },
          }),
          connection("c-enviada-recusada", ME, BIA, "declined", T1),
          connection("c-recebida", MARINA, ME, "pending", T1),
          // conexão aceita entre outras duas (o RLS mostra a todas): fica de fora
          connection("c-alheia", MARINA, BIA, "accepted", T0),
        ],
      }),
    );
    expect(data.rede_social.conexoes).toEqual([
      {
        id: "c-aceita",
        status: "accepted",
        message: "Recado c-aceita",
        created_at: T0,
        responded_at: T2,
        papel: "enviou",
        outra_pessoa: marina,
      },
      {
        id: "c-enviada-recusada",
        status: "pending",
        message: "Recado c-enviada-recusada",
        created_at: T1,
        responded_at: null,
        papel: "enviou",
        outra_pessoa: bia,
      },
      {
        id: "c-recebida",
        status: "pending",
        message: "Recado c-recebida",
        created_at: T1,
        responded_at: null,
        papel: "recebeu",
        outra_pessoa: marina,
      },
      {
        id: "c-recusada-por-ela",
        status: "declined",
        message: "Recado c-recusada-por-ela",
        created_at: T2,
        responded_at: T2,
        papel: "recebeu",
        outra_pessoa: bia,
      },
    ]);
    expect(JSON.stringify(data.rede_social.conexoes)).not.toMatch(
      /marina@x\.dev|c-alheia|requester_id|addressee_id/,
    );
  });

  it("traz portfólio, publicações, curtidas e comentários do feed só com os campos permitidos", () => {
    const data = buildDataExport(
      sources({
        portfolioItems: [
          {
            id: "i2",
            kind: "award",
            title: "Prêmio",
            description: null,
            url: null,
            venue: null,
            year: 2026,
            tags: [],
            pinned: false,
            created_at: T1,
            updated_at: T1,
          },
          {
            id: "i1",
            kind: "article",
            title: "Abelhas e visão computacional",
            description: "Artigo",
            url: "https://exemplo.org/a",
            venue: "SBC",
            year: 2025,
            tags: ["abelhas"],
            pinned: true,
            created_at: T0,
            updated_at: T2,
            owner_id: ME,
          } as never,
        ],
        feedPosts: [
          {
            id: "p1",
            kind: "achievement",
            body: "Consegui a bolsa!",
            link_url: null,
            portfolio_item_id: "i2",
            opportunity_id: null,
            like_count: 3,
            comment_count: 1,
            created_at: T1,
            updated_at: T1,
            author_id: ME,
          } as never,
        ],
        feedLikes: [
          { post_id: "p9", created_at: T2 },
          { post_id: "p8", created_at: T0, user_id: ME } as never,
        ],
        feedComments: [
          { id: "fc1", post_id: "p9", body: "Parabéns!", created_at: T2, updated_at: T2 },
          { id: "fc1", post_id: "p9", body: "Parabéns!", created_at: T2, updated_at: T2 },
        ],
      }),
    );
    expect(data.rede_social.portfolio.map((i) => i.id)).toEqual(["i1", "i2"]);
    expect(data.rede_social.portfolio[0]).toEqual({
      id: "i1",
      kind: "article",
      title: "Abelhas e visão computacional",
      description: "Artigo",
      url: "https://exemplo.org/a",
      venue: "SBC",
      year: 2025,
      tags: ["abelhas"],
      pinned: true,
      created_at: T0,
      updated_at: T2,
    });
    expect(data.rede_social.publicacoes).toEqual([
      {
        id: "p1",
        kind: "achievement",
        body: "Consegui a bolsa!",
        link_url: null,
        portfolio_item_id: "i2",
        opportunity_id: null,
        like_count: 3,
        comment_count: 1,
        created_at: T1,
        updated_at: T1,
      },
    ]);
    expect(data.rede_social.curtidas).toEqual([
      { post_id: "p8", created_at: T0 },
      { post_id: "p9", created_at: T2 },
    ]);
    expect(data.rede_social.comentarios_no_feed).toHaveLength(1);
    expect(JSON.stringify(data.rede_social)).not.toMatch(/owner_id|author_id|user_id/);
  });

  it("traz as vagas dela sem search_text, as candidaturas dela e as recebidas com a carta", () => {
    const opportunity = (id: string, owner: string, createdAt: string) => ({
      id,
      owner_id: owner,
      kind: "ic" as const,
      title: `Vaga ${id}`,
      description: "Descrição longa o bastante para a vaga de iniciação.",
      requirements: null,
      area_id: 2,
      keywords: ["abelhas"],
      institution: "IFSP",
      city: "Jacareí",
      state: "SP",
      modality: "hybrid" as const,
      has_scholarship: true,
      scholarship_info: "PIBIC",
      weekly_hours: 12,
      vacancies: 2,
      target_stages: ["undergraduate" as const],
      deadline: "2026-12-01",
      status: "open" as const,
      application_count: 1,
      created_at: createdAt,
      updated_at: createdAt,
      closed_at: null,
      area: { slug: "ecologia", name: "Ecologia" },
    });
    const application = (
      id: string,
      opportunityId: string,
      applicant: string,
      createdAt: string,
    ) => ({
      id,
      opportunity_id: opportunityId,
      applicant_id: applicant,
      message: `Carta ${id}`,
      status: "in_review" as const,
      owner_note: null,
      created_at: createdAt,
      updated_at: createdAt,
      responded_at: null,
    });
    const data = buildDataExport(
      sources({
        opportunities: [
          { ...opportunity("v2", ME, T1), search_text: "indice interno" } as never,
          opportunity("v1", ME, T0),
          // de outra dona (não deveria vir na consulta): nem ela nem as candidaturas dela entram
          opportunity("v-alheia", MARINA, T0),
        ],
        applications: [
          {
            ...application("a1", "v-marina", ME, T1),
            status: "accepted",
            owner_note: "Bem-vinda!",
            responded_at: T2,
            opportunity: { title: "IC em ecologia" },
          },
          // vaga apagada ou sem acesso: título null
          { ...application("a0", "v-sumiu", ME, T0), opportunity: null },
          { ...application("a-alheia", "v-marina", BIA, T0), opportunity: null },
        ],
        receivedApplications: [
          {
            ...application("r2", "v1", BIA, T2),
            applicant: { ...bia, email: "bia@x.dev", bio: "privada" } as never,
          },
          { ...application("r1", "v2", MARINA, T1), applicant: null },
          // vaga que não é dela
          { ...application("r-alheia", "v-alheia", BIA, T0), applicant: bia },
        ],
      }),
    );
    const { oportunidades_publicadas, candidaturas, candidaturas_recebidas } = data.rede_social;
    expect(oportunidades_publicadas.map((o) => o.id)).toEqual(["v1", "v2"]);
    expect(oportunidades_publicadas[0]).toMatchObject({
      title: "Vaga v1",
      has_scholarship: true,
      target_stages: ["undergraduate"],
      status: "open",
      application_count: 1,
      area: { slug: "ecologia", name: "Ecologia" },
    });
    expect(candidaturas).toEqual([
      {
        id: "a0",
        opportunity_id: "v-sumiu",
        message: "Carta a0",
        status: "in_review",
        owner_note: null,
        created_at: T0,
        updated_at: T0,
        responded_at: null,
        opportunity_title: null,
      },
      {
        id: "a1",
        opportunity_id: "v-marina",
        message: "Carta a1",
        status: "accepted",
        owner_note: "Bem-vinda!",
        created_at: T1,
        updated_at: T1,
        responded_at: T2,
        opportunity_title: "IC em ecologia",
      },
    ]);
    expect(candidaturas_recebidas).toEqual([
      {
        id: "r1",
        opportunity_id: "v2",
        message: "Carta r1",
        status: "in_review",
        owner_note: null,
        created_at: T1,
        updated_at: T1,
        responded_at: null,
        candidata: { id: MARINA, full_name: null },
      },
      {
        id: "r2",
        opportunity_id: "v1",
        message: "Carta r2",
        status: "in_review",
        owner_note: null,
        created_at: T2,
        updated_at: T2,
        responded_at: null,
        candidata: bia,
      },
    ]);
    expect(JSON.stringify(data.rede_social)).not.toMatch(
      /search_text|indice interno|bia@x\.dev|privada|applicant_id|owner_id|alheia/,
    );
  });

  it("traz as conversas diretas com mensagens, o papel dela e sem revelar a recusa de um pedido dela", () => {
    const conversation = (
      id: string,
      other: string,
      initiator: string,
      status: "request" | "active" | "declined",
      createdAt: string,
    ) => {
      const [a, b] = [ME, other].sort();
      const ref = (pid: string) =>
        ({ [ME]: larissa, [MARINA]: marina, [BIA]: bia, [ANA]: ana })[pid]!;
      return {
        id,
        user_a: a!,
        user_b: b!,
        initiator_id: initiator,
        status,
        created_at: createdAt,
        person_a: ref(a!),
        person_b: ref(b!),
      };
    };
    const message = (id: string, conversationId: string, sender: string, createdAt: string) => ({
      id,
      conversation_id: conversationId,
      sender_id: sender,
      body: `Mensagem ${id}`,
      created_at: createdAt,
    });
    const data = buildDataExport(
      sources({
        directConversations: [
          conversation("d-recusada-por-ela", ANA, ANA, "declined", T1),
          {
            ...conversation("d-ativa", MARINA, ME, "active", T0),
            last_message_preview: "prévia interna",
            user_a_read_at: T2,
          } as never,
          conversation("d-meu-pedido-recusado", BIA, ME, "declined", T2),
          // aberta pela outra pessoa e sem mensagem: nada escrito, não entra
          conversation("d-vazia", MARINA, MARINA, "request", T0),
        ],
        directMessages: [
          message("m3", "d-ativa", ME, T2),
          message("m1", "d-ativa", MARINA, T0),
          // repetida (veio em duas páginas): entra uma vez
          message("m1", "d-ativa", MARINA, T0),
          message("m4", "d-recusada-por-ela", ANA, T1),
          message("m5", "d-meu-pedido-recusado", ME, T2),
          // de uma conversa que não é dela e de alguém de fora da conversa: ficam de fora
          { ...message("x", "d-alheia", BIA, T0), body: "conversa alheia" },
          { ...message("y", "d-ativa", BIA, T1), body: "intrusa" },
        ],
      }),
    );
    expect(data.rede_social.mensagens_diretas).toEqual([
      {
        id: "d-ativa",
        status: "active",
        created_at: T0,
        papel: "iniciou",
        outra_pessoa: marina,
        mensagens: [
          { id: "m1", sender_id: MARINA, body: "Mensagem m1", created_at: T0 },
          { id: "m3", sender_id: ME, body: "Mensagem m3", created_at: T2 },
        ],
      },
      {
        id: "d-recusada-por-ela",
        status: "declined",
        created_at: T1,
        papel: "recebeu",
        outra_pessoa: ana,
        mensagens: [{ id: "m4", sender_id: ANA, body: "Mensagem m4", created_at: T1 }],
      },
      {
        id: "d-meu-pedido-recusado",
        status: "request",
        created_at: T2,
        papel: "iniciou",
        outra_pessoa: bia,
        mensagens: [{ id: "m5", sender_id: ME, body: "Mensagem m5", created_at: T2 }],
      },
    ]);
    expect(JSON.stringify(data.rede_social.mensagens_diretas)).not.toMatch(
      /prévia interna|read_at|conversa alheia|intrusa|d-vazia|user_a|initiator_id/,
    );
    expect(data.sobre.observacoes.join(" ")).toMatch(/aparecem como pendentes/);
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
