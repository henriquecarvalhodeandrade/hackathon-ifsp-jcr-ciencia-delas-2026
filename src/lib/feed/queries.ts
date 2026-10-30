import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { boundaryTie, FEED_PAGE_SIZE, paginate, type FeedTab, type Page } from "./presentation";
import type { ComposerAttachments, FeedCommentView, FeedPostView } from "./types";
import {
  opportunityOption,
  portfolioOption,
  toCommentView,
  toPostView,
  type PostRow,
} from "./view-models";

/*
 * Leituras do feed (Server Components). Tudo passa pelo RLS com a sessão da usuária: o feed é
 * só para membras, então as páginas chamam requireOnboardedProfile antes. Publicações ocultadas
 * ou apagadas pela moderação simplesmente não voltam (→ 404 na página da publicação).
 *
 * Cada página de publicações custa duas idas ao banco: as publicações com autora e anexos
 * embutidos (um select só) e as minhas curtidas nesses ids. A aba "Seguindo" lê antes quem eu sigo.
 */

type Supabase = Awaited<ReturnType<typeof createClient>>;

const POST_SELECT =
  "id, author_id, kind, body, link_url, like_count, comment_count, created_at, updated_at, author:profiles!posts_author_id_fkey(id, full_name, avatar_url, headline, career_stage), portfolio_item:portfolio_items!posts_portfolio_item_id_fkey(id, kind, title, venue, year, url), opportunity:research_opportunities!posts_opportunity_id_fkey(id, kind, title, has_scholarship, scholarship_info, status, area:research_areas!research_opportunities_area_id_fkey(name))";

const COMMENT_SELECT =
  "id, post_id, author_id, body, created_at, updated_at, author:profiles!post_comments_author_id_fkey(id, full_name, avatar_url, headline, career_stage)";

/**
 * Teto de pessoas seguidas consideradas na aba "Seguindo" (os ids vão na URL do PostgREST).
 * Com redes maiores, o certo é uma RPC/view no banco — ver o relatório da etapa.
 */
const MAX_FOLLOWED = 300;
/** Teto do grupo empatado na borda da página (ver paginate). */
const MAX_TIED = 100;
/** Máximo de comentários carregados por publicação (o hackathon não precisa paginar). */
export const MAX_COMMENTS_PER_POST = 500;

/** Ids das publicações (entre `ids`) que a usuária curtiu. */
async function likedPostIds(
  supabase: Supabase,
  viewerId: string,
  ids: string[],
): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const { data, error } = await supabase
    .from("post_likes")
    .select("post_id")
    .eq("user_id", viewerId)
    .in("post_id", ids);
  if (error) throw new Error(`Não foi possível carregar as curtidas (${error.code ?? "erro"}).`);
  return new Set((data ?? []).map((row) => row.post_id));
}

export type ListPostsOptions = {
  viewerId: string;
  /** Moderação também apaga publicações de outras pessoas. */
  viewerIsModerator?: boolean;
  /** "seguindo" = publicações de quem eu sigo + as minhas. */
  tab?: FeedTab;
  /** Cursor já validado (parseCursor): só publicações anteriores a este instante. */
  before?: string | null;
  /** Só as publicações desta pessoa (perfil). Tem precedência sobre `tab`. */
  authorId?: string;
  limit?: number;
};

