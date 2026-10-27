import { CalendarDays } from "lucide-react";
import { Card, CardLink } from "@/components/ui";
import type { EditionListItem } from "@/lib/newsletter/queries";
import { formatEditionPeriod } from "@/lib/newsletter/week";
import { pluralize, truncate } from "@/lib/utils";

/** Cartão de uma edição no arquivo público. O cartão inteiro leva à edição (CardLink). */
export function EditionCard({
  edition,
  headingLevel = "h3",
}: {
  edition: EditionListItem;
  headingLevel?: "h2" | "h3";
}) {
  const Heading = headingLevel;
  const period = formatEditionPeriod(edition.period_start, edition.period_end);
  const counts = [
    edition.counts.papers ? pluralize(edition.counts.papers, "paper") : null,
    edition.counts.threads ? pluralize(edition.counts.threads, "conversa") : null,
    edition.counts.mentors ? pluralize(edition.counts.mentors, "mentora") : null,
  ].filter(Boolean);

  return (
    <Card as="article" variant="interactive" padding="md" className="flex h-full flex-col gap-3">
      {period && (
        <p className="flex items-center gap-1.5 text-sm font-medium text-fg-subtle">
          <CalendarDays aria-hidden="true" className="size-4" />
          {period}
        </p>
      )}
      <Heading className="font-serif text-xl leading-snug font-semibold text-fg">
        <CardLink href={`/newsletter/${edition.slug}`} className="hover:text-primary">
          {edition.title}
        </CardLink>
      </Heading>
      {edition.summary && (
        <p className="text-[0.9375rem] text-fg-muted">{truncate(edition.summary, 170)}</p>
      )}
      {counts.length > 0 && (
        <p className="mt-auto pt-1 text-sm text-fg-subtle">{counts.join(" · ")}</p>
      )}
    </Card>
  );
}
