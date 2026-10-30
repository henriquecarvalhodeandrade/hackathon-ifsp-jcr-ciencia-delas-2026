"use client";

import { useId } from "react";
import { MessageCircle } from "lucide-react";
import { buttonVariants } from "@/components/ui";
import { commentsLabel } from "@/lib/feed/presentation";
import type { FeedViewer } from "@/lib/feed/types";
import { cn, formatNumber } from "@/lib/utils";
import { CommentPanel } from "./comment-panel";
import { useItem } from "./item-context";
import { LikeButton } from "./like-button";

export interface PostSocialProps {
  postId: string;
  liked: boolean;
  likeCount: number;
  commentCount: number;
  /** "a publicação de Marina Souza" (nome acessível dos botões). */
  targetLabel: string;
  /** "lista": "Comentar" abre o painel no cartão · "detalhe": pula para o campo da página. */
  context: "lista" | "detalhe";
  /** Sem quem está vendo (ex.: prévia), "Comentar" leva à página da publicação. */
  viewer: FeedViewer | null;
  /** A usuária é a autora da publicação (apaga comentários das outras no painel). */
  viewerOwnsPost?: boolean;
}

const actionClass = cn(
  buttonVariants({ variant: "ghost", size: "sm" }),
  "gap-1.5 text-fg-muted pointer-coarse:h-11",
);

/** Rodapé do cartão: só Curtir · Comentar (os números ficam dentro dos botões). */
export function PostSocial({
  postId,
  liked,
  likeCount,
  commentCount,
  targetLabel,
  context,
  viewer,
  viewerOwnsPost = false,
}: PostSocialProps) {
  const { commentsOpen, setCommentsOpen } = useItem();
  const baseId = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const panelId = `comentarios-${baseId}`;
  const countId = `contagem-${baseId}`;

  const count =
    commentCount > 0 ? (
      <span aria-hidden="true" className="text-xs font-bold tabular">
        {formatNumber(commentCount)}
      </span>
    ) : null;

  return (
    <div className="mt-3 border-t border-border pt-1.5">
      <div className="flex flex-wrap items-start gap-1">
        <LikeButton postId={postId} liked={liked} count={likeCount} targetLabel={targetLabel} />
        {context === "detalhe" || !viewer ? (
          <a
            href={context === "detalhe" ? "#comentar" : `/feed/p/${postId}#comentarios`}
            className={actionClass}
          >
            <MessageCircle aria-hidden="true" />
            Comentar
            {count}
            <span className="sr-only"> ({commentsLabel(commentCount)})</span>
          </a>
        ) : (
          <>
            <button
              type="button"
              aria-expanded={commentsOpen}
              aria-controls={commentsOpen ? panelId : undefined}
              aria-label={`Comentar ${targetLabel}`}
              aria-describedby={countId}
              onClick={() => setCommentsOpen(!commentsOpen)}
              className={cn(actionClass, commentsOpen && "text-primary")}
            >
              <MessageCircle aria-hidden="true" className={cn(commentsOpen && "fill-current")} />
              Comentar
              {count}
            </button>
            <span id={countId} hidden>
              {commentsLabel(commentCount)}
            </span>
          </>
        )}
      </div>
      {commentsOpen && viewer && context === "lista" && (
        <CommentPanel
          id={panelId}
          postId={postId}
          commentCount={commentCount}
          viewer={viewer}
          viewerOwnsPost={viewerOwnsPost}
        />
      )}
    </div>
  );
}
