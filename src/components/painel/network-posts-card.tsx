import Link from "next/link";
import { ArrowRight, MessageCircle, Newspaper, PenLine } from "lucide-react";
import { LikeButton } from "@/components/feed/like-button";
import { Avatar, ButtonLink, buttonVariants } from "@/components/ui";
import { commentsLabel, postKindLabel } from "@/lib/feed/presentation";
import { listPosts } from "@/lib/feed/queries";
import type { FeedPostView } from "@/lib/feed/types";
import { markdownToPlainText } from "@/lib/forum/text";
import { cn, formatDateTime, formatRelativeTime, toIsoString, truncate } from "@/lib/utils";
import { PainelSection } from "./painel-section";

/** Quantas publicações o bloco mostra (as mais recentes de quem ela segue). */
export const NETWORK_POSTS_SHOWN = 2;
/** Lidas a mais: a aba "Seguindo" inclui as dela, que ficam de fora daqui. */
const FETCHED = 6;

export interface NetworkPosts {
  posts: FeedPostView[];
  /** "seguindo" = de quem ela segue; "todas" = ela ainda não segue ninguém que publicou. */
  source: "seguindo" | "todas";
}

/**
 * Leitura própria do bloco (fora das 6 idas do loadPainelData): as publicações recentes de quem
 * ela segue, sem as dela. Se ninguém que ela segue publicou ainda, as mais recentes da rede.
 * Falhou → null (o bloco mostra o aviso calmo; os outros continuam).
 */
export async function loadNetworkPosts(userId: string): Promise<NetworkPosts | null> {
  try {
    const others = (items: FeedPostView[]) =>
      items.filter((post) => !post.isOwner).slice(0, NETWORK_POSTS_SHOWN);
    const following = others(
      (await listPosts({ viewerId: userId, tab: "seguindo", limit: FETCHED })).items,
    );
    if (following.length > 0) return { posts: following, source: "seguindo" };
    const everyone = others(
      (await listPosts({ viewerId: userId, tab: "todas", limit: FETCHED })).items,
    );
    return { posts: everyone, source: "todas" };
  } catch (error) {
    console.warn(`[painel] da sua rede — ${String(error).slice(0, 160)}`);
    return null;
  }
}

const ghost = cn(buttonVariants({ variant: "ghost", size: "sm" }), "gap-1.5 text-fg-muted");

/** Publicação em forma curta: quem, quando, o começo do texto, curtir e comentar ali mesmo. */
function NetworkPost({ post }: { post: FeedPostView }) {
  const headingId = `painel-post-${post.id}`;
  const name = post.author?.full_name?.trim() || "Pesquisadora";
  const excerpt = truncate(markdownToPlainText(post.body), 220);

  return (
    <article
      aria-labelledby={headingId}
      className="min-w-0 rounded-control border border-border bg-surface p-3.5 sm:p-4"
    >
      <div className="flex items-center gap-3">
        <Avatar name={name} src={post.author?.avatar_url} seed={post.author?.id ?? post.id} />
        <div className="grid min-w-0 gap-0.5">
          <h3 id={headingId} className="truncate font-sans text-[0.9375rem] font-semibold text-fg">
            {post.author ? (
              <Link
                href={`/pesquisadoras/${post.author.id}`}
                className="rounded-control underline-offset-4 hover:text-primary hover:underline"
              >
                {name}
              </Link>
            ) : (
              name
            )}
          </h3>
          <p className="text-xs text-fg-subtle">
            {postKindLabel(post.kind)} ·{" "}
            <time dateTime={toIsoString(post.createdAt)} title={formatDateTime(post.createdAt)}>
              {formatRelativeTime(post.createdAt)}
            </time>
          </p>
        </div>
      </div>
      <p className="mt-2.5 line-clamp-4 text-[0.9375rem] leading-relaxed break-words text-fg">
        {excerpt}
      </p>
      <div className="mt-2.5 flex flex-wrap items-start justify-between gap-x-3 gap-y-1 border-t border-border pt-2">
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

/**
 * "Da sua rede" (Server Component com leitura própria): as duas publicações mais recentes de quem
 * ela segue, com curtir e comentar ali mesmo, e o atalho "Compartilhar novidade" para o feed.
 */
export async function NetworkPostsCard({ userId }: { userId: string }) {
  const result = await loadNetworkPosts(userId);
  const empty = result !== null && result.posts.length === 0;
  return (
    <PainelSection
      titleId="painel-da-rede"
      title="Da sua rede"
      description={
        result?.source === "todas" && !empty
          ? "Você ainda não segue quem publicou. Veja o que a rede está contando:"
          : "O que as pessoas que você segue andam publicando."
      }
      icon={<Newspaper />}
      failed={result === null}
      action={
        <ButtonLink href="/feed?escrever=1" size="sm">
          <PenLine aria-hidden="true" />
          Compartilhar novidade
        </ButtonLink>
      }
    >
      {empty ? (
        <p className="text-sm text-fg-muted">
          Ainda não há publicações por aqui. Conte no feed no que você está trabalhando ou encontre
          pessoas para{" "}
          <Link
            href="/rede?aba=sugestoes"
            className="font-semibold text-primary underline underline-offset-2"
          >
            seguir e se conectar
          </Link>
          .
        </p>
      ) : (
        <div className="grid gap-3">
          <ul className="grid gap-3">
            {result?.posts.map((post) => (
              <li key={post.id} className="min-w-0">
                <NetworkPost post={post} />
              </li>
            ))}
          </ul>
          <Link
            href={result?.source === "seguindo" ? "/feed?aba=seguindo" : "/feed"}
            className="inline-flex items-center gap-1.5 justify-self-start rounded-control text-sm font-semibold text-primary underline-offset-4 hover:underline"
          >
            Ver mais no feed
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </div>
      )}
    </PainelSection>
  );
}
