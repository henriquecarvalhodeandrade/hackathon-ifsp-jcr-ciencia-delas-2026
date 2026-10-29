import type { Tables } from "@/lib/database.types";

/**
 * "Baixar meus dados" (LGPD, art. 18, V — portabilidade): monta o arquivo JSON com os dados da
 * própria usuária. Módulo puro e testado — as consultas ficam em ./export-data.ts (server-only).
 *
 * Regras de privacidade aplicadas AQUI (e não só nas consultas), para valerem mesmo se uma
 * consulta trouxer colunas a mais:
 *   - cada registro passa por uma lista de campos permitidos (nada de tokens, search_text,
 *     notas da moderação ou quem resolveu a denúncia);
 *   - de outras pessoas, só `{ id, full_name }` da outra participante da mentoria e da mentora
 *     sugerida — e, nas conversas da mentoria, as mensagens trocadas com ela (o que ela mesma
 *     leu e escreveu);
 *   - tópicos e respostas anônimos dela entram marcados com `is_anonymous: true`;
 *   - retornos de mentoria: SÓ os que ela mesma escreveu (o da outra participante nunca entra);
 *     declarações: as das mentorias dela, com o status derivado (emitida, aguardando, revogada…);
 *   - Pergunte a uma cientista: só as respostas que ELA escreveu. As perguntas não têm autora no
 *     banco, então nada no arquivo liga uma pessoa a uma pergunta anônima;
 *   - marcas de trajetória (trajectory_tags) entram no perfil: são dados dela;
 *   - rede social (docs/18): de outras pessoas, só `{ id, full_name }` de quem ela segue, de quem
 *     a segue, das conexões, das candidatas às vagas dela e de quem conversou com ela — e o que
 *     foi escrito PARA ela (recado do convite, carta de apresentação, mensagens diretas), como na
 *     mentoria. A recusa de um convite de conexão ou de um pedido de mensagem que ELA enviou não
 *     é revelada (a decisão é da outra pessoa; na tela também continua "pendente"/"aguardando");
 *     conversas diretas sem nenhuma mensagem não entram (como as conversas da mentoria).
 *
 * Formato: seções com nomes em português; dentro de cada registro, os nomes das colunas do banco
 * (docs/03-banco-de-dados.md), que são estáveis e servem para importar em outro sistema.
 */

export const EXPORT_FORMAT = "artemis-meus-dados";
export const EXPORT_VERSION = 1;

export interface PersonRef {
  id: string;
  full_name: string | null;
}

export interface ExportAccount {
  id: string;
  email: string | null;
  created_at: string | null;
  email_confirmed_at: string | null;
  last_sign_in_at: string | null;
}

const PROFILE_FIELDS = [
  "id",
  "full_name",
  "pronouns",
  "headline",
  "bio",
  "avatar_url",
  "career_stage",
  "institution",
  "city",
  "state",
  "keywords",
  "lattes_url",
  "orcid",
  "linkedin_url",
  "website_url",
  "seeks_mentorship",
  "mentoring_goals",
  "is_mentor",
  "mentor_available",
  "mentor_capacity",
  "mentoring_offer",
  "mentorship_topics",
  "meeting_formats",
  "languages",
  "trajectory_tags",
  "role",
  "ai_consent",
  "ai_consent_at",
  "onboarded_at",
  "created_at",
  "updated_at",
] as const satisfies ReadonlyArray<keyof Tables<"profiles">>;

const REQUEST_FIELDS = [
  "id",
  "status",
  "message",
  "response_message",
  "match_score",
  "match_reason",
  "created_at",
  "updated_at",
  "responded_at",
  "completed_at",
] as const satisfies ReadonlyArray<keyof Tables<"mentorship_requests">>;

/** Mensagens da conversa da mentoria (as dela e as que ela recebeu). */
const MESSAGE_FIELDS = [
  "id",
  "sender_id",
  "body",
  "created_at",
  "read_at",
] as const satisfies ReadonlyArray<keyof Tables<"mentorship_messages">>;

/** Retornos privados da mentoria (só os dela). */
const FEEDBACK_FIELDS = [
  "request_id",
  "role",
  "helpfulness",
  "outcomes",
  "would_recommend",
  "note",
  "created_at",
] as const satisfies ReadonlyArray<keyof Tables<"mentorship_feedback">>;

/** Declarações de participação das mentorias dela (sem quem pediu/revogou: ids de pessoas). */
const DECLARATION_FIELDS = [
  "request_id",
  "code",
  "mentee_consented_at",
  "mentor_consented_at",
  "issued_at",
  "revoked_at",
  "revoke_reason",
] as const satisfies ReadonlyArray<keyof Tables<"mentorship_declarations">>;

