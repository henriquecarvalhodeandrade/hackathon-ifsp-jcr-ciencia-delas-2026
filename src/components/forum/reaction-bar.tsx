"use client";

import { Fragment, useId, useOptimistic, useState, useTransition } from "react";
import { buttonVariants } from "@/components/ui";
import { toggleReaction, type ReactionResult } from "@/lib/forum/actions";
import type { ReactionKindValue } from "@/lib/forum/schema";
import type { ReactionState } from "@/lib/forum/types";
import { cn, formatNumber, pluralize } from "@/lib/utils";
import { REACTIONS } from "./reaction-icons";

type Toggle = { kind: ReactionKindValue; active: boolean };

const NETWORK_ERROR = "Não conseguimos registrar a reação. Confira sua conexão e tente de novo.";

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
 * O nome acessível de cada botão é FIXO (o rótulo, ex.: "Apoio"); o estado vem do aria-pressed
 * e a contagem fica na descrição (aria-describedby), como no botão de destaque da Vitrine.
 */
export function ReactionBar({
  threadId,
  postId,
  reactions,
  targetLabel,
  className,
}: ReactionBarProps) {
  const baseId = `reacoes-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const [optimistic, setOptimistic] = useOptimistic(reactions, applyToggle);
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle(kind: ReactionKindValue) {
    const active = !optimistic.mine.includes(kind);
    setError(null);
    startTransition(async () => {
      setOptimistic({ kind, active });
      // Falha de rede rejeita a promessa: sem o catch, o erro iria para o error boundary e
      // derrubaria a página inteira por causa de uma reação.
      const result = await toggleReaction({ threadId, postId: postId ?? null, kind, active }).catch(
        (): ReactionResult => ({ ok: false, error: NETWORK_ERROR }),
      );
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <div className={cn("grid gap-1.5", className)}>
      <div
        role="group"
        aria-label={`Reagir ${targetLabel}`}
        className="flex flex-wrap items-center gap-1.5"
      >
        {REACTIONS.map(({ kind, label, Icon }) => {
          const pressed = optimistic.mine.includes(kind);
          const count = optimistic.counts[kind];
          const countId = `${baseId}-${kind}`;
          return (
            <Fragment key={kind}>
              <button
                type="button"
                aria-pressed={pressed}
                aria-label={label}
                aria-describedby={countId}
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
                  <span aria-hidden="true" className="text-xs font-bold tabular">
                    {formatNumber(count)}
                  </span>
                )}
              </button>
              {/* Só para a descrição do botão (hidden evita leitura duplicada no modo de leitura). */}
              <span id={countId} hidden>
                {pluralize(count, "reação", "reações")}
              </span>
            </Fragment>
          );
        })}
      </div>
      <p aria-live="polite" className={cn("text-sm font-medium text-danger", !error && "sr-only")}>
        {error}
      </p>
    </div>
  );
}
