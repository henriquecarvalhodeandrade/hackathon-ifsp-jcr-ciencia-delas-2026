import { ExternalLink, Pin } from "lucide-react";
import { Badge, Card, Chip } from "@/components/ui";
import { linkHost, portfolioKindLabel, portfolioMeta } from "@/lib/portfolio/presentation";
import type { PortfolioItem } from "@/lib/portfolio/queries";
import { cn } from "@/lib/utils";
import { PortfolioKindIcon } from "./kind-icon";
import { PinButton } from "./pin-button";
import { PortfolioItemMenu } from "./portfolio-item-menu";

export interface PortfolioItemCardProps {
  item: PortfolioItem;
  /** "full" na /portfolio (com ações da dona); "compact" no perfil. */
  variant?: "full" | "compact";
  /** Mostra Destacar e o menu "⋯" (Editar, Compartilhar no feed, Apagar) — só na /portfolio. */
  editable?: boolean;
  /** Publicações minhas no feed que anexam o item (opção de apagá-las junto). */
  sharedPosts?: number;
  headingLevel?: "h3" | "h4";
  className?: string;
}

const MAX_TAGS_COMPACT = 4;

/** Link externo do item, com o domínio à mostra e aviso de nova aba. */
function ItemLink({ url, title }: { url: string; title: string }) {
  const host = linkHost(url);
  if (!host) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className="inline-flex max-w-full items-center gap-1.5 rounded-badge text-sm font-semibold text-primary underline-offset-[0.2em] hover:underline"
    >
      <ExternalLink aria-hidden="true" className="size-4 shrink-0" />
      <span className="truncate">{host}</span>
      <span className="sr-only">: abrir “{title}” (abre em nova aba)</span>
    </a>
  );
}

/**
 * Cartão de um item do portfólio: tipo, título, onde/quando, descrição, tags e link. Na
 * /portfolio (editable) traz as ações da dona; no perfil é a versão compacta.
 */
export function PortfolioItemCard({
  item,
  variant = "full",
  editable = false,
  sharedPosts = 0,
  headingLevel: Heading = "h3",
  className,
}: PortfolioItemCardProps) {
  const compact = variant === "compact";
  const meta = portfolioMeta(item);
  const tags = compact ? item.tags.slice(0, MAX_TAGS_COMPACT) : item.tags;
  const extraTags = item.tags.length - tags.length;
  const headingId = `item-${item.id}-titulo`;

  return (
    <Card
      as="li"
      id={`item-${item.id}`}
      aria-labelledby={headingId}
      padding={compact ? "sm" : "md"}
      className={cn(
        "flex min-w-0 scroll-mt-24 flex-col gap-3",
        // Anel do item recém-adicionado/editado (PortfolioFlash liga e desliga).
        "ring-offset-2 ring-offset-bg transition-shadow duration-700 data-[flash=on]:ring-2 data-[flash=on]:ring-primary",
        // Na /portfolio o estado do destaque está no botão "Destacar" (que não reordena a lista).
        !editable && item.pinned && "border-primary/40",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">
          <PortfolioKindIcon kind={item.kind} />
          {portfolioKindLabel(item.kind)}
        </Badge>
        {!editable && item.pinned && (
          <Badge variant="primary">
            <Pin aria-hidden="true" />
            Em destaque
          </Badge>
        )}
      </div>

      <div className="grid gap-1">
        <Heading
          id={headingId}
          className={cn(
            "font-display leading-snug font-semibold break-words text-fg",
            compact ? "text-base" : "text-lg",
          )}
        >
          {item.title}
        </Heading>
        {meta && <p className="text-sm text-fg-subtle">{meta}</p>}
      </div>

      {item.description && (
        <p
          className={cn(
            "text-[0.9375rem] break-words whitespace-pre-line text-fg-muted",
            compact ? "line-clamp-3" : "line-clamp-6",
          )}
        >
          {item.description}
        </p>
      )}

      {tags.length > 0 && (
        <ul aria-label="Tags" className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <li key={tag} className="max-w-full">
              <Chip size="sm">{tag}</Chip>
            </li>
          ))}
          {extraTags > 0 && (
            <li>
              <Chip size="sm" variant="outline">
                +{extraTags}
                <span className="sr-only"> outras tags</span>
              </Chip>
            </li>
          )}
        </ul>
      )}

      {item.url && <ItemLink url={item.url} title={item.title} />}

      {editable && (
        <div className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-3">
          <PinButton itemId={item.id} itemTitle={item.title} pinned={item.pinned} />
          <PortfolioItemMenu itemId={item.id} itemTitle={item.title} sharedPosts={sharedPosts} />
        </div>
      )}
    </Card>
  );
}
