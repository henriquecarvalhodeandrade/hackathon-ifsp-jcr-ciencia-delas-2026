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
 *     sugerida;
 *   - tópicos e respostas anônimos dela entram marcados com `is_anonymous: true`.
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
] as const satisfies ReadonlyArray<keyof Tables<"mentorship_requests">>;

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

/** Tudo o que as consultas devolveram (com a sessão dela → RLS). */
export interface ExportSources {
  generatedAt: Date;
  account: ExportAccount;
  profile: ExportProfile | null;
  areas: ExportArea[];
  mentorshipRequests: ExportMentorshipRequestSource[];
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

  const observacoes = [
    "Tópicos e respostas que você publicou como anônima aparecem com is_anonymous = true. Este arquivo liga o seu nome a eles: guarde-o em lugar seguro e só compartilhe se quiser.",
    "De outras pessoas, o arquivo traz só o id e o nome de quem participou das suas mentorias e das mentoras sugeridas a você.",
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
