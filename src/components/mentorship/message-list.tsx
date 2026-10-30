import { Check, CheckCheck } from "lucide-react";
import { groupByDay } from "@/lib/mentorship/conversation";
import type { ConversationMessage } from "@/lib/mentorship/conversation-queries";
import { cn, formatDate, formatRelativeTime, toIsoString } from "@/lib/utils";

function fullDate(date: string): string {
  return formatDate(date, { dateStyle: "long", timeStyle: "short" });
}

/**
 * Mensagens agrupadas por dia (fuso de São Paulo). As dela à direita (`primary-soft`), as da
 * outra participante à esquerda (`surface-2`); horário relativo e, nas dela, o recibo de
 * leitura ("Enviada"/"Lida", com ícone e texto — nunca só cor). Server Component: os horários
 * relativos são recalculados a cada atualização da página.
 */
export function MessageList({
  messages,
  otherName,
  now = new Date(),
}: {
  messages: readonly ConversationMessage[];
  otherName: string;
  now?: Date;
}) {
  const groups = groupByDay(messages, now);
  return (
    <div className="grid gap-6">
      {groups.map((group) => (
        <section key={group.key} aria-labelledby={`dia-${group.key}`} className="grid gap-3">
          <h3
            id={`dia-${group.key}`}
            className="flex items-center gap-3 text-xs font-semibold text-fg-muted before:h-px before:flex-1 before:bg-border after:h-px after:flex-1 after:bg-border"
          >
            <span className="first-letter:uppercase">{group.label}</span>
          </h3>
          <ol className="grid gap-3">
            {group.items.map((message) => (
              <MessageBubble key={message.id} message={message} otherName={otherName} now={now} />
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}

function MessageBubble({
  message,
  otherName,
  now,
}: {
  message: ConversationMessage;
  otherName: string;
  now: Date;
}) {
  const { mine } = message;
  const read = message.read_at !== null;
  return (
    <li
      id={`mensagem-${message.id}`}
      className={cn("flex", mine ? "justify-end" : "justify-start")}
    >
      <div
        className={cn(
          "grid max-w-[88%] gap-1 sm:max-w-[75%]",
          mine ? "justify-items-end" : "justify-items-start",
        )}
      >
        <p
          className={cn(
            "rounded-card px-3.5 py-2.5 text-[0.9375rem] leading-relaxed wrap-anywhere whitespace-pre-wrap text-fg",
            mine ? "rounded-br-badge bg-primary-soft" : "rounded-bl-badge bg-surface-2",
          )}
        >
          <span className="sr-only">{mine ? "Você" : otherName}: </span>
          {message.body}
        </p>
        <p className="flex flex-wrap items-center gap-x-1.5 px-1 text-xs text-fg-muted">
          <time dateTime={toIsoString(message.created_at)} title={fullDate(message.created_at)}>
            {formatRelativeTime(message.created_at, now)}
          </time>
          {mine && (
            <>
              <span aria-hidden="true">·</span>
              <span
                className={cn("inline-flex items-center gap-1", read && "text-primary")}
                title={read && message.read_at ? `Lida ${fullDate(message.read_at)}` : undefined}
              >
                {read ? (
                  <CheckCheck aria-hidden="true" className="size-3.5" />
                ) : (
                  <Check aria-hidden="true" className="size-3.5" />
                )}
                {read ? "Lida" : "Enviada"}
              </span>
            </>
          )}
        </p>
      </div>
    </li>
  );
}
