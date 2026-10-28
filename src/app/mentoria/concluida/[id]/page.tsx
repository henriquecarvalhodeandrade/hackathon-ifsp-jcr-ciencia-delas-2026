import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { CircleCheck, Lock, MessageSquareHeart } from "lucide-react";
import { z } from "zod";
import { Alert, Badge, ButtonLink, Card, Container, PageHeader } from "@/components/ui";
import { DeleteFeedbackDialog } from "@/components/recognition/declaration-forms";
import { DeclarationPanel } from "@/components/recognition/declaration-panel";
import { FeedbackForm } from "@/components/recognition/feedback-form";
import { ImpactSummary } from "@/components/recognition/impact-summary";
import { PersonSummary } from "@/components/mentorship/person-summary";
import { getCurrentUser, requireOnboardedProfile } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";
import { conversationHref } from "@/lib/mentorship/conversation";
import { firstName, parseNotice, tabHref } from "@/lib/mentorship/presentation";
import { formatPeriodRange } from "@/lib/recognition/declaration-text";
import { outcomeLabel } from "@/lib/recognition/outcomes";
import { getCompletion, type MyFeedback } from "@/lib/recognition/queries";
import { formatDate, toIsoString } from "@/lib/utils";

type Params = Promise<{ id: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const idSchema = z.guid();

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const base: Metadata = { title: "Mentoria concluída", robots: { index: false, follow: false } };
  if (!isSupabaseConfigured() || !idSchema.safeParse(id).success) return base;
  const user = await getCurrentUser();
  if (!user) return base;
  const result = await getCompletion(id, user.id);
  if (result.kind === "not-found") return { ...base, title: "Mentoria não encontrada" };
  return base;
}

function YourAnswers({ feedback }: { feedback: MyFeedback }) {
  const recommend =
    feedback.would_recommend === true
      ? "Sim"
      : feedback.would_recommend === false
        ? "Não"
        : "Prefiro não dizer";
  const outcomes = feedback.outcomes.map((slug) => outcomeLabel(slug)).filter(Boolean);
  return (
    <details className="rounded-control border border-border">
      <summary className="cursor-pointer rounded-control px-3.5 py-2.5 text-sm font-semibold text-fg-muted hover:text-fg">
        Ver as suas respostas (só você vê)
      </summary>
      <dl className="grid gap-3 border-t border-border px-3.5 py-3 text-sm">
        <div className="grid gap-0.5">
          <dt className="font-semibold text-fg">Quanto a mentoria ajudou</dt>
          <dd className="text-fg-muted">{feedback.helpfulness} de 5</dd>
        </div>
        <div className="grid gap-0.5">
          <dt className="font-semibold text-fg">O que mudou</dt>
          <dd className="text-fg-muted">
            {outcomes.length ? (
              <ul className="list-disc pl-5">
                {outcomes.map((label) => (
                  <li key={label}>{label}</li>
                ))}
              </ul>
            ) : (
              "Nenhuma opção marcada"
            )}
          </dd>
        </div>
        <div className="grid gap-0.5">
          <dt className="font-semibold text-fg">Indicaria a Artemis</dt>
          <dd className="text-fg-muted">{recommend}</dd>
        </div>
        {feedback.note && (
          <div className="grid gap-0.5">
            <dt className="font-semibold text-fg">Sua nota</dt>
            <dd className="whitespace-pre-line text-fg-muted">{feedback.note}</dd>
          </div>
        )}
      </dl>
    </details>
  );
}

/**
 * Depois de "Concluir mentoria": retorno privado (opcional), declaração de participação e o
 * impacto agregado. Só as participantes abrem (os demais recebem 404); mentoria ainda não
 * concluída volta para /mentoria?aba=ativas.
 */
