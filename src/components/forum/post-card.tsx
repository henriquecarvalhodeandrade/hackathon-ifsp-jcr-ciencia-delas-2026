import { CheckCircle2, CircleCheck, CircleSlash, Trash2 } from "lucide-react";
import { Badge, Markdown } from "@/components/ui";
import { ReportButton } from "@/components/moderation/report-button";
import { deletePost, setSolution } from "@/lib/forum/actions";
import type { PostView, ThreadView } from "@/lib/forum/types";
import { cn, formatDateTime, formatRelativeTime, toIsoString } from "@/lib/utils";
import { ActionButton } from "./action-button";
import { AuthorName, ForumAvatar } from "./author";
import { ConfirmActionDialog } from "./confirm-action-dialog";
import { EditablePost } from "./editable-post";
import { ReactionBar } from "./reaction-bar";

export interface PostCardProps {
  post: PostView;
  thread: Pick<ThreadView, "id" | "isOwner">;
  viewerIsModerator: boolean;
}

/** Uma resposta do tópico: autora/anônima, corpo em Markdown, reações e ações permitidas. */
export function PostCard({ post, thread, viewerIsModerator }: PostCardProps) {
  const headingId = `resposta-${post.id}-autora`;
  const authorLabel = post.author ? `à resposta de ${post.author.full_name}` : "à resposta anônima";
  const canDelete = post.isOwner || viewerIsModerator;
  const canChooseSolution = thread.isOwner || viewerIsModerator;

  return (
    <article
      id={`resposta-${post.id}`}
      aria-labelledby={headingId}
      className={cn(
        "scroll-mt-24 rounded-card border bg-surface p-4 shadow-card sm:p-5",
        post.isSolution ? "border-success ring-1 ring-success/30" : "border-border",
      )}
    >
      <header className="flex items-start gap-3">
        <ForumAvatar author={post.author} size="sm" className="mt-0.5" />
        <div className="grid min-w-0 flex-1 gap-0.5">
          <h3 id={headingId} className="flex flex-wrap items-center gap-x-2 gap-y-1 font-sans text-[0.9375rem]">
            <AuthorName author={post.author} isOwnAnonymous={post.isAnonymous && post.isOwner} />
            {post.isSolution && (
              <Badge variant="success">
                <CheckCircle2 aria-hidden="true" />
                Solução
              </Badge>
            )}
          </h3>
          <p className="text-xs text-fg-subtle">
            <time dateTime={toIsoString(post.createdAt)} title={formatDateTime(post.createdAt)}>
              {formatRelativeTime(post.createdAt)}
            </time>
            {post.editedAt && (
              <>
                {" · "}
                <span title={`Editada em ${formatDateTime(post.editedAt)}`}>editada</span>
              </>
            )}
            {post.author?.headline && <span className="hidden sm:inline"> · {post.author.headline}</span>}
          </p>
        </div>
      </header>

      <div className="mt-3">
        <EditablePost
          postId={post.id}
          threadId={thread.id}
          body={post.body}
          canEdit={post.isOwner}
          reactions={
            <ReactionBar threadId={thread.id} postId={post.id} reactions={post.reactions} targetLabel={authorLabel} />
          }
          actions={
            <>
              {canChooseSolution && (
                <ActionButton
                  action={setSolution}
                  hiddenFields={{ threadId: thread.id, postId: post.isSolution ? "" : post.id }}
                  variant="ghost"
                  pendingText={post.isSolution ? "Desmarcando…" : "Marcando…"}
                  className={post.isSolution ? "text-fg-muted" : "text-success"}
                >
                  {post.isSolution ? <CircleSlash aria-hidden="true" /> : <CircleCheck aria-hidden="true" />}
                  {post.isSolution ? "Desmarcar solução" : "Marcar como solução"}
                </ActionButton>
              )}
              {canDelete && (
                <ConfirmActionDialog
                  action={deletePost}
                  hiddenFields={{ threadId: thread.id, postId: post.id }}
                  title="Excluir esta resposta?"
                  description={
                    post.isOwner
                      ? "A resposta some do tópico para todas. Essa ação não pode ser desfeita."
                      : "Você está excluindo como moderação. Essa ação não pode ser desfeita."
                  }
                  confirmLabel="Sim, excluir"
                  pendingLabel="Excluindo…"
                  triggerLabel="Excluir"
                  triggerIcon={<Trash2 aria-hidden="true" />}
                  triggerClassName="text-fg-muted hover:text-danger"
                />
              )}
              {!post.isOwner && <ReportButton targetType="post" targetId={post.id} />}
            </>
          }
        >
          <Markdown headingOffset={3}>{post.body}</Markdown>
        </EditablePost>
      </div>
    </article>
  );
}
