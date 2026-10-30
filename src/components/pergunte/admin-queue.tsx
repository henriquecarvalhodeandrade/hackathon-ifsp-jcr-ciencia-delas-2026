import Link from "next/link";
import { Inbox, MessagesSquare } from "lucide-react";
import { Badge, Card, Chip, EmptyState } from "@/components/ui";
import { STAGE_LABELS } from "@/lib/pergunte/labels";
import {
  RECENT_ANSWERS_DAYS,
  type PerguntasAdminData,
  type PendingQuestionView,
  type RecentAnswerView,
} from "@/lib/pergunte/queries";
import { formatDateTime, formatNumber, formatRelativeTime, toIsoString } from "@/lib/utils";
import {
  AnswerVisibilityDialog,
  PublishQuestionButton,
  RejectQuestionDialog,
} from "./admin-actions";

function SectionHeader({
  id,
  title,
  count,
  description,
}: {
  id: string;
  title: string;
  count?: number;
  description: string;
}) {
  return (
    <div className="grid gap-1">
      <h3
        id={id}
        className="flex flex-wrap items-center gap-2 font-display text-xl font-semibold text-fg"
      >
        {title}
        {count !== undefined && (
          <Badge variant={count > 0 ? "warning" : "neutral"} size="md" className="tabular">
            {formatNumber(count)}
          </Badge>
        )}
      </h3>
      <p className="text-sm text-fg-muted">{description}</p>
    </div>
  );
}

function PendingCard({ question, now }: { question: PendingQuestionView; now: number }) {
  const labelId = `pendente-${question.id}`;
  return (
    <Card as="article" aria-labelledby={labelId} className="grid gap-4 p-5">
      <div className="flex flex-wrap items-center gap-2 text-sm text-fg-subtle">
        <span id={labelId} className="font-semibold text-fg">
          Pergunta anônima
        </span>
        <span aria-hidden="true">·</span>
        <span>
          enviada{" "}
          <time
            dateTime={toIsoString(question.createdAt)}
            title={formatDateTime(question.createdAt)}
          >
            {formatRelativeTime(question.createdAt, now)}
          </time>
        </span>
        {question.stage && <Badge variant="primary">{STAGE_LABELS[question.stage]}</Badge>}
        {question.areaName && (
          <Chip variant="outline" size="sm">
            {question.areaName}
          </Chip>
        )}
      </div>
      <p className="rounded-control bg-surface-2 p-4 whitespace-pre-line text-fg">
        {question.body}
      </p>
      <div className="flex flex-wrap items-start gap-2">
        <PublishQuestionButton questionId={question.id} />
        <RejectQuestionDialog questionId={question.id} />
      </div>
    </Card>
  );
}

function AnswerCard({ answer, now }: { answer: RecentAnswerView; now: number }) {
  const labelId = `resposta-moderacao-${answer.id}`;
  return (
    <Card
      as="article"
      aria-labelledby={labelId}
      variant={answer.isHidden ? "muted" : "default"}
      className="grid gap-3 p-5"
    >
      {answer.question && (
        <p className="text-sm text-fg-muted">
          Em resposta a:{" "}
          {answer.question.isPublished ? (
            <Link
              href={`/pergunte/${answer.question.id}`}
              className="font-semibold text-primary underline-offset-4 hover:underline"
            >
              {answer.question.excerpt}
            </Link>
          ) : (
            <span className="font-semibold text-fg">{answer.question.excerpt}</span>
          )}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span id={labelId} className="font-semibold text-fg">
          {answer.authorName}
        </span>
        <Badge variant={answer.showIdentity ? "info" : "neutral"}>
          {answer.showIdentity ? "Nome visível em público" : "Sem nome em público"}
        </Badge>
        {answer.isHidden && <Badge variant="warning">Oculta</Badge>}
        <span className="text-fg-subtle">
          <time dateTime={toIsoString(answer.createdAt)} title={formatDateTime(answer.createdAt)}>
            {formatRelativeTime(answer.createdAt, now)}
          </time>
        </span>
      </div>
      <p className="whitespace-pre-line text-fg">{answer.body}</p>
      <div className="flex flex-wrap gap-2">
        <AnswerVisibilityDialog answerId={answer.id} hidden={answer.isHidden} />
      </div>
    </Card>
  );
}

/** Aba "Perguntas" do /admin: fila de revisão e respostas recentes (moderação e admins). */
export function PerguntasAdminPanel({ data }: { data: PerguntasAdminData }) {
  const { now } = data;
  return (
    <div className="grid gap-10">
      {data.error && (
        <p
          role="status"
          className="rounded-control bg-warning-soft px-4 py-3 text-sm text-warning-soft-fg"
        >
          Parte da fila não carregou. Recarregue a página em instantes.
        </p>
      )}

      <section aria-labelledby="fila-perguntas" className="grid gap-4">
        <SectionHeader
          id="fila-perguntas"
          title="Perguntas para revisar"
          count={data.pending.length}
          description="As mais antigas primeiro. Publique o que for sobre ciência ou carreira científica e não identificar quem perguntou (nome, escola, contatos). Na dúvida, não publique: a estudante vê o motivo e pode enviar de novo."
        />
        {data.pending.length === 0 ? (
          <EmptyState
            variant="compact"
            headingLevel="h4"
            icon={<Inbox />}
            title="Nenhuma pergunta esperando revisão"
            description="Quando uma estudante enviar uma pergunta, ela aparece aqui antes de ficar pública."
          />
        ) : (
          <ol className="grid gap-4">
            {data.pending.map((question) => (
              <li key={question.id}>
                <PendingCard question={question} now={now} />
              </li>
            ))}
          </ol>
        )}
      </section>

      <section aria-labelledby="respostas-recentes" className="grid gap-4">
        <SectionHeader
          id="respostas-recentes"
          title="Respostas recentes"
          description={`Últimos ${RECENT_ANSWERS_DAYS} dias, inclusive as ocultas. O nome de quem respondeu aparece aqui só para a moderação. Oculte respostas com contatos, pedidos de conversa privada ou fora do código de conduta.`}
        />
        {data.answers.length === 0 ? (
          <EmptyState
            variant="compact"
            headingLevel="h4"
            icon={<MessagesSquare />}
            title="Nenhuma resposta nos últimos dias"
            description="As respostas das cientistas da rede aparecem aqui assim que são publicadas."
          />
        ) : (
          <ol className="grid gap-4">
            {data.answers.map((answer) => (
              <li key={answer.id}>
                <AnswerCard answer={answer} now={now} />
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