/** Publicações mais recentes primeiro, com a página seguinte indicada por `nextCursor`. */
export async function listPosts(opts: ListPostsOptions): Promise<Page<FeedPostView>> {
  const supabase = await createClient();
  const pageSize = opts.limit ?? FEED_PAGE_SIZE;

  let authorIds: string[] | null = null;
  if (opts.authorId) {
    authorIds = [opts.authorId];
  } else if (opts.tab === "seguindo") {
    const { data, error } = await supabase
      .from("follows")
      .select("followee_id")
      .eq("follower_id", opts.viewerId)
      .order("created_at", { ascending: false })
      .limit(MAX_FOLLOWED);
    if (error)
      throw new Error(`Não foi possível carregar quem você segue (${error.code ?? "erro"}).`);
    authorIds = [opts.viewerId, ...(data ?? []).map((row) => row.followee_id)];
  }

  const baseQuery = () => {
    const query = supabase.from("posts").select(POST_SELECT);
    if (!authorIds) return query;
    return authorIds.length === 1
      ? query.eq("author_id", authorIds[0]!)
      : query.in("author_id", authorIds);
  };

  let query = baseQuery();
  if (opts.before) query = query.lt("created_at", opts.before);
  const { data, error } = await query
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(pageSize + 1);
  if (error) throw new Error(`Não foi possível carregar as publicações (${error.code ?? "erro"}).`);
  const rows: PostRow[] = data ?? [];

  // Empate na borda: o grupo inteiro daquele instante entra nesta página (ver paginate).
  const tie = boundaryTie(rows, pageSize);
  let tied: PostRow[] | undefined;
  if (tie) {
    const { data: tiedRows } = await baseQuery()
      .eq("created_at", tie)
      .order("id", { ascending: false })
      .limit(MAX_TIED);
    tied = tiedRows ?? undefined;
  }

  const page = paginate(rows, pageSize, tied);
  const likedIds = await likedPostIds(
    supabase,
    opts.viewerId,
    page.items.map((row) => row.id),
  );
  return {
    items: page.items.map((row) =>
      toPostView(row, {
        viewerId: opts.viewerId,
        likedIds,
        viewerIsModerator: opts.viewerIsModerator,
      }),
    ),
    nextCursor: page.nextCursor,
  };
}

/** Dados mínimos da publicação (metadados da página). Memoizado por requisição. */
export const getPostSummary = cache(async (id: string) => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("posts")
    .select("id, body, author:profiles!posts_author_id_fkey(full_name)")
    .eq("id", id)
    .maybeSingle();
  return data ?? null;
});