/**
 * Respostas dela no Pergunte a uma cientista. Sem `hidden_by` (quem da moderação ocultou: a
 * coluna nem é legível pela API) e sem nada da pergunta além do id.
 */
const PUBLIC_ANSWER_FIELDS = [
  "id",
  "question_id",
  "body",
  "show_identity",
  "is_hidden",
  "hidden_at",
  "created_at",
] as const satisfies ReadonlyArray<keyof Tables<"public_answers">>;

const SUGGESTION_FIELDS = [
  "score",
  "rank",
  "reason",
  "conversation_starters",
  "source",
  "model",
  "created_at",
] as const satisfies ReadonlyArray<keyof Tables<"mentor_suggestions">>;

const THREAD_FIELDS = [
  "id",
  "category_id",
  "title",
  "body",
  "tags",
  "is_anonymous",
  "is_pinned",
  "is_locked",
  "solution_post_id",
  "reply_count",
  "created_at",
  "updated_at",
  "edited_at",
] as const satisfies ReadonlyArray<keyof Tables<"forum_threads">>;

const POST_FIELDS = [
  "id",
  "thread_id",
  "body",
  "is_anonymous",
  "created_at",
  "updated_at",
  "edited_at",
] as const satisfies ReadonlyArray<keyof Tables<"forum_posts">>;

const REACTION_FIELDS = [
  "kind",
  "thread_id",
  "post_id",
  "created_at",
] as const satisfies ReadonlyArray<keyof Tables<"forum_reactions">>;

const PAPER_FIELDS = [
  "id",
  "title",
  "authors",
  "abstract",
  "venue",
  "year",
  "doi",
  "url",
  "area_id",
  "keywords",
  "submitter_relation",
  "women_authorship_confirmed",
  "plain_summary",
  "plain_summary_source",
  "vote_count",
  "comment_count",
  "is_hidden",
  "created_at",
  "updated_at",
] as const satisfies ReadonlyArray<keyof Tables<"papers">>;

const VOTE_FIELDS = ["paper_id", "created_at"] as const satisfies ReadonlyArray<
  keyof Tables<"paper_votes">
>;

const COMMENT_FIELDS = [
  "id",
  "paper_id",
  "body",
  "created_at",
  "updated_at",
] as const satisfies ReadonlyArray<keyof Tables<"paper_comments">>;

const NOTIFICATION_FIELDS = [
  "id",
  "type",
  "title",
  "body",
  "link",
  "read_at",
  "created_at",
] as const satisfies ReadonlyArray<keyof Tables<"notifications">>;

/** Sem `resolution_note` nem `resolved_by`: são da moderação. */
const REPORT_FIELDS = [
  "id",
  "target_type",
  "target_id",
  "reason",
  "details",
  "status",
  "created_at",
  "resolved_at",
] as const satisfies ReadonlyArray<keyof Tables<"reports">>;

/** Sem tokens de confirmação/descadastro nem contadores internos de envio. */
const SUBSCRIPTION_FIELDS = [
  "email",
  "status",
  "area_ids",
  "consent_text",
  "consented_at",
  "confirmed_at",
  "unsubscribed_at",
  "created_at",
  "updated_at",
] as const satisfies ReadonlyArray<keyof Tables<"newsletter_subscribers">>;

// ── Rede social (docs/18) ────────────────────────────────────────────────────────────────────

/** Convites de conexão: o recado é de quem convidou (dela, ou o que recebeu). */
const CONNECTION_FIELDS = [
  "id",
  "status",
  "message",
  "created_at",
  "responded_at",
] as const satisfies ReadonlyArray<keyof Tables<"connections">>;

const PORTFOLIO_FIELDS = [
  "id",
  "kind",
  "title",
  "description",
  "url",
  "venue",
  "year",
  "tags",
  "pinned",
  "created_at",
  "updated_at",
] as const satisfies ReadonlyArray<keyof Tables<"portfolio_items">>;

const FEED_POST_FIELDS = [
  "id",
  "kind",
  "body",
  "link_url",
  "portfolio_item_id",
  "opportunity_id",
  "like_count",
  "comment_count",
  "created_at",
  "updated_at",
] as const satisfies ReadonlyArray<keyof Tables<"posts">>;

const FEED_LIKE_FIELDS = ["post_id", "created_at"] as const satisfies ReadonlyArray<
  keyof Tables<"post_likes">
>;

const FEED_COMMENT_FIELDS = [
  "id",
  "post_id",
  "body",
  "created_at",
  "updated_at",
] as const satisfies ReadonlyArray<keyof Tables<"post_comments">>;

