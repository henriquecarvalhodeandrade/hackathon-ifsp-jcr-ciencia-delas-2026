import { truncate } from "@/lib/utils";
import { NEWSLETTER_EXCLUDED_CATEGORY_SLUGS } from "./constants";
import type { NewsletterPaper, NewsletterThread } from "./content";

/**
 * Seleção dos destaques da semana (puro, testável). As consultas ficam em build-edition.ts.
 */

export interface PaperCandidate {
  id: string;
  title: string;
  authors: string[];
  plain_summary: string | null;
  vote_count: number;
  created_at: string;
  area_id: number | null;
  area_name: string | null;
}

/** Papers mais destacados na janela (votos dados na janela), desempate igual ao get_paper_ranking. */
export function rankPapersByWindowVotes(
  votes: ReadonlyArray<{ paper_id: string }>,
  papers: readonly PaperCandidate[],
  limit: number,
): PaperCandidate[] {
  const counts = new Map<string, number>();
  for (const vote of votes) counts.set(vote.paper_id, (counts.get(vote.paper_id) ?? 0) + 1);
  return papers
    .filter((p) => (counts.get(p.id) ?? 0) > 0)
    .sort(
      (a, b) =>
        (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0) ||
        b.vote_count - a.vote_count ||
        Date.parse(b.created_at) - Date.parse(a.created_at) ||
        a.id.localeCompare(b.id),
    )
    .slice(0, limit);
}

export function toNewsletterPaper(paper: PaperCandidate): NewsletterPaper {
  return {
    id: paper.id,
    title: paper.title,
    authors: paper.authors.slice(0, 20),
    votes: paper.vote_count,
    plain_summary: paper.plain_summary ? truncate(paper.plain_summary.trim(), 400) : null,
    url: `/papers/${paper.id}`,
    area_id: paper.area_id,
    area: paper.area_name,
  };
}

export interface ThreadCandidate {
  id: string;
  title: string;
  reply_count: number;
  created_at: string;
  is_anonymous: boolean;
  category_name: string | null;
  /** Slug da categoria (ex.: "apresente-se" fica de fora: apresentações são pessoais). */
  category_slug: string | null;
  /** Categorias que aceitam anonimato (apoio, maternidade, saúde mental) nunca vão para a newsletter pública. */
  category_allows_anonymous: boolean;
}

/** Tópicos que podem aparecer no arquivo público: sem anonimato e fora de categorias pessoais. */
export function isThreadPublishable(thread: ThreadCandidate): boolean {
  return (
    !thread.is_anonymous &&
    !thread.category_allows_anonymous &&
    thread.category_slug !== null &&
    !(NEWSLETTER_EXCLUDED_CATEGORY_SLUGS as readonly string[]).includes(thread.category_slug)
  );
}

/**
 * Conversas mais movimentadas na janela: respostas + reações na janela (+1 se o tópico é novo).
 * Exclui tópicos anônimos, TODA categoria que aceita anonimato e as apresentações pessoais
 * ("apresente-se") — a newsletter é pública e esses espaços são de acolhimento; nem o título
 * deles sai da comunidade. Nunca leva nome de autora.
 */
export function rankThreadsByActivity(input: {
  threads: readonly ThreadCandidate[];
  postThreadIds: readonly string[];
  reactionThreadIds: readonly string[];
  windowStart: Date;
  limit: number;
}): ThreadCandidate[] {
  const score = new Map<string, number>();
  const bump = (id: string, by = 1) => score.set(id, (score.get(id) ?? 0) + by);
  input.postThreadIds.forEach((id) => bump(id));
  input.reactionThreadIds.forEach((id) => bump(id));
  for (const thread of input.threads) {
    if (Date.parse(thread.created_at) >= input.windowStart.getTime()) bump(thread.id);
  }
  return input.threads
    .filter((t) => isThreadPublishable(t) && (score.get(t.id) ?? 0) > 0)
    .sort(
      (a, b) =>
        (score.get(b.id) ?? 0) - (score.get(a.id) ?? 0) ||
        b.reply_count - a.reply_count ||
        Date.parse(b.created_at) - Date.parse(a.created_at) ||
        a.id.localeCompare(b.id),
    )
    .slice(0, input.limit);
}

export function toNewsletterThread(thread: ThreadCandidate): NewsletterThread {
  return {
    id: thread.id,
    title: thread.title,
    category: thread.category_name ?? "",
    replies: thread.reply_count,
    url: `/forum/t/${thread.id}`,
  };
}
