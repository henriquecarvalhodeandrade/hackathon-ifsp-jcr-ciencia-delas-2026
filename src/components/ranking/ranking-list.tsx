import Link from "next/link";
import { VoteButton } from "@/components/papers/vote-button";
import type { RankingPeriod } from "@/lib/constants";
import { periodVotesLabel, rankingVotes, shortAuthorList } from "@/lib/papers/params";
import type { PaperListItem } from "@/lib/papers/queries";
import { pluralize } from "@/lib/utils";
import { viewerFor, type RankedPaperViewer } from "./podium";

/** Posições a partir da 4ª: lista compacta com número, título e destaques do período. */
export function RankingList({
  papers,
  period,
  startAt,
  viewer,
}: {
  papers: PaperListItem[];
  period: RankingPeriod;
  startAt: number;
  viewer: RankedPaperViewer;
}) {
  if (papers.length === 0) return null;
  return (
    <ol
      start={startAt}
      aria-label={`Posições ${startAt} a ${startAt + papers.length - 1}`}
      className="divide-y divide-border overflow-hidden rounded-card border border-border bg-surface shadow-card"
    >
      {papers.map((paper, index) => {
        const votes = rankingVotes(period, paper);
        return (
          <li
            key={paper.id}
            className="relative flex items-start gap-3 p-4 transition-colors hover:bg-surface-2 has-[[data-row-link]:focus-visible]:bg-surface-2 has-[[data-row-link]:focus-visible]:outline-2 has-[[data-row-link]:focus-visible]:-outline-offset-2 has-[[data-row-link]:focus-visible]:outline-focus sm:gap-4 sm:px-5"
          >
            <span
              aria-hidden="true"
              className="tabular w-8 shrink-0 pt-0.5 text-right font-display text-xl font-semibold text-fg-subtle"
            >
              {startAt + index}
            </span>
            <div className="grid min-w-0 flex-1 gap-1">
              <h3 className="font-serif text-lg leading-snug font-semibold break-words text-fg">
                <Link
                  data-row-link=""
                  href={`/papers/${paper.id}`}
                  className="after:absolute after:inset-0 after:content-[''] hover:text-primary focus-visible:outline-none"
                >
                  <span className="sr-only">{startAt + index}º lugar: </span>
                  {paper.title}
                </Link>
              </h3>
              <p className="text-sm text-fg-muted">
                <span className="break-words">{shortAuthorList(paper.authors, 2)}</span>
                {paper.area && <span className="text-fg-subtle"> · {paper.area.name}</span>}
              </p>
              <p className="text-sm font-semibold text-fg">
                {periodVotesLabel(period, votes)}
                {(period === "week" || period === "month" || period === "year") && (
                  <span className="font-normal text-fg-subtle"> · {pluralize(paper.vote_count, "destaque")} no total</span>
                )}
              </p>
            </div>
            <VoteButton
              paperId={paper.id}
              paperTitle={paper.title}
              voted={viewer.votedIds.has(paper.id)}
              count={paper.vote_count}
              viewer={viewerFor(paper, viewer)}
              loginHref={viewer.loginHref}
              showCount={false}
              className="shrink-0"
            />
          </li>
        );
      })}
    </ol>
  );
}

