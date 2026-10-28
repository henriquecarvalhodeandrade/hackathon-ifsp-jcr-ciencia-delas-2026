import { Ban, CalendarCheck, CircleCheck, Quote } from "lucide-react";
import { Badge, ButtonLink, Card, Chip } from "@/components/ui";
import { cancelRequestAction, completeMentorshipAction } from "@/app/mentoria/actions";
import { hasConversation } from "@/lib/mentorship/conversation";
import type { Contact, RequestItem } from "@/lib/mentorship/queries";
import { firstName, tabHref } from "@/lib/mentorship/presentation";
import { topicLabel } from "@/lib/mentorship/view-models";
import { formatDate, formatRelativeTime, toIsoString } from "@/lib/utils";
import { MentorshipActionDialog } from "./action-dialog";
import { ContactCard } from "./contact-card";
import { ConversationLink } from "./conversation-link";
import { PersonSummary } from "./person-summary";
import { RespondForm } from "./respond-form";
import { MentorshipStatusBadge } from "./status-badge";

function TimeAgo({ date, prefix }: { date: string; prefix: string }) {
  return (
    <p className="text-sm text-fg-subtle">
      {prefix}{" "}
      <time
        dateTime={toIsoString(date)}
        title={formatDate(date, { dateStyle: "long", timeStyle: "short" })}
      >
        {formatRelativeTime(date)}
      </time>
    </p>
  );
}

/** Mensagem citada (pedido ou resposta). */
function QuotedMessage({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <figure className="grid gap-1.5 rounded-control bg-surface-2 p-3.5">
      <figcaption className="flex items-center gap-1.5 text-xs font-bold tracking-wide text-fg-subtle uppercase">
        <Quote aria-hidden="true" className="size-3.5" />
        {label}
      </figcaption>
      <blockquote className="text-[0.9375rem] whitespace-pre-line text-fg">{children}</blockquote>
    </figure>
  );
}

// ---------------------------------------------------------------------------
// Solicitações enviadas (mentoranda)
// ---------------------------------------------------------------------------

