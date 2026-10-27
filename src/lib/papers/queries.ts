import "server-only";
import { cache } from "react";
import type { RankingPeriod } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";
import {
  PAPERS_PAGE_SIZE,
  areaIdsForSlug,
  escapeLikePattern,
  rankingVotes,
  type AreaRow,
  type VitrineOrder,
} from "./params";

/**
 * Leitura de dados da Vitrine e do ranking (servidor, sempre com a sessão da usuária → RLS).
 * Visitantes (anon) NÃO têm SELECT em `profiles`: nada aqui faz embed de perfis, exceto
 * as funções marcadas "só membros", chamadas apenas com sessão.
 */

export interface PaperListItem {
  id: string;
  title: string;
  authors: string[];
  venue: string | null;
  year: number | null;
  doi: string | null;
  url: string | null;
  area: { slug: string; name: string } | null;
  plain_summary: string | null;
  vote_count: number;
  /** Votos dentro da janela do período (null nas listas simples). */
  period_votes: number | null;
  comment_count: number;
  created_at: string;
  submitted_by: string;
}

export interface PaperDetail extends Omit<PaperListItem, "area" | "period_votes"> {
  abstract: string;
  area_id: number | null;
  area: { id: number; slug: string; name: string; big_area: string } | null;
  keywords: string[];
  submitter_relation: string;
  women_authorship_confirmed: boolean;
  plain_summary_source: string | null;
  is_hidden: boolean;
  updated_at: string;
}

export interface PaperComment {
  id: string;
  body: string;
  created_at: string;
  updated_at: string;
  author_id: string;
  author: { id: string; full_name: string; avatar_url: string | null; headline: string | null } | null;
}

export interface PaperSubmitter {
  id: string;
  full_name: string;
  avatar_url: string | null;
  headline: string | null;
  institution: string | null;
}

export interface LeaderboardEntry {
  profile_id: string;
  full_name: string;
  avatar_url: string | null;
  career_stage: string | null;
  points: number;
  papers: number;
  votes_received: number;
  solutions: number;
  mentorships: number;
  posts: number;
}

const LIST_COLUMNS =
  "id, title, authors, venue, year, doi, url, plain_summary, vote_count, comment_count, created_at, submitted_by, area:research_areas(slug, name)";

const DETAIL_COLUMNS =
  "id, title, abstract, authors, venue, year, doi, url, area_id, keywords, submitter_relation, women_authorship_confirmed, plain_summary, plain_summary_source, vote_count, comment_count, is_hidden, created_at, updated_at, submitted_by, area:research_areas(id, slug, name, big_area)";

/** Catálogo de áreas (público), ordenado por grande área e nome. Memoizado por requisição. */
export const getResearchAreas = cache(async (): Promise<AreaRow[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("research_areas")
    .select("id, slug, name, big_area")
    .order("big_area")
    .order("name");
  if (error) {
    console.error("[papers] falha ao carregar áreas", error.code, error.message);
    return [];
  }
  return data ?? [];
});

export type ListResult<T> = { ok: true; items: T[]; total: number } | { ok: false; items: T[]; total: 0 };

/**
 * Vitrine paginada. Períodos usam a RPC `get_paper_ranking`; "recent" e a busca (?q=, no
 * título) usam uma consulta simples em `papers` (a RPC não tem busca por texto).
 */
export async function listVitrine(options: {
  order: VitrineOrder;
  areaSlug: string | null;
  q: string;
  page: number;
}): Promise<ListResult<PaperListItem>> {
  const { order, areaSlug, q, page } = options;
  const supabase = await createClient();
  const areas = await getResearchAreas();
  const areaIds = areaIdsForSlug(areas, areaSlug);
  const from = (page - 1) * PAPERS_PAGE_SIZE;

  // Slug de área desconhecido: nenhum resultado (em vez de ignorar o filtro em silêncio).
  if (areaSlug && !areaIds) return { ok: true, items: [], total: 0 };

  if (q || order === "recent") {
    let query = supabase.from("papers").select(LIST_COLUMNS, { count: "exact" }).eq("is_hidden", false);
    if (q) query = query.ilike("title", `%${escapeLikePattern(q)}%`);
    if (areaIds) query = query.in("area_id", areaIds);
    query =
      order === "recent"
        ? query.order("created_at", { ascending: false })
        : query.order("vote_count", { ascending: false }).order("created_at", { ascending: false });
    const { data, error, count } = await query.order("id").range(from, from + PAPERS_PAGE_SIZE - 1);
    if (error) {
      console.error("[papers] falha na lista da Vitrine", error.code, error.message);
      return { ok: false, items: [], total: 0 };
    }
    return {
      ok: true,
      total: count ?? 0,
      items: (data ?? []).map((row) => ({ ...row, area: row.area ?? null, period_votes: null })),
    };
  }

  let countQuery = supabase.from("papers").select("id", { count: "exact", head: true }).eq("is_hidden", false);
  if (areaIds) countQuery = countQuery.in("area_id", areaIds);

  const [ranking, counted] = await Promise.all([
    supabase.rpc("get_paper_ranking", {
      p_period: order,
      p_area_slug: areaSlug ?? undefined,
      p_limit: PAPERS_PAGE_SIZE,
      p_offset: from,
    }),
    countQuery,
  ]);
  if (ranking.error || counted.error) {
    const error = ranking.error ?? counted.error;
    console.error("[papers] falha no ranking da Vitrine", error?.code, error?.message);
    return { ok: false, items: [], total: 0 };
  }
  return { ok: true, total: counted.count ?? 0, items: (ranking.data ?? []).map(fromRankingRow) };
}

