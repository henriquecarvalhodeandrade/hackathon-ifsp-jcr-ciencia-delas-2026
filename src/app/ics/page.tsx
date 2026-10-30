import type { Metadata } from "next";
import { ClipboardList, Microscope, Plus, SearchX, Sparkles } from "lucide-react";
import { OpportunityCard } from "@/components/opportunities/opportunity-card";
import { OpportunityFilters } from "@/components/opportunities/opportunity-filters";
import {
  Alert,
  ButtonLink,
  ChipLink,
  Container,
  EmptyState,
  PageHeader,
  Pagination,
  Section,
} from "@/components/ui";
import { requireOnboardedProfile } from "@/lib/auth";
import { CAREER_STAGES, type CareerStage } from "@/lib/constants";
import { canPublishOpportunities } from "@/lib/opportunities/labels";
import { OPPORTUNITIES_PAGE_SIZE } from "@/lib/opportunities/limits";
import {
  currentListHref,
  filtersHref,
  filtersToSearchParams,
  hasActiveFilters,
  parseOpportunityFilters,
} from "@/lib/opportunities/params";
import { getMyApplicationStatuses, listOpportunities } from "@/lib/opportunities/queries";
import { getResearchAreas } from "@/lib/papers/queries";
import { formatNumber, pluralize } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Explorar ICs",
  description:
    "Vagas de iniciação científica, IC Júnior, TCC, extensão e voluntariado publicadas por pesquisadoras da Artemis.",
  robots: { index: false },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function IcsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const filters = parseOpportunityFilters(params);
  const me = await requireOnboardedProfile(currentListHref(filters));

  const now = new Date();
  const areas = await getResearchAreas();
  const result = await listOpportunities(filters, areas, now);
  const applied = await getMyApplicationStatuses(
    me.id,
    result.items.map((o) => o.id),
  );

  const canPublish = canPublishOpportunities(me.career_stage);
  const active = hasActiveFilters(filters);
  const totalPages = Math.max(1, Math.ceil(result.total / OPPORTUNITIES_PAGE_SIZE));
  const outOfRange = result.ok && result.items.length === 0 && filters.page > 1 && result.total > 0;
  const myStage =
    me.career_stage && me.career_stage in CAREER_STAGES ? (me.career_stage as CareerStage) : null;
  const myStageHref =
    myStage && filters.etapa !== myStage ? filtersHref(filters, { etapa: myStage }) : null;

  return (
    <Container className="pb-16">
      <PageHeader
        eyebrow="Oportunidades"
        title="Explorar ICs"
        description="Vagas de iniciação científica, IC Júnior, TCC, extensão e voluntariado abertas por pesquisadoras da comunidade. Candidate-se aqui mesmo."
        actions={
          <>
            <ButtonLink href="/ics/minhas" variant="outline">
              <ClipboardList aria-hidden="true" />
              Minhas candidaturas
            </ButtonLink>
            {canPublish && (
              <ButtonLink href="/ics/nova">
                <Plus aria-hidden="true" />
                Publicar oportunidade
              </ButtonLink>
            )}
          </>
        }
      />

      {/* Fora do PageHeader: no celular a barra de busca fica fixa enquanto a lista rola. Sem
          `key`: o formulário não remonta a cada filtro (o foco fica no campo que mudou). */}
      <OpportunityFilters
        filters={filters}
        areas={areas}
        myStage={myStage}
        total={result.ok ? result.total : null}
      />

      <Section spacing="sm" aria-labelledby="resultados-ics">
        <div className="mb-5 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
          <h2
            id="resultados-ics"
            aria-live="polite"
            aria-atomic="true"
            className="font-display text-xl font-semibold text-fg"
          >
            {!result.ok || outOfRange
              ? "Vagas"
              : result.total === 0
                ? "Nenhuma vaga encontrada"
                : filters.encerradas
                  ? pluralize(result.total, "vaga encontrada", "vagas encontradas")
                  : pluralize(result.total, "vaga aberta", "vagas abertas")}
          </h2>
          <div className="flex flex-wrap items-center gap-3">
            {myStageHref && (
              <ChipLink href={myStageHref} scroll={false} icon={<Sparkles aria-hidden="true" />}>
                Para a minha etapa
              </ChipLink>
            )}
            {result.ok && totalPages > 1 && (
              <p className="text-sm text-fg-subtle">
                Página {formatNumber(Math.min(filters.page, totalPages))} de{" "}
                {formatNumber(totalPages)}
              </p>
            )}
          </div>
        </div>

        {!result.ok ? (
          <Alert variant="danger" title="Não conseguimos carregar as vagas agora.">
            Atualize a página em instantes. Se continuar, avise a equipe pelo fórum.
          </Alert>
        ) : outOfRange ? (
          <EmptyState
            icon={<SearchX />}
            headingLevel="h3"
            title="Esta página não tem resultados"
            description={`A lista tem ${formatNumber(totalPages)} ${totalPages === 1 ? "página" : "páginas"} com esses filtros. Volte para a primeira — os filtros continuam valendo.`}
            action={<ButtonLink href={filtersHref(filters)}>Ir para a primeira página</ButtonLink>}
          />
        ) : result.items.length === 0 ? (
          active ? (
            <EmptyState
              icon={<SearchX />}
              headingLevel="h3"
              title="Nenhuma vaga com esses filtros"
              description={
                filters.encerradas
                  ? "Tente outra área, outro tipo ou menos filtros. Novas vagas chegam toda semana."
                  : "Tente outra área ou menos filtros — ou inclua as vagas encerradas para ver o que já passou por aqui."
              }
              action={
                <>
                  {!filters.encerradas && (
                    <ButtonLink href={filtersHref(filters, { encerradas: true })} variant="outline">
                      Mostrar encerradas
                    </ButtonLink>
                  )}
                  <ButtonLink href="/ics">Ver todas as vagas abertas</ButtonLink>
                </>
              }
            />
          ) : (
            <EmptyState
              icon={<Microscope />}
              headingLevel="h3"
              title="Ainda não há vagas abertas"
              description={
                canPublish
                  ? "Tem um projeto procurando estudantes? Publique a primeira oportunidade — ela aparece aqui e pode ir para o feed."
                  : "Assim que pesquisadoras publicarem vagas, elas aparecem aqui. Enquanto isso, que tal conhecer quem pesquisa na sua área?"
              }
              action={
                canPublish ? (
                  <ButtonLink href="/ics/nova">
                    <Plus aria-hidden="true" />
                    Publicar oportunidade
                  </ButtonLink>
                ) : (
                  <ButtonLink href="/pesquisadoras">Ver pesquisadoras</ButtonLink>
                )
              }
            />
          )
        ) : (
          <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {result.items.map((opportunity) => (
              <li key={opportunity.id}>
                <OpportunityCard
                  opportunity={opportunity}
                  myApplication={applied.get(opportunity.id) ?? null}
                  isOwn={opportunity.owner_id === me.id}
                  now={now}
                />
              </li>
            ))}
          </ul>
        )}

        <Pagination
          className="mt-10"
          page={filters.page}
          totalPages={totalPages}
          basePath="/ics"
          searchParams={filtersToSearchParams(filters)}
        />
      </Section>
    </Container>
  );
}
