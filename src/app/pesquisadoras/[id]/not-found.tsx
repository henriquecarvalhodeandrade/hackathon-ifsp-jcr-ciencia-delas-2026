import { UserX } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { EmptyState } from "@/components/ui/empty-state";

/** Perfil inexistente, removido ou que ainda não concluiu o cadastro. */
export default function ProfileNotFound() {
  return (
    <Container size="narrow" className="py-10 sm:py-16">
      <h1 className="sr-only">Perfil não encontrado</h1>
      <EmptyState
        icon={<UserX />}
        title="Não encontramos este perfil"
        description="Ele pode ter sido excluído ou ainda não estar completo. Procure a pesquisadora pelo nome no diretório."
        action={<ButtonLink href="/pesquisadoras">Ir para o diretório</ButtonLink>}
      />
    </Container>
  );
}
