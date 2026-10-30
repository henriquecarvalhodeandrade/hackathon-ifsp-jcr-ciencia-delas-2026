import { MessageSquareHeart } from "lucide-react";
import { ButtonLink, Container, EmptyState } from "@/components/ui";

/** Conversa inexistente, de outra dupla (o RLS não diferencia) ou link quebrado. */
export default function ConversationNotFound() {
  return (
    <Container size="narrow" className="py-14">
      <h1 className="sr-only">Conversa não encontrada</h1>
      <EmptyState
        headingLevel="h2"
        icon={<MessageSquareHeart />}
        title="Não encontramos esta conversa"
        description="As conversas da mentoria são privadas: só a mentora e a mentoranda conseguem abrir. Confira o link ou volte para as suas mentorias."
        action={<ButtonLink href="/mentoria?aba=ativas">Ver minhas mentorias</ButtonLink>}
      />
    </Container>
  );
}
