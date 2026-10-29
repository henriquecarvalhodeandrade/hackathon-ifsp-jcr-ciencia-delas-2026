import { ExternalLink, Pencil, Pin, Trash2 } from "lucide-react";
import { Badge, Button, ButtonLink, Card, Chip, ConfirmDialog } from "@/components/ui";
import { deletePortfolioItemAction } from "@/lib/portfolio/actions";
import { linkHost, portfolioKindLabel, portfolioMeta } from "@/lib/portfolio/presentation";
import type { PortfolioItem } from "@/lib/portfolio/queries";
import { cn } from "@/lib/utils";
import { PortfolioKindIcon } from "./kind-icon";
import { PinButton } from "./pin-button";

export interface PortfolioItemCardProps {
  item: PortfolioItem;
  /** "full" na /portfolio (com ações da dona); "compact" no perfil. */
  variant?: "full" | "compact";
  /** Mostra Editar / Destacar / Apagar (só na /portfolio, para a dona). */
  editable?: boolean;
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
        item.pinned && "border-primary/40",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">
          <PortfolioKindIcon kind={item.kind} />
          {portfolioKindLabel(item.kind)}
        </Badge>
        {item.pinned && (
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
        <div className="mt-auto flex flex-wrap items-center gap-1 border-t border-border pt-3">
          <ButtonLink href={`/portfolio/${item.id}/editar`} variant="ghost" size="sm">
            <Pencil aria-hidden="true" />
            Editar
            <span className="sr-only"> “{item.title}”</span>
          </ButtonLink>
          <PinButton itemId={item.id} itemTitle={item.title} pinned={item.pinned} />
          <ConfirmDialog
            stateAction={deletePortfolioItemAction}
            hiddenFields={{ item_id: item.id }}
            trigger={
              <Button variant="ghost" size="sm" className="text-danger hover:text-danger">
                <Trash2 aria-hidden="true" />
                Apagar
                <span className="sr-only"> “{item.title}”</span>
              </Button>
            }
            title="Apagar este item do portfólio?"
            description={`“${item.title}” sai do seu portfólio e do seu perfil. Publicações do feed que o mostravam continuam, sem o anexo. Não dá para desfazer.`}
            confirmLabel="Sim, apagar"
            pendingLabel="Apagando…"
            cancelLabel="Voltar"
          />
        </div>
      )}
    </Card>
  );
}
