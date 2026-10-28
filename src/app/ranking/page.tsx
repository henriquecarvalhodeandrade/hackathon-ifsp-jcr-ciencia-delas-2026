import type { Metadata } from "next";
import { BookOpen, Info, Lock, LogIn, Telescope, Trophy, Users } from "lucide-react";
import { PaperFilters } from "@/components/papers/paper-filters";
import { VitrineUnavailable } from "@/components/papers/vitrine-unavailable";
import { Leaderboard, LeaderboardRules } from "@/components/ranking/leaderboard";
import { Podium } from "@/components/ranking/podium";
import { RankingList } from "@/components/ranking/ranking-list";
import {
  Alert,
  ButtonLink,
  Card,
  ChipLink,
  Container,
  EmptyState,
  PageHeader,
  TabNav,
} from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { RANKING_PERIODS, SITE, type RankingPeriod } from "@/lib/constants";
import { isSupabaseConfigured } from "@/lib/env";
import {
  RANKING_LIMIT,
  RANKING_PERIOD_ORDER,
  VITRINE_ORDER_EXPLANATIONS,
  buildHref,
  parseAreaSlug,
  parseRankingPeriod,
} from "@/lib/papers/params";
import {
  getCommunityLeaderboard,
  getResearchAreas,
  getVotedPaperIds,
  listRanking,
} from "@/lib/papers/queries";

export const metadata: Metadata = {
  title: "Ranking",
  description:
    "Os papers de pesquisadoras mais destacados pela comunidade da Artemis — em alta, na semana, no mês, no ano e de todos os tempos.",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const DOCS_URL = `${SITE.repoUrl}/blob/main/docs/05-papers-e-ranking.md#como-o-ranking-funciona`;

const PERIOD_HEADINGS: Record<RankingPeriod, string> = {
  hot: "Em alta agora",
  week: "Destaques da semana",
  month: "Destaques do mês",
  year: "Destaques do ano",
  all: "Mais destacados de todos os tempos",
};

export default async function RankingPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const tab = params.aba === "comunidade" ? "comunidade" : "papers";
  const period = parseRankingPeriod(params.periodo, "week");
  const areaSlug = parseAreaSlug(params.area);

  const header = (
    <PageHeader
      eyebrow="Ranking"
      title="Destaques da comunidade"
      description="Os papers mais destacados por período e as pesquisadoras que mais fortalecem a rede."
      actions={
        <ButtonLink href="/papers" variant="outline">
          <BookOpen aria-hidden="true" />
          Ir para a Vitrine
        </ButtonLink>
      }
    >
      <TabNav
        label="Tipo de ranking"
        items={[
          {
            href: buildHref("/ranking", {
              periodo: period === "week" ? null : period,
              area: areaSlug,
            }),
            label: "Papers",
            icon: <Trophy aria-hidden="true" />,
            active: tab === "papers",
          },
          {
            href: "/ranking?aba=comunidade",
            label: "Comunidade",
            icon: <Users aria-hidden="true" />,
            active: tab === "comunidade",
          },
        ]}
      />
    </PageHeader>
  );

  if (!isSupabaseConfigured()) {
    return (
      <Container className="pb-16">
        {header}
        <VitrineUnavailable />
      </Container>
    );
  }

  const user = await getCurrentUser();

  return (
    <Container className="pb-16">
      {header}
      {tab === "comunidade" ? (
        <CommunityTab userId={user?.id ?? null} />
      ) : (
        <PapersTab period={period} areaSlug={areaSlug} userId={user?.id ?? null} />
      )}
    </Container>
  );
}

