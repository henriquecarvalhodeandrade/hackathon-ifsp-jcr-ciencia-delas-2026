import Link from "next/link";
import { ArrowRight, MessageCircleQuestion, Sparkles } from "lucide-react";
import { ButtonLink, Chip, EmptyState } from "@/components/ui";
import type { RankedQuestion } from "@/lib/painel/questions-for-you";
import { formatRelativeTime, toIsoString } from "@/lib/utils";
import { PainelSection } from "./painel-section";

export interface QuestionsCardProps {
  questions: readonly RankedQuestion[];
  isMentor: boolean;
  failed?: boolean;
  now?: number;
}

export const QUESTIONS_TITLE_MENTOR = "Perguntas esperando por você";
export const QUESTIONS_TITLE_MEMBER = "Sem resposta ainda: talvez você saiba ajudar";

/**
 * Tópicos do fórum ainda sem resposta que combinam com ela (ou os mais recentes). Tópicos
 * anônimos aparecem como "Anônima" — a autoria nunca é buscada.
 */
export function QuestionsCard({ questions, isMentor, failed = false, now }: QuestionsCardProps) {
  return (
    <PainelSection
      titleId="painel-perguntas"
      title={isMentor ? QUESTIONS_TITLE_MENTOR : QUESTIONS_TITLE_MEMBER}
      description="Em 5 minutos você ajuda uma iniciante."
      icon={<MessageCircleQuestion />}
      failed={failed}
    >
      {questions.length === 0 ? (
        <EmptyState
          variant="compact"
          headingLevel="h3"
          className="py-4"
          title="Toda dúvida recente já tem resposta"
          description="Quando alguém perguntar algo da sua área, aparece aqui."
          action={
            <ButtonLink href="/forum" variant="outline" size="sm">
              Ver o fórum
            </ButtonLink>
          }
        />
      ) : (
        <div className="grid gap-4">
          <ul className="grid gap-3">
            {questions.map(({ thread, reason }) => (
              <li
                key={thread.id}
                className="relative grid gap-2 rounded-control border border-border bg-surface p-3.5 transition-colors focus-within:border-border-strong hover:border-border-strong hover:bg-surface-2"
              >
                <h3 className="font-display leading-snug font-semibold text-balance text-fg">
                  <Link
                    href={`/forum/t/${thread.id}`}
                    className="after:absolute after:inset-0 after:rounded-control after:content-[''] hover:text-primary focus-visible:[outline:none] focus-visible:after:[outline:2px_solid_var(--color-focus)] focus-visible:after:[outline-offset:-2px]"
                  >
                    {thread.title}
                  </Link>
                </h3>
                <p className="flex flex-wrap items-center gap-x-1.5 text-sm text-fg-muted">
                  <span>
                    {thread.isAnonymous ? "Anônima" : (thread.authorName ?? "Pesquisadora")}
                  </span>
                  {thread.categoryName && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>{thread.categoryName}</span>
                    </>
                  )}
                  <span aria-hidden="true">·</span>
                  <time dateTime={toIsoString(thread.createdAt)}>
                    {formatRelativeTime(thread.createdAt, now)}
                  </time>
                </p>
                <div>
                  {reason ? (
                    <Chip variant="primary" size="sm" icon={<Sparkles aria-hidden="true" />}>
                      Fala de: {reason}
                    </Chip>
                  ) : (
                    <Chip variant="outline" size="sm">
                      Sem resposta ainda
                    </Chip>
                  )}
                </div>
              </li>
            ))}
          </ul>
          <Link
            href="/forum"
            className="inline-flex items-center gap-1.5 justify-self-start rounded-control text-sm font-semibold text-primary underline-offset-4 hover:underline"
          >
            Ver todas as conversas do fórum
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </div>
      )}
    </PainelSection>
  );
}