export function SentRequestCard({
  request,
  unread = 0,
}: {
  request: RequestItem;
  /** Mensagens não lidas na conversa (se houver conversa). */
  unread?: number;
}) {
  const mentorName = firstName(request.other.full_name) || request.other.full_name;
  const headingId = `enviada-${request.id}`;
  return (
    <Card as="li" aria-labelledby={headingId} className="grid gap-4 p-5 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <PersonSummary person={request.other} headingId={headingId} />
        <div className="flex shrink-0 flex-col items-start gap-1 sm:items-end">
          <MentorshipStatusBadge status={request.status} />
          <TimeAgo date={request.created_at} prefix="Enviado" />
        </div>
      </div>

      <details className="group rounded-control border border-border">
        <summary className="cursor-pointer rounded-control px-3.5 py-2.5 text-sm font-semibold text-fg-muted hover:text-fg">
          Ver a mensagem que você enviou
        </summary>
        <p className="border-t border-border px-3.5 py-3 text-[0.9375rem] whitespace-pre-line text-fg">
          {request.message}
        </p>
      </details>

      {request.response_message && (
        <QuotedMessage label={`Resposta de ${mentorName}`}>
          {request.response_message}
        </QuotedMessage>
      )}

      {request.status === "pending" && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <p className="text-sm text-fg-muted">
            {mentorName} ainda não respondeu. Você recebe uma notificação assim que ela responder.
          </p>
          <MentorshipActionDialog
            action={cancelRequestAction}
            hiddenFields={{ request_id: request.id }}
            triggerLabel="Cancelar pedido"
            triggerIcon={<Ban aria-hidden="true" />}
            title="Cancelar este pedido?"
            description={`Avisaremos ${mentorName}. Depois, se quiser, você pode enviar um novo pedido.`}
            confirmLabel="Sim, cancelar pedido"
            pendingLabel="Cancelando…"
          />
        </div>
      )}
      {request.status === "accepted" && (
        <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
          <ConversationLink requestId={request.id} otherName={mentorName} unread={unread} />
          <ButtonLink href={tabHref("ativas")} variant="secondary" size="sm">
            <CalendarCheck aria-hidden="true" />
            Ver mentoria ativa
          </ButtonLink>
        </div>
      )}
      {request.status !== "accepted" && hasConversation(request) && (
        <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
          <ConversationLink
            requestId={request.id}
            otherName={mentorName}
            unread={unread}
            readOnly
          />
        </div>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Solicitações recebidas (mentora)
// ---------------------------------------------------------------------------

export function ReceivedRequestCard({ request }: { request: RequestItem }) {
  const menteeName = firstName(request.other.full_name) || request.other.full_name;
  const headingId = `recebida-${request.id}`;
  const topics = request.other.mentorship_topics.map(topicLabel);
  return (
    <Card as="li" aria-labelledby={headingId} className="grid gap-4 p-5 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <PersonSummary person={request.other} headingId={headingId}>
          {request.match_score !== null && (
            <Badge variant="primary">Afinidade estimada: {request.match_score}%</Badge>
          )}
        </PersonSummary>
        <div className="flex shrink-0 flex-col items-start gap-1 sm:items-end">
          <MentorshipStatusBadge status={request.status} />
          <TimeAgo date={request.created_at} prefix="Recebido" />
        </div>
      </div>

      {(request.other.areas.length > 0 || topics.length > 0) && (
        <dl className="grid gap-2.5 text-sm sm:grid-cols-2">
          {request.other.areas.length > 0 && (
            <div className="grid content-start gap-1.5">
              <dt className="font-semibold text-fg">Áreas de pesquisa</dt>
              <dd className="flex flex-wrap gap-1.5">
                {request.other.areas.slice(0, 5).map((area) => (
                  <Chip key={area} size="sm" variant="primary">
                    {area}
                  </Chip>
                ))}
              </dd>
            </div>
          )}
          {topics.length > 0 && (
            <div className="grid content-start gap-1.5">
              <dt className="font-semibold text-fg">Quer ajuda com</dt>
              <dd className="flex flex-wrap gap-1.5">
                {topics.slice(0, 5).map((topic) => (
                  <Chip key={topic} size="sm" variant="secondary">
                    {topic}
                  </Chip>
                ))}
              </dd>
            </div>
          )}
        </dl>
      )}

      <QuotedMessage label={`Mensagem de ${menteeName}`}>{request.message}</QuotedMessage>

      <div className="border-t border-border pt-4">
        <RespondForm requestId={request.id} menteeName={menteeName} />
      </div>
    </Card>
  );
}

/**
 * Linha compacta do histórico (pedidos já respondidos/encerrados). Com conversa (mentoria ativa,
 * concluída ou cancelada depois do aceite), traz o link para ela — só leitura se encerrada.
 */
export function HistoryRow({ request, unread = 0 }: { request: RequestItem; unread?: number }) {
  const when = request.responded_at ?? request.updated_at;
  const prefix = request.responded_at ? "Respondido" : "Atualizado";
  const otherName = firstName(request.other.full_name) || request.other.full_name;
  return (
    <li className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
      <PersonSummary person={request.other} />
      <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
        <div className="flex flex-col items-start gap-1 sm:items-end">
          <MentorshipStatusBadge status={request.status} />
          <TimeAgo date={when} prefix={prefix} />
        </div>
        {hasConversation(request) && (
          <ConversationLink
            requestId={request.id}
            otherName={otherName}
            unread={unread}
            readOnly={request.status !== "accepted"}
            variant={request.status === "accepted" ? "secondary" : "outline"}
          />
        )}
      </div>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Mentorias ativas (as duas participantes)
// ---------------------------------------------------------------------------

export function ActiveMentorshipCard({
  request,
  contact,
  unread = 0,
}: {
  request: RequestItem;
  contact: Contact | null;
  /** Mensagens da outra participante ainda não lidas. */
  unread?: number;
}) {
  const otherName = firstName(request.other.full_name) || request.other.full_name;
  const headingId = `ativa-${request.id}`;
  const isMentee = request.role === "mentee";
  const since = request.responded_at ?? request.updated_at;

  return (
    <Card as="li" aria-labelledby={headingId} className="grid gap-4 p-5 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <PersonSummary person={request.other} headingId={headingId} size="lg">
          <Badge variant={isMentee ? "primary" : "secondary"}>
            {isMentee ? "Sua mentora" : "Sua mentoranda"}
          </Badge>
        </PersonSummary>
        <div className="flex shrink-0 flex-col items-start gap-1 sm:items-end">
          <MentorshipStatusBadge status={request.status} />
          <p className="text-sm text-fg-subtle">
            Desde <time dateTime={toIsoString(since)}>{formatDate(since)}</time>
          </p>
        </div>
      </div>

      {request.response_message && (
        <QuotedMessage label={isMentee ? `Resposta de ${otherName}` : "Sua resposta"}>
          {request.response_message}
        </QuotedMessage>
      )}

      {contact ? (
        <ContactCard email={contact.email} name={otherName} />
      ) : (
        <p className="rounded-control bg-surface-2 p-3.5 text-sm text-fg-muted">
          Não conseguimos carregar o contato agora. Recarregue a página em instantes.
        </p>
      )}

      <details className="rounded-control border border-border">
        <summary className="cursor-pointer rounded-control px-3.5 py-2.5 text-sm font-semibold text-fg-muted hover:text-fg">
          {isMentee ? "Ver o pedido que você enviou" : `Ver o pedido de ${otherName}`}
        </summary>
        <p className="border-t border-border px-3.5 py-3 text-[0.9375rem] whitespace-pre-line text-fg">
          {request.message}
        </p>
      </details>

      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
        <ConversationLink requestId={request.id} otherName={otherName} unread={unread} />
        <MentorshipActionDialog
          action={completeMentorshipAction}
          hiddenFields={{ request_id: request.id }}
          tone="primary"
          triggerVariant="secondary"
          triggerIcon={<CircleCheck aria-hidden="true" />}
          triggerLabel="Concluir mentoria"
          title="Concluir esta mentoria?"
          description={`A mentoria com ${otherName} vai para o histórico${
            isMentee ? "" : " e libera uma vaga para novos pedidos"
          }. Avisaremos ${otherName}.`}
          confirmLabel="Sim, concluir"
          pendingLabel="Concluindo…"
        />
        {isMentee && (
          <MentorshipActionDialog
            action={cancelRequestAction}
            hiddenFields={{ request_id: request.id }}
            triggerVariant="ghost"
            triggerIcon={<Ban aria-hidden="true" />}
            triggerLabel="Cancelar mentoria"
            title="Cancelar esta mentoria?"
            description={`Avisaremos ${otherName}. Se a mentoria cumpriu o objetivo, prefira “Concluir mentoria”.`}
            confirmLabel="Sim, cancelar"
            pendingLabel="Cancelando…"
          />
        )}
      </div>
    </Card>
  );
}
