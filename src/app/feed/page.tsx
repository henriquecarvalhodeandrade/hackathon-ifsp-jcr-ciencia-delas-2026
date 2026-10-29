import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDown, History, Newspaper, UserPlus } from "lucide-react";
import { Alert, ButtonLink, Container, EmptyState, PageHeader, TabNav } from "@/components/ui";
import { Composer } from "@/components/feed/composer";
import { PostCard } from "@/components/feed/post-card";
import {
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

export const metadata: Metadata = {
  title: "Feed",
  description:
    "O que as pesquisadoras da Artemis estão fazendo: projetos, conquistas, publicações e eventos.",
  robots: { index: false },
};

type SearchParams = Promise<{ aba?: string | string[]; antes?: string | string[] }>;

/**
 * /feed — publicações da rede (docs/18 §1 e §2.4). Três colunas no desktop: meu perfil,
 * compositor + publicações (abas Todas/Seguindo, 20 por vez com ?antes=<created_at>) e, à
 * direita, vagas de IC e pessoas para conectar. No celular, uma coluna: o mini perfil some
 * (o cabeçalho já tem a conta) e as colunas laterais vão para depois das publicações.
 * Cada bloco lateral carrega sozinho: se um falhar, o resto da página continua.
 */
export default async function FeedPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const tab = parseFeedTab(params.aba);
  const before = parseCursor(params.antes);
  const profile = await requireOnboardedProfile(feedHref({ tab }));

  const [posts, counts, attachments, opportunities, suggestions] = await Promise.all([
    settle(() =>
      listPosts({ viewerId: profile.id, viewerIsModerator: isModerator(profile), tab, before }),
    ),
    getNetworkCounts(profile.id),
    getComposerAttachments(profile.id),
    listRecentOpportunities(3),
    listConnectionSuggestions(4),
  ]);

  return (
    <Container className="pb-14">
      <PageHeader
        className="pt-6 pb-5 sm:pt-8 sm:pb-6"
        eyebrow="Rede"
        title="Feed"
        description="Projetos, conquistas e novidades das pesquisadoras da Artemis."
      />

      <div className={FEED_GRID}>
        <aside aria-label="Seu perfil" className="hidden lg:sticky lg:top-20 lg:block">
          <ProfileSummary profile={profile} counts={counts} />
        </aside>

        <div className="grid min-w-0 gap-6">
          <Composer
            viewer={{ id: profile.id, name: profile.full_name, avatarUrl: profile.avatar_url }}
            attachments={attachments.ok ? attachments.data : null}
          />

          <section aria-labelledby="publicacoes-titulo" className="grid gap-4">
            <h2 id="publicacoes-titulo" className="sr-only">
              {tab === "seguindo" ? "Publicações de quem você segue" : "Todas as publicações"}
            </h2>
            <TabNav
              label="Filtrar publicações"
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
            ) : posts.data.items.length === 0 ? (
              <FeedEmpty tab={tab} paged={Boolean(before)} counts={counts} />
            ) : (
              <>
                <ol className="grid gap-4">
                  {posts.data.items.map((post) => (
                    <li key={post.id}>
                      <PostCard post={post} />
                    </li>
                  ))}
                </ol>
                {posts.data.nextCursor ? (
                  <div className="flex justify-center pt-2">
                    <ButtonLink
                      href={feedHref({ tab, before: posts.data.nextCursor })}
                      variant="outline"
                    >
                      <ArrowDown aria-hidden="true" />
                      Carregar mais
                    </ButtonLink>
                  </div>
                ) : (
                  <p className="pt-2 text-center text-sm text-fg-subtle">
                    Você viu todas as publicações{tab === "seguindo" ? " de quem você segue" : ""}.
                  </p>
                )}
              </>
            )}
          </section>
        </div>

        <aside aria-label="Vagas e pessoas para conectar" className="grid min-w-0 gap-6">
          <RecentOpportunitiesCard opportunities={opportunities} />
          <SuggestionsCard suggestions={suggestions} />
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
      description="Seja a primeira a contar no que está trabalhando: use a caixa “Compartilhe com a rede” acima."
    />
  );
}
