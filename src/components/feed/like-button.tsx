"use client";

import { useEffect, useId, useOptimistic, useState, useTransition } from "react";
import { Heart } from "lucide-react";
import { buttonVariants } from "@/components/ui";
import { toggleLikeAction, type LikeResult } from "@/lib/feed/actions";
import { likesLabel } from "@/lib/feed/presentation";
import { cn, formatNumber } from "@/lib/utils";

type LikeState = { liked: boolean; count: number };

const NETWORK_ERROR = "Não conseguimos registrar a curtida. Confira sua conexão e tente de novo.";

export interface LikeButtonProps {
  postId: string;
  liked: boolean;
  count: number;
  /** Alvo para leitores de tela: "a publicação de Marina Souza". */
  targetLabel: string;
  className?: string;
}

/**
 * Curtir com atualização otimista: o número muda no mesmo instante e a Server Action confirma
 * (ou desfaz, mostrando um aviso). O nome acessível é FIXO ("Curtir a publicação de…"): o estado
 * vem do aria-pressed e o total fica na descrição (aria-describedby), como no destaque da Vitrine.
 */
export function LikeButton({ postId, liked, count, targetLabel, className }: LikeButtonProps) {
  const countId = `curtidas-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const [confirmed, setConfirmed] = useState<LikeState>({ liked, count });
  const [lastProps, setLastProps] = useState<LikeState>({ liked, count });
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Dados novos do servidor (revalidação) substituem o último estado confirmado.
  if (lastProps.liked !== liked || lastProps.count !== count) {
    setLastProps({ liked, count });
    setConfirmed({ liked, count });
  }

  const [optimistic, setOptimistic] = useOptimistic(confirmed, (_current, next: LikeState) => next);

  useEffect(() => {
    if (!error) return;
    const timer = window.setTimeout(() => setError(null), 6000);
    return () => window.clearTimeout(timer);
  }, [error]);

  function handleClick() {
    const next: LikeState = {
      liked: !optimistic.liked,
      count: Math.max(0, optimistic.count + (optimistic.liked ? -1 : 1)),
    };
    setError(null);
    startTransition(async () => {
      setOptimistic(next);
      // Falha de rede rejeita a promessa: sem o catch, o erro iria para o error boundary e
      // derrubaria a página inteira por causa de uma curtida.
      const result = await toggleLikeAction(postId, next.liked).catch((): LikeResult => ({
        ok: false,
        error: NETWORK_ERROR,
      }));
      startTransition(() => {
        if (result.ok) setConfirmed({ liked: result.liked, count: result.likeCount });
        else setError(result.error);
      });
    });
  }

  const active = optimistic.liked;
  return (
    <div className={cn("grid justify-items-start gap-1", className)}>
      <button
        type="button"
        onClick={handleClick}
        aria-pressed={active}
        aria-busy={isPending || undefined}
        aria-label={`Curtir ${targetLabel}`}
        aria-describedby={countId}
        title={active ? "Remover curtida" : "Curtir"}
        className={cn(
          buttonVariants({ variant: "ghost", size: "sm" }),
          "gap-1.5 pointer-coarse:h-11",
          active ? "text-primary hover:text-primary" : "text-fg-muted",
        )}
      >
        <Heart aria-hidden="true" className={cn(active && "fill-current")} />
        <span>Curtir</span>
        {optimistic.count > 0 && (
          <span aria-hidden="true" className="text-xs font-bold tabular">
            {formatNumber(optimistic.count)}
          </span>
        )}
      </button>
      {/* Só para a descrição do botão (hidden evita leitura duplicada no modo de leitura). */}
      <span id={countId} hidden>
        {likesLabel(optimistic.count)}
      </span>
      <p aria-live="polite" className={cn("text-sm font-medium text-danger", !error && "sr-only")}>
        {error}
      </p>
    </div>
  );
}
