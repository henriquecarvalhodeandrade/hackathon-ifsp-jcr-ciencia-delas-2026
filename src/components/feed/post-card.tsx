import Link from "next/link";
import { Avatar, Markdown } from "@/components/ui";
import { deletePostAction } from "@/lib/feed/actions";
import {
  careerStageLabel,
  commentsLabel,
  portfolioKindLabel,
  postKindLabel,
  preserveLineBreaks,
} from "@/lib/feed/presentation";
import type { FeedPostView, FeedViewer } from "@/lib/feed/types";
import { formatDateTime, formatRelativeTime, toIsoString } from "@/lib/utils";
import { EditablePost } from "./editable-post";
import { ItemProvider } from "./item-context";
import { ItemMenu } from "./item-menu";
import { PostAttachment, PostLink } from "./post-attachment";
import { KIND_ICONS } from "./post-kind-badge";
import { PostSocial } from "./post-social";

export const AUTHOR_FALLBACK = "Pesquisadora";

export interface PostCardProps {
  post: FeedPostView;
  /** "lista" (feed) ou "detalhe" (página da publicação: apagar volta para o feed). */
  context?: "lista" | "detalhe";
  /** Nível do título com o nome da autora (h3 na lista; h2 na página da publicação). */
  headingAs?: "h2" | "h3";
  /** Quem está vendo: habilita o painel de comentários dentro do cartão. */
  viewer?: FeedViewer | null;
}

function deleteDescription(post: FeedPostView): string {
  const moderation = post.isOwner ? "" : "Você está apagando como moderação (fica no Registro). ";
  const consequence =
    post.commentCount === 0
      ? "Ela some do feed para todas."
      : post.commentCount === 1
        ? "O comentário e as curtidas também somem."
        : `Os ${commentsLabel(post.commentCount)} e as curtidas também somem.`;
  return `${moderation}${consequence} Essa ação não pode ser desfeita.`;
}

/**
 * Uma publicação do feed. Cabeçalho: autora (foto e nome levam ao perfil), título, "tipo ·
 * etapa · quando" (o quando leva à página da publicação) e o menu "…" (copiar link, editar,
 * apagar, denunciar). Corpo em Markdown (como no fórum), link e anexo. Rodapé: Curtir · Comentar.
 * Âncora `#post-<id>` e `tabIndex=-1`: o foco volta para cá depois de publicar ou apagar.
 */
export function PostCard({
  post,
  context = "lista",
  headingAs = "h3",
  viewer = null,
}: PostCardProps) {
  const anchorId = `post-${post.id}`;
  const headingId = `${anchorId}-autora`;
  const name = post.author?.full_name || AUTHOR_FALLBACK;
  const stage = careerStageLabel(post.author?.career_stage);
  const kindLabel = postKindLabel(post.kind);
  const KindIcon = KIND_ICONS[post.kind];
  const Heading = headingAs;
  const permalink = `/feed/p/${post.id}`;
  const targetLabel = `a publicação de ${name}`;
  const hideAttachmentKind =
    post.attachment?.type === "portfolio" && portfolioKindLabel(post.attachment.kind) === kindLabel;

  const avatar = (
    <Avatar name={name} src={post.author?.avatar_url} seed={post.author?.id ?? post.id} />
  );

  return (
    <ItemProvider>
      <article
        id={anchorId}
        data-post-id={post.id}
        tabIndex={-1}
        aria-labelledby={headingId}
        className="scroll-mt-24 rounded-card border border-border bg-surface p-4 shadow-card transition-shadow duration-700 ease-out-soft data-[destaque]:ring-2 data-[destaque]:ring-primary data-[destaque]:duration-150 motion-reduce:transition-none sm:p-5"
      >
        <header className="flex items-start gap-3">
          {post.author ? (
            // O nome já leva ao perfil: a foto é o mesmo link, fora do Tab e da leitura.
            <Link
              href={`/pesquisadoras/${post.author.id}`}
              tabIndex={-1}
              aria-hidden="true"
              className="shrink-0 rounded-full"
            >
              {avatar}
            </Link>
          ) : (
            avatar
          )}
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
              <p className="line-clamp-1 text-sm text-fg-muted">{post.author.headline}</p>
            )}
            <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-fg-subtle">
              <span className="inline-flex items-center gap-1 font-semibold text-fg-muted">
                <KindIcon aria-hidden="true" className="size-3.5" />
                {kindLabel}
              </span>
              {stage && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{stage}</span>
                </>
              )}
              <span aria-hidden="true">·</span>
              <Link
                href={permalink}
                className="rounded-badge underline-offset-4 hover:text-primary hover:underline"
              >
                <span className="sr-only">Publicação de {name}: </span>
                <time dateTime={toIsoString(post.createdAt)} title={formatDateTime(post.createdAt)}>
                  {formatRelativeTime(post.createdAt)}
                </time>
              </Link>
              {post.edited && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>editada</span>
                </>
              )}
            </p>
          </div>
          <ItemMenu
            label={`Mais ações: publicação de ${name}`}
            permalink={permalink}
            canEdit={post.isOwner}
            remove={
              post.canDelete
                ? {
                    action: deletePostAction,
                    hiddenFields: { postId: post.id, from: context },
                    title: "Apagar esta publicação?",
                    description: deleteDescription(post),
                    after: { kind: "post", postId: post.id },
                  }
                : undefined
            }
            report={post.isOwner ? undefined : { targetType: "feed_post", targetId: post.id }}
            className="-mt-1 -mr-2"
          />
        </header>

        <div className="mt-3">
          <EditablePost
            postId={post.id}
            kind={post.kind}
            body={post.body}
            linkUrl={post.link?.href ?? null}
          >
            <Markdown headingOffset={headingAs === "h2" ? 2 : 3} className="break-words">
              {preserveLineBreaks(post.body)}
            </Markdown>
            {post.link && (
              <p className="mt-3">
                <PostLink link={post.link} />
              </p>
            )}
            {post.attachment && (
              <PostAttachment
                attachment={post.attachment}
                hideKind={hideAttachmentKind}
                className="mt-3"
              />
            )}
          </EditablePost>
        </div>

        <PostSocial
          postId={post.id}
          liked={post.likedByMe}
          likeCount={post.likeCount}
          commentCount={post.commentCount}
          targetLabel={targetLabel}
          context={context}
          viewer={viewer}
        />
      </article>
    </ItemProvider>
  );
}
