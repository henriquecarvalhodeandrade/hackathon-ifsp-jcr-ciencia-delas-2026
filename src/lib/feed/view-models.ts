/**
 * Linhas do banco → modelos de tela do feed (puro, testado em view-models.test.ts).
 * Os tipos de linha são estruturais (o mínimo que a tela usa), compatíveis com o resultado
 * tipado das consultas em queries.ts.
 */
import { opportunityKindLabel } from "@/lib/opportunities/labels";
import { isEdited, portfolioKindLabel } from "./presentation";
import { encodeAttachment, isPostKind } from "./schema";
import type {
  AttachmentOption,
  AttachmentView,
  FeedAuthor,
  FeedCommentView,
  FeedPostView,
} from "./types";

export type AuthorRow = {
  id: string;
  full_name: string;
  avatar_url: string | null;
  headline: string | null;
  career_stage: string | null;
};

export type PortfolioItemRow = {
  id: string;
  kind: string;
  title: string;
  venue: string | null;
  year: number | null;
  url: string | null;
};

export type OpportunityRow = {
  id: string;
  kind: string;
  title: string;
  has_scholarship: boolean;
  scholarship_info: string | null;
  status: string;
  area: { name: string } | null;
};

export type PostRow = {
  id: string;
  author_id: string;
  kind: string;
  body: string;
  link_url: string | null;
  like_count: number;
  comment_count: number;
  created_at: string;
  updated_at: string;
  author: AuthorRow | null;
  portfolio_item: PortfolioItemRow | null;
  opportunity: OpportunityRow | null;
};

export type CommentRow = {
  id: string;
  post_id: string;
  author_id: string;
  body: string;
  created_at: string;
  updated_at: string;
  author: AuthorRow | null;
};

/**
 * Link externo seguro para exibir: só http(s) (o banco já exige, aqui é defesa em
 * profundidade) e o domínio sem "www." como texto curto.
 */
export function externalLink(
  url: string | null | undefined,
): { href: string; host: string } | null {
  if (!url) return null;
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
  return { href: parsed.href, host: parsed.hostname.replace(/^www\./i, "") };
}

function toAuthor(row: AuthorRow | null): FeedAuthor | null {
  if (!row) return null;
  return {
    id: row.id,
    full_name: row.full_name,
    avatar_url: row.avatar_url,
    headline: row.headline,
    career_stage: row.career_stage,
  };
}

function toAttachment(row: PostRow): AttachmentView | null {
  if (row.portfolio_item) {
    const item = row.portfolio_item;
    return {
      type: "portfolio",
      id: item.id,
      kind: item.kind,
      title: item.title,
      venue: item.venue,
      year: item.year,
      url: externalLink(item.url)?.href ?? null,
    };
  }
  if (row.opportunity) {
    const opportunity = row.opportunity;
    return {
      type: "opportunity",
      id: opportunity.id,
      kind: opportunity.kind,
      title: opportunity.title,
      areaName: opportunity.area?.name ?? null,
      hasScholarship: opportunity.has_scholarship,
      scholarshipInfo: opportunity.scholarship_info,
      isOpen: opportunity.status === "open",
    };
  }
  return null;
}

export function toPostView(
  row: PostRow,
  ctx: { viewerId: string; likedIds: ReadonlySet<string>; viewerIsModerator?: boolean },
): FeedPostView {
  const isOwner = row.author_id === ctx.viewerId;
  return {
    id: row.id,
    kind: isPostKind(row.kind) ? row.kind : "update",
    body: row.body,
    link: externalLink(row.link_url),
    createdAt: row.created_at,
    edited: isEdited(row.created_at, row.updated_at),
    likeCount: Math.max(0, row.like_count ?? 0),
    commentCount: Math.max(0, row.comment_count ?? 0),
    likedByMe: ctx.likedIds.has(row.id),
    isOwner,
    canDelete: isOwner || Boolean(ctx.viewerIsModerator),
    author: toAuthor(row.author),
    attachment: toAttachment(row),
  };
}

export function toCommentView(
  row: CommentRow,
  ctx: { viewerId: string; postAuthorId: string; viewerIsModerator?: boolean },
): FeedCommentView {
  const isOwner = row.author_id === ctx.viewerId;
  return {
    id: row.id,
    postId: row.post_id,
    body: row.body,
    createdAt: row.created_at,
    edited: isEdited(row.created_at, row.updated_at),
    author: toAuthor(row.author),
    isOwner,
    canDelete: isOwner || ctx.postAuthorId === ctx.viewerId || Boolean(ctx.viewerIsModerator),
  };
}

/** "Artigo · Título (2025)" — opção do anexo de portfólio no compositor. */
export function portfolioOption(
  item: Pick<PortfolioItemRow, "id" | "kind" | "title" | "year">,
): AttachmentOption {
  const year = item.year ? ` (${item.year})` : "";
  return {
    value: encodeAttachment({ type: "portfolio", id: item.id }),
    label: `${portfolioKindLabel(item.kind)} · ${item.title}${year}`,
  };
}

/** "Iniciação Científica · Título (encerrada)" — opção do anexo de vaga no compositor. */
export function opportunityOption(
  opportunity: Pick<OpportunityRow, "id" | "kind" | "title" | "status">,
): AttachmentOption {
  const closed = opportunity.status === "open" ? "" : " (encerrada)";
  return {
    value: encodeAttachment({ type: "opportunity", id: opportunity.id }),
    label: `${opportunityKindLabel(opportunity.kind)} · ${opportunity.title}${closed}`,
  };
}
