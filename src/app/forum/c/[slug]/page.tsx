import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EyeOff, Plus, SearchX, Tag, X } from "lucide-react";
import {
  Alert,
  ButtonLink,
  Container,
  EmptyState,
  PageHeader,
  Pagination,
  Section,
} from "@/components/ui";
import { CategoryIcon } from "@/components/forum/category-icon";
import { ForumSearch } from "@/components/forum/forum-search";
import { ThreadList } from "@/components/forum/thread-list";
import { requireOnboardedProfile } from "@/lib/auth";
import { getCategoryBySlug, listThreads } from "@/lib/forum/queries";
import {
  FORUM_PAGE_SIZE,
  parsePage,
  sanitizeSearchTerm,
  sanitizeTag,
  totalPages,
} from "@/lib/forum/text";
import { pluralize } from "@/lib/utils";

type Params = Promise<{ slug: string }>;
type SearchParams = Promise<{
  q?: string | string[];
  tag?: string | string[];
  pagina?: string | string[];
}>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCategoryBySlug(slug);
  return {
    title: category ? `${category.name} · Fórum` : "Categoria do fórum",
    description: category?.description || undefined,
    robots: { index: false },
  };
}

export default async function ForumCategoryPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const basePath = `/forum/c/${slug}`;
  const profile = await requireOnboardedProfile(basePath);

  const category = await getCategoryBySlug(slug);
  if (!category) notFound();

  const q = sanitizeSearchTerm(query.q);
  const tag = sanitizeTag(query.tag);
  const page = parsePage(query.pagina);
  const filtering = Boolean(q || tag);

  const { items, total } = await listThreads({
    viewerId: profile.id,
    categoryId: category.id,
    q: q || undefined,
    tag: tag || undefined,
    page,
  });
  const pages = totalPages(total, FORUM_PAGE_SIZE);
  const paginationParams = { ...(q && { q }), ...(tag && { tag }) };
  const newHref = `/forum/novo?categoria=${category.slug}`;

  return (
    <Container>
      <PageHeader
        back={{ href: "/forum", label: "Voltar ao fórum" }}
        eyebrow={
          <span className="inline-flex items-center gap-1.5">
            <CategoryIcon icon={category.icon} className="size-4" />
            Categoria do fórum
          </span>
        }
        title={category.name}
        description={category.description || undefined}
        actions={
          <ButtonLink href={newHref}>
            <Plus aria-hidden="true" />
            Novo tópico aqui
          </ButtonLink>
        }
      >
        <div className="grid gap-4">
          {category.allow_anonymous && (
            <Alert variant="info" icon={<EyeOff />} title="Este espaço aceita publicações anônimas">
              Você pode abrir tópicos e responder sem mostrar seu nome. A moderação consegue ver a
              autoria apenas para agir em casos graves de segurança. Leia o{" "}
              <Link href="/conduta">código de conduta</Link>.
            </Alert>
          )}
          <ForumSearch
            action={basePath}
            defaultValue={q}
            placeholder={`Buscar em ${category.name}`}
          />
        </div>
      </PageHeader>

      <Section spacing="sm" className="pt-0 pb-14" aria-label={`Tópicos em ${category.name}`}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-xl font-semibold text-fg sm:text-2xl">
            {filtering ? pluralize(total, "resultado") : pluralize(total, "tópico")}
            {q && <> para “{q}”</>}
            {tag && (
              <span className="ml-2 inline-flex items-center gap-1 align-middle text-base font-medium text-fg-muted">
                <Tag aria-hidden="true" className="size-4" />
                {tag}
              </span>
            )}
          </h2>
          {filtering && (
            <Link
              href={basePath}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
            >
              <X aria-hidden="true" className="size-4" />
              Limpar busca
            </Link>
          )}
        </div>

        {items.length > 0 ? (
          <ThreadList
            threads={items}
            showCategory={false}
            showExcerpt={Boolean(q)}
            tagBasePath={basePath}
          />
        ) : filtering ? (
          <EmptyState
            icon={<SearchX />}
            title="Nada encontrado nesta categoria"
            description="Tente outras palavras, busque no fórum todo ou abra um tópico novo."
            action={
              <>
                <ButtonLink
                  href={
                    q
                      ? `/forum?q=${encodeURIComponent(q)}`
                      : `/forum?tag=${encodeURIComponent(tag)}`
                  }
                  variant="outline"
                >
                  Buscar no fórum todo
                </ButtonLink>
                <ButtonLink href={newHref}>Abrir um tópico</ButtonLink>
              </>
            }
          />
        ) : (
          <EmptyState
            icon={<CategoryIcon icon={category.icon} />}
            title={page > 1 ? "Esta página está vazia" : "Ainda não há conversas aqui"}
            description={
              page > 1
                ? "Volte para a primeira página da categoria."
                : "Que tal começar? Uma pergunta simples já abre espaço para outras pesquisadoras."
            }
            action={
              page > 1 ? (
                <ButtonLink href={basePath} variant="outline">
                  Ir para a primeira página
                </ButtonLink>
              ) : (
                <ButtonLink href={newHref}>Abrir o primeiro tópico</ButtonLink>
              )
            }
          />
        )}
        <Pagination
          page={page}
          totalPages={pages}
          basePath={basePath}
          searchParams={paginationParams}
          className="mt-6"
        />
      </Section>
    </Container>
  );
}