/** Vagas que ela publicou: tudo o que ela preencheu + situação. Sem `search_text` (índice). */
const OPPORTUNITY_FIELDS = [
  "id",
  "kind",
  "title",
  "description",
  "requirements",
  "area_id",
  "keywords",
  "institution",
  "city",
  "state",
  "modality",
  "has_scholarship",
  "scholarship_info",
  "weekly_hours",
  "vacancies",
  "target_stages",
  "deadline",
  "status",
  "application_count",
  "created_at",
  "updated_at",
  "closed_at",
] as const satisfies ReadonlyArray<keyof Tables<"research_opportunities">>;

/**
 * Candidaturas: as que ela enviou (com o recado da dona da vaga) e as que recebeu nas vagas dela
 * (com a carta de apresentação, escrita PARA ela — como a mensagem de um pedido de mentoria).
 */
const APPLICATION_FIELDS = [
  "id",
  "opportunity_id",
  "message",
  "status",
  "owner_note",
  "created_at",
  "updated_at",
  "responded_at",
] as const satisfies ReadonlyArray<keyof Tables<"opportunity_applications">>;

/** Sem prévia da última mensagem nem marcas de leitura (a prévia repete o texto das mensagens). */
const DIRECT_CONVERSATION_FIELDS = ["id", "status", "created_at"] as const satisfies ReadonlyArray<
  keyof Tables<"direct_conversations">
>;

const DIRECT_MESSAGE_FIELDS = [
  "id",
  "sender_id",
  "body",
  "created_at",
] as const satisfies ReadonlyArray<keyof Tables<"direct_messages">>;

type Fields<T, K extends readonly (keyof T)[]> = Pick<T, K[number]>;

export type ExportProfile = Fields<Tables<"profiles">, typeof PROFILE_FIELDS>;
export interface ExportArea {
  id: number;
  slug: string;
  name: string;
  big_area: string;
}
export type ExportMentorshipRequestSource = Fields<
  Tables<"mentorship_requests">,
  typeof REQUEST_FIELDS
> &
  Pick<Tables<"mentorship_requests">, "mentee_id" | "mentor_id"> & {
    mentee: PersonRef | null;
    mentor: PersonRef | null;
  };
export type ExportMessageSource = Fields<Tables<"mentorship_messages">, typeof MESSAGE_FIELDS> &
  Pick<Tables<"mentorship_messages">, "request_id">;
export type ExportMessage = Fields<Tables<"mentorship_messages">, typeof MESSAGE_FIELDS>;
export interface ExportConversation {
  request_id: string;
  /** Papel dela nesta mentoria. */
  papel: "mentoranda" | "mentora";
  outra_participante: PersonRef;
  mensagens: ExportMessage[];
}
export type ExportFeedbackSource = Fields<Tables<"mentorship_feedback">, typeof FEEDBACK_FIELDS> &
  Pick<Tables<"mentorship_feedback">, "author_id">;
export type ExportFeedback = Fields<Tables<"mentorship_feedback">, typeof FEEDBACK_FIELDS>;
export type ExportDeclarationSource = Fields<
  Tables<"mentorship_declarations">,
  typeof DECLARATION_FIELDS
>;
/** Situação da declaração, derivada das datas. */
export type DeclarationExportStatus =
  "emitida" | "aguardando_autorizacao" | "revogada" | "cancelada";
export type ExportDeclaration = ExportDeclarationSource & { status: DeclarationExportStatus };
export type ExportPublicAnswer = Fields<Tables<"public_answers">, typeof PUBLIC_ANSWER_FIELDS>;
export type ExportPublicAnswerSource = ExportPublicAnswer &
  Pick<Tables<"public_answers">, "author_id">;
export type ExportSuggestionSource = Fields<
  Tables<"mentor_suggestions">,
  typeof SUGGESTION_FIELDS
> &
  Pick<Tables<"mentor_suggestions">, "mentor_id"> & { mentor: PersonRef | null };
export type ExportThreadSource = Fields<Tables<"forum_threads">, typeof THREAD_FIELDS> & {
  category: { slug: string; name: string } | null;
};
export type ExportPostSource = Fields<Tables<"forum_posts">, typeof POST_FIELDS>;
export type ExportAnonymousAuthorship = Pick<
  Tables<"forum_anonymous_authorship">,
  "thread_id" | "post_id"
>;
export type ExportReaction = Fields<Tables<"forum_reactions">, typeof REACTION_FIELDS>;
export type ExportPaperSource = Fields<Tables<"papers">, typeof PAPER_FIELDS> & {
  area: { slug: string; name: string } | null;
};
export type ExportVoteSource = Fields<Tables<"paper_votes">, typeof VOTE_FIELDS> & {
  paper: { title: string } | null;
};
export type ExportComment = Fields<Tables<"paper_comments">, typeof COMMENT_FIELDS>;
export type ExportNotification = Fields<Tables<"notifications">, typeof NOTIFICATION_FIELDS>;
export type ExportReport = Fields<Tables<"reports">, typeof REPORT_FIELDS>;
export type ExportSubscription = Fields<
  Tables<"newsletter_subscribers">,
  typeof SUBSCRIPTION_FIELDS
