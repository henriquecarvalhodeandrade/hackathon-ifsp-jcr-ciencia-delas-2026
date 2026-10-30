"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { ArrowDown } from "lucide-react";
import { buttonVariants, Spinner } from "@/components/ui";
import { feedHref, type FeedTab } from "@/lib/feed/presentation";
import {
  loadMorePostsAction,
  renderPostAction,
  type RenderedPost,
} from "@/lib/feed/render-actions";
import { pluralize } from "@/lib/utils";
import { announce, focusPost, POST_CHANGED_EVENT, type PostChangedDetail } from "./dom";

export interface LoadMoreProps {
  tab: FeedTab;
  /** Cursor da próxima página (null = acabou). */
  initialCursor: string | null;
  /** Quantas publicações já estão na página (numeração da lista acrescentada). */
  shownCount: number;
}

/**
 * "Carregar mais": acrescenta a página seguinte abaixo das publicações, sem recarregar nem perder
 * o lugar. O botão é um link para `?antes=<cursor>` — sem JavaScript, ele abre a página seguinte.
 * Depois de carregar, anuncia quantas chegaram e leva o foco à primeira nova.
 * Os cartões acrescentados não fazem parte da página revalidada: quando um deles é apagado ou
 * editado, o evento POST_CHANGED_EVENT tira o cartão ou pede a versão nova ao servidor.
 */
export function LoadMore({ tab, initialCursor, shownCount }: LoadMoreProps) {
  const [posts, setPosts] = useState<RenderedPost[]>([]);
  const [cursor, setCursor] = useState(initialCursor);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Lista atual para o ouvinte do evento (sem efeitos dentro do atualizador do estado).
  const postsRef = useRef(posts);
  useEffect(() => {
    postsRef.current = posts;
  }, [posts]);

  useEffect(() => {
    function onChanged(event: Event) {
      const { postId, deleted } = (event as CustomEvent<PostChangedDetail>).detail;
      if (!postsRef.current.some((post) => post.id === postId)) return;
      if (deleted) {
        setPosts((list) => list.filter((post) => post.id !== postId));
        return;
      }
      renderPostAction(postId)
        .then((result) => {
          if (!result.ok) return;
          setPosts((list) =>
            result.post
              ? list.map((post) => (post.id === postId ? result.post! : post))
              : list.filter((post) => post.id !== postId),
          );
        })
        .catch(() => {});
    }
    window.addEventListener(POST_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(POST_CHANGED_EVENT, onChanged);
  }, []);

  function loadMore(event: React.MouseEvent<HTMLAnchorElement>) {
    if (!cursor || event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
    event.preventDefault();
    if (pending) return;
    setError(null);
    startTransition(async () => {
      const result = await loadMorePostsAction(tab, cursor).catch(() => null);
      if (!result?.ok) {
        setError(
          result?.error ?? "Não conseguimos carregar mais publicações. Confira sua conexão.",
        );
        return;
      }
      const seen = new Set(
        Array.from(document.querySelectorAll<HTMLElement>("article[data-post-id]")).map(
          (el) => el.dataset.postId,
        ),
      );
      const fresh = result.posts.filter((post) => !seen.has(post.id));
      setPosts((list) => [...list, ...fresh]);
      setCursor(result.nextCursor);
      announce(
        fresh.length > 0
          ? `Mais ${pluralize(fresh.length, "publicação carregada", "publicações carregadas")}.`
          : "Não há mais publicações.",
      );
      if (fresh[0]) requestAnimationFrame(() => focusPost(fresh[0]!.id));
    });
  }

  return (
    <>
      {posts.length > 0 && (
        <ol start={shownCount + 1} className="grid gap-4">
          {posts.map((post) => (
            <li key={post.id}>{post.node}</li>
          ))}
        </ol>
      )}
      {cursor ? (
        <div className="grid justify-items-center gap-2 pt-2">
          <a
            href={feedHref({ tab, before: cursor })}
            onClick={loadMore}
            aria-busy={pending || undefined}
            className={buttonVariants({ variant: "outline" })}
          >
            {pending ? <Spinner size={16} decorative /> : <ArrowDown aria-hidden="true" />}
            {pending ? "Carregando…" : "Carregar mais"}
          </a>
          {error && (
            <p role="alert" className="text-sm font-medium text-danger">
              {error}
            </p>
          )}
        </div>
      ) : (
        <p className="pt-2 text-center text-sm text-fg-subtle">
          Você viu todas as publicações{tab === "seguindo" ? " de quem você segue" : ""}.
        </p>
      )}
    </>
  );
}