type RankingRow = {
  id: string;
  title: string;
  authors: string[];
  venue: string | null;
  year: number | null;
  doi: string | null;
  url: string | null;
  area_slug: string | null;
  area_name: string | null;
  plain_summary: string | null;
  vote_count: number;
  period_votes: number;
  comment_count: number;
  created_at: string;
  submitted_by: string;
};

function fromRankingRow(row: RankingRow): PaperListItem {
  return {
    id: row.id,
    title: row.title,
    authors: row.authors,
    venue: row.venue,
    year: row.year,
    doi: row.doi,
    url: row.url,
    area: row.area_slug && row.area_name ? { slug: row.area_slug, name: row.area_name } : null,
    plain_summary: row.plain_summary,
    vote_count: row.vote_count,
    period_votes: Number(row.period_votes),
    comment_count: row.comment_count,
    created_at: row.created_at,
    submitted_by: row.submitted_by,
  };
}

/** Ranking de papers do período: só quem recebeu destaques que contam no período. */
export async function listRanking(options: {
  period: RankingPeriod;
  areaSlug: string | null;
  limit: number;
}): Promise<ListResult<PaperListItem>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_paper_ranking", {
    p_period: options.period,
    p_area_slug: options.areaSlug ?? undefined,
    p_limit: options.limit,
    p_offset: 0,
  });
  if (error) {
    console.error("[ranking] falha no ranking de papers", error.code, error.message);
    return { ok: false, items: [], total: 0 };
  }
  const items = (data ?? []).map(fromRankingRow).filter((p) => rankingVotes(options.period, p) > 0);
  return { ok: true, items, total: items.length };
}

/** Quais destes papers a usuária logada já destacou. */
export async function getVotedPaperIds(userId: string | null, paperIds: string[]): Promise<Set<string>> {
  if (!userId || paperIds.length === 0) return new Set();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("paper_votes")
    .select("paper_id")
    .eq("user_id", userId)
    .in("paper_id", paperIds);
  if (error) {
    console.error("[papers] falha ao carregar destaques da usuária", error.code, error.message);
    return new Set();
  }
  return new Set((data ?? []).map((v) => v.paper_id));
}

/** Paper completo (visível pelo RLS: públicos; ocultos só para quem enviou e moderação). */
export const getPaperDetail = cache(async (id: string): Promise<PaperDetail | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("papers").select(DETAIL_COLUMNS).eq("id", id).maybeSingle();
  if (error) {
    console.error("[papers] falha ao carregar paper", error.code, error.message);
    throw new Error("Não foi possível carregar o paper.");
  }
  return data ? { ...data, area: data.area ?? null } : null;
});

/** Só membros: perfil público de quem enviou o paper. */
export async function getPaperSubmitter(profileId: string): Promise<PaperSubmitter | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url, headline, institution")
    .eq("id", profileId)
    .maybeSingle();
  return data ?? null;
}

/** Só membros: comentários com a autora (colunas públicas do perfil). */
export async function getPaperComments(paperId: string): Promise<{ ok: boolean; comments: PaperComment[] }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("paper_comments")
    .select("id, body, created_at, updated_at, author_id, author:profiles(id, full_name, avatar_url, headline)")
    .eq("paper_id", paperId)
    .order("created_at", { ascending: true })
    .limit(200);
  if (error) {
    console.error("[papers] falha ao carregar comentários", error.code, error.message);
    return { ok: false, comments: [] };
  }
  return { ok: true, comments: (data ?? []).map((c) => ({ ...c, author: c.author ?? null })) };
}

/** Só membros: ranking da comunidade (RPC SECURITY DEFINER). */
export async function getCommunityLeaderboard(limit = 20): Promise<ListResult<LeaderboardEntry>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_community_leaderboard", { p_limit: limit });
  if (error) {
    console.error("[ranking] falha no ranking da comunidade", error.code, error.message);
    return { ok: false, items: [], total: 0 };
  }
  return { ok: true, items: data ?? [], total: data?.length ?? 0 };
}
