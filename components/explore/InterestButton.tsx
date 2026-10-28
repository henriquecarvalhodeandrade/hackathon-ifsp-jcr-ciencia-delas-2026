"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { AlertCircle, CheckCircle, Clock, FlaskConical, Loader2 } from "lucide-react";
import { requestInterest } from "@/lib/actions/projects";

export type InterestState = "none" | "pending" | "accepted";

interface InterestButtonProps {
  projectId: string;
  state: InterestState;
  /** Motivo para desabilitar (ex.: vagas encerradas) */
  blockedReason?: string | null;
}

export function InterestButton({ projectId, state, blockedReason }: InterestButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = React.useState<string | null>(null);

  if (state === "accepted") {
    return (
      <span className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold text-sm">
        <CheckCircle className="w-4 h-4" />
        Participando
      </span>
    );
  }

  if (state === "pending") {
    return (
      <span className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-border bg-muted text-muted-foreground font-semibold text-sm">
        <Clock className="w-4 h-4" />
        Solicitação enviada
      </span>
    );
  }

  const blocked = Boolean(blockedReason);

  return (
    <div className="flex flex-col items-end gap-1.5">
      <button
        type="button"
        disabled={isPending || blocked}
        title={blockedReason ?? undefined}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const res = await requestInterest(projectId);
            if (!res.ok) setError(res.error);
            else router.refresh();
          });
        }}
        className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-sm shadow-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isPending ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <FlaskConical className="w-4 h-4" />
        )}
        Tenho Interesse
      </button>
      {error && (
        <span className="inline-flex items-center gap-1 text-xs text-destructive">
          <AlertCircle className="w-3.5 h-3.5" />
          {error}
        </span>
      )}
    </div>
  );
}
