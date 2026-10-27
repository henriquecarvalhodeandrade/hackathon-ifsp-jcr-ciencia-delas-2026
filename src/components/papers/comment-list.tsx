import Link from "next/link";
import { ReportButton } from "@/components/moderation/report-button";
import { Avatar, Badge } from "@/components/ui";
import type { PaperComment } from "@/lib/papers/queries";
import { formatDateTime, formatRelativeTime, toIsoString } from "@/lib/utils";
import { DeleteCommentButton } from "./delete-comment-button";

export interface CommentListProps {
  comments: PaperComment[];
  paperId: string;
  viewerId: string;
  /** Moderação pode apagar qualquer comentário (o RLS confere). */
  canModerate: boolean;
  /** Quem enviou o paper (para o selo "Enviou o paper"). */
  submitterId: string;
}

export function CommentList({
  comments,
  paperId,
  viewerId,
  canModerate,
  submitterId,
}: CommentListProps) {
  return (
    <ol className="grid gap-3">
      {comments.map((comment) => {
        const own = comment.author_id === viewerId;
        const name = comment.author?.full_name || "Pesquisadora";
        return (
          <li key={comment.id} id={`comentario-${comment.id}`}>
            <article className="grid gap-3 rounded-card border border-border bg-surface p-4 sm:p-5">
              <header className="flex items-start gap-3">
                <Avatar
                  name={name}
                  src={comment.author?.avatar_url}
                  seed={comment.author_id}
                  size="sm"
                />
                <div className="grid min-w-0 flex-1 gap-0.5">
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <Link
                      href={`/pesquisadoras/${comment.author_id}`}
                      className="font-semibold text-fg hover:text-primary hover:underline"
                    >
                      {name}
                    </Link>
                    {own && <Badge variant="primary">Você</Badge>}
                    {comment.author_id === submitterId && (
                      <Badge variant="secondary">Enviou o paper</Badge>
                    )}
                  </p>
                  {comment.author?.headline && (
                    <p className="truncate text-sm text-fg-subtle">{comment.author.headline}</p>
                  )}
                </div>
                <time
                  dateTime={toIsoString(comment.created_at)}
                  title={formatDateTime(comment.created_at)}
                  className="shrink-0 text-xs text-fg-subtle"
                >
                  {formatRelativeTime(comment.created_at)}
                </time>
              </header>
              <p className="text-[0.9375rem] leading-relaxed break-words whitespace-pre-line text-fg">
                {comment.body}
              </p>
              <footer className="flex flex-wrap items-center justify-end gap-2">
                {(own || canModerate) && (
                  <DeleteCommentButton
                    commentId={comment.id}
                    paperId={paperId}
                    asModerator={!own}
                  />
                )}
                {!own && <ReportButton targetType="paper_comment" targetId={comment.id} />}
              </footer>
            </article>
          </li>
        );
      })}
    </ol>
  );
}
