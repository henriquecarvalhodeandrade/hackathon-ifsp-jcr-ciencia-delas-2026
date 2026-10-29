"use client";

import { startTransition, useEffect, useRef } from "react";
import { markReadAction } from "@/app/mensagens/actions";
import { CONVERSATION_REFRESH_SUBSCRIBED_MS } from "@/lib/messages/conversation";
import { isPageVisible } from "./use-live-refresh";

/**
 * Marca como lidas as mensagens recebidas quando a conversa está de fato na tela (não na
 * renderização no servidor: pré-busca de link ou aba em segundo plano não contam). Sem conexão,
 * tenta de novo daqui a pouco e ao voltar para a aba. A atualização ao vivo da página fica com o
 * `MessagesLive` do layout.
 */
export function useMarkRead(conversationId: string | null, latestUnreadId: string | null) {
  const marking = useRef(false);
  /** markRead do efeito mais recente (null sem não lidas): chamado se outro envio estava no ar. */
  const latestMark = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!conversationId || !latestUnreadId) {
      latestMark.current = null;
      return;
    }
    let active = true;
    let retry: number | undefined;
    const markRead = () => {
      window.clearTimeout(retry);
      retry = undefined;
      if (!active || !isPageVisible() || marking.current) return;
      marking.current = true;
      startTransition(async () => {
        let ok = false;
        try {
          ok = (await markReadAction(conversationId)).ok;
        } catch {
          // Sem conexão: cai na nova tentativa abaixo.
        } finally {
          marking.current = false;
        }
        if (!active) {
          // Chegou outra não lida enquanto esta marcação estava no ar: o efeito novo pulou a dele.
          latestMark.current?.();
        } else if (!ok) {
          // O id da não lida não muda, então este efeito não roda de novo sozinho: tenta outra vez
          // daqui a pouco (e ao voltar para a aba). Deu certo: a resposta da action já traz a
          // página sem não lidas.
          retry = window.setTimeout(markRead, CONVERSATION_REFRESH_SUBSCRIBED_MS);
        }
      });
    };
    latestMark.current = markRead;
    markRead();
    document.addEventListener("visibilitychange", markRead);
    return () => {
      active = false;
      window.clearTimeout(retry);
      if (latestMark.current === markRead) latestMark.current = null;
      document.removeEventListener("visibilitychange", markRead);
    };
  }, [conversationId, latestUnreadId]);
}
