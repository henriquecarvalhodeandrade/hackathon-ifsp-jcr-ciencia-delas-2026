import "server-only";
import type { Profile } from "@/lib/auth";
import type { Enums } from "@/lib/database.types";
import { hasConversation } from "@/lib/mentorship/conversation";
import { createClient } from "@/lib/supabase/server";
import type { NextStepsInput } from "./next-steps";
import {
  QUESTIONS_CANDIDATES,
  QUESTIONS_MAX_AGE_DAYS,
  rankQuestionsForMember,
  type QuestionThread,
  type RankedQuestion,
} from "./questions-for-you";

/**
 * Leituras do /painel. Sempre com o cliente da SESSÃO (o RLS decide o que ela vê) e em UM
 * Promise.all com 6 idas ao Supabase — todas com limite explícito:
 *
 *   1. o próprio perfil com as relações embutidas (áreas, sugestões, mensagens enviadas,
 *      apresentação no fórum, respostas recentes, autoria anônima própria, papers, votos e
 *      notificações não lidas — menos as da rede que o painel já mostra com nome) — tudo o que
 *      os "próximos passos" precisam;
 *   2. os pedidos de mentoria dela, com o nome da outra pessoa e as mensagens não lidas;
 *   3. tópicos recentes sem resposta (candidatos a "Perguntas esperando por você");
 *   4. papers enviados nos últimos 7 dias;
 *   5. pessoas que chegaram à rede nos últimos 14 dias;
 *   6. a edição mais recente publicada do Boletim Delas.
 *
 * O perfil em si (palavras-chave, temas, disponibilidade) já veio de requireOnboardedProfile,
 * memoizado por requisição e compartilhado com o cabeçalho.
 *
 * Cada bloco falha sozinho: um erro vira `failed` no bloco (a página mostra um aviso calmo) e os
 * demais continuam. Nada aqui lança exceção.
 *
 * As pendências da rede social (mensagens diretas, convites, candidaturas) e "Da sua rede" têm
 * leitores próprios (network.ts, NetworkPostsCard), chamados em paralelo pela página.
 */

type ServerClient = Awaited<ReturnType<typeof createClient>>;

const DAY_MS = 24 * 60 * 60 * 1000;
const RECENT_REPLY_DAYS = 30;
const NEW_PAPER_DAYS = 7;
const NEW_MEMBER_DAYS = 14;

/**
 * Tipos de aviso que o painel já mostra com nome (pendências da rede social, network.ts) e por
 * isso ficam fora de "N notificações não lidas".
 */
export const NAMED_ELSEWHERE_TYPES = [
  "direct_message",
  "connection_request",
  "opportunity_application",
] as const satisfies readonly Enums<"notification_type">[];

/** Limites de cada lista (o banco nunca devolve mais do que isso). */
export const PAINEL_LIMITS = {
  areas: 20,
  introThreads: 1,
  ownAnonymous: 50,
  requests: 100,
  questions: QUESTIONS_CANDIDATES,
  papers: 30,
  members: 40,
  shownPapers: 3,
  shownMembers: 3,
  shownPendingSent: 3,
  shownConversations: 4,
} as const;

export interface WaitingConversation {
  requestId: string;
  name: string;
  unread: number;
}

export interface PendingSentRequest {
  requestId: string;
  mentorName: string;
  createdAt: string;
}

export interface WaitingData {
  conversations: WaitingConversation[];
  /** Pedidos recebidos aguardando resposta (mentora). */
  pendingReceived: { count: number; oldestAt: string | null };
  /** Pedidos enviados aguardando resposta (mentoranda), dos mais antigos aos mais novos. */
  pendingSent: PendingSentRequest[];
  pendingSentTotal: number;
  unreadNotifications: number;
}

export interface NewPaper {
  id: string;
  title: string;
  areaName: string | null;
  voteCount: number;
  inMyArea: boolean;
}

export interface NewMember {
  id: string;
  fullName: string;
  avatarUrl: string | null;
  headline: string | null;
  /** Área em comum com a membra (null quando entrou só por ser recente). */
  sharedArea: string | null;
}

export interface LatestEdition {
  slug: string;
  title: string;
  summary: string | null;
  publishedAt: string | null;
}

