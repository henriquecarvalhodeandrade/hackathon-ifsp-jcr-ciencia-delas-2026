"use client";

import { useActionState, useState } from "react";
import { Check, CheckCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import type { ActionState } from "@/lib/admin/action-state";
import {
  deleteReadNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/notifications/actions";

/** Botão "Marcar como lida" de um item (fica acima do link esticado do cartão). */
export function MarkReadButton({ id, title }: { id: string; title: string }) {
  const [state, formAction] = useActionState<ActionState, FormData>(markNotificationRead, null);
  return (
    <form action={formAction} className="relative z-10 grid justify-items-end gap-1">
      <input type="hidden" name="id" value={id} />
      <SubmitButton
        variant="ghost"
        size="sm"
        pendingText="Marcando…"
        aria-label={`Marcar como lida: ${title}`}
        className="text-fg-muted"
      >
        <Check aria-hidden="true" />
        <span className="hidden sm:inline">Marcar como lida</span>
      </SubmitButton>
      <FormMessage tone="error" className="max-w-56 text-right">
        {state && !state.ok ? state.error : null}
      </FormMessage>
    </form>
  );
}

/** Ações em lote do cabeçalho: marcar todas como lidas e limpar as lidas. */
export function NotificationBulkActions({ unread, read }: { unread: number; read: number }) {
  // Uma única mensagem: a da última ação executada (marcar todas ou limpar lidas).
  const [last, setLast] = useState<ActionState>(null);

  async function run(action: () => Promise<ActionState>) {
    try {
      setLast(await action());
    } catch {
      setLast({ ok: false, error: "Não conseguimos falar com o servidor. Tente de novo." });
    }
  }

  return (
    <div className="grid justify-items-start gap-2 md:justify-items-end">
      <div className="flex flex-wrap gap-2">
        <form action={() => run(markAllNotificationsRead)}>
          <SubmitButton variant="outline" size="sm" pendingText="Marcando…" disabled={unread === 0}>
            <CheckCheck aria-hidden="true" />
            Marcar todas como lidas
          </SubmitButton>
        </form>
        <ConfirmDialog
          trigger={
            <Button variant="ghost" size="sm" disabled={read === 0}>
              <Trash2 aria-hidden="true" />
              Limpar lidas
            </Button>
          }
          title="Apagar as notificações lidas?"
          description="As notificações que você já leu somem da lista. As não lidas continuam aqui. Essa ação não pode ser desfeita."
          confirmLabel="Sim, apagar lidas"
          pendingLabel="Apagando…"
          action={() => run(deleteReadNotifications)}
        />
      </div>
      <FormMessage tone={last?.ok ? "success" : "error"} className="max-w-sm">
        {last ? (last.ok ? last.message : last.error) : null}
      </FormMessage>
    </div>
  );
}
