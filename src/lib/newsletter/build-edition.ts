import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { EDITION_LIMITS } from "./constants";
import type { NewsletterContent } from "./content";
import {
  rankPapersByWindowVotes,
  rankThreadsByActivity,
  toNewsletterMentor,
  toNewsletterPaper,
  toNewsletterThread,
  type PaperCandidate,
  type ThreadCandidate,
} from "./select";

/**
 * Coleta os destaques de uma janela [start, end) com o cliente ADMIN (service role) — a edição é
 * montada por uma rotina do servidor, não por uma usuária. Só dados públicos entram no conteúdo:
 * títulos/autoras de papers (já públicos na Vitrine), títulos de conversas de categorias SEM
 * anonimato, nome + headline de mentoras e contagens agregadas.
 */

type AdminClient = SupabaseClient<Database>;

export interface EditionWindow {
  start: Date;
  end: Date;
}

const PAPER_COLUMNS =
  "id, title, authors, plain_summary, vote_count, created_at, area_id, area:research_areas(name)";

function fail(what: string, error: { message: string } | null): never {
  throw new Error(
    `Falha ao buscar ${what} para a newsletter: ${error?.message ?? "erro desconhecido"}`,
  );
}

type PaperRow = {
  id: string;
  title: string;
  authors: string[];
  plain_summary: string | null;
  vote_count: number;
  created_at: string;
  area_id: number | null;
  area: { name: string } | null;
};

function toCandidate(row: PaperRow): PaperCandidate {
  return {
    id: row.id,
    title: row.title,
    authors: row.authors ?? [],
    plain_summary: row.plain_summary,
    vote_count: row.vote_count,
    created_at: row.created_at,
    area_id: row.area_id,
    area_name: row.area?.name ?? null,
  };
}

async function collectPapers(admin: AdminClient, startIso: string, endIso: string) {
  const { data: votes, error: votesError } = await admin
    .from("paper_votes")
    .select("paper_id")
    .gte("created_at", startIso)
    .lt("created_at", endIso)
    .limit(10_000);
  if (votesError) fail("votos", votesError);

  const votedIds = [...new Set((votes ?? []).map((v) => v.paper_id))];
  let ranked: PaperCandidate[] = [];
  if (votedIds.length) {
    const { data, error } = await admin
      .from("papers")
      .select(PAPER_COLUMNS)
      .in("id", votedIds.slice(0, 500))
      .eq("is_hidden", false);
    if (error) fail("papers", error);
    ranked = rankPapersByWindowVotes(
      votes ?? [],
      ((data ?? []) as PaperRow[]).map(toCandidate),
      EDITION_LIMITS.papers,
    );
  }

  // Semana sem destaques: mostra as novidades da Vitrine (papers indicados na janela).
  if (ranked.length === 0) {
    const { data, error } = await admin
      .from("papers")
      .select(PAPER_COLUMNS)
      .eq("is_hidden", false)
      .gte("created_at", startIso)
      .lt("created_at", endIso)
      .order("created_at", { ascending: false })
      .limit(3);
    if (error) fail("papers novos", error);
    ranked = ((data ?? []) as PaperRow[]).map(toCandidate);
  }
  return ranked.map(toNewsletterPaper);
}

