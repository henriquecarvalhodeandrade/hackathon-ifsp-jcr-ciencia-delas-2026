import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CheckCircle2, EyeOff, Lock, LockOpen, MessagesSquare, Pencil, Pin, PinOff, ShieldCheck, Trash2 } from "lucide-react";
import { z } from "zod";
import { Alert, Badge, ButtonLink, Card, ChipLink, Container, EmptyState, Markdown, PageHeader } from "@/components/ui";
import { ActionButton } from "@/components/forum/action-button";
import { AuthorName, ForumAvatar } from "@/components/forum/author";
import { Breadcrumbs } from "@/components/forum/breadcrumbs";
import { CategoryIcon } from "@/components/forum/category-icon";
import { ConfirmActionDialog } from "@/components/forum/confirm-action-dialog";
import { PostCard } from "@/components/forum/post-card";
import { ReactionBar } from "@/components/forum/reaction-bar";
import { ReplyForm } from "@/components/forum/reply-form";
import { ReportButton } from "@/components/moderation/report-button";
import { getCurrentUser, isModerator, requireOnboardedProfile } from "@/lib/auth";
import { deleteThread, moderateThread } from "@/lib/forum/actions";
import { getThreadDetail, getThreadSummary } from "@/lib/forum/queries";
import { markdownToPlainText } from "@/lib/forum/text";
import { formatDateTime, formatRelativeTime, pluralize, toIsoString, truncate } from "@/lib/utils";

type Params = Promise<{ id: string }>;

const idSchema = z.guid();

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const fallback: Metadata = { title: "Tópico do fórum", robots: { index: false } };
  if (!idSchema.safeParse(id).success || !(await getCurrentUser())) return fallback;
  const summary = await getThreadSummary(id);
  if (!summary) return fallback;
  return {
    title: summary.title,
    description: truncate(markdownToPlainText(summary.body), 160),
    robots: { index: false },
  };
}

