"use client";

import { useState, useTransition } from "react";
import { Check, X } from "lucide-react";
import { Button, FormMessage } from "@/components/ui";
import { respondConversationAction } from "@/app/mensagens/actions";
import { CONNECTION_ERROR } from "@/lib/forum/client-action";

/**
 * Aceitar (e, num pedido novo, recusar) um pedido de mensagem recebido
 * (`respond_conversation_request`; recusado também pode ser aceito depois). Deu certo: avisa a
 * conversa (`onDone`), que mostra a linha de sistema, anuncia na região ao vivo da página e cuida
 * do foco — este aviso some com o estado novo.
 */
export function RequestResponse({
  conversationId,
  mode,
  onDone,
}: {
  conversationId: string;
  /** "respond" = Aceitar e Recusar · "accept" = só Aceitar (pedido que eu já recusei). */
  mode: "respond" | "accept";
  onDone: (accepted: boolean) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [choice, setChoice] = useState<boolean | null>(null);
  const [pending, startTransition] = useTransition();

  function respond(accept: boolean) {
    setError(null);
    setChoice(accept);
    startTransition(async () => {
      let result: Awaited<ReturnType<typeof respondConversationAction>>;
      try {
        result = await respondConversationAction(conversationId, accept);
      } catch {
        result = { ok: false, error: CONNECTION_ERROR };
      }
      if (result.ok) onDone(accept);
      else setError(result.error);
    });
  }

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          onClick={() => respond(true)}
          disabled={pending}
          loading={pending && choice === true}
          loadingText="Aceitando…"
          className="pointer-coarse:h-11"
        >
          <Check aria-hidden="true" />
          Aceitar
        </Button>
        {mode === "respond" && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => respond(false)}
            disabled={pending}
            loading={pending && choice === false}
            loadingText="Recusando…"
            className="pointer-coarse:h-11"
          >
            <X aria-hidden="true" />
            Recusar
          </Button>
        )}
      </div>
      <FormMessage tone="error">{error}</FormMessage>
    </div>
  );
}
