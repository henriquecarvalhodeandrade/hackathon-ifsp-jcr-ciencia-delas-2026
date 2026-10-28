"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { AlertCircle, Loader2, Trash2 } from "lucide-react";
import { deleteProject } from "@/lib/actions/projects";

interface DeleteProjectButtonProps {
  projectId: string;
}

/** Exclusão em 2 etapas (confirmar) para evitar clique acidental. */
export function DeleteProjectButton({ projectId }: DeleteProjectButtonProps) {
  const router = useRouter();
  const [confirming, setConfirming] = React.useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = React.useState<string | null>(null);

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-destructive/40 text-destructive hover:bg-destructive/10 font-semibold text-xs transition-colors"
      >
        <Trash2 className="w-3.5 h-3.5" />
        Excluir IC
      </button>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Excluir mesmo?</span>
        <button
          type="button"
          disabled={isPending}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              const res = await deleteProject(projectId);
              if (!res.ok) {
                setError(res.error);
                setConfirming(false);
              } else {
                router.push("/explore");
                router.refresh();
              }
            });
          }}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-destructive hover:bg-destructive/90 text-destructive-foreground font-semibold text-xs transition-colors disabled:opacity-60"
        >
          {isPending ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Trash2 className="w-3.5 h-3.5" />
          )}
          Sim, excluir
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => setConfirming(false)}
          className="px-3 py-1.5 rounded-xl border border-border hover:bg-muted font-semibold text-xs transition-colors disabled:opacity-60"
        >
          Cancelar
        </button>
      </div>
      {error && (
        <span className="inline-flex items-center gap-1 text-xs text-destructive">
          <AlertCircle className="w-3.5 h-3.5" />
          {error}
        </span>
      )}
    </div>
  );
}
