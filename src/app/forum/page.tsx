import type { Metadata } from "next";
import Link from "next/link";
import { MessagesSquare, Plus, SearchX, Tag, X } from "lucide-react";
import {
  ButtonLink,
  Container,
  EmptyState,
  PageHeader,
  Pagination,
  Section,
} from "@/components/ui";
import { CategoryGrid } from "@/components/forum/category-grid";
import { ForumSearch } from "@/components/forum/forum-search";
import { ThreadList } from "@/components/forum/thread-list";
import { requireOnboardedProfile } from "@/lib/auth";
import { getForumCategories, listThreads } from "@/lib/forum/queries";
import {
  FORUM_PAGE_SIZE,
  parsePage,
  sanitizeSearchTerm,
  sanitizeTag,
  totalPages,
} from "@/lib/forum/text";
import { pluralize } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Fórum",
  description:
    "Conversas da comunidade Ciência Delas: carreira, bolsas, pesquisa, maternidade e apoio.",
  robots: { index: false },
};

type SearchParams = Promise<{
  q?: string | string[];
  tag?: string | string[];
  pagina?: string | string[];
}>;

export default async function ForumPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const q = sanitizeSearchTerm(params.q);
  const tag = sanitizeTag(params.tag);
  const page = parsePage(params.pagina);
  const filtering = Boolean(q || tag);

  const nextPath = `/forum${q || tag ? `?${new URLSearchParams({ ...(q && { q }), ...(tag && { tag }) })}` : ""}`;
  const profile = await requireOnboardedProfile(nextPath);

  const [categories, recent, pinned] = await Promise.all([
    getForumCategories(),
    listThreads({
      viewerId: profile.id,
      q: q || undefined,
      tag: tag || undefined,
      // Sem filtro, os fixados aparecem numa seção própria (só na primeira página).
      pinned: filtering ? undefined : false,
      page,
    }),
    !filtering && page === 1
      ? listThreads({ viewerId: profile.id, pinned: true, pageSize: 6 })
      : Promise.resolve({ items: [], total: 0 }),
  ]);

  const pages = totalPages(recent.total, FORUM_PAGE_SIZE);
  const paginationParams = { ...(q && { q }), ...(tag && { tag }) };
  const firstName = profile.full_name.split(" ")[0] || "pesquisadora";

  return (
    <Container>
      <PageHeader
        eyebrow="Comunidade"
        title="Fórum"
        description={`Pergunte, compartilhe e acolha, ${firstName}. Aqui as conversas são só entre membros da rede.`}
        actions={
          <ButtonLink href="/forum/novo">
            <Plus aria-hidden="true" />
            Novo tópico
          </ButtonLink>
        }
      >
        <ForumSearch action="/forum" defaultValue={q} />
      </PageHeader>

      {filtering ? (
        <Section spacing="sm" className="pt-0" aria-label="Resultados da busca">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2
              className="font-display text-xl font-semibold text-fg sm:text-2xl"
              aria-live="polite"
            >
              {pluralize(recent.total, "resultado")}
              {q && <> para “{q}”</>}
              {tag && (
                <span className="ml-2 inline-flex items-center gap-1 align-middle text-base font-medium text-fg-muted">
                  <Tag aria-hidden="true" className="size-4" />
                  {tag}
                </span>
              )}
            </h2>
            <Link
              href="/forum"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
            >
              <X aria-hidden="true" className="size-4" />
              Limpar busca
            </Link>
          </div>
          {recent.items.length > 0 ? (
            <ThreadList threads={recent.items} showExcerpt={Boolean(q)} />
          ) : (
            <EmptyState
              icon={<SearchX />}
              title="Nada encontrado por aqui"
              description="Tente outras palavras ou abra um tópico novo — sua dúvida pode ajudar outras pesquisadoras."
              action={
                <>
                  <ButtonLink href="/forum" variant="outline">
                    Ver todas as conversas
                  </ButtonLink>
                  <ButtonLink href="/forum/novo">Abrir um tópico</ButtonLink>
                </>
              }
            />
          )}
          <Pagination
            page={page}
            totalPages={pages}
            basePath="/forum"
            searchParams={paginationParams}
            className="mt-6"
          />
        </Section>
      ) : (
        <>
          {page === 1 && (
            <Section
              spacing="sm"
              className="pt-0"
              title="Categorias"
              description="Escolha um espaço para conversar. As marcadas com “Anonimato” aceitam publicações anônimas."
            >
              <CategoryGrid categories={categories} />
            </Section>
          )}

          {pinned.items.length > 0 && (
            <Section spacing="sm" title="Fixados pela moderação">
              <ThreadList threads={pinned.items} />
            </Section>
          )}

          <Section
            spacing="sm"
            className="pb-14"
            title="Conversas recentes"
            description={
              recent.total > 0
                ? `${pluralize(recent.total, "tópico")}, com a atividade mais recente primeiro.`
                : undefined
            }
          >
            {recent.items.length > 0 ? (
              <ThreadList threads={recent.items} />
            ) : (
              <EmptyState
                icon={<MessagesSquare />}
                title={
                  page > 1 ? "Esta página está vazia" : "O fórum está esperando a primeira conversa"
                }
                description={
                  page > 1
                    ? "Volte para a primeira página para ver as conversas mais recentes."
                    : "Apresente-se, conte da sua pesquisa ou traga uma dúvida. A comunidade responde."
                }
                action={
                  page > 1 ? (
                    <ButtonLink href="/forum" variant="outline">
                      Ir para a primeira página
                    </ButtonLink>
                  ) : (
                    <ButtonLink href="/forum/novo">Abrir o primeiro tópico</ButtonLink>
                  )
                }
              />
            )}
            <Pagination page={page} totalPages={pages} basePath="/forum" className="mt-6" />
          </Section>
        </>
      )}
    </Container>
  );
}
