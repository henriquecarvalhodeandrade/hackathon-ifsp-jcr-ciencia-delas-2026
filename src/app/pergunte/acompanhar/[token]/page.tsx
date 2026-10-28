import type { Metadata } from "next";
import Link from "next/link";
import {
  CircleAlert,
  KeyRound,
  MessageCircleQuestion,
  MessagesSquare,
  PenLine,
  SearchX,
  Trash2,
} from "lucide-react";
import {
  Alert,
  Badge,
  ButtonLink,
  Card,
  ConfirmDialog,
  Container,
  EmptyState,
  PageHeader,
  Steps,
  type BadgeVariant,
} from "@/components/ui";
import { isSupabaseConfigured } from "@/lib/env";
import { deleteQuestionByToken } from "@/lib/pergunte/actions";
import { REJECT_REASON_TEXTS } from "@/lib/pergunte/labels";
import { getQuestionStatus, type QuestionStatusView } from "@/lib/pergunte/queries";
import { isTrackingToken } from "@/lib/pergunte/token";
import { formatDate, pluralize, toIsoString } from "@/lib/utils";

type Params = Promise<{ token: string }>;

/** Fora dos buscadores e sem mandar o endereço (com o token) como Referer para outros sites. */
export const metadata: Metadata = {
  title: "Acompanhar minha pergunta",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

const STEPS = [
  { label: "Enviada" },
  { label: "Em análise" },
  { label: "Publicada" },
  { label: "Respondida" },
] as const;

type Found = Exclude<QuestionStatusView, { kind: "not-found" } | { kind: "error" }>;

function describe(status: Found): {
  title: string;
  badge: string;
  badgeVariant: BadgeVariant;
  description: string;
  step: number | null;
} {
  switch (status.kind) {
    case "pending":
      return {
        title: "Em análise pela moderação",
        badge: "Em análise",
        badgeVariant: "info",
        description:
          "Uma moderadora vai ler sua pergunta antes de ela aparecer no site. Isso pode levar alguns dias: volte a este link de vez em quando.",
        step: 1,
      };
    case "published":
      return status.answerCount > 0
        ? {
            title: `Respondida: ${pluralize(status.answerCount, "resposta")}`,
            badge: "Respondida",
            badgeVariant: "success",
            description: "Cientistas da rede responderam sua pergunta. Que bom que você perguntou!",
            step: 3,
          }
        : {
            title: "Publicada: aguardando respostas",
            badge: "Publicada",
            badgeVariant: "primary",
            description:
              "Sua pergunta já aparece no site, sem nada que identifique você. Agora é esperar as cientistas da rede responderem.",
            step: 2,
          };
    case "rejected":
      return {
        title: "Não publicada",
        badge: "Não publicada",
        badgeVariant: "warning",
        description:
          "A moderação decidiu não publicar esta pergunta. Você pode enviar outra quando quiser.",
        step: null,
      };
  }
}

function decode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export default async function TrackQuestionPage({ params }: { params: Params }) {
  const token = decode((await params).token);
  // Formato inválido nem chega ao banco.
  const status: QuestionStatusView =
    isTrackingToken(token) && isSupabaseConfigured()
      ? await getQuestionStatus(token)
      : { kind: "not-found" };

  if (status.kind === "not-found" || status.kind === "error") {
    return (
      <Container size="narrow" className="py-14">
        <h1 className="sr-only">Acompanhar minha pergunta</h1>
        {status.kind === "error" ? (
          <EmptyState
            headingLevel="h2"
            icon={<CircleAlert />}
            title="Não conseguimos consultar sua pergunta agora"
            description="Tente de novo em instantes. Seu link continua valendo."
          />
        ) : (
          <EmptyState
            headingLevel="h2"
            icon={<SearchX />}
            title="Não encontramos esta pergunta"
            description="Confira se o link está completo. Perguntas apagadas por quem perguntou e perguntas não publicadas há mais de 30 dias deixam de existir."
            action={
              <ButtonLink href="/pergunte">
                <PenLine aria-hidden="true" />
                Fazer uma pergunta
              </ButtonLink>
            }
          />
        )}
      </Container>
    );
  }

  const info = describe(status);

  return (
    <Container size="narrow" className="pb-16">
      <PageHeader
        eyebrow="Acompanhar minha pergunta"
        title={info.title}
        description={info.description}
        actions={
          <Badge variant={info.badgeVariant} size="md">
            {info.badge}
          </Badge>
        }
      />

      <div className="grid gap-6">
        {info.step !== null && (
          <Card className="p-5 sm:p-6">
            <Steps steps={STEPS} current={info.step} label="Andamento da sua pergunta" />
          </Card>
        )}

        {status.kind === "rejected" && (
          <Alert variant="warning" title="Por que não foi publicada">
            <p>
              {status.reason
                ? REJECT_REASON_TEXTS[status.reason]
                : "Ela não seguiu as regras do Pergunte a uma cientista."}
            </p>
            <p className="mt-1">
              Ela será apagada de vez em até 30 dias.{" "}
              <Link href="/pergunte">Enviar uma nova pergunta</Link>
            </p>
          </Alert>
        )}

        {status.kind === "published" && (
          <div className="flex flex-wrap gap-2">
            <ButtonLink href={`/pergunte/${status.questionId}`} size="lg">
              {status.answerCount > 0 ? (
                <MessagesSquare aria-hidden="true" />
              ) : (
                <MessageCircleQuestion aria-hidden="true" />
              )}
              {status.answerCount > 0 ? "Ler as respostas" : "Ver a pergunta publicada"}
            </ButtonLink>
          </div>
        )}

        <Card
          as="section"
          aria-labelledby="sua-pergunta"
          variant="muted"
          className="grid gap-3 p-5 sm:p-6"
        >
          <h2 id="sua-pergunta" className="text-sm font-semibold text-fg-muted">
            Sua pergunta
            {status.createdAt && (
              <>
                {" · enviada em "}
                <time dateTime={toIsoString(status.createdAt)}>{formatDate(status.createdAt)}</time>
              </>
            )}
          </h2>
          <p className="font-serif text-lg leading-relaxed whitespace-pre-line text-fg">
            {status.body}
          </p>
        </Card>

        <Card
          as="section"
          aria-labelledby="apagar-pergunta"
          variant="outline"
          className="grid gap-3 p-5 sm:p-6"
        >
          <h2 id="apagar-pergunta" className="font-display text-lg font-semibold text-fg">
            Apagar minha pergunta
          </h2>
          <p className="text-sm text-fg-muted">
            Você pode apagar a qualquer momento, em qualquer etapa. As respostas que ela recebeu
            também somem.
          </p>
          <div>
            <ConfirmDialog
              stateAction={deleteQuestionByToken}
              hiddenFields={{ token }}
              triggerLabel="Apagar minha pergunta"
              triggerIcon={<Trash2 aria-hidden="true" />}
              triggerVariant="danger"
              title="Apagar sua pergunta?"
              description="A pergunta e as respostas que ela recebeu serão apagadas de vez. Não dá para desfazer."
              confirmLabel="Sim, apagar"
              pendingLabel="Apagando…"
              cancelLabel="Voltar"
            />
          </div>
        </Card>

        <p className="flex items-start gap-2 text-sm text-fg-muted">
          <KeyRound aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-fg-subtle" />
          <span>
            Este link é só seu: quem o tiver vê o andamento e pode apagar a pergunta. Esta página
            não aparece em buscadores.
          </span>
        </p>
      </div>
    </Container>
  );
}
