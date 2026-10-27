import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { Card, Container, PageHeader } from "@/components/ui";
import { Breadcrumbs } from "@/components/forum/breadcrumbs";
import { ThreadForm } from "@/components/forum/thread-form";
import { isModerator, requireOnboardedProfile } from "@/lib/auth";
import { getEditableThread } from "@/lib/forum/queries";

export const metadata: Metadata = {
  title: "Editar tópico",
  robots: { index: false },
};

type Params = Promise<{ id: string }>;

export default async function EditThreadPage({ params }: { params: Params }) {
  const { id } = await params;
  const profile = await requireOnboardedProfile(`/forum/t/${id}/editar`);
  if (!z.guid().safeParse(id).success) notFound();

  const thread = await getEditableThread(id, profile.id, isModerator(profile));
  if (!thread) notFound();

  const threadHref = `/forum/t/${thread.id}`;

  return (
    <Container size="narrow">
      <Breadcrumbs
        items={[
          { label: "Fórum", href: "/forum" },
          { label: thread.category.name, href: `/forum/c/${thread.category.slug}` },
          { label: thread.title, href: threadHref },
          { label: "Editar" },
        ]}
      />
      <PageHeader
        className="pt-4 sm:pt-6"
        eyebrow="Fórum"
        title="Editar tópico"
        description={
          thread.isOwner
            ? "Ajuste o título, o texto ou as tags. A data de edição fica visível para todas."
            : "Você está editando como moderação. Prefira corrigir só o necessário."
        }
      />
      <Card padding="lg" className="mb-14">
        <ThreadForm
          mode="edit"
          threadId={thread.id}
          category={thread.category}
          isAnonymous={thread.is_anonymous}
          initial={{ title: thread.title, body: thread.body, tags: thread.tags }}
          cancelHref={threadHref}
        />
      </Card>
    </Container>
  );
}