export default async function ThreadPage({ params }: { params: Params }) {
  const { id } = await params;
  const profile = await requireOnboardedProfile(`/forum/t/${id}`);
  if (!idSchema.safeParse(id).success) notFound();

  const detail = await getThreadDetail(id, profile.id);
  if (!detail) notFound();

  const { thread, posts } = detail;
  const moderator = isModerator(profile);
  const canEdit = thread.isOwner;
  const canDelete = thread.isOwner || moderator;
  const solution = thread.solutionPostId ? posts.find((p) => p.id === thread.solutionPostId) : undefined;
  const threadTarget = thread.author ? `ao tópico de ${thread.author.full_name}` : "ao tópico anônimo";

  return (
    <Container size="narrow">
      <Breadcrumbs
        items={[
          { label: "Fórum", href: "/forum" },
          { label: thread.category.name, href: `/forum/c/${thread.category.slug}` },
          { label: thread.title },
        ]}
      />

      <article aria-labelledby="titulo-topico">
        <PageHeader
          id="cabecalho-topico"
          className="pt-4 pb-5 sm:pt-6 sm:pb-6"
          eyebrow={
            <span className="inline-flex items-center gap-1.5">
              <CategoryIcon icon={thread.category.icon} className="size-4" />
              {thread.category.name}
            </span>
          }
          title={<span id="titulo-topico">{thread.title}</span>}
        >
          <div className="grid gap-4">
            {(thread.isPinned || thread.isLocked || solution || thread.isAnonymous) && (
              <div className="flex flex-wrap gap-1.5">
                {thread.isPinned && (
                  <Badge variant="primary" size="md">
                    <Pin aria-hidden="true" />
                    Fixado
                  </Badge>
                )}
                {solution && (
                  <Badge variant="success" size="md">
                    <CheckCircle2 aria-hidden="true" />
                    Resolvido
                  </Badge>
                )}
                {thread.isLocked && (
                  <Badge variant="warning" size="md">
                    <Lock aria-hidden="true" />
                    Trancado
                  </Badge>
                )}
                {thread.isAnonymous && (
                  <Badge variant="secondary" size="md">
                    <EyeOff aria-hidden="true" />
                    Publicação anônima
                  </Badge>
                )}
              </div>
            )}
            <div className="flex items-center gap-3">
              <ForumAvatar author={thread.author} />
              <div className="grid min-w-0 gap-0.5 text-sm">
                <AuthorName author={thread.author} isOwnAnonymous={thread.isAnonymous && thread.isOwner} />
                <p className="text-fg-subtle">
                  {thread.author?.headline && <span className="text-fg-muted">{thread.author.headline} · </span>}
                  publicado{" "}
                  <time dateTime={toIsoString(thread.createdAt)} title={formatDateTime(thread.createdAt)}>
                    {formatRelativeTime(thread.createdAt)}
                  </time>
                  {thread.editedAt && (
                    <span title={`Editado em ${formatDateTime(thread.editedAt)}`}> · editado</span>
                  )}
                </p>
              </div>
            </div>
          </div>
        </PageHeader>

        <Markdown className="max-w-none">{thread.body}</Markdown>

        {thread.tags.length > 0 && (
          <ul aria-label="Tags" className="mt-6 flex flex-wrap gap-1.5">
            {thread.tags.map((tag) => (
              <li key={tag}>
                <ChipLink href={`/forum?tag=${encodeURIComponent(tag)}`} className="h-7 px-2.5 text-xs">
                  {tag}
                </ChipLink>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-6 flex flex-wrap items-start justify-between gap-x-4 gap-y-3 border-y border-border py-3">
          <ReactionBar threadId={thread.id} reactions={thread.reactions} targetLabel={threadTarget} />
          <div className="flex flex-wrap items-start gap-1">
            {canEdit && (
              <ButtonLink href={`/forum/t/${thread.id}/editar`} variant="ghost" size="sm" className="text-fg-muted">
                <Pencil aria-hidden="true" />
                Editar
              </ButtonLink>
            )}
            {canDelete && (
              <ConfirmActionDialog
                action={deleteThread}
                hiddenFields={{ threadId: thread.id }}
                title="Excluir este tópico?"
                description={`${
                  posts.length > 0 ? `As ${pluralize(posts.length, "resposta")} também serão apagadas. ` : ""
                }Essa ação não pode ser desfeita.`}
                confirmLabel="Sim, excluir tópico"
                pendingLabel="Excluindo…"
                triggerLabel="Excluir"
                triggerIcon={<Trash2 aria-hidden="true" />}
                triggerClassName="text-fg-muted hover:text-danger"
              />
            )}
            {!thread.isOwner && <ReportButton targetType="thread" targetId={thread.id} />}
          </div>
        </div>

        {moderator && (
          <section
            aria-labelledby="moderacao-titulo"
            className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-card border border-dashed border-border-strong bg-surface-2 px-4 py-3"
          >
            <h2 id="moderacao-titulo" className="flex items-center gap-1.5 text-sm font-semibold text-fg">
              <ShieldCheck aria-hidden="true" className="size-4 text-secondary" />
              Moderação
            </h2>
            <ActionButton
              action={moderateThread}
              hiddenFields={{ threadId: thread.id, op: thread.isPinned ? "unpin" : "pin" }}
              pendingText={thread.isPinned ? "Desafixando…" : "Fixando…"}
            >
              {thread.isPinned ? <PinOff aria-hidden="true" /> : <Pin aria-hidden="true" />}
              {thread.isPinned ? "Desafixar" : "Fixar no topo"}
            </ActionButton>
            <ActionButton
              action={moderateThread}
              hiddenFields={{ threadId: thread.id, op: thread.isLocked ? "unlock" : "lock" }}
              pendingText={thread.isLocked ? "Destrancando…" : "Trancando…"}
            >
              {thread.isLocked ? <LockOpen aria-hidden="true" /> : <Lock aria-hidden="true" />}
              {thread.isLocked ? "Destrancar" : "Trancar respostas"}
            </ActionButton>
          </section>
        )}

        {solution && (
          <Alert
            variant="success"
            icon={<CheckCircle2 />}
            title="Esta dúvida foi resolvida"
            className="mt-6"
            actions={
              <ButtonLink href={`#resposta-${solution.id}`} variant="outline" size="sm">
                Ver a resposta escolhida
              </ButtonLink>
            }
          >
            Quem abriu o tópico marcou a resposta{" "}
            {solution.author ? `de ${solution.author.full_name}` : "de uma participante anônima"} como solução.
          </Alert>
        )}
      </article>

      <section aria-labelledby="respostas-titulo" className="pt-10">
        <h2 id="respostas-titulo" className="font-display text-2xl font-semibold text-fg">
          {posts.length > 0 ? pluralize(posts.length, "resposta") : "Respostas"}
        </h2>
        {posts.length > 0 ? (
          <ol className="mt-5 grid gap-4">
            {posts.map((post) => (
              <li key={post.id}>
                <PostCard post={post} thread={thread} viewerIsModerator={moderator} />
              </li>
            ))}
          </ol>
        ) : (
          <EmptyState
            variant="compact"
            headingLevel="h3"
            icon={<MessagesSquare />}
            title="Ainda não há respostas"
            description={
              thread.isOwner
                ? "Assim que alguém responder, você recebe uma notificação."
                : "Que tal ser a primeira a responder? Uma palavra de apoio já faz diferença."
            }
          />
        )}
      </section>

      <section aria-labelledby="responder-titulo" className="pt-10 pb-14">
        <h2 id="responder-titulo" className="font-display text-2xl font-semibold text-fg">
          Responder
        </h2>
        <div className="mt-5 grid gap-4">
          {thread.isLocked && !moderator ? (
            <Alert variant="warning" icon={<Lock />} title="Tópico trancado">
              A moderação trancou este tópico e ele não aceita novas respostas. Se quiser continuar a conversa, abra um
              tópico novo na mesma categoria.
            </Alert>
          ) : (
            <>
              {thread.isLocked && (
                <Alert variant="info" icon={<ShieldCheck />} title="Tópico trancado">
                  As membros não podem responder. Como moderadora, você ainda pode publicar um aviso.
                </Alert>
              )}
              <Card padding="md">
                <ReplyForm threadId={thread.id} allowAnonymous={thread.category.allow_anonymous} />
              </Card>
            </>
          )}
        </div>
      </section>
    </Container>
  );
}
