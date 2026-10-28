import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Send } from "lucide-react";
import { ButtonLink, Card, Container } from "@/components/ui";
import { EditionView } from "@/components/newsletter/edition-view";
import { getCurrentUser } from "@/lib/auth";
import { getAdjacentEditions, getEditionBySlug } from "@/lib/newsletter/queries";
import { truncate } from "@/lib/utils";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const edition = await getEditionBySlug(slug).catch(() => null);
  if (!edition) return { title: "Edição não encontrada", robots: { index: false, follow: false } };
  const description = edition.summary
    ? truncate(edition.summary, 160)
    : "Os destaques da semana na Artemis.";
  return {
    title: edition.title,
    description,
    openGraph: { type: "article", title: edition.title, description },
    ...(edition.status === "draft" ? { robots: { index: false, follow: false } } : {}),
  };
}

function SubscribeCta() {
  return (
    <Card
      variant="muted"
      padding="lg"
      className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="grid gap-1">
        <p className="font-display text-xl font-semibold text-fg">
          Receba a próxima edição no seu e-mail
        </p>
        <p className="text-fg-muted">Toda segunda-feira, de graça. Cancele quando quiser.</p>
      </div>
      <ButtonLink href="/newsletter#assinar" className="shrink-0">
        <Send aria-hidden="true" />
        Assinar o boletim
      </ButtonLink>
    </Card>
  );
}

export default async function NewsletterEditionPage({ params }: Props) {
  const { slug } = await params;
  const edition = await getEditionBySlug(slug);
  if (!edition) notFound();

  const [user, adjacent] = await Promise.all([
    getCurrentUser(),
    getAdjacentEditions(edition.published_at),
  ]);

  return (
    <Container size="narrow">
      <Link
        href="/newsletter"
        className="mt-8 inline-flex items-center gap-1.5 rounded-control text-sm font-semibold text-fg-muted transition-colors hover:text-primary sm:mt-12"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        Todas as edições
      </Link>
      <EditionView
        edition={edition}
        viewerIsMember={Boolean(user)}
        older={adjacent.older}
        newer={adjacent.newer}
        footer={<SubscribeCta />}
      />
    </Container>
  );
}
