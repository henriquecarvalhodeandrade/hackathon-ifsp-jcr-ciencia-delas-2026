import { Newspaper } from "lucide-react";
import { ButtonLink, Container, EmptyState } from "@/components/ui";

/** Publicação inexistente, apagada pela autora ou pela moderação, ou link quebrado. */
export default function PostNotFound() {
  return (
    <Container size="narrow" className="py-14">
      <h1 className="sr-only">Publicação não encontrada</h1>
      <EmptyState
        headingLevel="h2"
        icon={<Newspaper />}
        title="Não encontramos esta publicação"
        description="Ela pode ter sido apagada pela autora ou pela moderação, ou o link está incompleto."
        action={<ButtonLink href="/feed">Voltar ao feed</ButtonLink>}
      />
    </Container>
  );
}
