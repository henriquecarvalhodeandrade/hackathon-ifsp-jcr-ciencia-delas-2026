import { MessageCircleQuestion } from "lucide-react";
import { ButtonLink, Container, EmptyState } from "@/components/ui";

/** Pergunta inexistente, ainda em análise, não publicada ou apagada por quem perguntou. */
export default function QuestionNotFound() {
  return (
    <Container size="narrow" className="py-14">
      <h1 className="sr-only">Pergunta não encontrada</h1>
      <EmptyState
        headingLevel="h2"
        icon={<MessageCircleQuestion />}
        title="Não encontramos esta pergunta"
        description="Ela pode estar em análise pela moderação, não ter sido publicada ou ter sido apagada por quem perguntou."
        action={
          <>
            <ButtonLink href="/pergunte">Ver perguntas respondidas</ButtonLink>
            <ButtonLink href="/pergunte#enviar-pergunta" variant="outline">
              Fazer uma pergunta
            </ButtonLink>
          </>
        }
      />
    </Container>
  );
}