export default async function MentorshipCompletedPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { id } = await params;
  const profile = await requireOnboardedProfile(`/mentoria/concluida/${id}`);
  if (!isSupabaseConfigured() || !idSchema.safeParse(id).success) notFound();

  const result = await getCompletion(id, profile.id);
  if (result.kind === "not-found") notFound();
  if (result.kind === "not-completed") redirect(tabHref("ativas"));
  if (result.kind === "error") {
    return (
      <Container size="narrow" className="py-14">
        <h1 className="sr-only">Mentoria concluída</h1>
        <Alert
          variant="danger"
          title="Não conseguimos carregar esta mentoria agora"
          actions={<ButtonLink href={`/mentoria/concluida/${id}`}>Tentar de novo</ButtonLink>}
        >
          Recarregue a página em instantes. Se continuar, tente sair e entrar de novo.
        </Alert>
      </Container>
    );
  }

  const { request, role, other, feedback, declaration } = result.completion;
  const otherFirst = firstName(other.full_name) || other.full_name;
  const notice = parseNotice((await searchParams).aviso);
  const period = formatPeriodRange(
    request.responded_at ?? request.created_at,
    request.completed_at,
  );

  return (
    <Container>
      <PageHeader
        eyebrow="Mentoria concluída"
        title="Mentoria concluída. Obrigada por fazer parte."
        description={`Você e ${otherFirst} chegaram ao fim desta etapa. Se quiser, conte como foi e peçam juntas a declaração de participação.`}
        back={{ href: tabHref("ativas"), label: "Voltar para as mentorias" }}
      />

      <div className="grid gap-10 pb-14">
        {notice && (
          <Alert variant={notice.variant} title={notice.title} live>
            {notice.body}
          </Alert>
        )}

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <Card
            as="section"
            aria-labelledby="retorno-titulo"
            id="retorno"
            className="grid gap-5 p-5 sm:p-7"
          >
            <div className="grid gap-2">
              <h2 id="retorno-titulo" className="font-display text-2xl font-semibold text-fg">
                Conte como foi{" "}
                <span className="text-lg font-medium text-fg-muted">
                  (só você vê suas respostas)
                </span>
              </h2>
              <p className="flex items-start gap-2 text-sm text-fg-muted">
                <Lock aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-fg-subtle" />
                <span>
                  Nem {otherFirst}, nem a moderação veem o que você responder. As respostas só
                  entram nos números gerais da plataforma, a partir de 5 retornos.
                </span>
              </p>
            </div>
            {feedback ? (
              <div className="grid gap-4">
                <p className="flex items-start gap-2.5 rounded-control bg-success-soft p-4 text-success-soft-fg">
                  <CircleCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-success" />
                  <span>
                    <strong className="font-semibold">Você já contou como foi. Obrigada!</strong>{" "}
                    Enviado em{" "}
                    <time dateTime={toIsoString(feedback.created_at)}>
                      {formatDate(feedback.created_at)}
                    </time>
                    .
                  </span>
                </p>
                <YourAnswers feedback={feedback} />
                <div>
                  <DeleteFeedbackDialog requestId={request.id} />
                </div>
              </div>
            ) : (
              <FeedbackForm requestId={request.id} role={role} otherFirstName={otherFirst} />
            )}
          </Card>

          <div className="grid gap-6">
            <Card
              as="section"
              aria-labelledby="declaracao-titulo"
              id="declaracao"
              className="grid gap-4 p-5 sm:p-6"
            >
              <h2 id="declaracao-titulo" className="font-display text-xl font-semibold text-fg">
                Declaração de participação
              </h2>
              <DeclarationPanel
                requestId={request.id}
                otherFirstName={otherFirst}
                declaration={declaration}
                returnTo="concluida"
              />
              <p className="border-t border-border pt-3 text-xs text-fg-subtle">
                A página pública mostra só os nomes, os papéis, o período e os temas. Qualquer uma
                das duas pode revogar depois.
              </p>
            </Card>

            <Card
              as="aside"
              variant="muted"
              aria-labelledby="sobre-mentoria"
              className="grid gap-3 p-5"
            >
              <h2 id="sobre-mentoria" className="font-display text-lg font-semibold text-fg">
                A mentoria
              </h2>
              <PersonSummary person={other} headingLevel="h3">
                <Badge variant={role === "mentee" ? "primary" : "secondary"}>
                  {role === "mentee" ? "Sua mentora" : "Sua mentoranda"}
                </Badge>
              </PersonSummary>
              {period && (
                <p className="text-sm text-fg-muted">
                  Período: <span className="font-semibold text-fg">{period}</span>
                </p>
              )}
              <div>
                <ButtonLink href={conversationHref(request.id)} variant="outline" size="sm">
                  <MessageSquareHeart aria-hidden="true" />
                  Ver conversa
                  <span className="sr-only"> com {otherFirst}</span>
                </ButtonLink>
              </div>
            </Card>
          </div>
        </div>

        <ImpactSummary variant="embedded" />
      </div>
    </Container>
  );
}
