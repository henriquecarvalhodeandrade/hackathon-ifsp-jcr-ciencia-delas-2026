"use client";

import { Trash2 } from "lucide-react";
import { Button, ConfirmDialog } from "@/components/ui";
import { deleteComment } from "@/lib/papers/actions";

/**
 * Exclusão de comentário com confirmação. O botão-gatilho é criado aqui, no cliente:
 * elementos JSX vindos de um Server Component chegam "preguiçosos" no SSR e o
 * cloneElement do Dialog não os reconhece (o que causava erro de hidratação).
 */
export function DeleteCommentButton({
  commentId,
  paperId,
  asModerator,
}: {
  commentId: string;
  paperId: string;
  asModerator: boolean;
}) {
  return (
    <ConfirmDialog
      trigger={
        <Button variant="ghost" size="sm">
          <Trash2 aria-hidden="true" />
          {asModerator ? "Excluir (moderação)" : "Excluir"}
        </Button>
      }
      title="Excluir este comentário?"
      description="Ele some da conversa para todas as pessoas. Essa ação não pode ser desfeita."
      confirmLabel="Sim, excluir"
      pendingLabel="Excluindo…"
      action={deleteComment}
      hiddenFields={{ id: commentId, paper_id: paperId }}
    />
  );
}
