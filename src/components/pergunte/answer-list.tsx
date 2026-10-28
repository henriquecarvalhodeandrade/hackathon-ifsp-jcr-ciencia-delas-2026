import { FlaskConical, Trash2 } from "lucide-react";
import { Avatar, Badge, Card, ConfirmDialog, Markdown } from "@/components/ui";
import { deleteAnswer } from "@/lib/pergunte/actions";
import { answerIdentityLine } from "@/lib/pergunte/labels";
import type { PublicAnswerView } from "@/lib/pergunte/queries";
import { formatDate, toIsoString } from "@/lib/utils";

export interface AnswerListProps {
  answers: readonly PublicAnswerView[];
  questionId: string;
}

/**
 * Respostas públicas, mais antigas primeiro. O nome só aparece quando a autora marcou
 * "Mostrar meu nome…" naquela resposta; senão, "Uma cientista da rede".
 */
export function AnswerList({ answers, questionId }: AnswerListProps) {
  return (
    <ol className="grid gap-4">
      {answers.map((answer) => {
        const identified = Boolean(answer.name?.trim());
        const identity = answerIdentityLine({
          name: answer.name,
          stage: answer.stage,
          isMentor: answer.isMentor,
        });
        const labelId = `resposta-${answer.id}-autora`;
        return (
          <li key={answer.id} id={`resposta-${answer.id}`} className="scroll-mt-24">
            <Card as="article" aria-labelledby={labelId} className="grid gap-4 p-5 sm:p-6">
              <header className="flex flex-wrap items-center gap-x-3 gap-y-2">
                {identified ? (
                  <Avatar name={answer.name} size="md" />
                ) : (
                  <span
                    aria-hidden="true"
                    className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary-soft text-secondary-soft-fg [&_svg]:size-5"
                  >
                    <FlaskConical />
                  </span>
                )}
                <div className="grid min-w-0 flex-1 gap-0.5">
                  <p id={labelId} className="leading-snug font-semibold text-fg">
                    {identity}
                  </p>
                  <p className="text-sm text-fg-subtle">
                    Respondeu em{" "}
                    <time dateTime={toIsoString(answer.createdAt)}>
                      {formatDate(answer.createdAt)}
                    </time>
                  </p>
                </div>
                {answer.isMine && (
                  <Badge variant="secondary" size="md">
                    Sua resposta
                  </Badge>
                )}
              </header>

              <Markdown className="text-fg">{answer.body}</Markdown>

              {answer.isMine && (
                <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
                  <p className="text-sm text-fg-muted">
                    {identified
                      ? "Você escolheu mostrar seu nome nesta resposta."
                      : "Seu nome não aparece: só você vê que esta resposta é sua."}
                  </p>
                  <ConfirmDialog
                    stateAction={deleteAnswer}
                    hiddenFields={{ answerId: answer.id, questionId }}
                    triggerLabel="Apagar minha resposta"
                    triggerIcon={<Trash2 aria-hidden="true" />}
                    triggerVariant="ghost"
                    triggerSize="sm"
                    triggerClassName="text-danger hover:bg-danger-soft hover:text-danger-soft-fg"
                    title="Apagar sua resposta?"
                    description="Ela some da pergunta para todo mundo. Não dá para desfazer."
                    confirmLabel="Sim, apagar"
                    pendingLabel="Apagando…"
                    cancelLabel="Voltar"
                  />
                </footer>
              )}
            </Card>
          </li>
        );
      })}
    </ol>
  );
}
