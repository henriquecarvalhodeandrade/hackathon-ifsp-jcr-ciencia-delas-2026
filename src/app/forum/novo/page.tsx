import type { Metadata } from "next";
import Link from "next/link";
import { HeartHandshake } from "lucide-react";
import { Card, Container, PageHeader } from "@/components/ui";
import { ThreadForm } from "@/components/forum/thread-form";
import { requireOnboardedProfile } from "@/lib/auth";
import { getCategoryOptions } from "@/lib/forum/queries";

export const metadata: Metadata = {
  title: "Novo tópico",
  robots: { index: false },
};

type SearchParams = Promise<{ categoria?: string | string[] }>;

export default async function NewThreadPage({ searchParams }: { searchParams: SearchParams }) {
  const { categoria } = await searchParams;
  const slug = Array.isArray(categoria) ? categoria[0] : categoria;
  await requireOnboardedProfile(
    slug ? `/forum/novo?categoria=${encodeURIComponent(slug)}` : "/forum/novo",
  );

  const categories = await getCategoryOptions();
  const preselected = slug ? categories.find((c) => c.slug === slug) : undefined;
  const backHref = preselected ? `/forum/c/${preselected.slug}` : "/forum";

  return (
    <Container>
      <PageHeader
        back={{
          href: backHref,
          label: preselected ? `Voltar para ${preselected.name}` : "Voltar ao fórum",
        }}
        eyebrow="Fórum"
        title="Novo tópico"
        description="Traga uma dúvida, uma experiência ou uma oportunidade. Quanto mais contexto, melhores as respostas."
      />

      <div className="grid gap-8 pb-14 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <Card padding="lg">
          <ThreadForm
            mode="create"
            categories={categories.map(({ id, slug: s, name, description, allow_anonymous }) => ({
              id,
              slug: s,
              name,
              description,
              allow_anonymous,
            }))}
            defaultCategoryId={preselected?.id}
            cancelHref={backHref}
          />
        </Card>

        <aside aria-labelledby="dicas-titulo" className="lg:pt-2">
          <Card variant="muted" padding="md" className="grid gap-3">
            <h2
              id="dicas-titulo"
              className="flex items-center gap-2 font-display text-lg font-semibold text-fg"
            >
              <HeartHandshake aria-hidden="true" className="size-5 text-primary" />
              Antes de publicar
            </h2>
            <ul className="grid list-disc gap-2 pl-5 text-sm text-fg-muted marker:text-primary">
              <li>Um título claro ajuda quem pode responder a encontrar seu tópico.</li>
              <li>
                Não exponha nomes ou dados de outras pessoas, principalmente em relatos difíceis.
              </li>
              <li>
                Em “Maternidade”, “Rede de apoio” e “Saúde mental” você pode publicar sem mostrar
                seu nome.
              </li>
              <li>
                Respeito sempre: leia o{" "}
                <Link
                  href="/conduta"
                  className="font-semibold text-primary underline underline-offset-2"
                >
                  código de conduta
                </Link>
                .
              </li>
            </ul>
          </Card>
        </aside>
      </div>
    </Container>
  );
}
