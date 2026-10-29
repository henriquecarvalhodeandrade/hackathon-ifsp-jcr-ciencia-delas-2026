"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Check, X } from "lucide-react";
import { Button, FormMessage } from "@/components/ui";
import { respondConversationAction } from "@/app/mensagens/actions";
import { CONNECTION_ERROR, withConnectionFallback } from "@/lib/forum/client-action";
import type { MessagesActionState } from "@/lib/messages/types";

/** Os dois botões no mesmo formulário: só o que foi clicado mostra o carregamento. */
function RespondButtons() {
  const { pending, data } = useFormStatus();
  const choice = pending ? data?.get("accept") : null;
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        type="submit"
        name="accept"
        value="true"
        size="sm"
        disabled={pending}
        loading={choice === "true"}
        loadingText="Aceitando…"
      >
        <Check aria-hidden="true" />
        Aceitar
      </Button>
      <Button
        type="submit"
        name="accept"
        value="false"
        size="sm"
        variant="outline"
        disabled={pending}
        loading={choice === "false"}
        loadingText="Recusando…"
      >
        <X aria-hidden="true" />
        Recusar
      </Button>
    </div>
  );
}

/**
 * Aceitar ou recusar um pedido de mensagem recebido (`respond_conversation_request`). Deu certo:
 * a página volta já no estado novo (o aviso some) e o foco vai para o campo da mensagem, que
 * continua lá nos dois casos.
 */
export function RequestResponse({ conversationId }: { conversationId: string }) {
  const [state, formAction] = useActionState<MessagesActionState, FormData>(
    withConnectionFallback(
      async (prev: MessagesActionState, formData: FormData) => {
        const result = await respondConversationAction(prev, formData);
        if (result?.ok) {
          window.requestAnimationFrame(() =>
            document.getElementById(`mensagem-${conversationId}`)?.focus(),
          );
        }
        return result;
      },
      () => ({ ok: false, error: CONNECTION_ERROR }),
    ),
    null,
  );

  return (
    <form action={formAction} className="grid gap-2">
      <input type="hidden" name="conversation_id" value={conversationId} />
      <RespondButtons />
      <FormMessage tone="error">{state && !state.ok ? state.error : null}</FormMessage>
      <p role="status" aria-live="polite" className="sr-only">
        {state?.ok ? state.message : ""}
      </p>
    </form>
  );
}
