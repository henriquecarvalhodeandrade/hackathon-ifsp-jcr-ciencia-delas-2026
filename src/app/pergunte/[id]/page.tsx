import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LogIn, MessageCircle, MessagesSquare, PenLine, UserRoundPen } from "lucide-react";
import { AnswerForm } from "@/components/pergunte/answer-form";
import { AnswerList } from "@/components/pergunte/answer-list";
import {
  Alert,
  Badge,
  ButtonLink,
  Card,
  cardVariants,
  Chip,
  Container,
  EmptyState,
  PageHeader,
} from "@/components/ui";
import { getCurrentProfile } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";
import {
  answerCountLabel,
  questionExcerpt,
  questionHeadline,
  STAGE_LABELS,
} from "@/lib/pergunte/labels";
import { getPublishedQuestion, listPublicAnswers } from "@/lib/pergunte/queries";
import { cn, formatDate, toIsoString } from "@/lib/utils";

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

  const answers = await listPublicAnswers(question.id);
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
    </Container>
  );
}
