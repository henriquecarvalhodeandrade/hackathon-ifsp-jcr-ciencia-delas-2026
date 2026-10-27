import type { Tables } from "@/lib/database.types";
import type { ReactionKindValue } from "./schema";

/** Tipos compartilhados do fórum (servidor e cliente). */

export type ForumCategory = Tables<"forum_categories">;
export type ForumCategoryWithCount = ForumCategory & { threadCount: number };
export type CategorySummary = Pick<
  ForumCategory,
  "id" | "slug" | "name" | "icon" | "allow_anonymous"
>;

export type ForumAuthor = {
  id: string;
  full_name: string;
  avatar_url: string | null;
  headline: string | null;
};

export type ReactionCounts = Record<ReactionKindValue, number>;

export function emptyReactionCounts(): ReactionCounts {
  return { support: 0, useful: 0, celebrate: 0 };
}

export type ThreadListItem = {
  id: string;
  title: string;
  tags: string[];
  excerpt: string;
  isAnonymous: boolean;
  isPinned: boolean;
  isLocked: boolean;
  isSolved: boolean;
  replyCount: number;
  lastActivityAt: string;
  createdAt: string;
  author: ForumAuthor | null;
  category: CategorySummary | null;
  reactions: ReactionCounts;
  /** A usuária atual é a autora anônima deste tópico. */
  isOwnAnonymous: boolean;
};

export type ReactionState = { counts: ReactionCounts; mine: ReactionKindValue[] };

export type PostView = {
  id: string;
  body: string;
  isAnonymous: boolean;
  createdAt: string;
  editedAt: string | null;
  author: ForumAuthor | null;
  reactions: ReactionState;
  /** A usuária atual escreveu esta resposta (com nome ou anônima). */
  isOwner: boolean;
  isSolution: boolean;
};

export type ThreadView = {
  id: string;
  title: string;
  body: string;
  tags: string[];
  isAnonymous: boolean;
  isPinned: boolean;
  isLocked: boolean;
  solutionPostId: string | null;
  replyCount: number;
  createdAt: string;
  editedAt: string | null;
  lastActivityAt: string;
  author: ForumAuthor | null;
  category: CategorySummary;
  reactions: ReactionState;
  isOwner: boolean;
};

export type ThreadDetail = { thread: ThreadView; posts: PostView[] };
