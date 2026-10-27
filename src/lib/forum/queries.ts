import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { REACTION_KIND_VALUES, type ReactionKindValue } from "./schema";
import {
  emptyReactionCounts,
  type ForumCategory,
  type ForumCategoryWithCount,
  type ReactionCounts,
  type ReactionState,
  type PostView,
  type ThreadDetail,
  type ThreadListItem,
  type ThreadView,
} from "./types";
import { FORUM_PAGE_SIZE, markdownToPlainText, pageRange } from "./text";

/*
 * Leituras do fórum (Server Components). Tudo passa pelo RLS com a sessão da usuária:
 * o fórum é só para membros, então estas funções assumem login (as páginas chamam
 * requireOnboardedProfile antes).
 *
 * Anonimato: tópicos/respostas anônimos chegam com author_id = NULL. Para mostrar o
 * selo "você" na PRÓPRIA autoria anônima, lemos forum_anonymous_authorship filtrando
 * explicitamente user_id = viewer (moderadoras enxergam todas as linhas pelo RLS — sem o
 * filtro elas veriam "você" em conteúdo alheio).
 */

const THREAD_LIST_SELECT =
  "id, title, body, tags, is_anonymous, is_pinned, is_locked, solution_post_id, reply_count, last_activity_at, created_at, author:profiles!forum_threads_author_id_fkey(id, full_name, avatar_url, headline), category:forum_categories!forum_threads_category_id_fkey(id, slug, name, icon, allow_anonymous)";

/** Máximo de respostas carregadas por tópico (o hackathon não precisa paginar respostas). */
export const MAX_POSTS_PER_THREAD = 500;

function isReactionKind(value: unknown): value is ReactionKindValue {
  return typeof value === "string" && (REACTION_KIND_VALUES as readonly string[]).includes(value);
}

/** Categorias em ordem, com o número de tópicos (embed `forum_threads(count)`). */
export const getForumCategories = cache(async (): Promise<ForumCategoryWithCount[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("forum_categories")
    .select("*, forum_threads(count)")
    .order("sort_order")
    .order("name");
  if (error)
    throw new Error(`Não foi possível carregar as categorias do fórum (${error.code ?? "erro"}).`);
  return (data ?? []).map(({ forum_threads, ...category }) => ({
    ...category,
    threadCount: forum_threads?.[0]?.count ?? 0,
  }));
});

/** Só as categorias (sem contagem) — formulários. */
export const getCategoryOptions = cache(async (): Promise<ForumCategory[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("forum_categories")
    .select("*")
    .order("sort_order")
    .order("name");
  if (error)
    throw new Error(`Não foi possível carregar as categorias do fórum (${error.code ?? "erro"}).`);
  return data ?? [];
});

export const getCategoryBySlug = cache(async (slug: string): Promise<ForumCategory | null> => {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) || slug.length > 60) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("forum_categories")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  return data ?? null;
});

export type ListThreadsOptions = {
  viewerId: string;
  categoryId?: number;
  /** Termo já sanitizado (sanitizeSearchTerm). Busca em título e corpo. */
  q?: string;
  /** Tag já sanitizada (sanitizeTag). */
  tag?: string;
  /** true = só fixados · false = só não fixados · undefined = todos (fixados primeiro). */
  pinned?: boolean;
  page?: number;
  pageSize?: number;
};

