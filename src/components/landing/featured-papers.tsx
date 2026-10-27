import { ArrowRight, BookOpen, MessageCircle, Star, Trophy } from "lucide-react";
import { Badge, ButtonLink, Card, CardLink, Container, EmptyState } from "@/components/ui";
import { pluralize, truncate } from "@/lib/utils";
import type { LandingPaper } from "./data";
import type { FeaturedPeriod } from "./featured";

function PaperCard({ paper, rank, period }: { paper: LandingPaper; rank: number; period: FeaturedPeriod }) {
  const meta = [paper.venue, paper.year].filter(Boolean).join(" · ");
  const authors = paper.authors.length > 3 ? `${paper.authors.slice(0, 3).join(", ")} e outras` : paper.authors.join(", ");
  return (
    <Card as="article" variant="interactive" className="flex h-full flex-col gap-3 p-5 sm:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={rank === 1 ? "accent" : "neutral"}>
          {rank === 1 && <Star aria-hidden="true" className="fill-current" />}#{rank}
          {period === "week" ? " da semana" : " em alta"}
        </Badge>
        {paper.area_name && <Badge variant="outline">{paper.area_name}</Badge>}
      </div>
      <h3 className="font-serif text-xl leading-snug font-semibold text-fg">
        <CardLink href={`/papers/${paper.id}`}>{paper.title}</CardLink>
      </h3>
      <p className="text-sm text-fg-muted">
        {authors}
        {meta && <span className="text-fg-subtle"> · {meta}</span>}
      </p>
      {paper.plain_summary && (
        <p className="text-[0.9375rem] text-fg-muted">
          <span className="font-semibold text-fg">Em linguagem simples: </span>
          {truncate(paper.plain_summary, 190)}
        </p>
      )}
      <p className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 pt-2 text-sm text-fg-subtle">
        <span className="inline-flex items-center gap-1 font-semibold text-fg">
          <Star aria-hidden="true" className="size-4 fill-accent text-accent-strong" />
          {period === "week"
            ? `${pluralize(paper.period_votes, "destaque")} na semana`
            : pluralize(paper.vote_count, "destaque")}
        </span>
        <span className="inline-flex items-center gap-1">
          <MessageCircle aria-hidden="true" className="size-4" />
          {pluralize(paper.comment_count, "comentário")}
        </span>
      </p>
    </Card>
  );
}

export function FeaturedPapers({ papers, period }: { papers: LandingPaper[]; period: FeaturedPeriod | null }) {
  return (
    <section aria-labelledby="destaques-titulo" className="border-t border-border bg-surface py-16 sm:py-20">
      <Container>
        <div className="mb-8 flex flex-wrap items-end justify-between gap-6">
          <div className="grid max-w-2xl gap-3">
            <p className="eyebrow text-primary">Vitrine Delas</p>
            <h2 id="destaques-titulo" className="font-display text-3xl font-semibold text-fg sm:text-4xl">
              {period === "hot" ? "Em alta na Vitrine" : "Destaques da semana"}
            </h2>
            <p className="text-fg-muted">
              {period === "hot"
                ? "Ninguém destacou papers nos últimos 7 dias — estes são os que mais chamam atenção agora."
                : "Os papers que a comunidade mais destacou nos últimos 7 dias."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <ButtonLink href="/ranking" variant="ghost">
              <Trophy aria-hidden="true" />
              Ranking completo
            </ButtonLink>
            <ButtonLink href="/papers" variant="outline">
              Ver a Vitrine
              <ArrowRight aria-hidden="true" />
            </ButtonLink>
          </div>
        </div>

        {papers.length === 0 || !period ? (
          <EmptyState
            icon={<BookOpen />}
            title="A Vitrine está esperando o primeiro paper"
            description="Conhece um trabalho escrito por mulheres que merece ser lido? Indique e ajude a dar visibilidade."
            action={<ButtonLink href="/papers/novo">Divulgar um paper</ButtonLink>}
          />
        ) : (
          <ol className="grid gap-5 md:grid-cols-3">
            {papers.map((paper, i) => (
              <li key={paper.id}>
                <PaperCard paper={paper} rank={i + 1} period={period} />
              </li>
            ))}
          </ol>
        )}
      </Container>
    </section>
  );
}
