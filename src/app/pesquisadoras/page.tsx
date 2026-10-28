import type { Metadata } from "next";
import { SearchX, Users } from "lucide-react";
import { DirectoryFilters } from "@/components/profile/directory-filters";
import { ProfileCard } from "@/components/profile/profile-card";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { Container, Section } from "@/components/ui/container";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { requireOnboardedProfile } from "@/lib/auth";
import { groupAreas } from "@/lib/profile/areas";
import {
  activeFilterChips,
  filtersToSearchParams,
  hasActiveFilters,
  parseDirectoryFilters,
} from "@/lib/profile/directory";
import {
  getDirectoryPage,
  getMentorAvailability,
  getOwnOpenSlots,
  getResearchAreas,
} from "@/lib/profile/queries";
import { formatNumber, pluralize } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Pesquisadoras",
  description: "Diretório de pesquisadoras e mentoras da comunidade da Artemis.",
  robots: { index: false },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function PesquisadorasPage({ searchParams }: { searchParams: SearchParams }) {
  const me = await requireOnboardedProfile("/pesquisadoras");
  const filters = parseDirectoryFilters(await searchParams);
  const [areas, page] = await Promise.all([getResearchAreas(), getDirectoryPage(filters)]);
  const availability = await getMentorAvailability(
    page.items
      .filter((profile) => profile.is_mentor && profile.id !== me.id)
      .map((profile) => profile.id),
  );
  const ownSlots = me.is_mentor ? await getOwnOpenSlots(me.id, me.mentor_capacity) : null;
  const areaGroups = groupAreas(areas);
  const active = hasActiveFilters(filters);
  const areaName = filters.area
    ? areas.find((area) => area.slug === filters.area)?.name
    : undefined;
  const firstPageQuery = new URLSearchParams(filtersToSearchParams(filters)).toString();
  const firstPageHref = firstPageQuery ? `/pesquisadoras?${firstPageQuery}` : "/pesquisadoras";
  // Sem resultados com o filtro de trajetória: lembra que as marcas são opcionais.
  const withoutTrajectoryHref = filters.trajetoria
    ? activeFilterChips(filters).find((chip) => chip.key === "trajetoria")?.href
    : undefined;
  // Só a trajetória filtrada: "esses filtros" não faria sentido no título.
  const onlyTrajectory =
    Boolean(filters.trajetoria) && !hasActiveFilters({ ...filters, trajetoria: "" });

  return (
    <Container className="pb-16">
      <PageHeader
        eyebrow="Comunidade"
        title="Pesquisadoras"
        description="Encontre colegas de área, mentoras e pessoas para trocar ideias. O diretório é visível só para membras."
        actions={
          me.seeks_mentorship ? (
            <ButtonLink href="/mentoria">Ver sugestões de mentoras</ButtonLink>
          ) : (
            <ButtonLink href="/pesquisadoras?mentoras=1" variant="outline">
              Ver só mentoras
            </ButtonLink>
          )
        }
      >
        <DirectoryFilters
          key={JSON.stringify(filters)}
          filters={filters}
          areaGroups={areaGroups}
          hasActive={active}
        />
      </PageHeader>

      <Section spacing="sm" aria-labelledby="resultados-titulo">
        <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="resultados-titulo" className="font-display text-xl font-semibold text-fg">
            {page.error || page.outOfRange
              ? "Resultados"
              : page.total === 0
                ? "Nenhuma pesquisadora encontrada"
                : `${pluralize(page.total, "pesquisadora encontrada", "pesquisadoras encontradas")}`}
          </h2>
          {!page.error && page.totalPages > 1 && (
            <p className="text-sm text-fg-subtle">
              Página {formatNumber(Math.min(page.page, page.totalPages))} de{" "}
              {formatNumber(page.totalPages)}
            </p>
          )}
        </div>

        {page.error ? (
          <Alert variant="danger" title="Não conseguimos carregar o diretório agora">
            Verifique sua conexão e recarregue a página. Se continuar, tente de novo em alguns
            minutos.
          </Alert>
        ) : page.outOfRange ? (
          <EmptyState
            icon={<SearchX />}
            headingLevel="h3"
            title="Esta página não tem resultados"
            description="A lista é mais curta do que isso. Volte para a primeira página — os filtros continuam valendo."
            action={<ButtonLink href={firstPageHref}>Ir para a primeira página</ButtonLink>}
          />
        ) : page.items.length === 0 ? (
          withoutTrajectoryHref ? (
            <EmptyState
              icon={<SearchX />}
              headingLevel="h3"
              title={
                onlyTrajectory
                  ? "Ninguém marcou essa trajetória por enquanto"
                  : "Ninguém com esses filtros e essa trajetória"
              }
              description="As marcas de trajetória são opcionais: muitas pesquisadoras preferem não marcar nenhuma. Tente sem este filtro para ver mais gente."
              action={
                <ButtonLink href={withoutTrajectoryHref}>Tirar o filtro de trajetória</ButtonLink>
              }
            />
          ) : active ? (
            <EmptyState
              icon={<SearchX />}
              headingLevel="h3"
              title={
                areaName ? `Ninguém em ${areaName} com esses filtros` : "Ninguém com esses filtros"
              }
              description="Tente outra área, remova um filtro ou busque por parte do nome. A comunidade está crescendo!"
              action={<ButtonLink href="/pesquisadoras">Ver todas as pesquisadoras</ButtonLink>}
            />
          ) : (
            <EmptyState
              icon={<Users />}
              headingLevel="h3"
              title="O diretório ainda está vazio"
              description="Assim que outras pesquisadoras concluírem o perfil, elas aparecem aqui. Que tal convidar colegas?"
              action={<ButtonLink href="/forum">Ir para o fórum</ButtonLink>}
            />
          )
        ) : (
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {page.items.map((profile) => (
              <ProfileCard
                key={profile.id}
                profile={profile}
                isSelf={profile.id === me.id}
                trajectoryFirst={filters.trajetoria || null}
                openSlots={
                  profile.id === me.id
                    ? ownSlots
                    : (availability.get(profile.id)?.openSlots ?? null)
                }
              />
            ))}
          </ul>
        )}

        <Pagination
          className="mt-10"
          page={page.page}
          totalPages={page.totalPages}
          basePath="/pesquisadoras"
          searchParams={filtersToSearchParams(filters)}
        />
      </Section>
    </Container>
  );
}