export interface NewsData {
  papers: NewPaper[];
  /** "area" = papers novos nas áreas dela; "votes" = os mais destacados entre os novos da semana. */
  papersMode: "area" | "votes";
  members: NewMember[];
  edition: LatestEdition | null;
  /**
   * Partes que não carregaram (o bloco inteiro só falha quando as três falham). Uma lista vazia
   * por erro não pode virar "Nenhum paper novo" nem "A primeira edição sai em breve".
   */
  sectionsFailed?: { papers: boolean; members: boolean; edition: boolean };
}

export interface PainelData {
  /** Instante de referência das leituras (datas relativas na tela usam o mesmo). */
  now: number;
  steps: NextStepsInput;
  /** Os "próximos passos" usam dados que não carregaram (a lista pode estar desatualizada). */
  stepsFailed: boolean;
  waiting: WaitingData;
  waitingFailed: boolean;
  questions: RankedQuestion[];
  questionsFailed: boolean;
  news: NewsData;
  newsFailed: boolean;
}

function warn(what: string, error: { code?: string; message: string }) {
  console.warn(`[painel] ${what} — ${error.code ?? ""} ${error.message.slice(0, 160)}`);
}

function sinceIso(days: number, now: number): string {
  return new Date(now - days * DAY_MS).toISOString();
}

/** `relation(count)` embutido chega como `[{ count: n }]`. */
function embeddedCount(value: unknown): number {
  if (!Array.isArray(value)) return 0;
  const first = value[0] as { count?: unknown } | undefined;
  return typeof first?.count === "number" ? first.count : 0;
}

function personName(row: unknown): string {
  const name = (row as { full_name?: string | null } | null)?.full_name?.trim();
  return name || "Pesquisadora";
}

// ---------------------------------------------------------------------------
// 1. O próprio perfil + relações (próximos passos)
// ---------------------------------------------------------------------------

interface SelfData {
  areaIds: number[];
  areaNames: string[];
  suggestionCount: number;
  sentMessageCount: number;
  hasIntroThread: boolean;
  repliedRecently: boolean;
  ownAnonymousThreadIds: string[];
  submittedPaperCount: number;
  votedPaperCount: number;
  unreadNotifications: number;
}

const EMPTY_SELF: SelfData = {
  areaIds: [],
  areaNames: [],
  suggestionCount: 0,
  sentMessageCount: 0,
  hasIntroThread: false,
  repliedRecently: false,
  ownAnonymousThreadIds: [],
  submittedPaperCount: 0,
  votedPaperCount: 0,
  unreadNotifications: 0,
};

async function loadSelf(
  supabase: ServerClient,
  userId: string,
  now: number,
): Promise<{ data: SelfData; failed: boolean }> {
  const since = sinceIso(RECENT_REPLY_DAYS, now);
  const { data, error } = await supabase
    .from("profiles")
    .select(
      `id,
       areas:profile_research_areas(area:research_areas(id, name)),
       suggestions:mentor_suggestions!mentor_suggestions_mentee_id_fkey(count),
       sent:mentorship_messages(count),
       intro:forum_threads(id, cat:forum_categories!inner(slug)),
       replies:forum_posts(count),
       anon:forum_anonymous_authorship(thread_id, post_id, created_at),
       papers:papers!papers_submitted_by_fkey(count),
       votes:paper_votes(count),
       unread:notifications(count)`,
    )
    .eq("id", userId)
    .limit(PAINEL_LIMITS.areas, { referencedTable: "areas" })
    .eq("intro.is_anonymous", false)
    .eq("intro.cat.slug", "apresente-se")
    .limit(PAINEL_LIMITS.introThreads, { referencedTable: "intro" })
    .gte("replies.created_at", since)
    .gte("anon.created_at", since)
    .limit(PAINEL_LIMITS.ownAnonymous, { referencedTable: "anon" })
    .is("unread.read_at", null)
    // Mensagens diretas, convites e candidaturas aparecem com nome em "O que está esperando você"
    // (src/lib/painel/network.ts): fora da contagem de avisos, para não contar duas vezes.
    .not("unread.type", "in", `(${NAMED_ELSEWHERE_TYPES.join(",")})`)
    .maybeSingle();

  if (error || !data) {
    if (error) warn("perfil e passos", error);
    return { data: EMPTY_SELF, failed: true };
  }

  const areas = (data.areas ?? [])
    .map((row) => row.area)
    .filter((a): a is { id: number; name: string } => Boolean(a));
  const anon = data.anon ?? [];

  return {
    failed: false,
    data: {
      areaIds: areas.map((a) => Number(a.id)),
      areaNames: areas.map((a) => a.name),
      suggestionCount: embeddedCount(data.suggestions),
      sentMessageCount: embeddedCount(data.sent),
      hasIntroThread: (data.intro ?? []).length > 0,
      // Respostas com nome (author_id) e anônimas (registro de autoria da própria membra).
      repliedRecently: embeddedCount(data.replies) > 0 || anon.some((a) => a.post_id !== null),
      ownAnonymousThreadIds: anon
        .map((a) => a.thread_id)
        .filter((id): id is string => typeof id === "string"),
      submittedPaperCount: embeddedCount(data.papers),
      votedPaperCount: embeddedCount(data.votes),
      unreadNotifications: embeddedCount(data.unread),
    },
  };
}