export async function listThreads(
  opts: ListThreadsOptions,
): Promise<{ items: ThreadListItem[]; total: number }> {
  const supabase = await createClient();
  const pageSize = opts.pageSize ?? FORUM_PAGE_SIZE;
  const { from, to } = pageRange(opts.page ?? 1, pageSize);

  let query = supabase.from("forum_threads").select(THREAD_LIST_SELECT, { count: "exact" });
  if (opts.categoryId) query = query.eq("category_id", opts.categoryId);
  if (opts.pinned !== undefined) query = query.eq("is_pinned", opts.pinned);
  if (opts.tag) query = query.contains("tags", [opts.tag]);
  if (opts.q) query = query.or(`title.ilike.%${opts.q}%,body.ilike.%${opts.q}%`);

  const { data, count, error } = await query
    .order("is_pinned", { ascending: false })
    .order("last_activity_at", { ascending: false })
    .order("id")
    .range(from, to);

  if (error) {
    // Página além do fim (PGRST103) = lista vazia, não erro.
    if (error.code === "PGRST103") return { items: [], total: count ?? 0 };
    throw new Error(`Não foi possível carregar os tópicos (${error.code ?? "erro"}).`);
  }
  const rows = data ?? [];
  if (rows.length === 0) return { items: [], total: count ?? 0 };

  const ids = rows.map((r) => r.id);
  const anonIds = rows.filter((r) => r.is_anonymous).map((r) => r.id);

  const [countsRes, ownRes] = await Promise.all([
    supabase
      .from("forum_thread_reaction_counts")
      .select("thread_id, kind, total")
      .in("thread_id", ids),
    anonIds.length > 0
      ? supabase
          .from("forum_anonymous_authorship")
          .select("thread_id")
          .eq("user_id", opts.viewerId)
          .in("thread_id", anonIds)
      : Promise.resolve({ data: [] as { thread_id: string | null }[], error: null }),
  ]);

  const reactions = new Map<string, ReactionCounts>();
  for (const row of countsRes.data ?? []) {
    if (!row.thread_id || !isReactionKind(row.kind)) continue;
    const entry = reactions.get(row.thread_id) ?? emptyReactionCounts();
    entry[row.kind] += row.total ?? 0;
    reactions.set(row.thread_id, entry);
  }
  const own = new Set((ownRes.data ?? []).map((r) => r.thread_id).filter(Boolean));

  const items = rows.map<ThreadListItem>((row) => ({
    id: row.id,
    title: row.title,
    tags: row.tags,
    excerpt: markdownToPlainText(row.body).slice(0, 400),
    isAnonymous: row.is_anonymous,
    isPinned: row.is_pinned,
    isLocked: row.is_locked,
    isSolved: row.solution_post_id !== null,
    replyCount: row.reply_count,
    lastActivityAt: row.last_activity_at,
    createdAt: row.created_at,
    author: row.is_anonymous ? null : (row.author ?? null),
    category: row.category ?? null,
    reactions: reactions.get(row.id) ?? emptyReactionCounts(),
    isOwnAnonymous: own.has(row.id),
  }));

  return { items, total: count ?? items.length };
}

/** Dados mínimos do tópico (título/categoria) — metadados e checagens. Memoizado por requisição. */
export const getThreadSummary = cache(async (id: string) => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("forum_threads")
    .select(
      "id, title, body, is_anonymous, author_id, category:forum_categories!forum_threads_category_id_fkey(slug, name)",
    )
    .eq("id", id)
    .maybeSingle();
  return data ?? null;
});

