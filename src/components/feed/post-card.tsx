import Link from "next/link";
import { MessageCircle, Trash2 } from "lucide-react";
import { Avatar, ConfirmDialog, Markdown, buttonVariants } from "@/components/ui";
import { deletePostAction } from "@/lib/feed/actions";
import { careerStageLabel, commentsLabel, preserveLineBreaks } from "@/lib/feed/presentation";
import type { FeedPostView } from "@/lib/feed/types";
import { cn, formatDateTime, formatRelativeTime, toIsoString } from "@/lib/utils";
import { ReportButton } from "@/components/moderation/report-button";
import { EditablePost } from "./editable-post";
import { LikeButton } from "./like-button";
import { PostAttachment, PostLink } from "./post-attachment";
import { PostKindBadge } from "./post-kind-badge";

export const AUTHOR_FALLBACK = "Pesquisadora";

export interface PostCardProps {
  post: FeedPostView;
  /** "lista" (feed) ou "detalhe" (página da publicação: apagar volta para o feed). */
  context?: "lista" | "detalhe";
  /** Nível do título com o nome da autora (h3 na lista; h2 na página da publicação). */
  headingAs?: "h2" | "h3";
}

/**
 * Uma publicação do feed: autora (link para o perfil), tipo, texto em Markdown (como no
 * fórum), link externo, anexo, curtir, comentários e as ações permitidas.
 * Âncora `#post-<id>`: o compositor rola até ela depois de publicar.
 */
export function PostCard({ post, context = "lista", headingAs = "h3" }: PostCardProps) {
  const anchorId = `post-${post.id}`;
  const headingId = `${anchorId}-autora`;
  const name = post.author?.full_name || AUTHOR_FALLBACK;
  const stage = careerStageLabel(post.author?.career_stage);
  const Heading = headingAs;
  const targetLabel = `a publicação de ${name}`;

  return (
    <article
      id={anchorId}
      aria-labelledby={headingId}
      className="scroll-mt-24 rounded-card border border-border bg-surface p-4 shadow-card sm:p-5"
    >
      <header className="flex items-start gap-3">
        <Avatar name={name} src={post.author?.avatar_url} seed={post.author?.id ?? post.id} />
        <div className="grid min-w-0 flex-1 gap-0.5">
          <Heading id={headingId} className="font-sans text-[0.9375rem] leading-snug">
            {post.author ? (
              <Link
                href={`/pesquisadoras/${post.author.id}`}
                className="font-semibold text-fg underline-offset-4 transition-colors hover:text-primary hover:underline"
              >
                {name}
              </Link>
            ) : (
              <span className="font-semibold text-fg-muted">{name}</span>
            )}
          </Heading>
          {post.author?.headline && (
            <p className="line-clamp-2 text-sm text-fg-muted sm:line-clamp-1">
              {post.author.headline}
            </p>
          )}
          <p className="text-xs text-fg-subtle">
            {stage && <span>{stage} · </span>}
            <time dateTime={toIsoString(post.createdAt)} title={formatDateTime(post.createdAt)}>
              {formatRelativeTime(post.createdAt)}
            </time>
            {post.edited && <span> · editada</span>}
          </p>
        </div>
        <PostKindBadge kind={post.kind} className="shrink-0" />
      </header>

      <div className="mt-3">
        <EditablePost
          postId={post.id}
          kind={post.kind}
          body={post.body}
          linkUrl={post.link?.href ?? null}
          canEdit={post.isOwner}
          footer={
            <>
              <LikeButton
                postId={post.id}
                liked={post.likedByMe}
                count={post.likeCount}
                targetLabel={targetLabel}
              />
              <CommentsLink post={post} context={context} name={name} />
            </>
          }
          actions={
            <>
              {post.canDelete && (
                <ConfirmDialog
                  stateAction={deletePostAction}
                  hiddenFields={{ postId: post.id, from: context }}
                  triggerLabel={post.isOwner ? "Apagar" : "Apagar (moderação)"}
                  triggerIcon={<Trash2 aria-hidden="true" />}
                  triggerVariant="ghost"
                  triggerSize="sm"
                  triggerClassName="text-fg-muted hover:text-danger"
                  title="Apagar esta publicação?"
                  description={`${
                    post.isOwner ? "" : "Você está apagando como moderação (fica no Registro). "
                  }${
                    post.commentCount === 0
                      ? "Ela some do feed para todas."
                      : post.commentCount === 1
                        ? "O comentário e as curtidas também somem."
                        : `Os ${commentsLabel(post.commentCount)} e as curtidas também somem.`
                  } Essa ação não pode ser desfeita.`}
                  confirmLabel="Sim, apagar"
                  pendingLabel="Apagando…"
                />
              )}
              {!post.isOwner && (
                <ReportButton targetType="feed_post" targetId={post.id} className="text-fg-muted" />
              )}
            </>
          }
        >
          <Markdown headingOffset={headingAs === "h2" ? 2 : 3} className="break-words">
            {preserveLineBreaks(post.body)}
          </Markdown>
          {post.link && (
            <p className="mt-3">
              <PostLink link={post.link} />
            </p>
          )}
          {post.attachment && <PostAttachment attachment={post.attachment} className="mt-3" />}
        </EditablePost>
      </div>
    </article>
  );
}

/** Na lista: leva aos comentários. Na página da publicação: pula para o campo de comentar. */
function CommentsLink({
  post,
  context,
  name,
}: {
  post: FeedPostView;
  context: "lista" | "detalhe";
  name: string;
}) {
  const className = cn(buttonVariants({ variant: "ghost", size: "sm" }), "gap-1.5 text-fg-muted");
  if (context === "detalhe") {
    return (
      <a href="#comentar" className={className}>
        <MessageCircle aria-hidden="true" />
        Comentar
      </a>
    );
  }
  return (
    <Link href={`/feed/p/${post.id}#comentarios`} className={className}>
      <MessageCircle aria-hidden="true" />
      {post.commentCount > 0 ? commentsLabel(post.commentCount) : "Comentar"}
      <span className="sr-only"> na publicação de {name}</span>
    </Link>
  );
}