// ---------------------------------------------------------------------------
// 2. Pedidos de mentoria (o que está esperando por ela)
// ---------------------------------------------------------------------------

export interface RequestRow {
  id: string;
  status: "pending" | "accepted" | "declined" | "cancelled" | "completed";
  createdAt: string;
  respondedAt: string | null;
  role: "mentee" | "mentor";
  otherName: string;
  unread: number;
}

async function loadRequests(
  supabase: ServerClient,
  userId: string,
): Promise<{ rows: RequestRow[]; failed: boolean }> {
  const { data, error } = await supabase
    .from("mentorship_requests")
    .select(
      `id, status, created_at, responded_at, mentee_id, mentor_id,
       mentee:profiles!mentorship_requests_mentee_id_fkey(full_name),
       mentor:profiles!mentorship_requests_mentor_id_fkey(full_name),
       unread:mentorship_messages(count)`,
    )
    .or(`mentee_id.eq.${userId},mentor_id.eq.${userId}`)
    // Mesma regra de loadUnreadCounts: mensagens da OUTRA pessoa ainda não lidas.
    .is("unread.read_at", null)
    .neq("unread.sender_id", userId)
    .order("created_at", { ascending: false })
    .limit(PAINEL_LIMITS.requests);

  if (error) {
    warn("pedidos de mentoria", error);
    return { rows: [], failed: true };
  }

  return {
    failed: false,
    rows: (data ?? []).map((row) => {
      const role = row.mentee_id === userId ? "mentee" : "mentor";
      return {
        id: row.id,
        status: row.status,
        createdAt: row.created_at,
        respondedAt: row.responded_at,
        role,
        otherName: personName(role === "mentee" ? row.mentor : row.mentee),
        unread: embeddedCount(row.unread),
      };
    }),
  };
}

// ---------------------------------------------------------------------------
// 3. Perguntas sem resposta
// ---------------------------------------------------------------------------

async function loadQuestionCandidates(
  supabase: ServerClient,
  userId: string,
  now: number,
): Promise<{ threads: QuestionThread[]; failed: boolean }> {
  const { data, error } = await supabase
    .from("forum_threads")
    .select(
      `id, title, body, tags, is_anonymous, is_locked, reply_count, created_at, author_id,
       author:profiles!forum_threads_author_id_fkey(full_name),
       category:forum_categories!forum_threads_category_id_fkey!inner(name)`,
    )
    // Categorias de acolhimento (as que aceitam anonimato: apoio, maternidade, saúde mental) ficam
    // fora: um relato pessoal não vira "pergunta rápida" na página inicial de todo mundo.
    .eq("category.allow_anonymous", false)
    .eq("reply_count", 0)
    .eq("is_locked", false)
    .gte("created_at", sinceIso(QUESTIONS_MAX_AGE_DAYS, now))
    // Anônimos têm author_id NULL: "<> eu" sozinho os descartaria (NULL nunca é diferente).
    .or(`author_id.is.null,author_id.neq.${userId}`)
    .order("created_at", { ascending: false })
    .limit(PAINEL_LIMITS.questions);

  if (error) {
    warn("perguntas sem resposta", error);
    return { threads: [], failed: true };
  }

  return {
    failed: false,
    threads: (data ?? []).map((row) => ({
      id: row.id,
      title: row.title,
      body: row.body,
      tags: row.tags ?? [],
      isAnonymous: row.is_anonymous,
      authorId: row.is_anonymous ? null : row.author_id,
      authorName: row.is_anonymous ? null : personName(row.author),
      categoryName: row.category?.name ?? null,
      isLocked: row.is_locked,
      replyCount: row.reply_count,
      createdAt: row.created_at,
    })),
  };
}