async function PapersTab({
  period,
  areaSlug,
  userId,
}: {
  period: RankingPeriod;
  areaSlug: string | null;
  userId: string | null;
}) {
  const [areas, result] = await Promise.all([
    getResearchAreas(),
    listRanking({ period, areaSlug, limit: RANKING_LIMIT }),
  ]);
  const votedIds = await getVotedPaperIds(
    userId,
    result.items.map((p) => p.id),
  );
  const currentHref = buildHref("/ranking", {
    periodo: period === "week" ? null : period,
    area: areaSlug,
  });
  const viewer = { userId, votedIds, loginHref: `/entrar?next=${encodeURIComponent(currentHref)}` };
  const areaName = areaSlug ? areas.find((a) => a.slug === areaSlug)?.name : undefined;

  return (
    <div className="grid gap-6">
      <div className="grid gap-4">
        <nav
          aria-label="Período do ranking"
          className="-mx-4 scrollbar-none overflow-x-auto px-4 sm:mx-0 sm:px-0"
        >
          <ul className="flex min-w-max gap-2">
            {RANKING_PERIOD_ORDER.map((value) => (
              <li key={value}>
                <ChipLink
                  href={buildHref("/ranking", {
                    periodo: value === "week" ? null : value,
                    area: areaSlug,
                  })}
                  active={value === period}
                >
                  {RANKING_PERIODS[value]}
                </ChipLink>
              </li>
            ))}
          </ul>
        </nav>
        <PaperFilters
          areas={areas}
          order={period}
          areaSlug={areaSlug}
          withSearch={false}
          action="/ranking"
          clearHref={buildHref("/ranking", { periodo: period === "week" ? null : period })}
        />
        <Card variant="muted" className="flex items-start gap-3 p-4 text-sm text-fg-muted">
          <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-info" />
          <p>
            <span className="font-semibold text-fg">Como este ranking funciona: </span>
            {VITRINE_ORDER_EXPLANATIONS[period]} Empates são decididos pelo total de destaques e,
            depois, pelo paper mais novo.{" "}
            <a
              href={DOCS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-primary underline underline-offset-2"
            >
              Entenda as fórmulas<span className="sr-only"> (abre em nova aba)</span>
            </a>
          </p>
        </Card>
      </div>

      <section aria-labelledby="titulo-ranking" className="grid gap-5">
        <h2 id="titulo-ranking" className="font-display text-2xl font-semibold text-fg">
          {PERIOD_HEADINGS[period]}
          {areaName && <span className="text-fg-muted"> em {areaName}</span>}
        </h2>
        {!result.ok ? (
          <Alert variant="danger" title="Não conseguimos carregar o ranking agora.">
            Atualize a página em instantes.
          </Alert>
        ) : result.items.length === 0 ? (
          <EmptyState
            icon={<Telescope />}
            title={
              areaName
                ? `Ainda não há destaques em ${areaName} neste período`
                : "Ainda não há destaques neste período"
            }
            description="Que tal explorar a Vitrine e destacar os papers que você recomenda? Cada destaque ajuda uma pesquisadora a ganhar visibilidade."
            action={
              <>
                <ButtonLink href="/papers">Explorar a Vitrine</ButtonLink>
                {period !== "all" && (
                  <ButtonLink
                    href={buildHref("/ranking", { periodo: "all", area: areaSlug })}
                    variant="outline"
                  >
                    Ver todos os tempos
                  </ButtonLink>
                )}
              </>
            }
          />
        ) : (
          <>
            <Podium papers={result.items} period={period} viewer={viewer} />
            <RankingList
              papers={result.items.slice(3)}
              period={period}
              startAt={4}
              viewer={viewer}
            />
          </>
        )}
      </section>
    </div>
  );
}

async function CommunityTab({ userId }: { userId: string | null }) {
  if (!userId) {
    const next = encodeURIComponent("/ranking?aba=comunidade");
    return (
      <EmptyState
        icon={<Lock />}
        title="O ranking da comunidade é só para membros"
        description="Ele reconhece quem mais contribui com a rede — com mentorias, papers, destaques recebidos e respostas no fórum. Entre para ver e para fazer parte dele."
        action={
          <>
            <ButtonLink href={`/entrar?next=${next}`}>
              <LogIn aria-hidden="true" />
              Entrar
            </ButtonLink>
            <ButtonLink href={`/cadastro?next=${next}`} variant="outline">
              Criar conta
            </ButtonLink>
          </>
        }
      />
    );
  }

  const result = await getCommunityLeaderboard(RANKING_LIMIT);
  const inList = result.items.some((e) => e.profile_id === userId);

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
      <section aria-labelledby="titulo-comunidade" className="grid gap-4">
        <div className="grid gap-1">
          <h2 id="titulo-comunidade" className="font-display text-2xl font-semibold text-fg">
            Quem mais fortalece a rede
          </h2>
          <p className="text-fg-muted">
            Um agradecimento a quem orienta, compartilha pesquisa e responde dúvidas.
          </p>
        </div>
        {!result.ok ? (
          <Alert variant="danger" title="Não conseguimos carregar o ranking da comunidade agora.">
            Atualize a página em instantes.
          </Alert>
        ) : result.items.length === 0 ? (
          <EmptyState
            icon={<Users />}
            title="Ninguém pontuou ainda"
            description="Indique um paper, responda no fórum ou ofereça mentoria para abrir o ranking."
            action={<ButtonLink href="/papers/novo">Divulgar um paper</ButtonLink>}
          />
        ) : (
          <>
            <Leaderboard entries={result.items} viewerId={userId} />
            {!inList && (
              <Alert
                variant="info"
                title="Você ainda não aparece aqui."
                actions={
                  <>
                    <ButtonLink href="/papers/novo" size="sm">
                      Divulgar um paper
                    </ButtonLink>
                    <ButtonLink href="/forum" size="sm" variant="outline">
                      Participar do fórum
                    </ButtonLink>
                  </>
                }
              >
                Toda participação conta: indicar papers, responder no fórum e oferecer mentoria
                somam pontos.
              </Alert>
            )}
          </>
        )}
      </section>
      <LeaderboardRules />
    </div>
  );
}
