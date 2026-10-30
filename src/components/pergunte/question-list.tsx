import { MessageCircle, PenLine } from "lucide-react";
import { Badge, ButtonLink, Card, CardLink, Chip } from "@/components/ui";
import {
  answerCountLabel,
  questionExcerpt,
  splitQuestion,
  STAGE_LABELS,
} from "@/lib/pergunte/labels";
import type { QuestionSummary } from "@/lib/pergunte/queries";
import { cn, formatRelativeTime, toIsoString } from "@/lib/utils";

export interface QuestionListProps {
  questions: readonly QuestionSummary[];
  /** "respondidas": mostra a contagem; "esperando": botão "Responder" (membras). */
  variant?: "respondidas" | "esperando";
  /** Nível dos títulos dos cartões (padrão h3, abaixo do h2 da seção). */
  headingLevel?: "h3" | "h4";
  now?: number;
  className?: string;
}

/** Cartões de perguntas publicadas: trecho, etapa, área e respostas. O cartão inteiro é o link. */
export function QuestionList({
  questions,
  variant = "respondidas",
  headingLevel: Heading = "h3",
  now,
  className,
}: QuestionListProps) {
  return (
    <ul className={cn("grid gap-4 md:grid-cols-2", className)}>
      {questions.map((question) => {
        const { headline, rest } = splitQuestion(question.body);
        return (
          <li key={question.id} className="min-w-0">
            <Card as="article" variant="interactive" className="flex h-full flex-col gap-3 p-5">
              {(question.stage || question.areaName) && (
                <div className="flex flex-wrap items-center gap-2">
                  {question.stage && (
                    <Badge variant="primary">{STAGE_LABELS[question.stage]}</Badge>
                  )}
                  {question.areaName && (
                    <Chip variant="outline" size="sm">
                      {question.areaName}
                    </Chip>
                  )}
                </div>
              )}
              <Heading className="font-display text-lg leading-snug font-semibold text-pretty text-fg">
                <CardLink href={`/pergunte/${question.id}`} className="hover:text-primary">
                  {headline}
                </CardLink>
              </Heading>
              {rest && <p className="line-clamp-3 text-[0.9375rem] text-fg-muted">{rest}</p>}
              <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-1">
                <p className="flex flex-wrap items-center gap-x-1.5 text-sm text-fg-muted">
                  <MessageCircle aria-hidden="true" className="size-4 text-fg-subtle" />
                  <span className="font-semibold text-fg">
                    {answerCountLabel(question.answerCount)}
                  </span>
                  {question.publishedAt && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>
                        publicada{" "}
                        <time dateTime={toIsoString(question.publishedAt)}>
                          {formatRelativeTime(question.publishedAt, now)}
                        </time>
                      </span>
                    </>
                  )}
                </p>
                {variant === "esperando" && (
                  <ButtonLink
                    href={`/pergunte/${question.id}#responder`}
                    size="sm"
                    variant="secondary"
                    className="relative z-10"
                    aria-label={`Responder: ${questionExcerpt(question.body, 80)}`}
                  >
                    <PenLine aria-hidden="true" />
                    Responder
                  </ButtonLink>
                )}
              </div>
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
