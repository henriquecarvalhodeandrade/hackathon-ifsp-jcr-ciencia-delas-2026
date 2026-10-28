import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  EyeOff,
  LogIn,
  MessageCircle,
  MessagesSquare,
  PenLine,
  ShieldCheck,
  Trash2,
  UserRoundPen,
} from "lucide-react";
import { RemoveQuestionDialog } from "@/components/pergunte/admin-actions";
import { AnswerForm } from "@/components/pergunte/answer-form";
import { AnswerList } from "@/components/pergunte/answer-list";
import {
  Alert,
  Badge,
  ButtonLink,
  Card,
  cardVariants,
  Chip,
  ConfirmDialog,
  Container,
  EmptyState,
  PageHeader,
} from "@/components/ui";
import { getCurrentProfile, isModerator } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";
import {
  answerCountLabel,
  questionExcerpt,
  questionHeadline,
  STAGE_LABELS,
} from "@/lib/pergunte/labels";
import { deleteAnswer } from "@/lib/pergunte/actions";
import {
  getPublishedQuestion,
  listMyHiddenAnswers,
  listPublicAnswers,
} from "@/lib/pergunte/queries";
import { cn, formatDate, toIsoString, truncate } from "@/lib/utils";

type Params = Promise<{ id: string }>;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function loadQuestion(id: string) {
  if (!UUID_RE.test(id) || !isSupabaseConfigured()) return null;
  return getPublishedQuestion(id);
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const question = await loadQuestion(id);
  if (!question) return { title: "Pergunta não encontrada", robots: { index: false } };
  return {
    title: questionHeadline(question.body, 70),
    description: questionExcerpt(question.body, 160),
    alternates: { canonical: `/pergunte/${question.id}` },
  };
}

