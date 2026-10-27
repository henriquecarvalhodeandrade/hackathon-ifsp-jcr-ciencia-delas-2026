import { MessageCircle, Star } from "lucide-react";
import { Badge, Card, CardLink } from "@/components/ui";
import type { PaperListItem } from "@/lib/papers/queries";
import { shortAuthorList } from "@/lib/papers/params";
import { cn, pluralize, truncate } from "@/lib/utils";
import { VoteButton, type VoteViewer } from "./vote-button";

export interface PaperCardProps {
  paper: PaperListItem;
  viewer: VoteViewer;
  voted: boolean;
  /** Link de login (visitantes) que volta para a página atual. */
  loginHref?: string;
  /** Selo de posição, ex.: "#1 da semana". */
  rankBadge?: string | null;
  headingLevel?: "h2" | "h3";
  className?: string;
}

/** Paper na Vitrine: destaque (voto) à esquerda, título em serifa e resumo acessível. */
export function PaperCard({
  paper,
  viewer,
  voted,
  loginHref,
  rankBadge,
  headingLevel: Heading = "h3",
  className,
}: PaperCardProps) {
  const meta = [paper.venue, paper.year].filter(Boolean).join(" · ");
  return (
    <Card
      as="article"
      variant="interactive"
      className={cn("flex h-full gap-4 p-4 sm:p-5", className)}
    >
      <VoteButton
        paperId={paper.id}
        paperTitle={paper.title}
        voted={voted}
        count={paper.vote_count}
        viewer={viewer}
        loginHref={loginHref}
        className="shrink-0"
      />
      <div className="grid min-w-0 flex-1 content-start gap-2">
        {(paper.area || rankBadge) && (
          <div className="flex flex-wrap items-center gap-2">
            {rankBadge && (
              <Badge variant="accent">
                <Star aria-hidden="true" className="fill-current" />
                {rankBadge}
              </Badge>
            )}
            {paper.area && <Badge variant="outline">{paper.area.name}</Badge>}
          </div>
        )}
        <Heading className="font-serif text-xl leading-snug font-semibold text-pretty break-words text-fg">
          <CardLink href={`/papers/${paper.id}`}>{paper.title}</CardLink>
        </Heading>
        <p className="text-sm text-fg-muted">
          <span className="line-clamp-2 break-words">{shortAuthorList(paper.authors)}</span>
          {meta && <span className="block text-fg-subtle">{meta}</span>}
        </p>
        {paper.plain_summary && (
          <p className="line-clamp-3 text-[0.9375rem] text-fg-muted">
            <span className="font-semibold text-fg">Resumo acessível: </span>
            {truncate(paper.plain_summary, 280)}
          </p>
        )}
        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-fg-subtle">
          <span className="inline-flex items-center gap-1">
            <MessageCircle aria-hidden="true" className="size-4" />
            {pluralize(paper.comment_count, "comentário")}
          </span>
          {paper.doi && <span className="min-w-0 truncate font-mono text-xs">{paper.doi}</span>}
        </div>
      </div>
    </Card>
  );
}
