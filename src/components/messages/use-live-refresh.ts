"use client";

import { startTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

export function isPageVisible(): boolean {
  return document.visibilityState === "visible";
}

/**
 * Tabela observada pelo Realtime (as duas estão na publicação `supabase_realtime`). Sem filtro no
 * servidor: o Realtime do projeto recusa filtros nestas tabelas ("invalid column for filter …"),
 * e o RLS já limita os eventos às minhas conversas. `match` filtra aqui no navegador.
 */
export interface LiveTable {
  table: "direct_messages" | "direct_conversations";
  event: "INSERT" | "*";
  /** Só reage quando a linha nova (ou antiga) tem este valor nesta coluna. */
  match?: { column: string; value: string };
}

function matches(payload: unknown, match: LiveTable["match"]): boolean {
  if (!match) return true;
  const { new: next, old } = (payload ?? {}) as {
    new?: Record<string, unknown>;
    old?: Record<string, unknown>;
  };
  return next?.[match.column] === match.value || old?.[match.column] === match.value;
}

/** Junta rajadas de eventos (mensagem + conversa atualizada) num pedido só. */
const DEBOUNCE_MS = 300;

/**
 * Mantém a página atualizada sem recarregar (`router.refresh()` — o texto que está sendo digitado
 * e a rolagem continuam):
 *  - Realtime do Supabase (respeita o RLS): qualquer mudança nas tabelas observadas pede a página
 *    de novo na hora;
 *  - atualização periódica, só com a aba visível: `pollMs` enquanto o Realtime não está conectado
 *    (ou caiu) e `subscribedPollMs` com ele conectado — fica só como rede de segurança;
 *  - ao voltar para a aba, atualiza na hora.
 * O canal é fechado ao sair da página.
 */
export function useLiveRefresh({
  channel: channelName,
  tables,
  pollMs,
  subscribedPollMs,
  enabled = true,
}: {
  /** Prefixo do canal (o sufixo aleatório evita reaproveitar um canal que está fechando). */
  channel: string;
  tables: readonly LiveTable[];
  pollMs: number;
  subscribedPollMs: number;
  enabled?: boolean;
}) {
  const router = useRouter();
  // Dependência estável para o efeito (o array costuma ser recriado a cada renderização).
  const tablesKey = JSON.stringify(tables);

  useEffect(() => {
    if (!enabled) return;
    const watched = JSON.parse(tablesKey) as LiveTable[];
    let interval = pollMs;
    let timer: number | undefined;
    let debounce: number | undefined;
    let disposed = false;

    const refresh = () => {
      if (!disposed && isPageVisible()) startTransition(() => router.refresh());
    };
    const stop = () => {
      if (timer !== undefined) window.clearInterval(timer);
      timer = undefined;
    };
    const start = () => {
      stop();
      if (isPageVisible()) timer = window.setInterval(refresh, interval);
    };
    const onVisibilityChange = () => {
      if (isPageVisible()) {
        refresh();
        start();
      } else {
        stop();
      }
    };

    let supabase: ReturnType<typeof createClient> | null = null;
    let channel: RealtimeChannel | null = null;
    try {
      supabase = createClient();
      channel = supabase.channel(`${channelName}:${Math.random().toString(36).slice(2)}`);
      const onChange = (payload: unknown, match: LiveTable["match"]) => {
        if (!matches(payload, match)) return;
        window.clearTimeout(debounce);
        debounce = window.setTimeout(refresh, DEBOUNCE_MS);
      };
      for (const { table, event, match } of watched) {
        if (event === "INSERT") {
          channel.on("postgres_changes", { event, schema: "public", table }, (payload) =>
            onChange(payload, match),
          );
        } else {
          channel.on("postgres_changes", { event, schema: "public", table }, (payload) =>
            onChange(payload, match),
          );
        }
      }
      channel.subscribe((status) => {
        if (disposed) return;
        const next = status === "SUBSCRIBED" ? subscribedPollMs : pollMs;
        if (next !== interval) {
          interval = next;
          start();
        }
      });
    } catch {
      // Realtime indisponível (sem chaves públicas, navegador sem WebSocket): fica só a
      // atualização periódica.
      channel = null;
    }

    start();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      disposed = true;
      stop();
      window.clearTimeout(debounce);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (supabase && channel) void supabase.removeChannel(channel);
    };
  }, [enabled, channelName, tablesKey, pollMs, subscribedPollMs, router]);
}
