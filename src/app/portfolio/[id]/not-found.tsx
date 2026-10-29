import { Briefcase } from "lucide-react";
import { ButtonLink, Container, EmptyState } from "@/components/ui";

/** Item inexistente, apagado ou de outra pessoa (só a dona edita). */
export default function PortfolioItemNotFound() {
  return (
    <Container size="narrow" className="py-10 sm:py-16">
      <h1 className="sr-only">Item não encontrado</h1>
      <EmptyState
        icon={<Briefcase />}
        title="Não encontramos este item no seu portfólio"
        description="Ele pode ter sido apagado, ou o link é de um item de outra pessoa — só a dona edita o próprio portfólio."
        action={<ButtonLink href="/portfolio">Ir para o meu portfólio</ButtonLink>}
      />
    </Container>
  );
}
