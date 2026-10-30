import Link from "next/link";
import { Avatar, Badge, Markdown } from "@/components/ui";
import { deleteCommentAction } from "@/lib/feed/actions";
import { preserveLineBreaks } from "@/lib/feed/presentation";
import type { FeedCommentView } from "@/lib/feed/types";
import { formatDateTime, formatRelativeTime, toIsoString } from "@/lib/utils";
import { EditableComment } from "./editable-comment";
import { ItemProvider } from "./item-context";
import { ItemMenu } from "./item-menu";
import { AUTHOR_FALLBACK } from "./post-card";

export interface CommentListProps {
  comments: FeedCommentView[];
  postId: string;
  /** Autora da publicação (selo "Autora"). */
  postAuthorId: string | null;
  /** A usuária atual é a autora da publicação (apaga comentários nela). */
  viewerOwnsPost: boolean;
}

function deleteDescription(comment: FeedCommentView, name: string, viewerOwnsPost: boolean) {
  if (comment.isOwner) return "Ele some da conversa para todas. Essa ação não pode ser desfeita.";
  if (viewerOwnsPost)
    return `O comentário de ${name} some da sua publicação. Essa ação não pode ser desfeita.`;
  return "Você está apagando como moderação (fica no Registro). Essa ação não pode ser desfeita.";
}

/**
 * Comentários de uma publicação, do mais antigo para o mais novo. Âncora `#comentario-<id>` (o
 * título recebe o foco quando o link aponta para ele). Ações no menu "…" de cada comentário.
 */
export function CommentList({ comments, postId, postAuthorId, viewerOwnsPost }: CommentListProps) {
  return (
    <ol className="grid gap-3">
      {comments.map((comment) => {
        const name = comment.author?.full_name || AUTHOR_FALLBACK;
        const headingId = `comentario-${comment.id}-autora`;
        return (
          <li key={comment.id} id={`comentario-${comment.id}`} className="scroll-mt-24">
            <ItemProvider>
              <article
                aria-labelledby={headingId}
                className="rounded-card border border-border bg-surface p-4"
              >
                <header className="flex items-start gap-3">
                  {comment.author ? (
                    <Link
                      href={`/pesquisadoras/${comment.author.id}`}
                      tabIndex={-1}
                      aria-hidden="true"
                      className="shrink-0 rounded-full"
                    >
                      <Avatar
                        name={name}
                        src={comment.author.avatar_url}
                        seed={comment.author.id}
                        size="sm"
                      />
                    </Link>
                  ) : (
                    <Avatar name={name} seed={comment.id} size="sm" />
                  )}
                  <div className="grid min-w-0 flex-1 gap-0.5">
                    <h3
                      id={headingId}
                      tabIndex={-1}
                      className="flex flex-wrap items-center gap-x-2 gap-y-1 font-sans text-[0.9375rem]"
                    >
                      {comment.author ? (
                        <Link
                          href={`/pesquisadoras/${comment.author.id}`}
                          className="font-semibold text-fg underline-offset-4 hover:text-primary hover:underline"
                        >
                          {name}
                        </Link>
                      ) : (
                        <span className="font-semibold text-fg-muted">{name}</span>
                      )}
                      {comment.isOwner ? (
                        <Badge variant="primary">Você</Badge>
                      ) : (
                        comment.author?.id === postAuthorId && (
                          <Badge variant="secondary">Autora</Badge>
                        )
                      )}
                    </h3>
                    <p className="text-xs text-fg-subtle">
                      <time
                        dateTime={toIsoString(comment.createdAt)}
                        title={formatDateTime(comment.createdAt)}
                      >
                        {formatRelativeTime(comment.createdAt)}
                      </time>
                      {comment.edited && <span> · editado</span>}
                      {comment.author?.headline && (
                        <span className="hidden sm:inline"> · {comment.author.headline}</span>
                      )}
                    </p>
                  </div>
                  <ItemMenu
                    label={`Mais ações: comentário de ${name}`}
                    permalink={`/feed/p/${postId}#comentario-${comment.id}`}
                    canEdit={comment.isOwner}
                    remove={
                      comment.canDelete
                        ? {
                            action: deleteCommentAction,
                            hiddenFields: { commentId: comment.id, postId },
                            title: "Apagar este comentário?",
                            description: deleteDescription(comment, name, viewerOwnsPost),
                            after: { kind: "comment", commentId: comment.id },
                          }
                        : undefined
                    }
                    report={
                      comment.isOwner
                        ? undefined
                        : { targetType: "feed_comment", targetId: comment.id }
                    }
                    className="-mt-1 -mr-2"
                  />
                </header>
                <div className="mt-2.5">
                  <EditableComment commentId={comment.id} postId={postId} body={comment.body}>
                    <Markdown headingOffset={3} className="text-[0.9375rem] break-words">
                      {preserveLineBreaks(comment.body)}
                    </Markdown>
                  </EditableComment>
                </div>
              </article>
            </ItemProvider>
          </li>
        );
      })}
    </ol>
  );
}