>;

export type ExportNewsletterSource =
  { available: true; subscription: ExportSubscription | null } | { available: false };

export type ExportFollowSource = Pick<
  Tables<"follows">,
  "follower_id" | "followee_id" | "created_at"
> & {
  follower: PersonRef | null;
  followee: PersonRef | null;
};
export interface ExportFollow {
  pessoa: PersonRef;
  created_at: string;
}
export type ExportConnectionSource = Fields<Tables<"connections">, typeof CONNECTION_FIELDS> &
  Pick<Tables<"connections">, "requester_id" | "addressee_id"> & {
    requester: PersonRef | null;
    addressee: PersonRef | null;
  };
export type ExportConnection = Fields<Tables<"connections">, typeof CONNECTION_FIELDS> & {
  /** Se foi ela quem convidou ou quem recebeu o convite. */
  papel: "enviou" | "recebeu";
  outra_pessoa: PersonRef;
};
export type ExportPortfolioItem = Fields<Tables<"portfolio_items">, typeof PORTFOLIO_FIELDS>;
export type ExportFeedPost = Fields<Tables<"posts">, typeof FEED_POST_FIELDS>;
export type ExportFeedLike = Fields<Tables<"post_likes">, typeof FEED_LIKE_FIELDS>;
export type ExportFeedComment = Fields<Tables<"post_comments">, typeof FEED_COMMENT_FIELDS>;
export type ExportOpportunitySource = Fields<
  Tables<"research_opportunities">,
  typeof OPPORTUNITY_FIELDS
> &
  Pick<Tables<"research_opportunities">, "owner_id"> & {
    area: { slug: string; name: string } | null;
  };
export type ExportOpportunity = Fields<
  Tables<"research_opportunities">,
  typeof OPPORTUNITY_FIELDS
> & {
  area: { slug: string; name: string } | null;
};
type ApplicationFields = Fields<Tables<"opportunity_applications">, typeof APPLICATION_FIELDS>;
export type ExportApplicationSource = ApplicationFields &
  Pick<Tables<"opportunity_applications">, "applicant_id"> & {
    opportunity: { title: string } | null;
  };
export type ExportReceivedApplicationSource = ApplicationFields &
  Pick<Tables<"opportunity_applications">, "applicant_id"> & { applicant: PersonRef | null };
export type ExportDirectConversationSource = Fields<
  Tables<"direct_conversations">,
  typeof DIRECT_CONVERSATION_FIELDS
> &
  Pick<Tables<"direct_conversations">, "user_a" | "user_b" | "initiator_id"> & {
    person_a: PersonRef | null;
    person_b: PersonRef | null;
  };
export type ExportDirectMessageSource = Fields<
  Tables<"direct_messages">,
  typeof DIRECT_MESSAGE_FIELDS
> &
  Pick<Tables<"direct_messages">, "conversation_id">;
export type ExportDirectMessage = Fields<Tables<"direct_messages">, typeof DIRECT_MESSAGE_FIELDS>;
export interface ExportDirectConversation extends Fields<
  Tables<"direct_conversations">,
  typeof DIRECT_CONVERSATION_FIELDS
> {
  /** Se foi ela quem começou a conversa. */
  papel: "iniciou" | "recebeu";
  outra_pessoa: PersonRef;
  mensagens: ExportDirectMessage[];
}

/** Tudo o que as consultas devolveram (com a sessão dela → RLS). */
export interface ExportSources {
  generatedAt: Date;
  account: ExportAccount;
  profile: ExportProfile | null;
  areas: ExportArea[];
  mentorshipRequests: ExportMentorshipRequestSource[];
  /** Mensagens das conversas das mentorias dela (o RLS só devolve as das participantes). */
  messages: ExportMessageSource[];
  /** Retornos da mentoria escritos por ela (o RLS só devolve os da autora). */
  feedback: ExportFeedbackSource[];
  /** Declarações das mentorias dela (o RLS só devolve às participantes). */
  declarations: ExportDeclarationSource[];
  /** Respostas dela no Pergunte a uma cientista (filtradas pela autora). */
  publicAnswers: ExportPublicAnswerSource[];
  suggestions: ExportSuggestionSource[];
  /** Tópicos assinados por ela + os anônimos dela (pode haver repetidos). */
  threads: ExportThreadSource[];
  posts: ExportPostSource[];
  /** Linhas dela em forum_anonymous_authorship (a fonte da verdade do anonimato). */
  anonymousAuthorship: ExportAnonymousAuthorship[];
  reactions: ExportReaction[];
  papers: ExportPaperSource[];
  votes: ExportVoteSource[];
  comments: ExportComment[];
  notifications: ExportNotification[];
  reports: ExportReport[];
  newsletter: ExportNewsletterSource;
  /** Quem ela segue + quem a segue (o RLS de follows é aberto: as consultas filtram pelo id). */
  follows: ExportFollowSource[];
  /** Convites e conexões em que ela é uma das duas (aceitas de outras pessoas ficam de fora). */
  connections: ExportConnectionSource[];
  portfolioItems: ExportPortfolioItem[];
  feedPosts: ExportFeedPost[];
  feedLikes: ExportFeedLike[];
  feedComments: ExportFeedComment[];
  /** Vagas de IC publicadas por ela. */
  opportunities: ExportOpportunitySource[];
  /** Candidaturas que ela enviou. */
  applications: ExportApplicationSource[];
  /** Candidaturas às vagas dela (pelos ids das vagas). */
  receivedApplications: ExportReceivedApplicationSource[];
  /** Conversas diretas dela (o RLS só devolve às duas participantes). */
  directConversations: ExportDirectConversationSource[];
  /** Mensagens dessas conversas (pelos ids das conversas). */
  directMessages: ExportDirectMessageSource[];
}

