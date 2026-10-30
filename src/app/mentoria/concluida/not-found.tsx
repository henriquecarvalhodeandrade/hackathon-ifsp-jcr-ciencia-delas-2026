import { HeartHandshake } from "lucide-react";
import { ButtonLink, Container, EmptyState } from "@/components/ui";

/** Mentoria inexistente, de outra dupla (o RLS não diferencia) ou link quebrado. */
export default function CompletedMentorshipNotFound() {
  return (
    <Container size="narrow" className="py-14">
      <h1 className="sr-only">Mentoria não encontrada</h1>
      <EmptyState
        headingLevel="h2"
        icon={<HeartHandshake />}
        title="Não encontramos esta mentoria"
        description="O retorno e a declaração de uma mentoria só abrem para a mentora e a mentoranda. Confira o link ou volte para as suas mentorias."
        action={<ButtonLink href="/mentoria?aba=ativas">Ver minhas mentorias</ButtonLink>}
      />
    </Container>
  );
}