/** Uma publicação (sem comentários) — para re-renderizar um cartão. null = não existe/oculta. */
export async function getPost(
  id: string,
  viewerId: string,
  viewerIsModerator = false,
): Promise<FeedPostView | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("posts")
    .select(POST_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Não foi possível carregar a publicação (${error.code ?? "erro"}).`);
  const row: PostRow | null = data;
  if (!row) return null;
  const likedIds = await likedPostIds(supabase, viewerId, [row.id]);
  return toPostView(row, { viewerId, likedIds, viewerIsModerator });
}

export type PostDetail = { post: FeedPostView; comments: FeedCommentView[] };

/** Uma publicação com todos os comentários (mais antigos primeiro). null = não existe/oculta. */
export async function getPostDetail(
  id: string,
  viewerId: string,
  viewerIsModerator = false,
): Promise<PostDetail | null> {
  const supabase = await createClient();
  const [postRes, commentsRes] = await Promise.all([
    supabase.from("posts").select(POST_SELECT).eq("id", id).maybeSingle(),
    supabase
      .from("post_comments")
      .select(COMMENT_SELECT)
      .eq("post_id", id)
      .order("created_at")
      .order("id")
      .limit(MAX_COMMENTS_PER_POST),
  ]);
  if (postRes.error)
    throw new Error(`Não foi possível carregar a publicação (${postRes.error.code ?? "erro"}).`);
  const row: PostRow | null = postRes.data;
  if (!row) return null;
  if (commentsRes.error)
    throw new Error(
      `Não foi possível carregar os comentários (${commentsRes.error.code ?? "erro"}).`,
    );

  const likedIds = await likedPostIds(supabase, viewerId, [row.id]);
  return {
    post: toPostView(row, { viewerId, likedIds, viewerIsModerator }),
    comments: (commentsRes.data ?? []).map((comment) =>
      toCommentView(comment, { viewerId, postAuthorId: row.author_id, viewerIsModerator }),
    ),
  };
}

/**
 * Os `limit` comentários mais recentes de uma publicação, em ordem cronológica (painel de
 * comentários do cartão). Lê junto a autora da publicação para saber quem pode apagar.
 */
export async function listRecentComments(
  postId: string,
  opts: { viewerId: string; viewerIsModerator?: boolean; limit?: number },
): Promise<FeedCommentView[]> {
  const supabase = await createClient();
  const [postRes, commentsRes] = await Promise.all([
    supabase.from("posts").select("author_id").eq("id", postId).maybeSingle(),
    supabase
      .from("post_comments")
      .select(COMMENT_SELECT)
      .eq("post_id", postId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(opts.limit ?? 2),
  ]);
  if (postRes.error || commentsRes.error)
    throw new Error("Não foi possível carregar os comentários.");
  const postAuthorId = postRes.data?.author_id ?? "";
  return (commentsRes.data ?? []).reverse().map((comment) =>
    toCommentView(comment, {
      viewerId: opts.viewerId,
      postAuthorId,
      viewerIsModerator: opts.viewerIsModerator,
    }),
  );
}

// ---------------------------------------------------------------------------
// Compositor e colunas laterais
// ---------------------------------------------------------------------------

/** Resultado de um bloco independente: se falhar, a página mostra um aviso só nele. */
export type Settled<T> = { ok: true; data: T } | { ok: false };

export async function settle<T>(task: () => Promise<T>): Promise<Settled<T>> {
  try {
    return { ok: true, data: await task() };
  } catch (error) {
    console.error("[feed] bloco indisponível:", error);
    return { ok: false };
  }
}

/** O que dá para anexar: itens do meu portfólio e vagas que publiquei. */
export function getComposerAttachments(viewerId: string): Promise<Settled<ComposerAttachments>> {
  return settle(async () => {
    const supabase = await createClient();
    const [portfolioRes, opportunitiesRes] = await Promise.all([
      supabase
        .from("portfolio_items")
        .select("id, kind, title, year")
        .eq("owner_id", viewerId)
        .order("pinned", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("research_opportunities")
        .select("id, kind, title, status")
        .eq("owner_id", viewerId)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);
    if (portfolioRes.error) throw portfolioRes.error;
    if (opportunitiesRes.error) throw opportunitiesRes.error;
    return {
      portfolio: (portfolioRes.data ?? []).map(portfolioOption),
      opportunities: (opportunitiesRes.data ?? []).map(opportunityOption),
    };
  });
}

export type NetworkCounts = { followers: number; following: number; connections: number };

export function getNetworkCounts(profileId: string): Promise<Settled<NetworkCounts>> {
  return settle(async () => {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("get_network_counts", { p_profile_id: profileId });
    if (error) throw error;
    const row = data?.[0];
    return {
      followers: row?.followers ?? 0,
      following: row?.following ?? 0,
      connections: row?.connections ?? 0,
    };
  });
}

export type RecentOpportunity = {
  id: string;
  kind: string;
  title: string;
  institution: string | null;
  hasScholarship: boolean;
  areaName: string | null;
};

/** As vagas abertas mais recentes (coluna "Vagas de IC recentes"). */
export function listRecentOpportunities(limit = 3): Promise<Settled<RecentOpportunity[]>> {
  return settle(async () => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("research_opportunities")
      .select(
        "id, kind, title, institution, has_scholarship, area:research_areas!research_opportunities_area_id_fkey(name)",
      )
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []).map((row) => ({
      id: row.id,
      kind: row.kind,
      title: row.title,
      institution: row.institution,
      hasScholarship: row.has_scholarship,
      areaName: row.area?.name ?? null,
    }));
  });
}

export type ConnectionSuggestion = {
  id: string;
  full_name: string;
  avatar_url: string | null;
  headline: string | null;
  institution: string | null;
  career_stage: string | null;
  mutualConnections: number;
  sharedAreas: number;
};

/**
 * Pessoas para conectar (RPC get_connection_suggestions, já sem quem tem convite ou conexão
 * comigo). Tira também quem eu já sigo — o bloco convida a conectar com gente nova (uma ida a
 * mais, só pelos ids sugeridos). Pede um pouco além do `limit` para compensar as retiradas.
 */
export function listConnectionSuggestions(
  viewerId: string,
  limit = 4,
): Promise<Settled<ConnectionSuggestion[]>> {
  return settle(async () => {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("get_connection_suggestions", {
      p_limit: limit + 6,
    });
    if (error) throw error;
    const rows = data ?? [];
    const followed = new Set<string>();
    if (rows.length > 0) {
      const { data: follows, error: followsError } = await supabase
        .from("follows")
        .select("followee_id")
        .eq("follower_id", viewerId)
        .in(
          "followee_id",
          rows.map((row) => row.id),
        );
      if (followsError) throw followsError;
      for (const row of follows ?? []) followed.add(row.followee_id);
    }
    return rows
      .filter((row) => !followed.has(row.id))
      .slice(0, limit)
      .map((row) => ({
        id: row.id,
        full_name: row.full_name,
        avatar_url: row.avatar_url,
        headline: row.headline,
        institution: row.institution,
        career_stage: row.career_stage,
        mutualConnections: row.mutual_connections,
        sharedAreas: row.shared_areas,
      }));
  });
}
