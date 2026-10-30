import type { Metadata } from "next";
import Link from "next/link";
import { History, Newspaper, UserPlus } from "lucide-react";
import { Alert, ButtonLink, Container, EmptyState, TabNav } from "@/components/ui";
import { Composer } from "@/components/feed/composer";
import { LIVE_REGION_ID } from "@/components/feed/dom";
import { LoadMore } from "@/components/feed/load-more";
import { PostCard } from "@/components/feed/post-card";
import {
  PeopleStrip,
  ProfileSummary,
  RecentOpportunitiesCard,
  SuggestionsCard,
} from "@/components/feed/sidebar";
import { FEED_GRID } from "@/components/feed/skeletons";
import { isModerator, requireOnboardedProfile } from "@/lib/auth";
import {
  FEED_TAB_LABELS,
  FEED_TABS,
  feedHref,
  parseCursor,
  parseFeedTab,
  type FeedTab,
} from "@/lib/feed/presentation";
import {
  getComposerAttachments,
  getNetworkCounts,
  listConnectionSuggestions,
  listPosts,
  listRecentOpportunities,
  settle,
  type NetworkCounts,
  type Settled,
} from "@/lib/feed/queries";
import type { FeedPostView, FeedViewer } from "@/lib/feed/types";

export const metadata: Metadata = {
  title: "Feed",
  description:
    "O que as pesquisadoras da Artemis estão fazendo: projetos, conquistas, publicações e eventos.",
  robots: { index: false },
};

type SearchParams = Promise<{
  aba?: string | string[];
  antes?: string | string[];
  /** `?escrever=1`: abre a caixa de publicação com o foco no campo (ex.: atalho do painel). */
  escrever?: string | string[];
}>;

/** Onde os blocos laterais entram no meio das publicações abaixo de 1024 px. */
const PEOPLE_AFTER = 3;
const OPPORTUNITIES_AFTER = 6;

/**
 * /feed — publicações da rede (docs/18 §1 e §2.4). Desktop: meu perfil | compositor + publicações
 * | vagas e pessoas. Abaixo de 1024 px: uma coluna (largura limitada no tablet); "Pessoas para
 * conectar" entra depois da 3ª publicação e "Vagas de IC" depois da 6ª, para não ficarem só no
 * fim do feed. O compositor fechado ocupa uma linha, então as publicações começam logo no topo.
 * Cada bloco lateral carrega sozinho: se um falhar, o resto da página continua.
 */
