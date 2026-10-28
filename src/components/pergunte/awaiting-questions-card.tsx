import Link from "next/link";
import { ArrowRight, MessageCircleQuestion, PenLine } from "lucide-react";
import { ButtonLink, Card, Chip } from "@/components/ui";
import { questionExcerpt, splitQuestion, STAGE_LABELS } from "@/lib/pergunte/labels";
import { listAwaitingQuestions } from "@/lib/pergunte/queries";
import { formatRelativeTime, toIsoString } from "@/lib/utils";

/**
 * Cartão do /painel (integração: slot "Perguntas"): até 3 perguntas de estudantes já publicadas
 * e ainda sem resposta, cada uma com "Responder". Sem perguntas (ou se a leitura falhar), não
 * renderiza nada — o painel continua com os outros blocos.
 */
export async function AwaitingQuestionsCard({ now }: { now?: number } = {}) {
  const questions = await listAwaitingQuestions(3);
  if (!questions || questions.length === 0) return null;

  return (
    <Card as="section" aria-labelledby="painel-pergunte" className="min-w-0">
      <div className="flex items-start gap-3 px-5 pt-5 sm:px-6 sm:pt-6">
        <span
          aria-hidden="true"
          className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary-soft text-secondary-soft-fg [&_svg]:size-[1.125rem]"
        >
          <MessageCircleQuestion />
        </span>
        <div className="grid min-w-0 gap-1">
          <h2
            id="painel-pergunte"
            className="font-display text-xl leading-snug font-semibold text-fg"
          >
            Estudantes perguntando
          </h2>
          <p className="text-sm text-fg-muted">
            Perguntas anônimas, já moderadas, esperando a primeira resposta.
          </p>
        </div>
      </div>
      <div className="grid gap-4 px-5 pt-4 pb-5 sm:px-6 sm:pb-6">
        <ul className="grid gap-3">
          {questions.map((question) => (
            <li
              key={question.id}
              className="grid gap-2 rounded-control border border-border bg-surface p-3.5"
            >
              <p className="leading-snug font-semibold text-pretty text-fg">
                {splitQuestion(question.body, 140).headline}
              </p>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-fg-muted">
                  {question.stage && (
                    <Chip variant="outline" size="sm">
                      {STAGE_LABELS[question.stage]}
                    </Chip>
                  )}
                  {question.publishedAt && (
                    <time dateTime={toIsoString(question.publishedAt)}>
                      {formatRelativeTime(question.publishedAt, now)}
                    </time>
                  )}
                </p>
                <ButtonLink
                  href={`/pergunte/${question.id}#responder`}
                  size="sm"
                  variant="secondary"
                  aria-label={`Responder: ${questionExcerpt(question.body, 80)}`}
                >
                  <PenLine aria-hidden="true" />
                  Responder
                </ButtonLink>
              </div>
            </li>
          ))}
        </ul>
        <Link
          href="/pergunte"
          className="inline-flex items-center gap-1.5 justify-self-start rounded-control text-sm font-semibold text-primary underline-offset-4 hover:underline"
        >
          Ver todas as perguntas de estudantes
          <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      </div>
    </Card>
  );
}
