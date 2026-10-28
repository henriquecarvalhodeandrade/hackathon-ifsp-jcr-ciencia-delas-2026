import "server-only";
import type { User } from "@supabase/supabase-js";
import { isAdminConfigured } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  buildDataExport,
  type DataExport,
  type ExportNewsletterSource,
  type ExportSources,
} from "./export";

/**
 * Consultas do "Baixar meus dados". Tudo com o cliente da SESSÃO da usuária: o RLS limita cada
 * tabela ao que ela pode ver, e os filtros por id dela restringem ao que é DELA. A única exceção
 * é a newsletter (tabela sem acesso pela API): lida com o cliente admin, e só pelo e-mail da
 * própria conta. Qualquer erro de consulta derruba a exportação inteira — melhor avisar do que
 * entregar um arquivo incompleto como se estivesse completo.
 */

export class ExportQueryError extends Error {
  constructor(
    readonly section: string,
    readonly code: string | undefined,
  ) {
    super(`Falha ao exportar "${section}" (${code ?? "sem código"})`);
    this.name = "ExportQueryError";
  }
}

type DbResult<T> = { data: T | null; error: { code?: string } | null };

function ok<T>(section: string, result: DbResult<T>): T {
  if (result.error) throw new ExportQueryError(section, result.error.code);
  return result.data as T;
}

/** PostgREST devolve no máximo `max_rows` (1000) por resposta: pagina até acabar. */
const PAGE = 1000;
const MAX_ROWS = 50_000;

async function all<T>(
  section: string,
  page: (from: number, to: number) => PromiseLike<DbResult<T[]>>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; from < MAX_ROWS; from += PAGE) {
    const data = ok(section, await page(from, from + PAGE - 1)) ?? [];
    rows.push(...data);
    if (data.length < PAGE) break;
  }
  return rows;
}

const IN_CHUNK = 100;

function chunks<T>(items: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += IN_CHUNK) out.push(items.slice(i, i + IN_CHUNK));
  return out;
}

const THREAD_COLUMNS =
  "id, category_id, title, body, tags, is_anonymous, is_pinned, is_locked, solution_post_id, reply_count, created_at, updated_at, edited_at, category:forum_categories(slug, name)";
const POST_COLUMNS = "id, thread_id, body, is_anonymous, created_at, updated_at, edited_at";

async function loadNewsletter(email: string | null | undefined): Promise<ExportNewsletterSource> {
  if (!isAdminConfigured()) return { available: false };
  if (!email) return { available: true, subscription: null };
  const admin = createAdminClient();
  const result = await admin
    .from("newsletter_subscribers")
    .select(
      "email, status, area_ids, consent_text, consented_at, confirmed_at, unsubscribed_at, created_at, updated_at",
    )
    // citext: a comparação já ignora maiúsculas.
    .eq("email", email)
    .maybeSingle();
  return { available: true, subscription: ok("newsletter", result) };
}

