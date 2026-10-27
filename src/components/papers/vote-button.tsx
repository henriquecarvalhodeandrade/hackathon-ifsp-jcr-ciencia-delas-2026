"use client";

import { useEffect, useId, useOptimistic, useState, useTransition } from "react";
import Link from "next/link";
import { Star } from "lucide-react";
import { Tooltip } from "@/components/ui";
import { toggleVote } from "@/lib/papers/actions";
import { cn, formatNumber } from "@/lib/utils";

export type VoteViewer = "member" | "guest" | "owner";

export interface VoteButtonProps {
  paperId: string;
  paperTitle: string;
  voted: boolean;
  count: number;
  viewer: VoteViewer;
  /** Para visitantes: link de login que volta para a página atual. */
  loginHref?: string;
  /** vertical (coluna do cartão) ou horizontal (página do paper). */
  layout?: "vertical" | "horizontal";
  /** Mostra o total de destaques ao lado do botão (padrão true). Escondido, continua para leitores de tela. */
  showCount?: boolean;
  /**
   * De que lado da tela o botão fica: a dica e o aviso de erro se abrem para dentro
   * ("start" = botão à esquerda, "end" = botão à direita), sem sair da tela no celular.
   */
  align?: "start" | "end";
  className?: string;
}

type VoteState = { voted: boolean; count: number };

const OWN_PAPER_HINT = "Você não pode destacar o próprio paper";

const baseButton =
  "relative z-10 inline-flex items-center justify-center gap-2 rounded-control border font-semibold transition-[background-color,border-color,color] duration-150 ease-out-soft active:translate-y-px [&_svg]:size-5";

/** Ancora a bolha do <Tooltip> (centralizada por padrão) na borda do botão. */
const TOOLTIP_ALIGN = {
  start: "[&>[role=tooltip]]:left-0 [&>[role=tooltip]]:translate-x-0",
  end: "[&>[role=tooltip]]:right-0 [&>[role=tooltip]]:left-auto [&>[role=tooltip]]:translate-x-0",
} as const;

/**
 * Botão de destaque (voto) com atualização otimista. Visitantes veem um link para entrar;
 * quem enviou o paper vê o botão indisponível (focável) com a explicação.
 * O nome acessível é FIXO ("Destacar “título”"): o estado vem do aria-pressed (docs/02 §13).
 */
export function VoteButton({
  paperId,
  paperTitle,
  voted,
  count,
  viewer,
  loginHref = "/entrar",
  layout = "vertical",
  showCount = true,
  align = "start",
  className,
}: VoteButtonProps) {
  const countId = `destaques-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const [confirmed, setConfirmed] = useState<VoteState>({ voted, count });
  const [lastProps, setLastProps] = useState<VoteState>({ voted, count });
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Novos dados do servidor (revalidação) substituem o último estado confirmado.
  if (lastProps.voted !== voted || lastProps.count !== count) {
    setLastProps({ voted, count });
    setConfirmed({ voted, count });
  }

  const [optimistic, setOptimistic] = useOptimistic(confirmed, (_current, next: VoteState) => next);

  useEffect(() => {
    if (!error) return;
    const timer = window.setTimeout(() => setError(null), 6000);
    return () => window.clearTimeout(timer);
  }, [error]);

  const vertical = layout === "vertical";
  const name = `Destacar “${paperTitle}”`;
  const unit = optimistic.count === 1 ? "destaque" : "destaques";
  const countLabel = (
    <span
      id={countId}
      className={cn(
        showCount ? "font-bold text-fg tabular" : "sr-only",
        vertical ? "text-sm" : "text-base",
      )}
    >
      {formatNumber(optimistic.count)}
      <span className="sr-only"> {unit} no total</span>
    </span>
  );
  const wrapper = cn(
    "flex items-center gap-1",
    vertical ? "flex-col" : "flex-row gap-3",
    className,
  );
  const size = vertical ? "size-10" : "h-11 px-4 text-[0.9375rem]";

  if (viewer === "guest") {
    return (
      <div className={wrapper}>
        <Link
          href={loginHref}
          aria-label={`Entre para destacar “${paperTitle}”`}
          aria-describedby={countId}
          className={cn(
            baseButton,
            "border-border-strong bg-surface text-fg-muted hover:border-accent-strong hover:bg-accent-soft hover:text-accent-strong",
            size,
          )}
        >
          <Star aria-hidden="true" />
          {!vertical && <span>Entre para destacar</span>}
        </Link>
        {countLabel}
      </div>
    );
  }

  if (viewer === "owner") {
    return (
      <div className={wrapper}>
        <Tooltip
          content={OWN_PAPER_HINT}
          side={vertical ? "bottom" : "top"}
          className={TOOLTIP_ALIGN[align]}
        >
          <button
            type="button"
            aria-disabled="true"
            aria-label={name}
            aria-describedby={countId}
            onClick={(event) => event.preventDefault()}
            className={cn(
              baseButton,
              "cursor-not-allowed border-border bg-surface-2 text-fg-subtle",
              size,
            )}
          >
            <Star aria-hidden="true" />
            {!vertical && <span>Destacar</span>}
          </button>
        </Tooltip>
        {countLabel}
      </div>
    );
  }

  function handleClick() {
    const next: VoteState = {
      voted: !optimistic.voted,
      count: Math.max(0, optimistic.count + (optimistic.voted ? -1 : 1)),
    };
    setError(null);
    startTransition(async () => {
      setOptimistic(next);
      const result = await toggleVote(paperId, next.voted);
      startTransition(() => {
        if (result.ok) setConfirmed({ voted: result.voted, count: result.voteCount });
        else setError(result.error);
      });
    });
  }

  const active = optimistic.voted;
  return (
    <div className={cn("relative", wrapper)}>
      <button
        type="button"
        onClick={handleClick}
        aria-pressed={active}
        aria-busy={isPending || undefined}
        aria-label={name}
        aria-describedby={countId}
        className={cn(
          baseButton,
          active
            ? "border-accent-strong bg-accent-soft text-accent-strong hover:bg-accent-soft"
            : "border-border-strong bg-surface text-fg-muted hover:border-accent-strong hover:bg-accent-soft hover:text-accent-strong",
          size,
        )}
      >
        <Star aria-hidden="true" className={cn(active && "fill-accent")} />
        {!vertical && <span>Destacar</span>}
      </button>
      {countLabel}
      <span aria-live="polite" className="sr-only">
        {error ?? ""}
      </span>
      {error && (
        <p
          aria-hidden="true"
          className={cn(
            "absolute top-full z-20 mt-1 w-56 rounded-control border border-danger/30 bg-danger-soft px-3 py-2 text-xs font-medium text-danger-soft-fg shadow-overlay",
            align === "end" ? "right-0" : "left-0",
          )}
        >
          {error}
        </p>
      )}
    </div>
  );
}
