"use server";

import { z } from "zod";
import { PostCard } from "@/components/feed/post-card";
import { getCurrentProfile, isModerator, type Profile } from "@/lib/auth";
import { parseCursor, parseFeedTab } from "./presentation";
import { getPost, listPosts } from "./queries";

/*
 * Server Actions que devolvem cartões já renderizados no servidor (o mesmo <PostCard> da página,
 * com Markdown e anexos), para o "Carregar mais" acrescentar publicações sem recarregar o feed.
 * Só leem: conferem a sessão e passam pelo RLS como as páginas.
 */

export type RenderedPost = { id: string; node: React.ReactNode };

export type MorePostsResult =
  { ok: true; posts: RenderedPost[]; nextCursor: string | null } | { ok: false; error: string };

export type RenderPostResult = { ok: true; post: RenderedPost | null } | { ok: false };

const SESSION_ERROR = "Sua sessão expirou. Entre novamente para continuar.";

async function getMember(): Promise<Profile | null> {
  const profile = await getCurrentProfile();
  return profile?.onboarded_at ? profile : null;
}

function render(post: Awaited<ReturnType<typeof getPost>>, profile: Profile): RenderedPost | null {
  if (!post) return null;
  return {
    id: post.id,
    node: (
      <PostCard
        post={post}
        viewer={{ id: profile.id, name: profile.full_name, avatarUrl: profile.avatar_url }}
      />
    ),
  };
}

/** A página seguinte do feed (mesma aba), a partir do cursor `antes`. */
export async function loadMorePostsAction(tab: string, before: string): Promise<MorePostsResult> {
  const cursor = parseCursor(before);
  if (!cursor) return { ok: false, error: "Não conseguimos carregar mais publicações." };
  const profile = await getMember();
  if (!profile) return { ok: false, error: SESSION_ERROR };

  try {
    const page = await listPosts({
      viewerId: profile.id,
      viewerIsModerator: isModerator(profile),
      tab: parseFeedTab(tab),
      before: cursor,
    });
    return {
      ok: true,
      posts: page.items.map((post) => render(post, profile)!),
      nextCursor: page.nextCursor,
    };
  } catch {
    return {
      ok: false,
      error: "Não conseguimos carregar mais publicações. Confira sua conexão e tente de novo.",
    };
  }
}

/** Um cartão de novo (depois de editar uma publicação carregada com "Carregar mais"). */
export async function renderPostAction(postId: string): Promise<RenderPostResult> {
  if (!z.guid().safeParse(postId).success) return { ok: false };
  const profile = await getMember();
  if (!profile) return { ok: false };
  try {
    const post = await getPost(postId, profile.id, isModerator(profile));
    return { ok: true, post: render(post, profile) };
  } catch {
    return { ok: false };
  }
}