export interface DataExport {
  sobre: {
    formato: typeof EXPORT_FORMAT;
    versao: typeof EXPORT_VERSION;
    gerado_em: string;
    descricao: string;
    observacoes: string[];
  };
  conta: ExportAccount;
  perfil: ExportProfile | null;
  areas_de_pesquisa: ExportArea[];
  palavras_chave: string[];
  mentoria: {
    pedidos_enviados: Array<
      Fields<Tables<"mentorship_requests">, typeof REQUEST_FIELDS> & { mentora: PersonRef }
    >;
    pedidos_recebidos: Array<
      Fields<Tables<"mentorship_requests">, typeof REQUEST_FIELDS> & { mentoranda: PersonRef }
    >;
    sugestoes_salvas: Array<
      Fields<Tables<"mentor_suggestions">, typeof SUGGESTION_FIELDS> & { mentora: PersonRef }
    >;
    /** Conversas com pelo menos uma mensagem, na ordem dos pedidos. */
    conversas: ExportConversation[];
  };
  forum: {
    topicos: Array<
      Fields<Tables<"forum_threads">, typeof THREAD_FIELDS> & {
        category: { slug: string; name: string } | null;
      }
    >;
    respostas: ExportPostSource[];
    reacoes: ExportReaction[];
  };
  vitrine: {
    papers_enviados: Array<
      Fields<Tables<"papers">, typeof PAPER_FIELDS> & {
        area: { slug: string; name: string } | null;
      }
    >;
    destaques: Array<
      Fields<Tables<"paper_votes">, typeof VOTE_FIELDS> & { paper_title: string | null }
    >;
    comentarios: ExportComment[];
  };
  /** Rede social (docs/18): rede, portfólio, feed, ICs e mensagens diretas. */
  rede_social: {
    seguindo: ExportFollow[];
    seguidoras: ExportFollow[];
    conexoes: ExportConnection[];
    portfolio: ExportPortfolioItem[];
    publicacoes: ExportFeedPost[];
    curtidas: ExportFeedLike[];
    comentarios_no_feed: ExportFeedComment[];
    oportunidades_publicadas: ExportOpportunity[];
    candidaturas: Array<ApplicationFields & { opportunity_title: string | null }>;
    /** Nas vagas dela: a carta de apresentação entra (foi escrita para ela); da candidata, só id e nome. */
    candidaturas_recebidas: Array<ApplicationFields & { candidata: PersonRef }>;
    /** Conversas com pelo menos uma mensagem, mais antigas primeiro. */
    mensagens_diretas: ExportDirectConversation[];
  };
  /** Retornos privados que ela deixou ao concluir mentorias (nunca o da outra participante). */
  retornos_de_mentoria: ExportFeedback[];
  declaracoes_de_mentoria: ExportDeclaration[];
  /** Respostas públicas que ela escreveu (as perguntas não têm autora: nunca entram como dela). */
  respostas_pergunte_a_uma_cientista: ExportPublicAnswer[];
  notificacoes: ExportNotification[];
  denuncias_feitas: ExportReport[];
  newsletter:
    | { disponivel: true; inscricao: ExportSubscription | null }
    | { disponivel: false; motivo: string };
}

export const NEWSLETTER_UNAVAILABLE =
  "A situação da sua inscrição no Boletim não pôde ser consultada neste ambiente (o servidor está sem a chave de serviço). Peça pelos contatos da página de Privacidade.";

function pick<T extends object, K extends keyof T>(row: T, fields: readonly K[]): Pick<T, K> {
  const out = {} as Pick<T, K>;
  for (const field of fields) out[field] = row[field] ?? (null as T[K]);
  return out;
}

