import { MessageSquareHeart } from "lucide-react";
import { ButtonLink, type ButtonVariant } from "@/components/ui";
import { conversationHref, unreadLabel } from "@/lib/mentorship/conversation";

/**
 * Botão "Conversar" (mentoria ativa) ou "Ver conversa" (concluída/cancelada, só leitura), com o
 * número de mensagens não lidas — em texto para leitor de tela, não só no selo.
 */
export function ConversationLink({
  requestId,
  otherName,
  unread = 0,
  readOnly = false,
  variant,
}: {
  requestId: string;
  /** Primeiro nome da outra participante (para o nome acessível). */
  otherName: string;
  unread?: number;
  readOnly?: boolean;
  variant?: ButtonVariant;
}) {
  return (
    <ButtonLink
      href={conversationHref(requestId)}
      variant={variant ?? (readOnly ? "outline" : "primary")}
      size="sm"
    >
      <MessageSquareHeart aria-hidden="true" />
      {readOnly ? "Ver conversa" : "Conversar"}
      <span className="sr-only"> com {otherName}</span>
      {unread > 0 && (
        <span className="ml-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-pill bg-accent px-1.5 text-xs font-bold text-accent-fg tabular">
          <span aria-hidden="true">{unread > 99 ? "99+" : unread}</span>
          <span className="sr-only">({unreadLabel(unread)})</span>
        </span>
      )}
    </ButtonLink>
  );
}
