"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Check, Loader2, UserMinus, X } from "lucide-react";
import { removeParticipant } from "@/lib/actions/projects";

interface RemoveParticipantButtonProps {
  interestId: string;
}

/** Remoção em 2 etapas (confirmar) para evitar clique acidental. */
export function RemoveParticipantButton({ interestId }: RemoveParticipantButtonProps) {
  const router = useRouter();
  const [confirming, setConfirming] = React.useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = React.useState<string | null>(null);

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        aria-label="Remover participante"
        title="Remover participante do projeto"
        className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-xl border border-destructive/40 text-destructive hover:bg-destructive/10 font-semibold text-[11px] transition-colors"
      >
        <UserMinus className="w-3.5 h-3.5" />
        Remover
      </button>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          disabled={isPending}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              const res = await removeParticipant(interestId);
              if (!res.ok) {
                setError(res.error);
                setConfirming(false);
              } else {
                setConfirming(false);
                router.refresh();
              }
            });
          }}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-destructive hover:bg-destructive/90 text-destructive-foreground font-semibold text-[11px] transition-colors disabled:opacity-60"
          aria-label="Confirmar remoção"
        >
          {isPending ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Check className="w-3 h-3" />
          )}
          Confirmar
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => setConfirming(false)}
          aria-label="Cancelar"
          className="p-1 rounded-lg border border-border hover:bg-muted transition-colors disabled:opacity-60"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
      {error && <span className="text-[10px] text-destructive">{error}</span>}
    </div>
  );
}