export async function loadMyDataExport(user: User, now: Date = new Date()): Promise<DataExport> {
  const supabase = await createClient();
  const uid = user.id;

  const [
    profile,
    areaRows,
    mentorshipRequests,
    suggestions,
    anonymousAuthorship,
    namedThreads,
    namedPosts,
    reactions,
    papers,
    votes,
    comments,
    notifications,
    reports,
    feedback,
    publicAnswers,
    newsletter,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "id, full_name, pronouns, headline, bio, avatar_url, career_stage, institution, city, state, keywords, lattes_url, orcid, linkedin_url, website_url, seeks_mentorship, mentoring_goals, is_mentor, mentor_available, mentor_capacity, mentoring_offer, mentorship_topics, meeting_formats, languages, trajectory_tags, role, ai_consent, ai_consent_at, onboarded_at, created_at, updated_at",
      )
      .eq("id", uid)
      .maybeSingle()
      .then((r) => ok("perfil", r)),
    supabase
      .from("profile_research_areas")
      .select("area:research_areas(id, slug, name, big_area)")
      .eq("profile_id", uid)
      .then((r) => ok("areas_de_pesquisa", r) ?? []),
    all("mentoria", (from, to) =>
      supabase
        .from("mentorship_requests")
        .select(
          "id, status, message, response_message, match_score, match_reason, created_at, updated_at, responded_at, completed_at, mentee_id, mentor_id, mentee:profiles!mentorship_requests_mentee_id_fkey(id, full_name), mentor:profiles!mentorship_requests_mentor_id_fkey(id, full_name)",
        )
        .or(`mentee_id.eq.${uid},mentor_id.eq.${uid}`)
        .order("created_at")
        .order("id")
        .range(from, to),
    ),
    all("sugestoes_salvas", (from, to) =>
      supabase
        .from("mentor_suggestions")
        .select(
          "mentor_id, score, rank, reason, conversation_starters, source, model, created_at, mentor:profiles!mentor_suggestions_mentor_id_fkey(id, full_name)",
        )
        .eq("mentee_id", uid)
        .order("rank")
        .order("mentor_id")
        .range(from, to),
    ),
    all("autoria_anonima", (from, to) =>
      supabase
        .from("forum_anonymous_authorship")
        .select("thread_id, post_id")
        .eq("user_id", uid)
        .order("id")
        .range(from, to),
    ),
    all("topicos", (from, to) =>
      supabase
        .from("forum_threads")
        .select(THREAD_COLUMNS)
        .eq("author_id", uid)
        .order("created_at")
        .order("id")
        .range(from, to),
    ),
    all("respostas", (from, to) =>
      supabase
        .from("forum_posts")
        .select(POST_COLUMNS)
        .eq("author_id", uid)
        .order("created_at")
        .order("id")
        .range(from, to),
    ),
    all("reacoes", (from, to) =>
      supabase
        .from("forum_reactions")
        .select("kind, thread_id, post_id, created_at")
        .eq("user_id", uid)
        .order("id")
        .range(from, to),
    ),
    all("papers", (from, to) =>
      supabase
        .from("papers")
        .select(
          "id, title, authors, abstract, venue, year, doi, url, area_id, keywords, submitter_relation, women_authorship_confirmed, plain_summary, plain_summary_source, vote_count, comment_count, is_hidden, created_at, updated_at, area:research_areas(slug, name)",
        )
        .eq("submitted_by", uid)
        .order("created_at")
        .order("id")
        .range(from, to),
    ),
    all("destaques", (from, to) =>
      supabase
        .from("paper_votes")
        .select("paper_id, created_at, paper:papers(title)")
        .eq("user_id", uid)
        .order("created_at")
        .order("paper_id")
        .range(from, to),
    ),
    all("comentarios", (from, to) =>
      supabase
        .from("paper_comments")
        .select("id, paper_id, body, created_at, updated_at")
        .eq("author_id", uid)
        .order("created_at")
        .order("id")
        .range(from, to),
    ),
    all("notificacoes", (from, to) =>
      supabase
        .from("notifications")
        .select("id, type, title, body, link, read_at, created_at")
        .eq("user_id", uid)
        .order("created_at")
        .order("id")
        .range(from, to),
    ),
    all("denuncias", (from, to) =>
      supabase
        .from("reports")
        .select("id, target_type, target_id, reason, details, status, created_at, resolved_at")
        .eq("reporter_id", uid)
        .order("created_at")
        .order("id")
        .range(from, to),
    ),
    // Retornos da mentoria: só os que ELA escreveu (o RLS também só devolve os da autora).
    all("retornos_de_mentoria", (from, to) =>
      supabase
        .from("mentorship_feedback")
        .select(
          "request_id, author_id, role, helpfulness, outcomes, would_recommend, note, created_at",
        )
        .eq("author_id", uid)
        .order("created_at")
        .order("id")
        .range(from, to),
    ),
    // Pergunte a uma cientista: as respostas que ELA escreveu. Sem hidden_by (o GRANT por coluna
    // nem deixa ler). As perguntas não têm autora: não há o que buscar do lado delas.
    all("respostas_pergunte_a_uma_cientista", (from, to) =>
      supabase
        .from("public_answers")
        .select("id, question_id, author_id, body, show_identity, is_hidden, hidden_at, created_at")
        .eq("author_id", uid)
        .order("created_at")
        .order("id")
        .range(from, to),
    ),
    loadNewsletter(user.email),
  ]);

  // Conversas da mentoria: pelos ids dos pedidos DELA (o RLS também só mostra às participantes).
  const messageChunks = await Promise.all(
    chunks(mentorshipRequests.map((r) => r.id)).map((ids) =>
      all("mensagens_da_mentoria", (from, to) =>
        supabase
          .from("mentorship_messages")
          .select("id, request_id, sender_id, body, created_at, read_at")
          .in("request_id", ids)
          .order("created_at")
          .order("id")
          .range(from, to),
      ),
    ),
  );

  // Declarações de participação: pelos ids dos pedidos DELA (o RLS só mostra às participantes).
  const declarationChunks = await Promise.all(
    chunks(mentorshipRequests.map((r) => r.id)).map((ids) =>
      all("declaracoes_de_mentoria", (from, to) =>
        supabase
          .from("mentorship_declarations")
          .select(
            "request_id, code, mentee_consented_at, mentor_consented_at, issued_at, revoked_at, revoke_reason",
          )
          .in("request_id", ids)
          .order("created_at")
          .order("id")
          .range(from, to),
      ),
    ),
  );

  // Publicações anônimas: author_id é NULL, então vêm pelos ids da autoria (só as dela, pelo RLS).
  const anonThreadIds = anonymousAuthorship.flatMap((row) =>
    row.thread_id ? [row.thread_id] : [],
  );
  const anonPostIds = anonymousAuthorship.flatMap((row) => (row.post_id ? [row.post_id] : []));
  const [anonThreads, anonPosts] = await Promise.all([
    Promise.all(
      chunks(anonThreadIds).map((ids) =>
        supabase
          .from("forum_threads")
          .select(THREAD_COLUMNS)
          .in("id", ids)
          .then((r) => ok("topicos_anonimos", r) ?? []),
      ),
    ),
    Promise.all(
      chunks(anonPostIds).map((ids) =>
        supabase
          .from("forum_posts")
          .select(POST_COLUMNS)
          .in("id", ids)
          .then((r) => ok("respostas_anonimas", r) ?? []),
      ),
    ),
  ]);

  const sources: ExportSources = {
    generatedAt: now,
    account: {
      id: uid,
      email: user.email ?? null,
      created_at: user.created_at ?? null,
      email_confirmed_at: user.email_confirmed_at ?? null,
      last_sign_in_at: user.last_sign_in_at ?? null,
    },
    profile,
    areas: areaRows.flatMap((row) => (row.area ? [row.area] : [])),
    mentorshipRequests,
    messages: messageChunks.flat(),
    feedback,
    declarations: declarationChunks.flat(),
    publicAnswers,
    suggestions,
    threads: [...namedThreads, ...anonThreads.flat()],
    posts: [...namedPosts, ...anonPosts.flat()],
    anonymousAuthorship,
    reactions,
    papers,
    votes,
    comments,
    notifications,
    reports,
    newsletter,
  };
  return buildDataExport(sources);
}
