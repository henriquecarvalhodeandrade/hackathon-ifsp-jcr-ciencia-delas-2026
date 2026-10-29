import { Check, CheckCheck, CircleAlert, Clock3, MessageSquareHeart } from "lucide-react";
import { groupRuns, type DirectMessage, type PendingMessage } from "@/lib/messages/conversation";
import { groupByDay } from "@/lib/mentorship/conversation";
import { cn, formatDate, formatNumber, formatRelativeTime, toIsoString } from "@/lib/utils";

function fullDate(date: string): string {
  return formatDate(date, { dateStyle: "long", timeStyle: "short" });
}

export interface FailedMessage extends PendingMessage {
  error: string;
}

export interface SystemNote {
  id: string;
  text: string;
}

const bubble =
  "rounded-card px-3.5 py-2.5 text-[0.9375rem] leading-relaxed wrap-anywhere whitespace-pre-wrap text-fg";

/**
 * Conteúdo da conversa: mensagens por dia (fuso de São Paulo) e, dentro do dia, em blocos de
 * mensagens seguidas da mesma pessoa — horário e recibo ("Enviada"/"Lida", com ícone e texto,
 * nunca só cor) uma vez por bloco. No fim: as provisórias ("Enviando…"), as que falharam ("Não
 * enviada · Tentar de novo", com o texto guardado) e as linhas de sistema (pedido aceito, pedido
 * aguardando resposta…).
 */
export function ChatLog({
  messages,
  pending,
  failed,
  notes,
  otherName,
  readReceipts,
  truncatedLimit,
  empty,
  now,
  onRetry,
  onDiscard,
}: {
  messages: readonly DirectMessage[];
  pending: readonly PendingMessage[];
  failed: readonly FailedMessage[];
  notes: readonly SystemNote[];
  otherName: string;
  readReceipts: boolean;
  /** Há mensagens mais antigas que as carregadas: quantas aparecem. */
  truncatedLimit: number | null;
  /** Estado vazio (sem mensagens nem provisórias). */
  empty: { title: string; description: string };
  now: Date;
  onRetry: (message: FailedMessage) => void;
  onDiscard: (message: FailedMessage) => void;
}) {
  const days = groupByDay(messages, now);
  const nothing = messages.length === 0 && pending.length === 0 && failed.length === 0;

  return (
    <div className="grid gap-5 px-4 py-4 sm:px-5 lg:px-6">
      {truncatedLimit !== null && (
        <p className="text-center text-xs text-fg-muted">
          Mostrando as {formatNumber(truncatedLimit)} mensagens mais recentes.
        </p>
      )}

      {nothing && (
        <div className="mx-auto grid max-w-sm justify-items-center gap-2 py-6 text-center">
          <span
            aria-hidden="true"
            className="flex size-12 items-center justify-center rounded-full border border-border bg-surface-2 text-primary [&_svg]:size-6"
          >
            <MessageSquareHeart />
          </span>
          <h2 className="font-display text-lg font-semibold text-fg">{empty.title}</h2>
          <p className="text-sm text-fg-muted">{empty.description}</p>
        </div>
      )}

      {days.map((day) => (
        <section key={day.key} aria-labelledby={`dia-${day.key}`} className="grid gap-3">
          <h2
            id={`dia-${day.key}`}
            className="flex items-center gap-3 text-xs font-semibold text-fg-muted before:h-px before:flex-1 before:bg-border after:h-px after:flex-1 after:bg-border"
          >
            <span className="first-letter:uppercase">{day.label}</span>
          </h2>
          {groupRuns(day.items).map((run) => (
            <ol
              key={run.key}
              className={cn("grid gap-1", run.mine ? "justify-items-end" : "justify-items-start")}
            >
              {run.items.map((message, index) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  last={index === run.items.length - 1}
                  otherName={otherName}
                  readReceipts={readReceipts}
                  now={now}
                />
              ))}
            </ol>
          ))}
        </section>
      ))}

      {(pending.length > 0 || failed.length > 0) && (
        <ol className="grid justify-items-end gap-1">
          {failed.map((message) => (
            <li
              key={message.tempId}
              className="grid max-w-[88%] justify-items-end gap-1 sm:max-w-[75%]"
            >
              <p className={cn(bubble, "rounded-br-badge bg-primary-soft ring-1 ring-danger/50")}>
                <span className="sr-only">Você (não enviada): </span>
                {message.body}
              </p>
              <p className="flex flex-wrap items-center justify-end gap-x-1.5 gap-y-1 px-1 text-xs text-danger">
                <CircleAlert aria-hidden="true" className="size-3.5" />
                <span>Não enviada</span>
                <span aria-hidden="true">·</span>
                <button
                  type="button"
                  onClick={() => onRetry(message)}
                  className="rounded-badge font-semibold underline underline-offset-2 hover:text-fg"
                >
                  Tentar de novo
                </button>
                <span aria-hidden="true">·</span>
                <button
                  type="button"
                  onClick={() => onDiscard(message)}
                  className="rounded-badge text-fg-muted underline underline-offset-2 hover:text-fg"
                >
                  Descartar
                </button>
              </p>
              <p className="max-w-full px-1 text-right text-xs text-fg-muted">{message.error}</p>
            </li>
          ))}
          {pending.map((message) => (
            <li
              key={message.tempId}
              className="grid max-w-[88%] justify-items-end gap-1 sm:max-w-[75%]"
            >
              <p className={cn(bubble, "rounded-br-badge bg-primary-soft opacity-75")}>
                <span className="sr-only">Você: </span>
                {message.body}
              </p>
              <p className="flex items-center gap-1 px-1 text-xs text-fg-muted">
                <Clock3 aria-hidden="true" className="size-3.5" />
                Enviando…
              </p>
            </li>
          ))}
        </ol>
      )}

      {notes.map((note) => (
        <p
          key={note.id}
          className="mx-auto max-w-sm rounded-card bg-surface-2 px-3 py-1.5 text-center text-xs text-fg-muted"
        >
          {note.text}
        </p>
      ))}
    </div>
  );
}

function MessageBubble({
  message,
  last,
  otherName,
  readReceipts,
  now,
}: {
  message: DirectMessage;
  /** Última do bloco: leva o horário e o recibo. */
  last: boolean;
  otherName: string;
  readReceipts: boolean;
  now: Date;
}) {
  const { mine } = message;
  const read = readReceipts && message.read_at !== null;
  return (
    <li
      id={`mensagem-${message.id}`}
      className={cn(
        "grid max-w-[88%] gap-1 sm:max-w-[75%]",
        mine ? "justify-items-end" : "justify-items-start",
      )}
    >
      <p
        className={cn(
          bubble,
          mine ? "bg-primary-soft" : "bg-surface-2",
          last && (mine ? "rounded-br-badge" : "rounded-bl-badge"),
        )}
        title={last ? undefined : fullDate(message.created_at)}
      >
        <span className="sr-only">{mine ? "Você" : otherName}: </span>
        {message.body}
      </p>
      {last && (
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
      )}
    </li>
  );
}
