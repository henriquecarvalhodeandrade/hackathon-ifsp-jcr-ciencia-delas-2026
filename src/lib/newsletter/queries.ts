import "server-only";
import { cache } from "react";
import type { Enums } from "@/lib/database.types";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { ARCHIVE_PAGE_SIZE, EDITION_SLUG_PATTERN } from "./constants";
import { parseEditionContent, type NewsletterContent } from "./content";

/**
 * Leituras públicas da newsletter com o cliente da SESSÃO (RLS): edições publicadas/enviadas são
 * públicas; rascunhos só aparecem para admins (pré-visualização). Nada aqui usa o service role.
 */

export interface EditionListItem {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  period_start: string | null;
  period_end: string | null;
  published_at: string | null;
  status: Enums<"edition_status">;
  counts: { papers: number; threads: number; mentors: number };
}

export interface EditionDetail extends EditionListItem {
  content: NewsletterContent;
}

const LIST_COLUMNS =
  "id, slug, title, summary, period_start, period_end, published_at, status, content";

type ListRow = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  period_start: string | null;
  period_end: string | null;
  published_at: string | null;
  status: Enums<"edition_status">;
  content: unknown;
};

function toDetail(row: ListRow): EditionDetail {
  const content = parseEditionContent(row.content);
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    period_start: row.period_start,
    period_end: row.period_end,
    published_at: row.published_at,
    status: row.status,
    content,
    counts: {
      papers: content.papers.length,
      threads: content.threads.length,
      mentors: content.mentor_summary.total,
    },
  };
}

export async function listPublishedEditions(
  page = 1,
  pageSize = ARCHIVE_PAGE_SIZE,
): Promise<{ editions: EditionListItem[]; total: number; failed: boolean }> {
  if (!isSupabaseConfigured()) return { editions: [], total: 0, failed: false };
  const supabase = await createClient();
  const from = (Math.max(1, page) - 1) * pageSize;
  const { data, count, error } = await supabase
    .from("newsletter_editions")
    .select(LIST_COLUMNS, { count: "exact" })
    .in("status", ["published", "sent"])
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("slug", { ascending: false })
    .range(from, from + pageSize - 1);
  if (error) {
    console.error(`[newsletter] falha ao listar edições: ${error.message}`);
    return { editions: [], total: 0, failed: true };
  }
  return {
    editions: (data ?? []).map((row) => {
      const detail = toDetail(row);
      return {
        id: detail.id,
        slug: detail.slug,
        title: detail.title,
        summary: detail.summary,
        period_start: detail.period_start,
        period_end: detail.period_end,
        published_at: detail.published_at,
        status: detail.status,
        counts: detail.counts,
      };
    }),
    total: count ?? 0,
    failed: false,
  };
}

/** Edição pelo slug (null se não existir ou não for visível para quem está vendo). Memoizada por requisição. */
export const getEditionBySlug = cache(async (slug: string): Promise<EditionDetail | null> => {
  if (!isSupabaseConfigured() || !EDITION_SLUG_PATTERN.test(slug) || slug.length > 80) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("newsletter_editions")
    .select(LIST_COLUMNS)
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(`Não foi possível carregar a edição: ${error.message}`);
  return data ? toDetail(data) : null;
});

export interface EditionLink {
  slug: string;
  title: string;
}

/** Edição publicada anterior e seguinte (navegação no fim da página). */
export async function getAdjacentEditions(
  publishedAt: string | null,
): Promise<{ older: EditionLink | null; newer: EditionLink | null }> {
  if (!publishedAt || !isSupabaseConfigured()) return { older: null, newer: null };
  const supabase = await createClient();
  const [older, newer] = await Promise.all([
    supabase
      .from("newsletter_editions")
      .select("slug, title")
      .in("status", ["published", "sent"])
      .lt("published_at", publishedAt)
      .order("published_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("newsletter_editions")
      .select("slug, title")
      .in("status", ["published", "sent"])
      .gt("published_at", publishedAt)
      .order("published_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);
  return { older: older.data ?? null, newer: newer.data ?? null };
}

export interface BigArea {
  id: number;
  name: string;
}

/** As 9 grandes áreas do CNPq (linhas em que name = big_area) — opções de interesse da newsletter. */
export async function getBigAreas(): Promise<BigArea[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("research_areas")
    .select("id, name, big_area")
    .order("id");
  if (error) {
    console.error(`[newsletter] falha ao carregar áreas: ${error.message}`);
    return [];
  }
  return (data ?? []).filter((a) => a.name === a.big_area).map((a) => ({ id: a.id, name: a.name }));
}
