"use client";

import { useActionState } from "react";
import { Pencil, Sparkles, Trash2 } from "lucide-react";
import { Button, ButtonLink, ConfirmDialog, FormMessage, SubmitButton } from "@/components/ui";
import { deletePaper, regenerateSummary, type RegenerateState } from "@/lib/papers/actions";

export interface PaperOwnerActionsProps {
  paperId: string;
  /** Quem enviou: editar e gerar resumo. */
  isOwner: boolean;
  /** Quem enviou ou a moderação: excluir. */
  canDelete: boolean;
  aiEnabled: boolean;
  hasSummary: boolean;
}

/** Ações de quem enviou o paper (e exclusão pela moderação). */
export function PaperOwnerActions({ paperId, isOwner, canDelete, aiEnabled, hasSummary }: PaperOwnerActionsProps) {
  const [state, formAction] = useActionState<RegenerateState, FormData>(regenerateSummary, null);

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-2">
        {isOwner && (
          <ButtonLink href={`/papers/${paperId}/editar`} variant="outline" size="sm">
            <Pencil aria-hidden="true" />
            Editar
          </ButtonLink>
        )}
        {canDelete && (
          <ConfirmDialog
            trigger={
              <Button variant="ghost" size="sm" className="text-danger hover:text-danger">
                <Trash2 aria-hidden="true" />
                {isOwner ? "Excluir" : "Excluir (moderação)"}
              </Button>
            }
            title="Excluir este paper da Vitrine?"
            description="Os destaques e comentários dele também serão apagados. Essa ação não pode ser desfeita."
            confirmLabel="Sim, excluir"
            pendingLabel="Excluindo…"
            action={deletePaper}
            hiddenFields={{ id: paperId }}
          />
        )}
      </div>
      {isOwner && aiEnabled && (
        <form action={formAction} className="grid gap-2">
          <input type="hidden" name="paper_id" value={paperId} />
          <SubmitButton variant="outline" size="sm" pendingText="Gerando resumo…" className="justify-self-start">
            <Sparkles aria-hidden="true" />
            {hasSummary ? "Gerar novo resumo com IA" : "Gerar resumo acessível com IA"}
          </SubmitButton>
          <p className="text-xs text-fg-subtle">
            O título e o abstract (públicos) são enviados a um serviço de IA de terceiros. O novo texto substitui o
            atual e aparece marcado como gerado por IA.
          </p>
          <FormMessage tone={state?.ok ? "success" : "error"}>
            {state ? (state.ok ? state.message : state.error) : null}
          </FormMessage>
        </form>
      )}
    </div>
  );
}
