import { Crown, Medal } from "lucide-react";
import { VoteButton, type VoteViewer } from "@/components/papers/vote-button";
import { Badge, Card, CardLink } from "@/components/ui";
import type { RankingPeriod } from "@/lib/constants";
import { periodVotesCaption, rankingVotes, shortAuthorList } from "@/lib/papers/params";
import type { PaperListItem } from "@/lib/papers/queries";
import { cn, formatNumber } from "@/lib/utils";

export interface RankedPaperViewer {
  userId: string | null;
  votedIds: ReadonlySet<string>;
  loginHref: string;
}

export function viewerFor(paper: Pick<PaperListItem, "submitted_by">, viewer: RankedPaperViewer): VoteViewer {
  if (!viewer.userId) return "guest";
  return paper.submitted_by === viewer.userId ? "owner" : "member";
}

const PLACE = [
  {
    label: "1º lugar",
    order: "sm:order-2",
    step: "sm:h-20",
    card: "border-accent-strong/60 ring-2 ring-accent/50",
    badge: "bg-accent text-accent-fg",
  },
  { label: "2º lugar", order: "sm:order-1", step: "sm:h-12", card: "", badge: "bg-primary-soft text-primary-soft-fg" },
  { label: "3º lugar", order: "sm:order-3", step: "sm:h-6", card: "", badge: "bg-secondary-soft text-secondary-soft-fg" },
] as const;

/** Pódio dos 3 primeiros: o 1º fica no centro (telas largas) e mais alto. */
export function Podium({
  papers,
  period,
  viewer,
}: {
  papers: PaperListItem[];
  period: RankingPeriod;
  viewer: RankedPaperViewer;
}) {
  const top = papers.slice(0, 3);
  return (
    <ol aria-label="Pódio" className="grid gap-4 sm:grid-cols-3 sm:items-end">
      {top.map((paper, index) => {
        const place = PLACE[index]!;
        const Icon = index === 0 ? Crown : Medal;
        return (
          <li key={paper.id} className={cn("flex min-w-0 flex-col", place.order)}>
            <Card
              as="article"
              variant="interactive"
              className={cn("flex flex-1 flex-col gap-3 p-5 sm:rounded-b-none", place.card)}
            >
              <div className="flex items-center justify-between gap-3">
                <span
                  className={cn(
                    "inline-flex h-9 items-center gap-1.5 rounded-pill px-3 font-display text-sm font-bold",
                    place.badge,
                  )}
                >
                  <Icon aria-hidden="true" className="size-4" />
                  {place.label}
                </span>
                {paper.area && (
                  <Badge variant="outline" className="truncate">
                    {paper.area.name}
                  </Badge>
                )}
              </div>
              <h3 className="font-serif text-lg leading-snug font-semibold text-pretty break-words text-fg">
                <CardLink href={`/papers/${paper.id}`}>{paper.title}</CardLink>
              </h3>
              <p className="line-clamp-2 text-sm text-fg-muted">{shortAuthorList(paper.authors, 2)}</p>
              <div className="mt-auto flex items-end justify-between gap-3 border-t border-border pt-3">
                <p className="grid">
                  <span className="tabular font-display text-2xl leading-none font-semibold text-fg">
                    {formatNumber(rankingVotes(period, paper))}
                  </span>
                  <span className="text-xs text-fg-subtle">{periodVotesCaption(period, rankingVotes(period, paper))}</span>
                </p>
                <VoteButton
                  paperId={paper.id}
                  paperTitle={paper.title}
                  voted={viewer.votedIds.has(paper.id)}
                  count={paper.vote_count}
                  viewer={viewerFor(paper, viewer)}
                  loginHref={viewer.loginHref}
                  showCount={false}
                />
              </div>
            </Card>
            <div
              aria-hidden="true"
              className={cn(
                "hidden rounded-b-card border border-t-0 border-border bg-primary-soft/60 sm:block",
                place.step,
              )}
            />
          </li>
        );
      })}
    </ol>
  );
}