/** Tópico completo com respostas, reações e autoria da usuária atual. */
export async function getThreadDetail(id: string, viewerId: string): Promise<ThreadDetail | null> {
  const supabase = await createClient();

  const [threadRes, postsRes] = await Promise.all([
    supabase
      .from("forum_threads")
      .select(
        "id, title, body, tags, is_anonymous, is_pinned, is_locked, solution_post_id, reply_count, created_at, edited_at, last_activity_at, author_id, author:profiles!forum_threads_author_id_fkey(id, full_name, avatar_url, headline), category:forum_categories!forum_threads_category_id_fkey(id, slug, name, icon, allow_anonymous)",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("forum_posts")
      .select(
        "id, body, is_anonymous, created_at, edited_at, author_id, author:profiles!forum_posts_author_id_fkey(id, full_name, avatar_url, headline)",
      )
      .eq("thread_id", id)
      .order("created_at")
      .order("id")
      .limit(MAX_POSTS_PER_THREAD),
  ]);

  if (threadRes.error)
    throw new Error(`Não foi possível carregar o tópico (${threadRes.error.code ?? "erro"}).`);
  const row = threadRes.data;
  if (!row || !row.category) return null;
  if (postsRes.error)
    throw new Error(`Não foi possível carregar as respostas (${postsRes.error.code ?? "erro"}).`);
  const postRows = postsRes.data ?? [];

  const [threadReactionsRes, postReactionsRes, ownAnonRes] = await Promise.all([
    supabase.from("forum_reactions").select("kind, user_id").eq("thread_id", id),
    postRows.length > 0
      ? supabase
          .from("forum_reactions")
          .select("post_id, kind, user_id, post:forum_posts!inner(thread_id)")
          .eq("post.thread_id", id)
      : Promise.resolve({
          data: [] as { post_id: string | null; kind: string; user_id: string }[],
          error: null,
        }),
    supabase
      .from("forum_anonymous_authorship")
      .select("thread_id, post_id")
      .eq("user_id", viewerId),
  ]);

  const threadReactions: ReactionState = { counts: emptyReactionCounts(), mine: [] };
  for (const r of threadReactionsRes.data ?? []) {
    if (!isReactionKind(r.kind)) continue;
    threadReactions.counts[r.kind] += 1;
    if (r.user_id === viewerId) threadReactions.mine.push(r.kind);
  }

  const postReactions = new Map<string, ReactionState>();
  for (const r of postReactionsRes.data ?? []) {
    if (!r.post_id || !isReactionKind(r.kind)) continue;
    const entry = postReactions.get(r.post_id) ?? { counts: emptyReactionCounts(), mine: [] };
    entry.counts[r.kind] += 1;
    if (r.user_id === viewerId) entry.mine.push(r.kind);
    postReactions.set(r.post_id, entry);
  }

  const ownThreads = new Set<string>();
  const ownPosts = new Set<string>();
  for (const a of ownAnonRes.data ?? []) {
    if (a.thread_id) ownThreads.add(a.thread_id);
    if (a.post_id) ownPosts.add(a.post_id);
  }

  const thread: ThreadView = {
    id: row.id,
    title: row.title,
    body: row.body,
    tags: row.tags,
    isAnonymous: row.is_anonymous,
    isPinned: row.is_pinned,
    isLocked: row.is_locked,
    solutionPostId: row.solution_post_id,
    replyCount: row.reply_count,
    createdAt: row.created_at,
    editedAt: row.edited_at,
    lastActivityAt: row.last_activity_at,
    author: row.is_anonymous ? null : (row.author ?? null),
    category: row.category,
    reactions: threadReactions,
    isOwner: row.author_id === viewerId || ownThreads.has(row.id),
  };

  const posts = postRows.map<PostView>((p) => ({
    id: p.id,
    body: p.body,
    isAnonymous: p.is_anonymous,
    createdAt: p.created_at,
    editedAt: p.edited_at,
    author: p.is_anonymous ? null : (p.author ?? null),
    reactions: postReactions.get(p.id) ?? { counts: emptyReactionCounts(), mine: [] },
    isOwner: p.author_id === viewerId || ownPosts.has(p.id),
    isSolution: p.id === row.solution_post_id,
  }));

  return { thread, posts };
}

/** Para a página de edição: o tópico se a usuária pode editá-lo (dona ou moderação). */
export async function getEditableThread(id: string, viewerId: string, viewerIsModerator: boolean) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("forum_threads")
    .select(
      "id, title, body, tags, is_anonymous, author_id, category:forum_categories!forum_threads_category_id_fkey(id, slug, name, icon, allow_anonymous)",
    )
    .eq("id", id)
    .maybeSingle();
  if (!data || !data.category) return null;

  let isOwner = data.author_id === viewerId;
  if (!isOwner && data.is_anonymous) {
    const { data: own } = await supabase
      .from("forum_anonymous_authorship")
      .select("id")
      .eq("user_id", viewerId)
      .eq("thread_id", id)
      .maybeSingle();
    isOwner = Boolean(own);
  }
  if (!isOwner && !viewerIsModerator) return null;
  return { ...data, category: data.category, isOwner };
}