export default async function QuestionPage({ params }: { params: Params }) {
  const { id } = await params;
  const [question, profile] = await Promise.all([loadQuestion(id), getCurrentProfile()]);
  if (!question) notFound();

  const [answers, myHidden] = await Promise.all([
    listPublicAnswers(question.id),
    profile ? listMyHiddenAnswers(question.id, profile.id) : Promise.resolve([]),
  ]);
  const count = answers?.length ?? 0;
  const next = encodeURIComponent(`/pergunte/${question.id}#responder`);

  return (
    <Container size="narrow" className="pb-16">
      <PageHeader
        back={{ href: "/pergunte", label: "Todas as perguntas" }}
        eyebrow="Pergunta de uma estudante"
        title={questionHeadline(question.body, 160)}
      >
        <div className="flex flex-wrap items-center gap-2 text-sm text-fg-muted">
          {question.stage && (
            <Badge variant="primary" size="md">
              {STAGE_LABELS[question.stage]}
            </Badge>
          )}
          {question.areaName && <Chip variant="outline">{question.areaName}</Chip>}
          <span className="flex items-center gap-1.5">
            <MessageCircle aria-hidden="true" className="size-4 text-fg-subtle" />
            {answerCountLabel(count)}
          </span>
          <span aria-hidden="true">·</span>
          <span>
            publicada em{" "}
            <time dateTime={toIsoString(question.publishedAt)}>
              {formatDate(question.publishedAt)}
            </time>
          </span>
        </div>
      </PageHeader>

      <figure className={cn(cardVariants({ variant: "muted" }), "grid gap-3 p-5 sm:p-7")}>
        <blockquote className="font-serif text-xl leading-relaxed whitespace-pre-line text-fg">
          {question.body}
        </blockquote>
        <figcaption className="text-sm text-fg-muted">
          Pergunta anônima, publicada depois da revisão da moderação.
        </figcaption>
      </figure>

      <section aria-labelledby="respostas-titulo" className="grid gap-5 pt-12">
        <h2 id="respostas-titulo" className="font-display text-2xl font-semibold text-fg">
          {count > 0 ? `Respostas (${count})` : "Respostas"}
        </h2>
        {answers === null ? (
          <Alert variant="warning" title="Não conseguimos carregar as respostas agora">
            Recarregue a página em instantes.
          </Alert>
        ) : answers.length === 0 ? (
          <EmptyState
            variant="compact"
            headingLevel="h3"
            icon={<MessagesSquare />}
            title="Esta pergunta ainda espera a primeira resposta"
            description="Cientistas da rede respondem por aqui, em público. Volte em alguns dias."
          />
        ) : (
          <AnswerList answers={answers} questionId={question.id} />
        )}

        {myHidden.length > 0 && (
          <Alert
            variant="warning"
            icon={<EyeOff />}
            title={
              myHidden.length === 1
                ? "Uma resposta sua foi ocultada pela moderação"
                : `${myHidden.length} respostas suas foram ocultadas pela moderação`
            }
          >
            <p>
              Ela não aparece para o público nem na contagem. Se quiser, apague e responda de novo
              seguindo o código de conduta, sem contatos privados.
            </p>
            <ul className="mt-3 grid gap-3">
              {myHidden.map((answer) => (
                <li
                  key={answer.id}
                  className="grid gap-2 rounded-control border border-border bg-surface p-3 text-fg"
                >
                  <p className="text-sm whitespace-pre-line">{truncate(answer.body, 280)}</p>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm text-fg-muted">
                      Respondeu em{" "}
                      <time dateTime={toIsoString(answer.createdAt)}>
                        {formatDate(answer.createdAt)}
                      </time>
                    </p>
                    <ConfirmDialog
                      stateAction={deleteAnswer}
                      hiddenFields={{ answerId: answer.id, questionId: question.id }}
                      triggerLabel="Apagar esta resposta"
                      triggerIcon={<Trash2 aria-hidden="true" />}
                      triggerVariant="outline"
                      triggerSize="sm"
                      title="Apagar sua resposta ocultada?"
                      description="Ela é apagada de vez. Não dá para desfazer."
                      confirmLabel="Sim, apagar"
                      pendingLabel="Apagando…"
                      cancelLabel="Voltar"
                    />
                  </div>
                </li>
              ))}
            </ul>
          </Alert>
        )}
      </section>

      <section
        aria-labelledby="responder-titulo"
        id="responder"
        className="grid scroll-mt-20 gap-5 pt-12"
      >
        <h2 id="responder-titulo" className="font-display text-2xl font-semibold text-fg">
          Responder
        </h2>
        {profile?.onboarded_at ? (
          <Card className="p-5 sm:p-6">
            <AnswerForm questionId={question.id} />
          </Card>
        ) : profile ? (
          <Card variant="outline" className="grid gap-3 p-5 sm:p-6">
            <p className="font-semibold text-fg">Complete seu cadastro para responder.</p>
            <p className="text-sm text-fg-muted">
              Só pesquisadoras com o perfil completo respondem às estudantes.
            </p>
            <div>
              <ButtonLink href={`/onboarding?next=${next}`} variant="outline">
                <UserRoundPen aria-hidden="true" />
                Completar meu cadastro
              </ButtonLink>
            </div>
          </Card>
        ) : (
          <Card variant="outline" className="grid gap-4 p-5 sm:p-6">
            <div className="grid gap-1">
              <p className="font-semibold text-fg">É pesquisadora? Entre para responder.</p>
              <p className="text-sm text-fg-muted">
                As respostas são públicas e você escolhe, em cada uma, se mostra seu nome.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <ButtonLink href={`/entrar?next=${next}`}>
                <LogIn aria-hidden="true" />
                Entrar para responder
              </ButtonLink>
              <ButtonLink href="/pergunte#enviar-pergunta" variant="outline">
                <PenLine aria-hidden="true" />
                Também quero perguntar
              </ButtonLink>
            </div>
          </Card>
        )}
      </section>

      {isModerator(profile) && (
        <section aria-labelledby="moderacao-titulo" className="grid gap-4 pt-12">
          <h2
            id="moderacao-titulo"
            className="flex items-center gap-2 font-display text-xl font-semibold text-fg"
          >
            <ShieldCheck aria-hidden="true" className="size-5 text-primary" />
            Moderação
          </h2>
          <Card variant="outline" className="grid gap-3 p-5 sm:p-6">
            <p className="text-sm text-fg-muted">
              Se esta pergunta identifica quem perguntou (nome, escola, cidade pequena, contato) ou
              se ela pediu a exclusão e não tem mais o link, remova de vez. As respostas vão junto e
              a remoção fica no registro da moderação. Para uma resposta só, use{" "}
              <Link
                href="/admin?aba=perguntas"
                className="font-semibold text-primary underline underline-offset-4"
              >
                a aba Perguntas
              </Link>
              .
            </p>
            <div>
              <RemoveQuestionDialog questionId={question.id} />
            </div>
          </Card>
        </section>
      )}
    </Container>
  );
}