async function collectThreads(
  admin: AdminClient,
  window: EditionWindow,
  startIso: string,
  endIso: string,
) {
  const [posts, reactions, created] = await Promise.all([
    admin
      .from("forum_posts")
      .select("thread_id")
      .gte("created_at", startIso)
      .lt("created_at", endIso)
      .limit(10_000),
    admin
      .from("forum_reactions")
      .select("thread_id, post_id")
      .gte("created_at", startIso)
      .lt("created_at", endIso)
      .limit(10_000),
    admin
      .from("forum_threads")
      .select("id")
      .gte("created_at", startIso)
      .lt("created_at", endIso)
      .limit(1_000),
  ]);
  if (posts.error) fail("respostas do fórum", posts.error);
  if (reactions.error) fail("reações do fórum", reactions.error);
  if (created.error) fail("tópicos do fórum", created.error);

  const postThreadIds = (posts.data ?? []).map((p) => p.thread_id);
  const reactionThreadIds = (reactions.data ?? []).flatMap((r) =>
    r.thread_id ? [r.thread_id] : [],
  );

  // Reações em respostas contam para o tópico da resposta.
  const reactedPostIds = [
    ...new Set((reactions.data ?? []).flatMap((r) => (r.post_id ? [r.post_id] : []))),
  ];
  if (reactedPostIds.length) {
    const { data, error } = await admin
      .from("forum_posts")
      .select("id, thread_id")
      .in("id", reactedPostIds.slice(0, 1_000));
    if (error) fail("respostas reagidas", error);
    const threadOf = new Map((data ?? []).map((p) => [p.id, p.thread_id]));
    for (const r of reactions.data ?? []) {
      const threadId = r.post_id ? threadOf.get(r.post_id) : undefined;
      if (threadId) reactionThreadIds.push(threadId);
    }
  }

  const candidateIds = [
    ...new Set([...postThreadIds, ...reactionThreadIds, ...(created.data ?? []).map((t) => t.id)]),
  ];
  if (candidateIds.length === 0) return [];

  const { data, error } = await admin
    .from("forum_threads")
    .select(
      "id, title, reply_count, created_at, is_anonymous, category:forum_categories(name, allow_anonymous)",
    )
    .in("id", candidateIds.slice(0, 500));
  if (error) fail("tópicos", error);

  const threads: ThreadCandidate[] = (data ?? []).map((t) => ({
    id: t.id,
    title: t.title,
    reply_count: t.reply_count,
    created_at: t.created_at,
    is_anonymous: t.is_anonymous,
    category_name: t.category?.name ?? null,
    // Sem categoria conhecida → tratamos como sensível (fica de fora).
    category_allows_anonymous: t.category?.allow_anonymous ?? true,
  }));

  return rankThreadsByActivity({
    threads,
    postThreadIds,
    reactionThreadIds,
    windowStart: window.start,
    limit: EDITION_LIMITS.threads,
  }).map(toNewsletterThread);
}

async function collectMentors(admin: AdminClient, startIso: string, endIso: string) {
  const base = () =>
    admin
      .from("profiles")
      .select("id, full_name, headline")
      .eq("is_mentor", true)
      .eq("mentor_available", true)
      .not("onboarded_at", "is", null)
      .neq("full_name", "");

  const { data: fresh, error } = await base()
    .gte("onboarded_at", startIso)
    .lt("onboarded_at", endIso)
    .order("onboarded_at", { ascending: false })
    .limit(EDITION_LIMITS.mentors);
  if (error) fail("novas mentoras", error);
  if (fresh?.length) return fresh.map(toNewsletterMentor);

  // Nenhuma mentora nova: apresenta mentoras disponíveis que chegaram mais recentemente.
  const { data: available, error: availableError } = await base()
    .lt("onboarded_at", endIso)
    .order("onboarded_at", { ascending: false })
    .limit(3);
  if (availableError) fail("mentoras disponíveis", availableError);
  return (available ?? []).map(toNewsletterMentor);
}

async function collectStats(admin: AdminClient, startIso: string, endIso: string) {
  const [members, papers, mentorships] = await Promise.all([
    admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .gte("onboarded_at", startIso)
      .lt("onboarded_at", endIso),
    admin
      .from("papers")
      .select("id", { count: "exact", head: true })
      .eq("is_hidden", false)
      .gte("created_at", startIso)
      .lt("created_at", endIso),
    admin
      .from("mentorship_requests")
      .select("id", { count: "exact", head: true })
      .in("status", ["accepted", "completed"])
      .gte("responded_at", startIso)
      .lt("responded_at", endIso),
  ]);
  if (members.error) fail("novas integrantes", members.error);
  if (papers.error) fail("novos papers", papers.error);
  if (mentorships.error) fail("mentorias", mentorships.error);
  return {
    new_members: members.count ?? 0,
    new_papers: papers.count ?? 0,
    mentorships: mentorships.count ?? 0,
  };
}

/** Monta o `content` (CONTRACT §9) da janela informada. Lança Error em falha de consulta. */
export async function collectEditionContent(
  admin: AdminClient,
  window: EditionWindow,
): Promise<NewsletterContent> {
  const startIso = window.start.toISOString();
  const endIso = window.end.toISOString();
  const [papers, threads, mentors, stats] = await Promise.all([
    collectPapers(admin, startIso, endIso),
    collectThreads(admin, window, startIso, endIso),
    collectMentors(admin, startIso, endIso),
    collectStats(admin, startIso, endIso),
  ]);
  return { papers, threads, mentors, stats };
}
