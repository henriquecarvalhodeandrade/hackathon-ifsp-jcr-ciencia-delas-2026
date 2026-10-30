import { MessagesSquare } from "lucide-react";
import { ButtonLink, EmptyState } from "@/components/ui";

/**
 * Conversa inexistente, de outra dupla (o RLS não diferencia) ou link quebrado. Aparece no painel
 * da direita (a caixa de entrada continua ao lado, no computador) com status HTTP 404.
 */
export default function DirectConversationNotFound() {
  return (
    <div className="max-lg:mb-6 lg:flex lg:min-h-0 lg:flex-1">
      <h1 className="sr-only">Conversa não encontrada</h1>
      <EmptyState
        headingLevel="h2"
        icon={<MessagesSquare />}
        title="Não encontramos esta conversa"
        description="As mensagens diretas são privadas: só as duas participantes conseguem abrir. Confira o link ou volte para a sua caixa de entrada."
        action={<ButtonLink href="/mensagens">Ver minhas mensagens</ButtonLink>}
        className="lg:flex-1"
      />
    </div>
  );
}
