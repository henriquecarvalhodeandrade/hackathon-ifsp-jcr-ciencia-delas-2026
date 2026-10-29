import { MessageSquare } from "lucide-react";
import { ButtonLink, type ButtonVariant } from "@/components/ui";
import { startConversationHref } from "@/lib/messages/conversation";
import { cn } from "@/lib/utils";

/**
 * Botão "Mensagem" (perfil, rede, ICs…): leva à conversa com a pesquisadora — a do par, se já
 * existir, ou um rascunho (`/mensagens/nova?com=<perfil>`). Nada é criado no banco até a primeira
 * mensagem: abrir e desistir não deixa conversa vazia. Por isso é um link comum (a pré-busca é
 * inofensiva) e funciona em Server e Client Components. Quando o banco não deixa conversar
 * (ensino médio só recebe de conexões, limite do dia…), o motivo aparece no rascunho, com o texto
 * guardado.
 *
 * <MessageButton profileId={profile.id} />                       (listas: "Mensagem")
 * <MessageButton profileId={profile.id} label="Enviar mensagem" variant="outline" size="sm" />
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
  return (
    <ButtonLink
      href={startConversationHref(profileId)}
      variant={variant}
      size={size}
      className={cn("pointer-coarse:min-h-11", className)}
    >
      <MessageSquare aria-hidden="true" />
      {label}
    </ButtonLink>
  );
}