// ---------------------------------------------------------------------------
// 4–6. Novidades da semana
// ---------------------------------------------------------------------------

export interface PaperRow {
  id: string;
  title: string;
  areaId: number | null;
  areaName: string | null;
  voteCount: number;
  createdAt: string;
}

async function loadNewPapers(
  supabase: ServerClient,
  now: number,
): Promise<{ rows: PaperRow[]; failed: boolean }> {
  const { data, error } = await supabase
    .from("papers")
    .select("id, title, area_id, vote_count, created_at, area:research_areas(name)")
    .eq("is_hidden", false)
    .gte("created_at", sinceIso(NEW_PAPER_DAYS, now))
    .order("vote_count", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(PAINEL_LIMITS.papers);
  if (error) {
    warn("papers da semana", error);
    return { rows: [], failed: true };
  }
  return {
    failed: false,
    rows: (data ?? []).map((p) => ({
      id: p.id,
      title: p.title,
      areaId: p.area_id,
      areaName: p.area?.name ?? null,
      voteCount: p.vote_count,
      createdAt: p.created_at,
    })),
  };
}

export interface MemberRow {
  id: string;
  fullName: string;
  avatarUrl: string | null;
  headline: string | null;
  areaIds: number[];
}

async function loadNewMembers(
  supabase: ServerClient,
  userId: string,
  now: number,
): Promise<{ rows: MemberRow[]; failed: boolean }> {
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, full_name, avatar_url, headline, onboarded_at, areas:profile_research_areas(area_id)",
    )
    .gte("onboarded_at", sinceIso(NEW_MEMBER_DAYS, now))
    .neq("id", userId)
    .order("onboarded_at", { ascending: false })
    .limit(PAINEL_LIMITS.members);
  if (error) {
    warn("novas na rede", error);
    return { rows: [], failed: true };
  }
  return {
    failed: false,
    rows: (data ?? []).map((m) => ({
      id: m.id,
      fullName: m.full_name?.trim() || "Pesquisadora",
      avatarUrl: m.avatar_url,
      headline: m.headline,
      areaIds: (m.areas ?? []).map((a) => Number(a.area_id)),
    })),
  };
}

async function loadLatestEdition(
  supabase: ServerClient,
): Promise<{ edition: LatestEdition | null; failed: boolean }> {
  const { data, error } = await supabase
    .from("newsletter_editions")
    .select("slug, title, summary, published_at")
    // Admins enxergam rascunhos pelo RLS: aqui só o que já é público.
    .in("status", ["published", "sent"])
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    warn("boletim", error);
    return { edition: null, failed: true };
  }
  return {
    failed: false,
    edition: data
      ? {
          slug: data.slug,
          title: data.title,
          summary: data.summary,
          publishedAt: data.published_at,
        }
      : null,
  };
}

// ---------------------------------------------------------------------------
// Montagem (pura: exportada para testes)
// ---------------------------------------------------------------------------

export function buildWaiting(requests: readonly RequestRow[], unreadNotifications: number) {
  const conversations = requests
    .filter(
      (r) => r.unread > 0 && hasConversation({ status: r.status, responded_at: r.respondedAt }),
    )
    .sort((a, b) => b.unread - a.unread)
    .slice(0, PAINEL_LIMITS.shownConversations)
    .map((r) => ({ requestId: r.id, name: r.otherName, unread: r.unread }));

  const received = requests.filter((r) => r.role === "mentor" && r.status === "pending");
  const oldestReceived = received.reduce<string | null>(
    (oldest, r) => (oldest === null || r.createdAt < oldest ? r.createdAt : oldest),
    null,
  );

  const sent = requests
    .filter((r) => r.role === "mentee" && r.status === "pending")
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  return {
    conversations,
    pendingReceived: { count: received.length, oldestAt: oldestReceived },
    pendingSent: sent.slice(0, PAINEL_LIMITS.shownPendingSent).map((r) => ({
      requestId: r.id,
      mentorName: r.otherName,
      createdAt: r.createdAt,
    })),
    pendingSentTotal: sent.length,
    unreadNotifications,
  } satisfies WaitingData;
}

