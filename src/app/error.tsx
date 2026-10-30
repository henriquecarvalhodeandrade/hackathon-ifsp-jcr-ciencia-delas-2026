"use client";

import { useEffect } from "react";
import { House, Orbit, RotateCcw } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { EmptyState } from "@/components/ui/empty-state";

export default function ErrorPage({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const digest =
    error && typeof error === "object" && "digest" in error && typeof error.digest === "string"
      ? error.digest
      : undefined;

  return (
    <Container size="narrow" className="py-16 sm:py-24">
      <EmptyState
        headingLevel="h2"
        icon={<Orbit />}
        title={<span className="text-2xl sm:text-3xl">Algo saiu da órbita</span>}
        description={
          <>
            Tivemos um problema ao carregar esta parte da página. Tente de novo — se continuar
            acontecendo, avise a equipe e conte o que você estava fazendo.
            {digest && (
              <span className="mt-3 block text-sm text-fg-subtle">
                Código do erro: <code className="font-mono">{digest}</code>
              </span>
            )}
          </>
        }
        action={
          <>
            <Button onClick={() => retry()} size="lg">
              <RotateCcw aria-hidden="true" />
              Tentar de novo
            </Button>
            <ButtonLink href="/" variant="outline" size="lg">
              <House aria-hidden="true" />
              Voltar ao início
            </ButtonLink>
          </>
        }
      />
    </Container>
  );
}
