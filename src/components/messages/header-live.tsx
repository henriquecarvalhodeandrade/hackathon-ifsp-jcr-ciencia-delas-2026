"use client";

import { startTransition, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { headerCountsAction } from "@/app/mensagens/actions";
import { useLiveSignal } from "./use-live-refresh";

/** Sem o Realtime (ou como rede de segurança), confere os selos a cada minuto com a aba visível. */
const HEADER_POLL_MS = 60_000;

/**
 * Selos do cabeçalho ao vivo (mensagens e sino) em qualquer página. Ouve, pelo Realtime (o RLS
 * só entrega as linhas da usuária), as minhas conversas (`direct_conversations`) e os avisos novos
 * (INSERT em `notifications`); a cada sinal busca só as duas contagens (`headerCountsAction`) e
 * pede a página de novo (`router.refresh()`) apenas quando elas mudaram — assim um evento que não
 * mexe nos selos não custa uma renderização inteira. Não desenha nada.
 *
 * Montado pelo cabeçalho para membras, com as contagens que ele já mostra:
 *   <HeaderLive messages={account.unreadMessages} notifications={account.unread} />
 */
export function HeaderLive({
  messages,
  notifications,
}: {
  /** Conversas com mensagem nova que o cabeçalho está mostrando. */
  messages: number;
  /** Avisos não lidos do sino que o cabeçalho está mostrando. */
  notifications: number;
}) {
  const router = useRouter();
  const shown = useRef({ messages, notifications });
  const checking = useRef(false);

  useEffect(() => {
    shown.current = { messages, notifications };
  }, [messages, notifications]);

  const check = useCallback(async () => {
    if (checking.current) return;
    checking.current = true;
    try {
      const counts = await headerCountsAction();
      const current = shown.current;
      if (counts.messages !== current.messages || counts.notifications !== current.notifications) {
        // Evita outro refresh enquanto a página nova não chega com as contagens novas.
        shown.current = counts;
        startTransition(() => router.refresh());
      }
    } catch {
      // Sem conexão: a próxima verificação tenta de novo.
    } finally {
      checking.current = false;
    }
  }, [router]);

  useLiveSignal({
    channel: "cabecalho",
    tables: [
      { table: "direct_conversations", event: "*" },
      { table: "notifications", event: "INSERT" },
    ],
    pollMs: HEADER_POLL_MS,
    subscribedPollMs: HEADER_POLL_MS,
    onSignal: () => void check(),
  });

  return null;
}