export function buildNews(
  papers: readonly PaperRow[],
  members: readonly MemberRow[],
  myAreaIds: readonly number[],
  areaNames: ReadonlyMap<number, string>,
  edition: LatestEdition | null,
): NewsData {
  const mine = new Set(myAreaIds);
  const inArea = papers.filter((p) => p.areaId !== null && mine.has(p.areaId));
  const papersMode = inArea.length > 0 ? "area" : "votes";
  const chosenPapers = (papersMode === "area" ? inArea : papers)
    .slice(0, PAINEL_LIMITS.shownPapers)
    .map((p) => ({
      id: p.id,
      title: p.title,
      areaName: p.areaName,
      voteCount: p.voteCount,
      inMyArea: p.areaId !== null && mine.has(p.areaId),
    }));

  // Quem chegou e divide uma área com ela vem primeiro; as demais completam a lista.
  const withShared = members.map((m) => {
    const shared = m.areaIds.find((id) => mine.has(id));
    return { member: m, sharedArea: shared !== undefined ? (areaNames.get(shared) ?? null) : null };
  });
  const ordered = [
    ...withShared.filter((m) => m.sharedArea !== null),
    ...withShared.filter((m) => m.sharedArea === null),
  ];

  return {
    papers: chosenPapers,
    papersMode,
    members: ordered.slice(0, PAINEL_LIMITS.shownMembers).map(({ member, sharedArea }) => ({
      id: member.id,
      fullName: member.fullName,
      avatarUrl: member.avatarUrl,
      headline: member.headline,
      sharedArea,
    })),
    edition,
  };
}

export async function loadPainelData(profile: Profile, now = Date.now()): Promise<PainelData> {
  const supabase = await createClient();

  const [self, requests, candidates, papers, members, edition] = await Promise.all([
    loadSelf(supabase, profile.id, now),
    loadRequests(supabase, profile.id),
    loadQuestionCandidates(supabase, profile.id, now),
    loadNewPapers(supabase, now),
    loadNewMembers(supabase, profile.id, now),
    loadLatestEdition(supabase),
  ]);

  const rows = requests.rows;
  const activeAsMentee = rows.find((r) => r.role === "mentee" && r.status === "accepted");

  const steps: NextStepsInput = {
    isMentor: profile.is_mentor,
    seeksMentorship: profile.seeks_mentorship,
    headline: profile.headline,
    areaCount: self.data.areaIds.length,
    keywordCount: profile.keywords.length,
    mentoringOffer: profile.mentoring_offer,
    mentorshipTopicCount: profile.mentorship_topics.length,
    mentorAvailable: profile.mentor_available,
    mentorCapacity: profile.mentor_capacity,
    hasIntroThread: self.data.hasIntroThread,
    suggestionCount: self.data.suggestionCount,
    requestsAsMentee: rows.filter((r) => r.role === "mentee").length,
    activeMenteeRequestId: activeAsMentee?.id ?? null,
    activeMentorFirstName: activeAsMentee?.otherName.split(/\s+/)[0] ?? null,
    sentMessageCount: self.data.sentMessageCount,
    pendingReceivedCount: rows.filter((r) => r.role === "mentor" && r.status === "pending").length,
    repliedRecently: self.data.repliedRecently,
    submittedPaperCount: self.data.submittedPaperCount,
    votedPaperCount: self.data.votedPaperCount,
  };

  const questions = rankQuestionsForMember(
    candidates.threads,
    {
      id: profile.id,
      keywords: profile.keywords,
      areaNames: self.data.areaNames,
      mentorshipTopics: profile.mentorship_topics,
      ownAnonymousThreadIds: self.data.ownAnonymousThreadIds,
    },
    { now },
  );

  const areaNames = new Map(self.data.areaIds.map((id, i) => [id, self.data.areaNames[i]!]));

  return {
    now,
    steps,
    stepsFailed: self.failed || requests.failed,
    waiting: buildWaiting(rows, self.data.unreadNotifications),
    waitingFailed: requests.failed || self.failed,
    questions,
    questionsFailed: candidates.failed,
    news: {
      ...buildNews(papers.rows, members.rows, self.data.areaIds, areaNames, edition.edition),
      sectionsFailed: { papers: papers.failed, members: members.failed, edition: edition.failed },
    },
    newsFailed: papers.failed && members.failed && edition.failed,
  };
}
