import { notFound } from "next/navigation";
import { MessageSquareHeart } from "lucide-react";
import { Alert, ButtonLink, Card, Container, EmptyState, PageHeader } from "@/components/ui";
import { ConversationScroller } from "@/components/mentorship/conversation-scroller";
import { PersonSummary } from "@/components/mentorship/person-summary";
import { DirectConversationLive } from "@/components/messages/conversation-live";
import { InboxPane } from "@/components/messages/inbox-pane";
import { DirectMessageComposer } from "@/components/messages/message-composer";
import { DirectMessageList } from "@/components/messages/message-list";
import { RequestResponse } from "@/components/messages/request-response";
import { ReportButton } from "@/components/moderation/report-button";
import { requireOnboardedProfile } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";
import {
  CONVERSATION_MESSAGE_LIMIT,
  conversationStarters,
  conversationState,
  latestUnreadFromOther,
} from "@/lib/messages/conversation";
import { buildInbox, inboxHref, inboxTabOf } from "@/lib/messages/inbox";
import { getDirectConversation, getInbox } from "@/lib/messages/queries";
import { conversationIdSchema } from "@/lib/messages/schema";
import { firstName } from "@/lib/mentorship/presentation";
import { cn, formatNumber } from "@/lib/utils";

type Params = Promise<{ id: string }>;

export default async function DirectConversationPage({ params }: { params: Params }) {
  const { id } = await params;
  const profile = await requireOnboardedProfile(`/mensagens/${id}`);
  if (!isSupabaseConfigured()) notFound();
  if (!conversationIdSchema.safeParse(id).success) notFound();

  // O layout já respondeu 404 para quem não participa; aqui é só para o tipo.
  const [result, inboxResult] = await Promise.all([
    getDirectConversation(id, profile.id),
    getInbox(),
  ]);
  if (result.kind === "not-found") notFound();
  if (result.kind === "error") {
    return (
      <Container size="narrow" className="py-14">
        <h1 className="sr-only">Mensagens</h1>
        <Alert
          variant="danger"
          title="Não conseguimos carregar a conversa agora"
          actions={<ButtonLink href={`/mensagens/${id}`}>Tentar de novo</ButtonLink>}
        >
          Recarregue a página em instantes. Se continuar, tente sair e entrar de novo.
        </Alert>
      </Container>
    );
  }

  const { status, iAmInitiator, other, messages, truncated, mySentCount } = result.conversation;
  const otherFirst = firstName(other.full_name) || other.full_name;
  const state = conversationState({
    status,
    iAmInitiator,
    mySentCount,
    otherFirstName: otherFirst,
  });
  const banner = state.banner;
  const last = messages.at(-1);
  const latestUnread = latestUnreadFromOther(messages);
  const firstRequest = banner?.kind === "first-request";

  // Lista lateral (telas largas): a aba em que esta conversa aparece, com ela destacada.
  const inbox = buildInbox(inboxResult.rows, profile.id);
  const currentRow = inboxResult.rows.find((row) => row.id === id);
  const tab = (currentRow && inboxTabOf(currentRow, profile.id)) || "conversas";
  const now = new Date();

  return (
    <Container>
      <PageHeader
        eyebrow="Mensagens"
        title={`Conversa com ${otherFirst}`}
        back={{ href: inboxHref(tab), label: "Voltar para as mensagens" }}
        className="pb-5 sm:pb-6"
      />

      <div className="grid items-start gap-6 pb-14 lg:grid-cols-[22rem_minmax(0,1fr)]">
        <InboxPane
          inbox={inbox}
          tab={tab}
          failed={inboxResult.failed}
          currentId={id}
          headingId="lista-de-conversas"
          className="hidden lg:grid"
        />

        <Card as="section" aria-labelledby="conversa-com" className="grid min-w-0">
          <header className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5">
            <PersonSummary person={other} headingLevel="h2" headingId="conversa-com" />
            <div className="flex shrink-0 flex-row-reverse flex-wrap items-center justify-between gap-2 sm:flex-row sm:justify-end">
              <ButtonLink href={`/pesquisadoras/${other.id}`} variant="outline" size="sm">
                Ver perfil<span className="sr-only"> de {other.full_name}</span>
              </ButtonLink>
              <ReportButton targetType="profile" targetId={other.id} label="Denunciar perfil" />
            </div>
          </header>

          {banner && (
            <Alert
              variant={banner.variant}
              title={banner.title}
              className="mx-4 mt-4 sm:mx-5"
              actions={
                banner.kind === "incoming-request" ? (
                  <RequestResponse conversationId={id} />
                ) : undefined
              }
            >
              {banner.body}
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
              <DirectMessageList
                messages={messages}
                otherName={otherFirst}
                readReceipts={state.showReadReceipts}
                now={now}
              />
            ) : (
              <EmptyState
                variant="compact"
                headingLevel="h3"
                icon={<MessageSquareHeart />}
                title={state.canSend ? "Comecem a conversa" : "Nenhuma mensagem por aqui"}
                description={
                  !state.canSend
                    ? `A conversa continua quando ${otherFirst} responder.`
                    : firstRequest
                      ? `Apresente-se e conte por que quer conversar com ${otherFirst}. As sugestões abaixo ajudam a começar.`
                      : `Diga olá para ${otherFirst}. As sugestões abaixo ajudam a começar.`
                }
              />
            )}
          </ConversationScroller>

          {state.canSend && (
            <div className="border-t border-border p-4 sm:p-5">
              <DirectMessageComposer
                conversationId={id}
                otherFirstName={otherFirst}
                starters={messages.length === 0 ? conversationStarters(otherFirst) : []}
                hint={
                  firstRequest
                    ? "Você manda uma mensagem e espera a resposta."
                    : "As mensagens ficam só entre vocês duas."
                }
                submitLabel={firstRequest ? "Enviar pedido" : "Enviar"}
              />
            </div>
          )}
        </Card>
      </div>

      <DirectConversationLive conversationId={id} latestUnreadId={latestUnread?.id ?? null} />
    </Container>
  );
}
