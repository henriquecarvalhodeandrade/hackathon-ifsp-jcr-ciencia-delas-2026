import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MessagesSquare } from "lucide-react";
import { z } from "zod";
import { Card, Container, EmptyState, PageHeader } from "@/components/ui";
import { CommentForm } from "@/components/feed/comment-form";
import { CommentList } from "@/components/feed/comment-list";
import { LIVE_REGION_ID } from "@/components/feed/dom";
import { AUTHOR_FALLBACK, PostCard } from "@/components/feed/post-card";
import { ScrollToHash } from "@/components/feed/scroll-to-hash";
import { getCurrentUser, isModerator, requireOnboardedProfile } from "@/lib/auth";
import { commentsLabel } from "@/lib/feed/presentation";
import { getPostDetail, getPostSummary } from "@/lib/feed/queries";
import { markdownToPlainText } from "@/lib/forum/text";
import { truncate } from "@/lib/utils";

type Params = Promise<{ id: string }>;

const idSchema = z.guid();

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const fallback: Metadata = { title: "Publicação", robots: { index: false } };
  // Sem sessão o texto não é consultado (o feed é só para membras).
  if (!(await getCurrentUser())) return fallback;
  // (O `metadata` de um not-found.tsx aninhado é ignorado pelo Next — o título do 404 vem daqui.)
  const missing: Metadata = { title: "Publicação não encontrada", robots: { index: false } };
  if (!idSchema.safeParse(id).success) return missing;
  const summary = await getPostSummary(id);
  if (!summary) return missing;
  const name = summary.author?.full_name;
  return {
    title: name ? `Publicação de ${name}` : "Publicação",
    description: truncate(markdownToPlainText(summary.body), 160),
    robots: { index: false },
  };
}

/** /feed/p/[id] — uma publicação com todos os comentários. Oculta, apagada ou id inválido → 404. */
export default async function PostPage({ params }: { params: Params }) {
  const { id } = await params;
  const profile = await requireOnboardedProfile(`/feed/p/${id}`);
  if (!idSchema.safeParse(id).success) notFound();

  const detail = await getPostDetail(id, profile.id, isModerator(profile));
  if (!detail) notFound();

  const { post, comments } = detail;
  const name = post.author?.full_name || AUTHOR_FALLBACK;

  return (
    <Container size="narrow" className="pb-14">
      <PageHeader
        className="pt-6 pb-5 sm:pt-8 sm:pb-6"
        back={{ href: "/feed", label: "Voltar ao feed", preferHistory: true }}
        title={post.isOwner ? "Sua publicação" : `Publicação de ${name}`}
      />

      <p id={LIVE_REGION_ID} aria-live="polite" className="sr-only" />
      {/* Link "N comentários" do feed: leva ao # depois de montar (navegação pelo cliente). */}
      <ScrollToHash key={post.id} />

      <PostCard post={post} context="detalhe" headingAs="h2" />

      <section id="comentarios" aria-labelledby="comentarios-titulo" className="scroll-mt-24 pt-10">
        <h2
          id="comentarios-titulo"
          tabIndex={-1}
          className="font-display text-2xl font-semibold text-fg"
        >
          {comments.length > 0 ? commentsLabel(comments.length) : "Comentários"}
        </h2>
        <div className="mt-5 grid gap-6">
          {comments.length > 0 ? (
            <CommentList
              comments={comments}
              postId={post.id}
              postAuthorId={post.author?.id ?? null}
              viewerOwnsPost={post.isOwner}
            />
          ) : (
            <EmptyState
              variant="compact"
              headingLevel="h3"
              icon={<MessagesSquare />}
              title="Ainda não há comentários"
              description={
                post.isOwner
                  ? "Quando alguém comentar, você recebe um aviso."
                  : `Que tal ser a primeira a comentar? Uma palavra de incentivo para ${name} já faz diferença.`
              }
            />
          )}
          <Card padding="md">
            <CommentForm postId={post.id} />
          </Card>
        </div>
      </section>
    </Container>
  );
}
