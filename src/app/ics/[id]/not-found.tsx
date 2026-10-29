import { SearchX } from "lucide-react";
import { ButtonLink, Container, EmptyState } from "@/components/ui";

/** Vaga inexistente, excluída — ou página só da dona (editar, candidaturas) aberta por outra pessoa. */
export default function OpportunityNotFound() {
  return (
    <Container size="narrow" className="py-10 sm:py-16">
      <h1 className="sr-only">Vaga não encontrada</h1>
      <EmptyState
        icon={<SearchX />}
        title="Não encontramos esta vaga"
        description="Ela pode ter sido excluída por quem publicou, ou o link está incompleto. Veja as vagas abertas no Explorar ICs."
        action={<ButtonLink href="/ics">Ir para o Explorar ICs</ButtonLink>}
      />
    </Container>
  );
}
