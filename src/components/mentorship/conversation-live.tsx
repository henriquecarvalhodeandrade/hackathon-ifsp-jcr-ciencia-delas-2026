"use client";

import { startTransition, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { markConversationReadAction } from "@/app/mentoria/actions";
import { CONVERSATION_REFRESH_MS } from "@/lib/mentorship/conversation";

function isVisible(): boolean {
  return document.visibilityState === "visible";
}

/**
 * Mantém a conversa atualizada sem recarregar a página:
 *  - `live`: a cada 15 s, só com a aba visível, pede a página de novo ao servidor
 *    (`router.refresh()` — o texto que está sendo digitado e a rolagem continuam); ao voltar
 *    para a aba, atualiza na hora;
 *  - marca como lidas as mensagens recebidas quando a conversa está de fato na tela (não na
 *    renderização no servidor: pré-busca de link ou aba em segundo plano não contam).
 * Não desenha nada.
 */
export function ConversationLive({
  requestId,
  live,
  latestUnreadId,
}: {
  requestId: string;
  /** Conversa aberta (mentoria aceita): só ela recebe mensagens novas. */
  live: boolean;
  /** Id da mensagem não lida mais recente da outra participante (ou null). */
  latestUnreadId: string | null;
}) {
  const router = useRouter();
  const marking = useRef(false);
  /** markRead do efeito mais recente (null sem não lidas): chamado se outro envio estava no ar. */
  const latestMark = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!live) return;
    let timer: number | undefined;
    const refresh = () => {
      if (isVisible()) startTransition(() => router.refresh());
    };
    const stop = () => {
      if (timer !== undefined) window.clearInterval(timer);
      timer = undefined;
    };
    const start = () => {
      stop();
      timer = window.setInterval(refresh, CONVERSATION_REFRESH_MS);
    };
    const onVisibilityChange = () => {
      if (isVisible()) {
        refresh();
        start();
      } else {
        stop();
      }
    };
    if (isVisible()) start();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [live, router]);

  useEffect(() => {
    if (!latestUnreadId) {
      latestMark.current = null;
      return;
    }
    let active = true;
    let retry: number | undefined;
    const markRead = () => {
      window.clearTimeout(retry);
      retry = undefined;
      if (!active || !isVisible() || marking.current) return;
      marking.current = true;
      startTransition(async () => {
        let ok = false;
        try {
          ok = (await markConversationReadAction(requestId)).ok;
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
          retry = window.setTimeout(markRead, CONVERSATION_REFRESH_MS);
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
  }, [requestId, latestUnreadId]);

  return null;
}
