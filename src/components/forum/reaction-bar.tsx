"use client";

import { useOptimistic, useState, useTransition } from "react";
import { buttonVariants } from "@/components/ui";
import { toggleReaction } from "@/lib/forum/actions";
import type { ReactionKindValue } from "@/lib/forum/schema";
import type { ReactionState } from "@/lib/forum/types";
import { cn, formatNumber, pluralize } from "@/lib/utils";
import { REACTIONS } from "./reaction-icons";

type Toggle = { kind: ReactionKindValue; active: boolean };

function applyToggle(state: ReactionState, { kind, active }: Toggle): ReactionState {
  const has = state.mine.includes(kind);
  if (active === has) return state;
  return {
    counts: { ...state.counts, [kind]: Math.max(0, state.counts[kind] + (active ? 1 : -1)) },
    mine: active ? [...state.mine, kind] : state.mine.filter((k) => k !== kind),
  };
}

export interface ReactionBarProps {
  threadId: string;
  /** Ausente = reações do próprio tópico. */
  postId?: string;
  reactions: ReactionState;
  /** Nome do alvo para leitores de tela ("ao tópico", "à resposta de Ana"). */
  targetLabel: string;
  className?: string;
}

/**
 * Apoio / Útil / Parabéns. Botões com aria-pressed e atualização otimista: o número muda
 * no mesmo instante e a Server Action confirma (ou desfaz, mostrando um aviso).
 */
export function ReactionBar({ threadId, postId, reactions, targetLabel, className }: ReactionBarProps) {
  const [optimistic, setOptimistic] = useOptimistic(reactions, applyToggle);
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle(kind: ReactionKindValue) {
    const active = !optimistic.mine.includes(kind);
    setError(null);
    startTransition(async () => {
      setOptimistic({ kind, active });
      const result = await toggleReaction({ threadId, postId: postId ?? null, kind, active });
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <div className={cn("grid gap-1.5", className)}>
      <div role="group" aria-label={`Reagir ${targetLabel}`} className="flex flex-wrap items-center gap-1.5">
        {REACTIONS.map(({ kind, label, Icon }) => {
          const pressed = optimistic.mine.includes(kind);
          const count = optimistic.counts[kind];
          return (
            <button
              key={kind}
              type="button"
              aria-pressed={pressed}
              onClick={() => toggle(kind)}
              title={pressed ? `Remover “${label}”` : label}
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "h-8 gap-1.5 rounded-pill px-3",
                pressed &&
                  "border-primary bg-primary-soft text-primary-soft-fg hover:border-primary hover:bg-primary-soft",
              )}
            >
              <Icon aria-hidden="true" className={cn(pressed && "text-primary")} />
              <span>{label}</span>
              {count > 0 && (
                <span className="tabular text-xs font-bold">
                  <span className="sr-only">: </span>
                  {formatNumber(count)}
                  <span className="sr-only"> {pluralize(count, "reação", "reações", { withCount: false })}</span>
                </span>
              )}
            </button>
          );
        })}
      </div>
      <p aria-live="polite" className={cn("text-sm font-medium text-danger", !error && "sr-only")}>
        {error}
      </p>
    </div>
  );
}
