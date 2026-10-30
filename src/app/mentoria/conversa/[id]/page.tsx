import { notFound } from "next/navigation";
import { MessageSquareHeart } from "lucide-react";
import { z } from "zod";
import { Alert, Badge, ButtonLink, Card, Container, EmptyState, PageHeader } from "@/components/ui";
import { ConversationLive } from "@/components/mentorship/conversation-live";
import { ConversationScroller } from "@/components/mentorship/conversation-scroller";
import { FirstMeetingChecklist } from "@/components/mentorship/first-meeting-checklist";
import { MessageComposer } from "@/components/mentorship/message-composer";
import { MessageList } from "@/components/mentorship/message-list";
import { PersonSummary } from "@/components/mentorship/person-summary";
import { MentorshipStatusBadge } from "@/components/mentorship/status-badge";
import { ReportButton } from "@/components/moderation/report-button";
import { requireOnboardedProfile } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";
import {
  CONVERSATION_MESSAGE_LIMIT,
  conversationStarters,
  conversationState,
  hasConversation,
  otherRoleLabel,
} from "@/lib/mentorship/conversation";
import { getConversation } from "@/lib/mentorship/conversation-queries";
import { firstName, tabHref } from "@/lib/mentorship/presentation";
import { cn, formatDate, formatNumber, toIsoString } from "@/lib/utils";

type Params = Promise<{ id: string }>;

const idSchema = z.guid();

export default async function ConversationPage({ params }: { params: Params }) {
  const { id } = await params;
  const profile = await requireOnboardedProfile(`/mentoria/conversa/${id}`);
  if (!isSupabaseConfigured()) notFound();
  if (!idSchema.safeParse(id).success) notFound();

  // O layout já respondeu 404 para quem não participa; aqui é só para o tipo.
  const result = await getConversation(id, profile.id);
  if (result.kind === "not-found") notFound();
  if (result.kind === "error") {
    return (
      <Container size="narrow" className="py-14">
        <h1 className="sr-only">Conversa da mentoria</h1>
        <Alert
          variant="danger"
          title="Não conseguimos carregar a conversa agora"
          actions={<ButtonLink href={`/mentoria/conversa/${id}`}>Tentar de novo</ButtonLink>}
        >
          Recarregue a página em instantes. Se continuar, tente sair e entrar de novo.
        </Alert>
      </Container>
    );
  }

  const { request, role, other, messages, truncated } = result.conversation;
  const otherFirst = firstName(other.full_name) || other.full_name;
  // Concluída/cancelada depois do aceite: conversa guardada. Pendente, recusado ou cancelado antes
  // do aceite: a conversa nunca abriu.
  const opened = hasConversation(request);
  const state = conversationState(request.status, role, otherFirst, opened);
  const last = messages.at(-1);
  const latestUnread = [...messages].reverse().find((m) => !m.mine && m.read_at === null);
  // Desde o aceite (responded_at); pedido recusado ou cancelado antes do aceite não tem "desde".
  const since = request.status === "declined" ? null : request.responded_at;
  const now = new Date();

  return (
    <Container>
      <PageHeader
        eyebrow="Mentoria"
        title={`Conversa com ${otherFirst}`}
        back={{ href: tabHref("ativas"), label: "Voltar para as mentorias" }}
        className="pb-5 sm:pb-6"
      />

      <div className="grid items-start gap-6 pb-14 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Card as="section" aria-labelledby="conversa-com" className="grid min-w-0">
          <header className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5">
            <PersonSummary person={other} headingLevel="h2" headingId="conversa-com">
              <Badge variant={role === "mentee" ? "primary" : "secondary"} size="md">
                {otherRoleLabel(role)}
              </Badge>
              <MentorshipStatusBadge status={request.status} />
            </PersonSummary>
            <div className="flex shrink-0 flex-row-reverse items-center justify-between gap-2 sm:flex-col sm:items-end">
              <ReportButton targetType="profile" targetId={other.id} label="Denunciar perfil" />
              {since && (
                <p className="text-sm text-fg-subtle">
                  Mentoria desde <time dateTime={toIsoString(since)}>{formatDate(since)}</time>
                </p>
              )}
            </div>
          </header>

          {state.banner && (
            <Alert
              variant={state.banner.variant}
              title={state.banner.title}
              className="mx-4 mt-4 sm:mx-5"
            >
              {state.banner.body}
            </Alert>
          )}

          <ConversationScroller
            label={`Mensagens com ${otherFirst}`}
            lastMessageId={last?.id ?? null}
            lastIsMine={last?.mine ?? false}
            className={cn(
              "px-4 py-5 sm:px-5",
              // Aberta: altura fixa (o campo fica sempre no mesmo lugar). Só leitura: encolhe.
              state.canSend ? "h-[min(60dvh,38rem)] min-h-80" : "max-h-[min(70dvh,44rem)]",
            )}
          >
            {truncated && (
              <p className="mb-5 text-center text-xs text-fg-muted">
                Mostrando as {formatNumber(CONVERSATION_MESSAGE_LIMIT)} mensagens mais recentes.
              </p>
            )}
            {messages.length > 0 ? (
              <MessageList messages={messages} otherName={otherFirst} now={now} />
            ) : (
              <EmptyState
                variant="compact"
                headingLevel="h3"
                icon={<MessageSquareHeart />}
                title={state.canSend ? "Comecem a conversa" : "Nenhuma mensagem por aqui"}
                description={
                  state.canSend
                    ? role === "mentee"
                      ? `Apresente-se, conte o que você espera da mentoria e combine com ${otherFirst} o primeiro encontro. As sugestões abaixo ajudam a começar.`
                      : `Dê as boas-vindas a ${otherFirst} e combinem o primeiro encontro. As sugestões abaixo ajudam a começar.`
                    : opened
                      ? "Esta mentoria não teve mensagens pela plataforma."
                      : "A conversa só abre depois que a mentora aceita o pedido."
                }
              />
            )}
          </ConversationScroller>

          {state.canSend && (
            <div className="border-t border-border p-4 sm:p-5">
              <MessageComposer
                requestId={request.id}
                otherFirstName={otherFirst}
                starters={messages.length === 0 ? conversationStarters(role, otherFirst) : []}
              />
            </div>
          )}
        </Card>

        <div className="hidden gap-6 lg:grid">
          <Card
            as="aside"
            variant="muted"
            aria-labelledby="pedido-original"
            className="grid gap-3 p-5"
          >
            <h2 id="pedido-original" className="font-display text-lg font-semibold text-fg">
              O pedido de mentoria
            </h2>
            <p className="line-clamp-6 text-sm whitespace-pre-line text-fg-muted">
              {request.message}
            </p>
            <p className="text-xs text-fg-subtle">
              Enviado em{" "}
              <time dateTime={toIsoString(request.created_at)}>
                {formatDate(request.created_at)}
              </time>
            </p>
          </Card>
          {state.canSend && <FirstMeetingChecklist />}
        </div>
      </div>

      <ConversationLive
        requestId={request.id}
        live={request.status === "accepted"}
        latestUnreadId={latestUnread?.id ?? null}
      />
    </Container>
  );
}
