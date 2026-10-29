"use client";

import { useActionState } from "react";
import { MessageSquare } from "lucide-react";
import { FormMessage, SubmitButton, type ButtonVariant } from "@/components/ui";
import { startConversationAction } from "@/app/mensagens/actions";
import { CONNECTION_ERROR, withConnectionFallback } from "@/lib/forum/client-action";
import type { MessagesActionState } from "@/lib/messages/types";
import { cn } from "@/lib/utils";

/**
 * Botão "Mensagem" (perfil, rede, candidaturas…): abre a conversa com a pesquisadora — acha a do
 * par ou cria uma, aceita ou como pedido de mensagem, conforme o banco decidir — e leva até ela.
 * É um formulário (POST): nada acontece antes do clique (nem pré-busca) e, quando o banco não deixa
 * (ensino médio só recebe de conexões, limite do dia…), o motivo aparece logo abaixo do botão, sem
 * sair da página.
 *
 * <MessageButton profileId={profile.id} />
 */
export function MessageButton({
  profileId,
  label = "Mensagem",
  variant = "secondary",
  size = "md",
  className,
}: {
  profileId: string;
  label?: string;
  variant?: ButtonVariant;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const [state, formAction] = useActionState<MessagesActionState, FormData>(
    withConnectionFallback(startConversationAction, () => ({
      ok: false,
      error: CONNECTION_ERROR,
    })),
    null,
  );
  const error = state && !state.ok ? state.error : null;

  return (
    <form action={formAction} className={cn("inline-grid max-w-xs", className)}>
      <input type="hidden" name="profile_id" value={profileId} />
      <SubmitButton variant={variant} size={size} pendingText="Abrindo…">
        <MessageSquare aria-hidden="true" />
        {label}
      </SubmitButton>
      {/* Sempre montada (aria-live), mas sem altura enquanto vazia: o formulário fica do tamanho
          do botão e se alinha com os vizinhos (Conectar, Seguir…). */}
      <FormMessage tone="error" className="mt-2 empty:mt-0">
        {error}
      </FormMessage>
    </form>
  );
}
