import { MessagesSquare } from "lucide-react";
import { ButtonLink, Container, EmptyState } from "@/components/ui";

/** Conversa inexistente, de outra dupla (o RLS não diferencia) ou link quebrado. */
export default function DirectConversationNotFound() {
  return (
    <Container size="narrow" className="py-14">
      <h1 className="sr-only">Conversa não encontrada</h1>
      <EmptyState
        headingLevel="h2"
        icon={<MessagesSquare />}
        title="Não encontramos esta conversa"
        description="As mensagens diretas são privadas: só as duas participantes conseguem abrir. Confira o link ou volte para a sua caixa de entrada."
        action={<ButtonLink href="/mensagens">Ver minhas mensagens</ButtonLink>}
      />
    </Container>
  );
}
