import { Compass } from "lucide-react";
import { ButtonLink, Container, EmptyState } from "@/components/ui";

/** Categoria inexistente (slug errado). */
export default function CategoryNotFound() {
  return (
    <Container size="narrow" className="py-14">
      <h1 className="sr-only">Categoria não encontrada</h1>
      <EmptyState
        headingLevel="h2"
        icon={<Compass />}
        title="Esta categoria não existe"
        description="Confira o endereço ou escolha uma das categorias do fórum."
        action={<ButtonLink href="/forum">Ver categorias do fórum</ButtonLink>}
      />
    </Container>
  );
}