function person(ref: PersonRef | null | undefined, fallbackId: string): PersonRef {
  return { id: ref?.id ?? fallbackId, full_name: ref?.full_name ?? null };
}

/** Mais antigos primeiro; desempate estável pela ordem de chegada. */
function byCreatedAt<T extends { created_at: string }>(rows: T[]): T[] {
  return rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => a.row.created_at.localeCompare(b.row.created_at) || a.index - b.index)
    .map(({ row }) => row);
}

function uniqueBy<T>(rows: T[], key: (row: T) => string): T[] {
  const seen = new Set<string>();
  return rows.filter((row) => {
    const k = key(row);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/**
 * Uma conversa por mentoria dela (só as que têm mensagens). Mensagens de pedidos que não são
 * dela, ou de alguém que não participa do pedido, ficam de fora mesmo se vierem na consulta.
 */
function buildConversations(
  requests: ExportMentorshipRequestSource[],
  messages: ExportMessageSource[],
  me: string,
): ExportConversation[] {
  const byRequest = new Map<string, ExportMessageSource[]>();
  for (const message of uniqueBy(messages, (m) => m.id)) {
    const list = byRequest.get(message.request_id) ?? [];
    list.push(message);
    byRequest.set(message.request_id, list);
  }
  return requests.flatMap((r) => {
    const participants = new Set([r.mentee_id, r.mentor_id]);
    const list = (byRequest.get(r.id) ?? []).filter((m) => participants.has(m.sender_id));
    if (list.length === 0) return [];
    const mentee = r.mentee_id === me;
    return [
      {
        request_id: r.id,
        papel: mentee ? "mentoranda" : "mentora",
        outra_participante: mentee ? person(r.mentor, r.mentor_id) : person(r.mentee, r.mentee_id),
        mensagens: byCreatedAt(list).map((m) => pick(m, MESSAGE_FIELDS)),
      },
    ];
  });
}

/**
 * Convites e conexões em que ela é uma das duas. Um convite que ELA enviou e foi recusado sai
 * como "pending" e sem `responded_at`, como na tela (docs/18 §2.1: quem convidou nunca vê a
 * recusa — a decisão é da outra pessoa).
 */
function buildConnections(rows: ExportConnectionSource[], me: string): ExportConnection[] {
  return byCreatedAt(
    uniqueBy(
      rows.filter((c) => c.requester_id === me || c.addressee_id === me),
      (c) => c.id,
    ),
  ).map((c) => {
    const sent = c.requester_id === me;
    const hideDecline = sent && c.status === "declined";
    return {
      ...pick(c, CONNECTION_FIELDS),
      ...(hideDecline ? { status: "pending" as const, responded_at: null } : {}),
      papel: sent ? "enviou" : "recebeu",
      outra_pessoa: sent
        ? person(c.addressee, c.addressee_id)
        : person(c.requester, c.requester_id),
    };
  });
}

/**
 * Uma entrada por conversa direta dela com pelo menos uma mensagem (uma conversa aberta sem
 * mensagem não tem nada escrito). Mensagens de conversas que não são dela, ou de alguém de fora
 * da conversa, ficam de fora. Pedido de mensagem que ELA começou e foi recusado sai como
 * "request" (docs/18 §2.5: a recusa nunca é revelada a quem pediu).
 */
function buildDirectConversations(
  conversations: ExportDirectConversationSource[],
  messages: ExportDirectMessageSource[],
  me: string,
): ExportDirectConversation[] {
  const byConversation = new Map<string, ExportDirectMessageSource[]>();
  for (const message of uniqueBy(messages, (m) => m.id)) {
    const list = byConversation.get(message.conversation_id) ?? [];
    list.push(message);
    byConversation.set(message.conversation_id, list);
  }
  const mine = uniqueBy(
    conversations.filter((c) => c.user_a === me || c.user_b === me),
    (c) => c.id,
  );
  return byCreatedAt(mine).flatMap((c) => {
    const participants = new Set([c.user_a, c.user_b]);
    const list = (byConversation.get(c.id) ?? []).filter((m) => participants.has(m.sender_id));
    if (list.length === 0) return [];
    const started = c.initiator_id === me;
    const iAmA = c.user_a === me;
    return [
      {
        ...pick(c, DIRECT_CONVERSATION_FIELDS),
        status: started && c.status === "declined" ? "request" : c.status,
        papel: started ? "iniciou" : "recebeu",
        outra_pessoa: iAmA ? person(c.person_b, c.user_b) : person(c.person_a, c.user_a),
        mensagens: byCreatedAt(list).map((m) => pick(m, DIRECT_MESSAGE_FIELDS)),
      },
    ];
  });
}

function buildSocialNetwork(sources: ExportSources, me: string): DataExport["rede_social"] {
  const follows = uniqueBy(sources.follows, (f) => `${f.follower_id}:${f.followee_id}`);
  const opportunities = byCreatedAt(
    uniqueBy(
      sources.opportunities.filter((o) => o.owner_id === me),
      (o) => o.id,
    ),
  );
  const myOpportunityIds = new Set(opportunities.map((o) => o.id));

  return {
    seguindo: byCreatedAt(follows.filter((f) => f.follower_id === me && f.followee_id !== me)).map(
      (f) => ({ pessoa: person(f.followee, f.followee_id), created_at: f.created_at }),
    ),
    seguidoras: byCreatedAt(
      follows.filter((f) => f.followee_id === me && f.follower_id !== me),
    ).map((f) => ({ pessoa: person(f.follower, f.follower_id), created_at: f.created_at })),
    conexoes: buildConnections(sources.connections, me),
    portfolio: byCreatedAt(
      uniqueBy(sources.portfolioItems, (p) => p.id).map((p) => pick(p, PORTFOLIO_FIELDS)),
    ),
    publicacoes: byCreatedAt(
      uniqueBy(sources.feedPosts, (p) => p.id).map((p) => pick(p, FEED_POST_FIELDS)),
    ),
    curtidas: byCreatedAt(
      uniqueBy(sources.feedLikes, (l) => l.post_id).map((l) => pick(l, FEED_LIKE_FIELDS)),
    ),
    comentarios_no_feed: byCreatedAt(
      uniqueBy(sources.feedComments, (c) => c.id).map((c) => pick(c, FEED_COMMENT_FIELDS)),
    ),
    oportunidades_publicadas: opportunities.map((o) => ({
      ...pick(o, OPPORTUNITY_FIELDS),
      area: o.area ? { slug: o.area.slug, name: o.area.name } : null,
    })),
    candidaturas: byCreatedAt(
      uniqueBy(
        sources.applications.filter((a) => a.applicant_id === me),
        (a) => a.id,
      ),
    ).map((a) => ({
      ...pick(a, APPLICATION_FIELDS),
      opportunity_title: a.opportunity?.title ?? null,
    })),
    candidaturas_recebidas: byCreatedAt(
      uniqueBy(
        sources.receivedApplications.filter(
          (a) => myOpportunityIds.has(a.opportunity_id) && a.applicant_id !== me,
        ),
        (a) => a.id,
      ),
    ).map((a) => ({
      ...pick(a, APPLICATION_FIELDS),
      candidata: person(a.applicant, a.applicant_id),
    })),
    mensagens_diretas: buildDirectConversations(
      sources.directConversations,
      sources.directMessages,
      me,
    ),
  };
}

export function declarationExportStatus(
  row: Pick<ExportDeclarationSource, "issued_at" | "revoked_at">,
): DeclarationExportStatus {
  if (row.revoked_at) return row.issued_at ? "revogada" : "cancelada";
  return row.issued_at ? "emitida" : "aguardando_autorizacao";
}

export function buildDataExport(sources: ExportSources): DataExport {
  const me = sources.account.id;
  const anonThreads = new Set(
    sources.anonymousAuthorship.flatMap((row) => (row.thread_id ? [row.thread_id] : [])),
  );
  const anonPosts = new Set(
    sources.anonymousAuthorship.flatMap((row) => (row.post_id ? [row.post_id] : [])),
  );

  const requests = byCreatedAt(
    sources.mentorshipRequests.filter((r) => r.mentee_id === me || r.mentor_id === me),
  );
  const myRequestIds = new Set(requests.map((r) => r.id));

  const observacoes = [
    "Tópicos e respostas que você publicou como anônima aparecem com is_anonymous = true. Este arquivo liga o seu nome a eles: guarde-o em lugar seguro e só compartilhe se quiser.",
    "De outras pessoas, o arquivo traz só o id e o nome de quem participou das suas mentorias, das mentoras sugeridas a você e de quem está na sua rede (quem você segue, quem segue você, conexões, candidatas às suas vagas e quem conversou com você nas mensagens diretas), além do que foi escrito para você: as mensagens das conversas da mentoria e das mensagens diretas, os recados dos convites de conexão e as cartas de apresentação recebidas nas suas vagas.",
    "Convites de conexão e pedidos de mensagem que você enviou e ainda não foram aceitos aparecem como pendentes (pending / request), como na tela: a resposta é da outra pessoa. Conversas diretas sem nenhuma mensagem não entram.",
    "Retornos de mentoria: só os que você escreveu. O retorno da outra participante é privado dela e não entra no seu arquivo.",
    "Pergunte a uma cientista: entram as respostas que você escreveu (show_identity diz se o seu nome aparece nelas). As perguntas não guardam quem as enviou, então nenhuma pergunta aparece como sua.",
    "Não entram aqui: a representação numérica do perfil usada pela IA (embedding, que pode ser recalculada), as anotações da moderação sobre as suas denúncias e os registros técnicos dos provedores.",
  ];
  if (!sources.newsletter.available) observacoes.push(NEWSLETTER_UNAVAILABLE);

  return {
    sobre: {
      formato: EXPORT_FORMAT,
      versao: EXPORT_VERSION,
      gerado_em: sources.generatedAt.toISOString(),
      descricao:
        "Cópia dos seus dados pessoais na Artemis, gerada a seu pedido (LGPD, art. 18, V). As seções têm nomes em português; os campos de cada registro seguem os nomes das colunas do banco de dados.",
      observacoes,
    },
    conta: pick(sources.account, [
      "id",
      "email",
      "created_at",
      "email_confirmed_at",
      "last_sign_in_at",
    ]),
    perfil: sources.profile ? pick(sources.profile, PROFILE_FIELDS) : null,
    areas_de_pesquisa: uniqueBy(
      sources.areas.map((area) => pick(area, ["id", "slug", "name", "big_area"])),
      (area) => String(area.id),
    ).sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    palavras_chave: [...(sources.profile?.keywords ?? [])],
    mentoria: {
      pedidos_enviados: requests
        .filter((r) => r.mentee_id === me)
        .map((r) => ({ ...pick(r, REQUEST_FIELDS), mentora: person(r.mentor, r.mentor_id) })),
      pedidos_recebidos: requests
        .filter((r) => r.mentor_id === me && r.mentee_id !== me)
        .map((r) => ({ ...pick(r, REQUEST_FIELDS), mentoranda: person(r.mentee, r.mentee_id) })),
      sugestoes_salvas: [...sources.suggestions]
        .sort((a, b) => a.rank - b.rank)
        .map((s) => ({ ...pick(s, SUGGESTION_FIELDS), mentora: person(s.mentor, s.mentor_id) })),
      conversas: buildConversations(requests, sources.messages, me),
    },
    forum: {
      topicos: byCreatedAt(uniqueBy(sources.threads, (t) => t.id)).map((t) => ({
        ...pick(t, THREAD_FIELDS),
        is_anonymous: t.is_anonymous || anonThreads.has(t.id),
        category: t.category ? { slug: t.category.slug, name: t.category.name } : null,
      })),
      respostas: byCreatedAt(uniqueBy(sources.posts, (p) => p.id)).map((p) => ({
        ...pick(p, POST_FIELDS),
        is_anonymous: p.is_anonymous || anonPosts.has(p.id),
      })),
      reacoes: byCreatedAt(sources.reactions.map((r) => pick(r, REACTION_FIELDS))),
    },
    vitrine: {
      papers_enviados: byCreatedAt(uniqueBy(sources.papers, (p) => p.id)).map((p) => ({
        ...pick(p, PAPER_FIELDS),
        area: p.area ? { slug: p.area.slug, name: p.area.name } : null,
      })),
      destaques: byCreatedAt(sources.votes).map((v) => ({
        ...pick(v, VOTE_FIELDS),
        paper_title: v.paper?.title ?? null,
      })),
      comentarios: byCreatedAt(sources.comments.map((c) => pick(c, COMMENT_FIELDS))),
    },
    rede_social: buildSocialNetwork(sources, me),
    retornos_de_mentoria: byCreatedAt(
      uniqueBy(
        sources.feedback.filter((f) => f.author_id === me && myRequestIds.has(f.request_id)),
        (f) => f.request_id,
      ).map((f) => pick(f, FEEDBACK_FIELDS)),
    ),
    declaracoes_de_mentoria: uniqueBy(
      sources.declarations.filter((d) => myRequestIds.has(d.request_id)),
      (d) => d.code,
    ).map((d) => ({ ...pick(d, DECLARATION_FIELDS), status: declarationExportStatus(d) })),
    respostas_pergunte_a_uma_cientista: byCreatedAt(
      uniqueBy(
        sources.publicAnswers.filter((a) => a.author_id === me),
        (a) => a.id,
      ).map((a) => pick(a, PUBLIC_ANSWER_FIELDS)),
    ),
    notificacoes: byCreatedAt(sources.notifications.map((n) => pick(n, NOTIFICATION_FIELDS))),
    denuncias_feitas: byCreatedAt(sources.reports.map((r) => pick(r, REPORT_FIELDS))),
    newsletter: sources.newsletter.available
      ? {
          disponivel: true,
          inscricao: sources.newsletter.subscription
            ? pick(sources.newsletter.subscription, SUBSCRIPTION_FIELDS)
            : null,
        }
      : { disponivel: false, motivo: NEWSLETTER_UNAVAILABLE },
  };
}

/** "artemis-meus-dados-2026-10-28.json" — data no fuso de São Paulo. */
export function exportFileName(date: Date): string {
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
  return `artemis-meus-dados-${day}.json`;
}
