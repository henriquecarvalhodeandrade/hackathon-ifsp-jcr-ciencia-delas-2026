"use client";

import { startTransition, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

export function isPageVisible(): boolean {
  return document.visibilityState === "visible";
}

/**
 * Tabela observada pelo Realtime (todas na publicação `supabase_realtime`). Sem filtro no
 * servidor: o Realtime do projeto recusa filtros nestas tabelas ("invalid column for filter …"),
 * e o RLS já limita os eventos às linhas da usuária. `match` filtra aqui no navegador.
 */
export interface LiveTable {
  table: "direct_messages" | "direct_conversations" | "notifications";
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

/** Junta rajadas de eventos (mensagem + conversa atualizada) num sinal só. */
const DEBOUNCE_MS = 300;

/**
 * Sinal de "algo mudou" para atualizar a tela, só com a aba visível:
 *  - Realtime do Supabase (respeita o RLS): mudança numa das tabelas observadas → sinal na hora;
 *  - atualização periódica: `pollMs` enquanto o Realtime não está conectado (ou caiu) e
 *    `subscribedPollMs` com ele conectado — fica só como rede de segurança;
 *  - ao voltar para a aba (ou quando a conexão volta), sinal na hora; sem rede, nenhum sinal.
 * O canal é fechado ao sair (ou quando as tabelas mudam).
 */
export function useLiveSignal({
  channel: channelName,
  tables,
  pollMs,
  subscribedPollMs,
  onSignal,
  enabled = true,
}: {
  /** Prefixo do canal (o sufixo aleatório evita reaproveitar um canal que está fechando). */
  channel: string;
  tables: readonly LiveTable[];
  pollMs: number;
  subscribedPollMs: number;
  onSignal: () => void;
  enabled?: boolean;
}) {
  const signal = useRef(onSignal);
  useEffect(() => {
    signal.current = onSignal;
  }, [onSignal]);
  // Dependência estável para o efeito (o array costuma ser recriado a cada renderização).
  const tablesKey = JSON.stringify(tables);

  useEffect(() => {
    if (!enabled) return;
    const watched = JSON.parse(tablesKey) as LiveTable[];
    let interval = pollMs;
    let timer: number | undefined;
    let debounce: number | undefined;
    let disposed = false;

    // Sem rede, nada de sinal: um `router.refresh()` que falha faz o Next cair numa navegação
    // completa do navegador (a página recarrega offline e perde o que estava na tela, como uma
    // mensagem "Não enviada"). Quando a conexão volta, um sinal na hora.
    const fire = () => {
      if (!disposed && isPageVisible() && navigator.onLine) signal.current();
    };
    const stop = () => {
      if (timer !== undefined) window.clearInterval(timer);
      timer = undefined;
    };
    const start = () => {
      stop();
      if (isPageVisible()) timer = window.setInterval(fire, interval);
    };
    const onVisibilityChange = () => {
      if (isPageVisible()) {
        fire();
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
        debounce = window.setTimeout(fire, DEBOUNCE_MS);
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
    window.addEventListener("online", fire);
    return () => {
      disposed = true;
      stop();
      window.clearTimeout(debounce);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("online", fire);
      if (supabase && channel) void supabase.removeChannel(channel);
    };
  }, [enabled, channelName, tablesKey, pollMs, subscribedPollMs]);
}

/**
 * Mantém a página atualizada sem recarregar: a cada sinal (`useLiveSignal`), pede a página de
 * novo ao servidor (`router.refresh()` — o texto que está sendo digitado e a rolagem continuam).
 */
export function useLiveRefresh(options: Omit<Parameters<typeof useLiveSignal>[0], "onSignal">) {
  const router = useRouter();
  useLiveSignal({
    ...options,
    onSignal: () => startTransition(() => router.refresh()),
  });
}
