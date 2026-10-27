import type { Metadata } from "next";
import { MessagesSquare } from "lucide-react";
import { ButtonLink, Container, EmptyState } from "@/components/ui";

export const metadata: Metadata = { title: "Tópico não encontrado" };

/** Tópico inexistente, apagado ou link quebrado. */
export default function ThreadNotFound() {
  return (
    <Container size="narrow" className="py-14">
      <h1 className="sr-only">Tópico não encontrado</h1>
      <EmptyState
        headingLevel="h2"
        icon={<MessagesSquare />}
        title="Não encontramos este tópico"
        description="Ele pode ter sido apagado pela autora ou pela moderação, ou o link está incompleto."
        action={
          <>
            <ButtonLink href="/forum">Voltar ao fórum</ButtonLink>
            <ButtonLink href="/forum/novo" variant="outline">
              Abrir um tópico
            </ButtonLink>
          </>
        }
      />
    </Container>
  );
}
