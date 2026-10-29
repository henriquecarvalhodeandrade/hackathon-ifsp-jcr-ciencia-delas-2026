"use client";

import { startTransition, useId, useMemo, useOptimistic, useRef, useState } from "react";
import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Alert, Avatar } from "@/components/ui";
import { sendDirectMessageAction, sendFirstMessageAction } from "@/app/mensagens/actions";
import { CONNECTION_ERROR_KEEP_TEXT } from "@/lib/forum/client-action";
import {
  unconfirmedPending,
  type ConversationStarter,
  type ConversationState,
  type DirectMessage,
  type PendingMessage,
} from "@/lib/messages/conversation";
import type { SendResult } from "@/lib/messages/types";
import { careerStageLabel } from "@/lib/mentorship/view-models";
import { ChatComposer } from "./chat-composer";
import { ChatLog, type FailedMessage, type SystemNote } from "./chat-log";
import { ChatScroller } from "./chat-scroller";
import { useMarkRead } from "./conversation-live";
import { ConversationMenu } from "./conversation-menu";
import { RequestResponse } from "./request-response";

export interface ChatPerson {
  id: string;
  full_name: string;
  first_name: string;
  avatar_url: string | null;
  headline: string | null;
  career_stage: string | null;
}

function tempId(): string {
  return `tmp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function finePointer(): boolean {
  return window.matchMedia("(pointer: fine)").matches;
}

/**
 * Tela da conversa direta — um chat de verdade, nos dois tamanhos: barra do topo (voltar no
 * celular, pessoa → perfil, "⋯"), aviso compacto quando há pedido, mensagens presas ao fim e o
 * campo fixo embaixo (com a área segura do iPhone). Ocupa toda a altura disponível: no celular a
 * página vira a tela do chat (`data-chat-open` — o layout de /mensagens esconde a lista e o rodapé
 * com isso), no computador ela é o painel da direita.
 *
 * Envio otimista: a mensagem aparece na hora ("Enviando…"), o campo é limpo e a do servidor toma
 * o lugar dela quando chega (pela resposta da action ou pelo Realtime, o que vier primeiro); se
 * falhar, fica "Não enviada · Tentar de novo" com o texto guardado. Sem `conversationId` é um
 * rascunho: a primeira mensagem cria a conversa e leva até ela.
 *
 * Uma região `role="status"` da página toda anuncia envio, falha e aceite/recusa — os avisos dos
 * componentes que somem com o estado novo não seriam lidos.
 */
export function ChatScreen({
  conversationId,
  draftProfileId = null,
  other,
  messages,
  truncatedLimit,
  state,
  starters,
  nowIso,
  latestUnreadId,
  backHref,
}: {
  /** null = rascunho (a conversa ainda não existe). */
  conversationId: string | null;
  /** Rascunho: com quem. */
  draftProfileId?: string | null;
  other: ChatPerson;
  messages: DirectMessage[];
  /** Há mensagens mais antigas que as carregadas: quantas aparecem (ou null). */
  truncatedLimit: number | null;
  state: ConversationState;
  starters: ConversationStarter[];
  /** "Agora" do servidor (os horários relativos batem com o HTML do servidor). */
  nowIso: string;
  latestUnreadId: string | null;
  /** Voltar (celular): a aba da caixa de entrada em que esta conversa aparece. */
  backHref: string;
}) {
  const titleId = useId();
  const fieldId = `mensagem-${conversationId ?? "nova"}`;
  const now = useMemo(() => new Date(nowIso), [nowIso]);
  const [pending, addPending] = useOptimistic<PendingMessage[], PendingMessage>(
    [],
    (current, message) => [...current, message],
  );
  const [failed, setFailed] = useState<FailedMessage[]>([]);
  const [notes, setNotes] = useState<SystemNote[]>([]);
  const [announcement, setAnnouncement] = useState("");
  const scrollerRef = useRef<HTMLDivElement>(null);

  useMarkRead(conversationId, latestUnreadId);

  function announce(text: string) {
    // Limpa antes: o mesmo texto duas vezes seguidas também é lido.
    setAnnouncement("");
    window.setTimeout(() => setAnnouncement(text), 50);
  }

  function send(body: string) {
    const message: PendingMessage = {
      tempId: tempId(),
      body,
      created_at: new Date().toISOString(),
      afterId: messages.at(-1)?.id ?? null,
    };
    startTransition(async () => {
      addPending(message);
      let result: SendResult | undefined;
      try {
        result = conversationId
          ? await sendDirectMessageAction(conversationId, body)
          : await sendFirstMessageAction(draftProfileId ?? "", body);
      } catch (error) {
        // redirect() da primeira mensagem segue para o Next; o resto é falha de conexão.
        unstable_rethrow(error);
        result = { ok: false, error: CONNECTION_ERROR_KEEP_TEXT };
      }
      if (!result || result.ok) {
        announce("Mensagem enviada.");
      } else {
        const error = result.error;
        setFailed((current) => [...current, { ...message, error }]);
        announce(`Mensagem não enviada. ${error}`);
      }
    });
  }

  function retry(message: FailedMessage) {
    setFailed((current) => current.filter((item) => item.tempId !== message.tempId));
    send(message.body);
  }

  function discard(message: FailedMessage) {
    setFailed((current) => current.filter((item) => item.tempId !== message.tempId));
    document.getElementById(fieldId)?.focus();
  }

  function onResponded(accepted: boolean) {
    const text = accepted
      ? "Você aceitou o pedido — agora vocês podem conversar."
      : "Você recusou o pedido. Ela não fica sabendo; aceitar ou responder reabre a conversa.";
    setNotes((current) => [...current, { id: tempId(), text }]);
    announce(text);
    // O aviso com os botões some: o foco vai para o campo (mouse/teclado) ou para a conversa.
    window.requestAnimationFrame(() => {
      const target = finePointer() ? document.getElementById(fieldId) : scrollerRef.current;
      target?.focus({ preventScroll: true });
    });
  }

  // Provisórias que o servidor ainda não devolveu (e que não falharam).
  const failedIds = new Set(failed.map((item) => item.tempId));
  const visiblePending = unconfirmedPending(
    pending.filter((item) => !failedIds.has(item.tempId)),
    messages,
  );
  const allNotes: SystemNote[] = state.waiting
    ? [...notes, { id: "aguardando", text: state.waiting.note }]
    : notes;
  const lastItem =
    allNotes.at(-1)?.id ??
    visiblePending.at(-1)?.tempId ??
    failed.at(-1)?.tempId ??
    messages.at(-1)?.id ??
    null;
  const lastIsMine =
    visiblePending.length > 0 ||
    failed.length > 0 ||
    (allNotes.length === 0 && (messages.at(-1)?.mine ?? false));

  const meta = other.headline || careerStageLabel(other.career_stage);
  const banner = state.banner;
  const firstRequest = banner?.kind === "first-request" || banner?.kind === "draft";

  return (
    <section
      data-chat-open=""
      aria-labelledby={titleId}
      className="flex min-h-0 flex-1 flex-col overflow-hidden bg-surface lg:rounded-card lg:border lg:border-border lg:shadow-card"
    >
      <h1 id={titleId} className="sr-only">
        Conversa com {other.full_name}
      </h1>

      <header className="flex shrink-0 items-center gap-1 border-b border-border px-1.5 py-1.5 sm:px-3 lg:gap-2 lg:px-4 lg:py-2.5">
        <Link
          href={backHref}
          aria-label="Voltar para as mensagens"
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-control text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg lg:hidden [&_svg]:size-5"
        >
          <ArrowLeft aria-hidden="true" />
        </Link>
        <Link
          href={`/pesquisadoras/${other.id}`}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-control p-1.5 transition-colors hover:bg-surface-2"
        >
          <Avatar name={other.full_name} src={other.avatar_url} seed={other.id} size="md" />
          <span className="grid min-w-0">
            <span className="truncate font-display text-base leading-snug font-semibold text-fg">
              <span className="sr-only">Perfil de </span>
              {other.full_name}
            </span>
            {meta && <span className="truncate text-xs text-fg-muted">{meta}</span>}
          </span>
        </Link>
        <ConversationMenu profileId={other.id} name={other.full_name} />
      </header>

      {banner && (
        <Alert
          variant={banner.variant}
          title={banner.title}
          className="shrink-0 rounded-none border-x-0 border-t-0 px-4 py-3 lg:px-5"
          actions={
            banner.actions && conversationId ? (
              <RequestResponse
                conversationId={conversationId}
                mode={banner.actions}
                onDone={onResponded}
              />
            ) : undefined
          }
        >
          {banner.body}
        </Alert>
      )}

      <ChatScroller
        label={`Mensagens com ${other.first_name}`}
        lastItemId={lastItem}
        lastIsMine={lastIsMine}
        scrollerRef={scrollerRef}
      >
        <ChatLog
          messages={messages}
          pending={visiblePending}
          failed={failed}
          notes={allNotes}
          otherName={other.first_name}
          readReceipts={state.showReadReceipts}
          truncatedLimit={truncatedLimit}
          empty={{
            title: state.canSend ? "Comecem a conversa" : "Nenhuma mensagem por aqui",
            description: !state.canSend
              ? `A conversa continua quando ${other.first_name} responder.`
              : firstRequest
                ? `Apresente-se e conte por que quer conversar com ${other.first_name}. As sugestões abaixo ajudam a começar.`
                : `Diga olá para ${other.first_name}. As sugestões abaixo ajudam a começar.`,
          }}
          now={now}
          onRetry={retry}
          onDiscard={discard}
        />
      </ChatScroller>

      <div className="shrink-0 border-t border-border bg-surface px-3 pt-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] sm:px-4 lg:px-6 lg:pb-4">
        <ChatComposer
          id={fieldId}
          otherFirstName={other.first_name}
          canSend={state.canSend}
          waitingText={state.waiting?.placeholder ?? null}
          sendLabel={state.sendLabel}
          starters={messages.length === 0 && visiblePending.length === 0 ? starters : []}
          onSend={send}
          autoFocus
        />
      </div>

      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </section>
  );
}
