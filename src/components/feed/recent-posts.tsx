import Link from "next/link";
import { ArrowRight, CircleAlert, MessageCircle, Newspaper, Paperclip } from "lucide-react";
import { ButtonLink, EmptyState, buttonVariants } from "@/components/ui";
import { commentsLabel } from "@/lib/feed/presentation";
import { listPosts, settle } from "@/lib/feed/queries";
import type { FeedPostView } from "@/lib/feed/types";
import { markdownToPlainText } from "@/lib/forum/text";
import { cn, formatDateTime, formatRelativeTime, toIsoString, truncate } from "@/lib/utils";
import { LikeButton } from "./like-button";
import { AUTHOR_FALLBACK } from "./post-card";
import { PostKindBadge } from "./post-kind-badge";

export interface RecentPostsProps {
  /** Dona do perfil. */
  authorId: string;
  /** Quem está vendo (curtidas e o texto do estado vazio). */
  viewerId: string;
  limit?: number;
}

/**
 * Publicações recentes de uma pessoa, em cartões compactos (perfil em /pesquisadoras/[id]).
 * Server Component: lê por conta própria e, se falhar, mostra um aviso calmo só neste bloco.
 * Os cartões usam títulos h3 — coloque dentro de uma seção com h2.
 */
export async function RecentPosts({ authorId, viewerId, limit = 3 }: RecentPostsProps) {
  const result = await settle(() => listPosts({ viewerId, authorId, limit }));
  const own = authorId === viewerId;

  if (!result.ok) {
    return (
      <p className="flex items-start gap-2 rounded-control bg-surface-2 px-3.5 py-3 text-sm text-fg-muted">
        <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-warning" />
        <span>
          Não conseguimos carregar as publicações agora. Recarregue a página em instantes.
        </span>
      </p>
    );
  }

  const posts = result.data.items.slice(0, limit);
  if (posts.length === 0) {
    return (
      <EmptyState
        variant="compact"
        headingLevel="h3"
        icon={<Newspaper />}
        title={own ? "Você ainda não publicou no feed" : "Ainda não há publicações"}
        description={
          own
            ? "Conte no que você está trabalhando: um projeto, uma conquista, um evento. Sua rede acompanha por aqui."
            : "Quando ela publicar no feed, as novidades aparecem aqui."
        }
        action={
          own ? (
            <ButtonLink href="/feed" variant="outline" size="sm">
              Escrever no feed
            </ButtonLink>
          ) : undefined
        }
      />
    );
  }

  return (
    <ul className="grid gap-3">
      {posts.map((post) => (
        // min-w-0: o título do anexo (truncate) não pode alargar a coluna do perfil no celular.
        <li key={post.id} className="min-w-0">
          <CompactPostCard post={post} />
        </li>
      ))}
    </ul>
  );
}

/** Cartão compacto: tipo, quando, trecho do texto, anexo em uma linha, curtir e comentários. */
export function CompactPostCard({ post }: { post: FeedPostView }) {
  const headingId = `post-resumo-${post.id}`;
  const name = post.author?.full_name || AUTHOR_FALLBACK;
  const excerpt = truncate(markdownToPlainText(post.body), 280);
  const ghost = cn(buttonVariants({ variant: "ghost", size: "sm" }), "gap-1.5 text-fg-muted");

  return (
    <article
      aria-labelledby={headingId}
      className="min-w-0 rounded-card border border-border bg-surface p-4 shadow-card"
    >
      <h3 id={headingId} className="flex flex-wrap items-center gap-2 font-sans text-sm">
        <PostKindBadge kind={post.kind} />
        <time
          dateTime={toIsoString(post.createdAt)}
          title={formatDateTime(post.createdAt)}
          className="text-xs font-normal text-fg-subtle"
        >
          {formatRelativeTime(post.createdAt)}
        </time>
      </h3>
      <p className="mt-2 text-[0.9375rem] leading-relaxed break-words text-fg">{excerpt}</p>
      {post.attachment && (
        <p className="mt-2 flex items-center gap-1.5 text-sm text-fg-muted">
          <Paperclip aria-hidden="true" className="size-4 shrink-0" />
          <span className="sr-only">Anexo: </span>
          <span className="min-w-0 truncate">{post.attachment.title}</span>
        </p>
      )}
      <div className="mt-3 flex flex-wrap items-start justify-between gap-x-3 gap-y-1 border-t border-border pt-2">
        <div className="flex flex-wrap items-start gap-1">
          <LikeButton
            postId={post.id}
            liked={post.likedByMe}
            count={post.likeCount}
            targetLabel={`a publicação de ${name}`}
          />
          <Link href={`/feed/p/${post.id}#comentarios`} className={ghost}>
            <MessageCircle aria-hidden="true" />
            {post.commentCount > 0 ? commentsLabel(post.commentCount) : "Comentar"}
            <span className="sr-only"> na publicação de {name}</span>
          </Link>
        </div>
        <Link
          href={`/feed/p/${post.id}`}
          aria-describedby={headingId}
          className={cn(ghost, "text-primary")}
        >
          Ver publicação
          <ArrowRight aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}
