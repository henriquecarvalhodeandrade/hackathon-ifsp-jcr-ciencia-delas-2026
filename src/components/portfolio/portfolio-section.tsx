import { Briefcase, Settings2 } from "lucide-react";
import { ButtonLink, Card, EmptyState } from "@/components/ui";
import { listPortfolioItems } from "@/lib/portfolio/queries";
import { createClient } from "@/lib/supabase/server";
import { pluralize } from "@/lib/utils";
import { PortfolioItemCard } from "./portfolio-item-card";

export interface PortfolioSectionProps {
  /** Dona do portfólio (o perfil exibido). */
  ownerId: string;
  /** Quem vê é a própria dona (mostra "Gerenciar portfólio"). */
  isOwner: boolean;
  /** Primeiro nome da dona, para a linha de "vazio" no perfil de outra pessoa. */
  ownerName?: string;
}

/** Itens visíveis de cara no perfil; os demais ficam em "Ver mais" (na mesma página). */
const PROFILE_LIMIT = 6;

/**
 * Seção "Portfólio" do perfil (Server Component): itens em cartões compactos, destacados
 * primeiro. Para a dona, "Gerenciar portfólio" leva à /portfolio.
 */
export async function PortfolioSection({ ownerId, isOwner, ownerName }: PortfolioSectionProps) {
  const supabase = await createClient();
  const { items, failed } = await listPortfolioItems(supabase, ownerId);
  const shown = items.slice(0, PROFILE_LIMIT);
  const hidden = items.length - shown.length;

  return (
    <Card as="section" aria-labelledby="portfolio-titulo" padding="md">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2
          id="portfolio-titulo"
          className="flex items-center gap-2 font-display text-xl font-semibold text-fg"
        >
          <span aria-hidden="true" className="text-primary [&_svg]:size-5">
            <Briefcase />
          </span>
          Portfólio
        </h2>
        {isOwner && items.length > 0 && (
          <ButtonLink href="/portfolio" variant="outline" size="sm">
            <Settings2 aria-hidden="true" />
            Gerenciar portfólio
          </ButtonLink>
        )}
      </div>

      {failed ? (
        <p className="text-fg-muted">
          Não conseguimos carregar o portfólio agora. Recarregue a página em instantes.
        </p>
      ) : items.length === 0 ? (
        isOwner ? (
          <EmptyState
            variant="compact"
            headingLevel="h3"
            icon={<Briefcase />}
            title="Seu portfólio está vazio"
            description="Mostre artigos, projetos, apresentações, prêmios e cursos — eles aparecem aqui no seu perfil."
            action={<ButtonLink href="/portfolio/novo">Adicionar item</ButtonLink>}
          />
        ) : (
          // No perfil de outra pessoa, o vazio é uma linha discreta (sem ilustração nem convite).
          <p className="text-fg-muted">
            {ownerName || "Ela"} ainda não adicionou itens ao portfólio.
          </p>
        )
      ) : (
        <div className="grid gap-4">
          <ul className="grid gap-3 sm:grid-cols-2">
            {shown.map((item) => (
              <PortfolioItemCard key={item.id} item={item} variant="compact" />
            ))}
          </ul>
          {hidden > 0 && (
            <details className="group">
              <summary className="cursor-pointer rounded-control text-sm font-semibold text-primary underline-offset-[0.2em] hover:underline">
                <span className="group-open:hidden">
                  Ver mais {pluralize(hidden, "item", "itens")}
                </span>
                <span className="hidden group-open:inline">Mostrar menos</span>
              </summary>
              <ul className="mt-3 grid gap-3 sm:grid-cols-2">
                {items.slice(PROFILE_LIMIT).map((item) => (
                  <PortfolioItemCard key={item.id} item={item} variant="compact" />
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </Card>
  );
}
