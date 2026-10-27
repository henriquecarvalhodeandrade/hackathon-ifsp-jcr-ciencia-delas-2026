"use client";

import { useEffect, useOptimistic, useState, useTransition } from "react";
import Link from "next/link";
import { Star } from "lucide-react";
import { Tooltip } from "@/components/ui";
import { toggleVote } from "@/lib/papers/actions";
import { cn, formatNumber, pluralize } from "@/lib/utils";

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
  /** Mostra o total de destaques ao lado do botão (padrão true). */
  showCount?: boolean;
  className?: string;
}

type VoteState = { voted: boolean; count: number };

const OWN_PAPER_HINT = "Você não pode destacar o próprio paper";

const baseButton =
  "relative z-10 inline-flex items-center justify-center gap-2 rounded-control border font-semibold transition-[background-color,border-color,color] duration-150 ease-out-soft active:translate-y-px [&_svg]:size-5";

/**
 * Botão de destaque (voto) com atualização otimista. Visitantes veem um link para entrar;
 * quem enviou o paper vê o botão desabilitado com a explicação.
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
  className,
}: VoteButtonProps) {
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
  const countLabel = showCount ? (
    <span aria-hidden="true" className={cn("tabular font-bold text-fg", vertical ? "text-sm" : "text-base")}>
      {formatNumber(optimistic.count)}
    </span>
  ) : null;
  const srCount = <span className="sr-only">{pluralize(optimistic.count, "destaque")} no total</span>;

  if (viewer === "guest") {
    return (
      <div className={cn("flex items-center gap-1", vertical ? "flex-col" : "flex-row gap-3", className)}>
        <Link
          href={loginHref}
          aria-label={`Entre para destacar “${paperTitle}”`}
          className={cn(
            baseButton,
            "border-border-strong bg-surface text-fg-muted hover:border-accent-strong hover:bg-accent-soft hover:text-accent-strong",
            vertical ? "size-10" : "h-11 px-4 text-[0.9375rem]",
          )}
        >
          <Star aria-hidden="true" />
          {!vertical && <span>Entre para destacar</span>}
        </Link>
        {countLabel}
        {srCount}
      </div>
    );
  }

  if (viewer === "owner") {
    return (
      <div className={cn("flex items-center gap-1", vertical ? "flex-col" : "flex-row gap-3", className)}>
        <Tooltip content={OWN_PAPER_HINT} side={vertical ? "bottom" : "top"}>
          <button
            type="button"
            aria-disabled="true"
            aria-label={`Destacar “${paperTitle}” (indisponível: você enviou este paper)`}
            onClick={(event) => event.preventDefault()}
            className={cn(
              baseButton,
              "cursor-not-allowed border-border bg-surface-2 text-fg-subtle",
              vertical ? "size-10" : "h-11 px-4 text-[0.9375rem]",
            )}
          >
            <Star aria-hidden="true" />
            {!vertical && <span>Seu paper</span>}
          </button>
        </Tooltip>
        {countLabel}
        {srCount}
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
    <div className={cn("relative flex items-center gap-1", vertical ? "flex-col" : "flex-row gap-3", className)}>
      <button
        type="button"
        onClick={handleClick}
        aria-pressed={active}
        aria-busy={isPending || undefined}
        aria-label={
          active ? `Remover destaque de “${paperTitle}” (você destacou este paper)` : `Destacar “${paperTitle}”`
        }
        className={cn(
          baseButton,
          active
            ? "border-accent-strong bg-accent-soft text-accent-strong hover:bg-accent-soft"
            : "border-border-strong bg-surface text-fg-muted hover:border-accent-strong hover:bg-accent-soft hover:text-accent-strong",
          vertical ? "size-10" : "h-11 px-4 text-[0.9375rem]",
        )}
      >
        <Star aria-hidden="true" className={cn(active && "fill-accent")} />
        {!vertical && <span>{active ? "Destacado" : "Destacar"}</span>}
      </button>
      {countLabel}
      {srCount}
      <span aria-live="polite" className="sr-only">
        {error ?? ""}
      </span>
      {error && (
        <p
          aria-hidden="true"
          className={cn(
            "absolute z-20 w-56 rounded-control border border-danger/30 bg-danger-soft px-3 py-2 text-xs font-medium text-danger-soft-fg shadow-overlay",
            vertical ? "top-full left-0 mt-1" : "top-full left-0 mt-2",
          )}
        >
          {error}
        </p>
      )}
    </div>
  );
}
