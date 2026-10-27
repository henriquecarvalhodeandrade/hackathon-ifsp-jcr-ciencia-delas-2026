import type { Metadata } from "next";
import { BookOpen, Plus, Trophy } from "lucide-react";
import { PaperCard } from "@/components/papers/paper-card";
import { PaperFilters } from "@/components/papers/paper-filters";
import { VitrineUnavailable } from "@/components/papers/vitrine-unavailable";
import { Alert, ButtonLink, Container, EmptyState, PageHeader, Pagination, TabNav } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";
import {
  PAPERS_PAGE_SIZE,
  VITRINE_ORDER_LABELS,
  VITRINE_ORDER_ORDER,
  buildHref,
  parseAreaSlug,
  parsePage,
  parseSearch,
  parseVitrineOrder,
  rankBadgeLabel,
  rankingVotes,
  type VitrineOrder,
} from "@/lib/papers/params";
import { getResearchAreas, getVotedPaperIds, listVitrine } from "@/lib/papers/queries";
import { RANKING_PERIOD_EXPLANATIONS } from "@/lib/ranking/hot";
import { formatNumber, pluralize } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Vitrine de papers",
  description:
    "Papers com autoria de mulheres, indicados pela comunidade Ciência Delas, com resumos em linguagem simples e destaques.",
};

const PAGE_TITLE = "Papers de pesquisadoras";
const PAGE_DESCRIPTION =
  "Trabalhos com autoria de mulheres, indicados pela comunidade. Leia o resumo acessível e destaque os que você recomenda.";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const ORDER_EXPLANATIONS: Record<VitrineOrder, string> = {
  ...RANKING_PERIOD_EXPLANATIONS,
  recent: "Os papers que chegaram por último à Vitrine aparecem primeiro.",
};

export default async function PapersPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const order = parseVitrineOrder(params.periodo);
  const areaSlug = parseAreaSlug(params.area);
  const q = parseSearch(params.q);
  const page = parsePage(params.pagina);

  if (!isSupabaseConfigured()) {
    return (
      <Container className="pb-16">
        <PageHeader eyebrow="Vitrine Delas" title={PAGE_TITLE} description={PAGE_DESCRIPTION} />
        <VitrineUnavailable />
      </Container>
    );
  }

  const user = await getCurrentUser();
  const [areas, result] = await Promise.all([getResearchAreas(), listVitrine({ order, areaSlug, q, page })]);
  const votedIds = await getVotedPaperIds(user?.id ?? null, result.items.map((p) => p.id));

  const selectedArea = areaSlug ? areas.find((a) => a.slug === areaSlug) : undefined;
  const totalPages = Math.max(1, Math.ceil(result.total / PAPERS_PAGE_SIZE));
  const currentHref = buildHref("/papers", { periodo: order === "hot" ? null : order, area: areaSlug, q, pagina: page });
  const loginHref = `/entrar?next=${encodeURIComponent(currentHref)}`;
  const submitHref = user ? "/papers/novo" : `/entrar?next=${encodeURIComponent("/papers/novo")}`;
  const showRankBadges = page === 1 && !q && order !== "recent";

  const tabs = VITRINE_ORDER_ORDER.map((value) => ({
    href: buildHref("/papers", { periodo: value === "hot" ? null : value, area: areaSlug, q }),
    label: VITRINE_ORDER_LABELS[value],
    active: value === order,
  }));

  return (
    <Container className="pb-16">
      <PageHeader
        eyebrow="Vitrine Delas"
        title={PAGE_TITLE}
        description={PAGE_DESCRIPTION}
        actions={
          <>
            <ButtonLink href="/ranking" variant="outline">
              <Trophy aria-hidden="true" />
              Ver ranking
            </ButtonLink>
            <ButtonLink href={submitHref}>
              <Plus aria-hidden="true" />
              Divulgar um paper
            </ButtonLink>
          </>
        }
      >
        <TabNav label="Ordenação da Vitrine" items={tabs} />
      </PageHeader>

      <div className="grid gap-6">
        {params.removido === "1" && (
          <Alert variant="success" title="Paper removido da Vitrine.">
            Ele não aparece mais nas listas nem no ranking.
          </Alert>
        )}

        <PaperFilters
          areas={areas}
          order={order}
          areaSlug={areaSlug}
          q={q}
          action="/papers"
          clearHref={buildHref("/papers", { periodo: order === "hot" ? null : order })}
        />

        <div aria-live="polite" className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 text-sm text-fg-muted">
          <p>
            <span className="font-semibold text-fg">{pluralize(result.total, "paper")}</span>
            {q && (
              <>
                {" "}
                com “<span className="font-semibold text-fg">{q}</span>” no título
              </>
            )}
            {selectedArea && (
              <>
                {" "}
                em <span className="font-semibold text-fg">{selectedArea.name}</span>
              </>
            )}
          </p>
          <p>
            {q && order !== "recent"
              ? "Na busca, os mais destacados aparecem primeiro."
              : ORDER_EXPLANATIONS[order]}
          </p>
        </div>

        {!result.ok ? (
          <Alert variant="danger" title="Não conseguimos carregar os papers agora.">
            Atualize a página em instantes. Se continuar, avise a equipe pelo fórum.
          </Alert>
        ) : result.items.length === 0 ? (
          <EmptyState
            icon={<BookOpen />}
            title={
              page > 1 && result.total > 0
                ? "Esta página não existe"
                : q || areaSlug
                  ? "Nenhum paper encontrado com esses filtros"
                  : "A Vitrine ainda está vazia"
            }
            description={
              page > 1 && result.total > 0
                ? `A Vitrine tem ${formatNumber(totalPages)} ${totalPages === 1 ? "página" : "páginas"} com esses filtros.`
                : q || areaSlug
                  ? "Tente outra palavra ou outra área. Conhece um trabalho que deveria estar aqui? Indique!"
                  : "Que tal indicar o primeiro paper? Pode ser seu ou de outra pesquisadora."
            }
            action={
              <>
                {(q || areaSlug || page > 1) && (
                  <ButtonLink href="/papers" variant="outline">
                    Ver todos os papers
                  </ButtonLink>
                )}
                <ButtonLink href={submitHref}>
                  <Plus aria-hidden="true" />
                  Divulgar um paper
                </ButtonLink>
              </>
            }
          />
        ) : (
          <section aria-labelledby="lista-papers">
            <h2 id="lista-papers" className="sr-only">
              Papers — {VITRINE_ORDER_LABELS[order]}
            </h2>
            <ul className="grid gap-4 lg:grid-cols-2">
              {result.items.map((paper, index) => (
                <li key={paper.id}>
                  <PaperCard
                    paper={paper}
                    voted={votedIds.has(paper.id)}
                    viewer={!user ? "guest" : paper.submitted_by === user.id ? "owner" : "member"}
                    loginHref={loginHref}
                    rankBadge={
                      showRankBadges && index < 3 && rankingVotes(order, paper) > 0
                        ? rankBadgeLabel(index + 1, order)
                        : null
                    }
                  />
                </li>
              ))}
            </ul>
          </section>
        )}

        <Pagination
          page={page}
          totalPages={totalPages}
          basePath="/papers"
          searchParams={{ periodo: order === "hot" ? undefined : order, area: areaSlug ?? undefined, q: q || undefined }}
        />
      </div>
    </Container>
  );
}
