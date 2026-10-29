import type { Metadata } from "next";
import Link from "next/link";
import { Briefcase, Eye, Plus } from "lucide-react";
import { Alert, ButtonLink, Container, EmptyState, PageHeader } from "@/components/ui";
import { PortfolioItemCard } from "@/components/portfolio/portfolio-item-card";
import { requireOnboardedProfile } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";
import { parsePortfolioNotice, PORTFOLIO_LIMITS } from "@/lib/portfolio/presentation";
import { listPortfolioItems } from "@/lib/portfolio/queries";
import { createClient } from "@/lib/supabase/server";
import { formatNumber } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Meu portfólio",
  robots: { index: false },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function PortfolioPage({ searchParams }: { searchParams: SearchParams }) {
  if (!isSupabaseConfigured()) {
    return (
      <Container className="py-12">
        <EmptyState
          icon={<Briefcase />}
          title="O portfólio ainda não está disponível neste ambiente"
          description="Configure o Supabase (veja o aviso no topo da página) para montar o seu portfólio."
        />
      </Container>
    );
  }

  const me = await requireOnboardedProfile("/portfolio");
  const notice = parsePortfolioNotice((await searchParams).aviso);
  const supabase = await createClient();
  const { items, failed } = await listPortfolioItems(supabase, me.id);
  const full = items.length >= PORTFOLIO_LIMITS.itemsMax;

  return (
    <Container className="pb-16">
      <PageHeader
        eyebrow="Portfólio"
        title="Meu portfólio"
        description="Artigos, projetos, apresentações, pôsteres, TCC, prêmios e cursos: o que você reunir aqui aparece no seu perfil para as membras da Artemis. Destaque os itens que quer mostrar primeiro."
        actions={
          <>
            <ButtonLink href={`/pesquisadoras/${me.id}`} variant="outline">
              <Eye aria-hidden="true" />
              Ver no meu perfil
            </ButtonLink>
            {!full && items.length > 0 && (
              <ButtonLink href="/portfolio/novo">
                <Plus aria-hidden="true" />
                Adicionar item
              </ButtonLink>
            )}
          </>
        }
      />

      <div className="grid gap-6">
        {notice && (
          <Alert variant={notice.variant} title={notice.title} live>
            {notice.body}
          </Alert>
        )}

        {failed ? (
          <Alert variant="danger" title="Não conseguimos carregar o seu portfólio agora">
            Recarregue a página em instantes. Se continuar, tente sair e entrar de novo.
          </Alert>
        ) : items.length === 0 ? (
          <EmptyState
            icon={<Briefcase />}
            title="Seu portfólio está vazio"
            description="Comece pelo trabalho de que você mais se orgulha: um artigo, um projeto de iniciação científica, uma apresentação num evento ou um prêmio. Ele aparece no seu perfil e, se você quiser, no feed."
            action={
              <ButtonLink href="/portfolio/novo">
                <Plus aria-hidden="true" />
                Adicionar o primeiro item
              </ButtonLink>
            }
          />
        ) : (
          <section aria-labelledby="itens-titulo" className="grid gap-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="itens-titulo" className="font-display text-xl font-semibold text-fg">
                Seus itens
              </h2>
              <p className="text-sm text-fg-subtle">
                <span className="tabular">{formatNumber(items.length)}</span> de{" "}
                <span className="tabular">{PORTFOLIO_LIMITS.itemsMax}</span> itens
              </p>
            </div>
            {full && (
              <Alert variant="info" title="Seu portfólio chegou a 50 itens">
                Para adicionar outro, apague ou junte alguns itens.
              </Alert>
            )}
            <ul className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {items.map((item) => (
                <PortfolioItemCard key={item.id} item={item} editable />
              ))}
            </ul>
            <p className="text-sm text-fg-muted">
              Quer ver como as outras membras enxergam?{" "}
              <Link
                href={`/pesquisadoras/${me.id}`}
                className="font-semibold text-primary underline underline-offset-2"
              >
                Abrir o meu perfil
              </Link>
            </p>
          </section>
        )}
      </div>
    </Container>
  );
}