export default async function FeedPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const tab = parseFeedTab(params.aba);
  const before = parseCursor(params.antes);
  const write = !before && [params.escrever].flat()[0] === "1";
  const profile = await requireOnboardedProfile(
    write ? `${feedHref({ tab })}${tab === "todas" ? "?" : "&"}escrever=1` : feedHref({ tab }),
  );
  const viewer: FeedViewer = {
    id: profile.id,
    name: profile.full_name,
    avatarUrl: profile.avatar_url,
  };

  const [posts, counts, attachments, opportunities, suggestions] = await Promise.all([
    settle(() =>
      listPosts({ viewerId: profile.id, viewerIsModerator: isModerator(profile), tab, before }),
    ),
    getNetworkCounts(profile.id),
    // Páginas "?antes=" não mostram o compositor: não há por que ler os anexos.
    before ? Promise.resolve(null) : getComposerAttachments(profile.id),
    listRecentOpportunities(3),
    listConnectionSuggestions(profile.id, 8),
  ]);

  const items = posts.ok ? posts.data.items : [];
  const list = (slice: FeedPostView[], start: number) =>
    slice.length > 0 && (
      <ol start={start + 1} className="grid gap-4">
        {slice.map((post) => (
          <li key={post.id}>
            <PostCard post={post} viewer={viewer} />
          </li>
        ))}
      </ol>
    );
  // Só na primeira página: depois de "Carregar mais"/"?antes=" a pessoa já passou por eles.
  const inlineBlocks = !before;
  const peopleAt = Math.min(PEOPLE_AFTER, items.length);
  const opportunitiesAt = Math.min(OPPORTUNITIES_AFTER, items.length);

  return (
    <Container className="relative pt-4 pb-14 sm:pt-6">
      <h1 className="sr-only">Feed</h1>
      {/* Pula o mini perfil e o compositor (visível só com o foco do teclado). */}
      <a
        href="#publicacoes"
        className="sr-only rounded-control bg-primary px-4 py-2.5 font-semibold text-primary-fg shadow-overlay focus:not-sr-only focus:absolute focus:top-2 focus:left-4 focus:z-50 sm:focus:left-6 lg:focus:left-8"
      >
        Ir para as publicações
      </a>
      <p id={LIVE_REGION_ID} aria-live="polite" className="sr-only" />

      <div className={FEED_GRID}>
        <aside aria-label="Seu perfil" className="hidden lg:sticky lg:top-20 lg:block">
          <ProfileSummary profile={profile} counts={counts} />
        </aside>

        <div className="grid min-w-0 grid-cols-1 gap-4 md:mx-auto md:w-full md:max-w-2xl lg:max-w-none">
          {attachments !== null && (
            <Composer
              viewer={viewer}
              attachments={attachments.ok ? attachments.data : null}
              autoOpen={write}
            />
          )}

          <section
            id="publicacoes"
            tabIndex={-1}
            aria-labelledby="publicacoes-titulo"
            className="grid min-w-0 scroll-mt-24 grid-cols-1 gap-4"
          >
            <h2 id="publicacoes-titulo" className="sr-only">
              {tab === "seguindo" ? "Publicações de quem você segue" : "Todas as publicações"}
            </h2>
            <TabNav
              label="Filtrar publicações"
              data-feed-tabs=""
              scroll={false}
              items={FEED_TABS.map((value) => ({
                href: feedHref({ tab: value }),
                label: FEED_TAB_LABELS[value],
                active: value === tab,
              }))}
            />

            {before && (
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-control bg-surface-2 px-3.5 py-2.5 text-sm text-fg-muted">
                <History aria-hidden="true" className="size-4 shrink-0" />
                Mostrando publicações anteriores.
                <Link
                  href={feedHref({ tab })}
                  className="font-semibold text-primary underline-offset-4 hover:underline"
                >
                  Voltar às mais recentes
                </Link>
              </p>
            )}

            {!posts.ok ? (
              <Alert variant="warning" title="Não conseguimos carregar as publicações">
                Recarregue a página em instantes. Se continuar, tente de novo mais tarde.
              </Alert>
            ) : items.length === 0 ? (
              <>
                <FeedEmpty tab={tab} paged={Boolean(before)} counts={counts} />
                {inlineBlocks && <PeopleStrip suggestions={suggestions} className="lg:hidden" />}
              </>
            ) : inlineBlocks ? (
              <>
                {list(items.slice(0, peopleAt), 0)}
                <PeopleStrip suggestions={suggestions} className="lg:hidden" />
                {list(items.slice(peopleAt, opportunitiesAt), peopleAt)}
                <RecentOpportunitiesCard
                  opportunities={opportunities}
                  inline
                  className="lg:hidden"
                />
                {list(items.slice(opportunitiesAt), opportunitiesAt)}
                <LoadMore
                  tab={tab}
                  initialCursor={posts.data.nextCursor}
                  shownCount={items.length}
                />
              </>
            ) : (
              <>
                {list(items, 0)}
                <LoadMore
                  tab={tab}
                  initialCursor={posts.data.nextCursor}
                  shownCount={items.length}
                />
              </>
            )}
          </section>
        </div>

        <aside aria-label="Vagas e pessoas para conectar" className="hidden min-w-0 gap-6 lg:grid">
          <RecentOpportunitiesCard opportunities={opportunities} />
          <SuggestionsCard suggestions={suggestions} limit={4} />
        </aside>
      </div>
    </Container>
  );
}

function FeedEmpty({
  tab,
  paged,
  counts,
}: {
  tab: FeedTab;
  paged: boolean;
  counts: Settled<NetworkCounts>;
}) {
  if (paged) {
    return (
      <EmptyState
        headingLevel="h3"
        icon={<History />}
        title="Você chegou ao fim"
        description="Não há publicações mais antigas por aqui."
        action={<ButtonLink href={feedHref({ tab })}>Voltar às mais recentes</ButtonLink>}
      />
    );
  }
  if (tab === "seguindo") {
    const followsNobody = counts.ok && counts.data.following === 0;
    return (
      <EmptyState
        headingLevel="h3"
        icon={<UserPlus />}
        title={
          followsNobody ? "Você ainda não segue ninguém" : "Quem você segue ainda não publicou"
        }
        description={
          followsNobody
            ? "Siga pesquisadoras para acompanhar aqui os projetos e as conquistas delas."
            : "Enquanto isso, veja o que o restante da rede anda compartilhando."
        }
        action={
          <>
            <ButtonLink href="/rede?aba=sugestoes">Encontrar pessoas</ButtonLink>
            <ButtonLink href={feedHref()} variant="outline">
              Ver todas as publicações
            </ButtonLink>
          </>
        }
      />
    );
  }
  return (
    <EmptyState
      headingLevel="h3"
      icon={<Newspaper />}
      title="O feed ainda está em silêncio"
      description="Seja a primeira a contar no que está trabalhando: use a caixa de publicação acima."
    />
  );
}
