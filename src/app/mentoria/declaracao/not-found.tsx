import { FileText } from "lucide-react";
import { ButtonLink, Container, EmptyState } from "@/components/ui";

/** Declaração inexistente, ainda não emitida, revogada ou de outra dupla. */
export default function DeclarationNotFound() {
  return (
    <Container size="narrow" className="py-14">
      <h1 className="sr-only">Declaração não encontrada</h1>
      <EmptyState
        headingLevel="h2"
        icon={<FileText />}
        title="Esta declaração não está disponível"
        description="A declaração só abre para as duas participantes, depois que as duas autorizarem e enquanto não for revogada."
        action={<ButtonLink href="/mentoria?aba=ativas">Ver minhas mentorias</ButtonLink>}
      />
    </Container>
  );
}
