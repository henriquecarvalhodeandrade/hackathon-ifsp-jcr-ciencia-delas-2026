import type { Metadata } from "next";
import { ArrowLeft, BookOpen } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { ConstellationPattern } from "@/components/ui/constellation-pattern";
import { Container } from "@/components/ui/container";

export const metadata: Metadata = {
  title: "Página não encontrada",
};

export default function NotFound() {
  return (
    <Container className="py-16 sm:py-24">
      <div className="relative isolate overflow-hidden rounded-dialog border border-border bg-surface px-6 py-14 text-center shadow-card sm:px-12 sm:py-20">
        <ConstellationPattern
          density="medium"
          className="absolute inset-0 -z-10 size-full text-primary/25 [mask-image:radial-gradient(ellipse_at_center,transparent_20%,black_75%)]"
        />
        <p className="eyebrow text-primary">Erro 404</p>
        <p
          aria-hidden="true"
          className="mx-auto mt-4 flex items-center justify-center font-display text-[clamp(5rem,18vw,9rem)] leading-none font-bold tracking-[-0.05em] text-primary"
        >
          <span>4</span>
          {/* o "0" é a órbita da marca, com a estrela âmbar */}
          <svg viewBox="0 0 64 80" fill="none" className="mx-[0.03em] h-[0.74em] w-[0.6em]">
            <ellipse cx="32" cy="40" rx="22" ry="31" stroke="currentColor" strokeWidth="13" />
            <circle cx="52" cy="15" r="10.5" fill="var(--color-accent)" stroke="var(--color-surface)" strokeWidth="5" />
          </svg>
          <span>4</span>
        </p>
        <h1 className="mx-auto mt-6 max-w-xl font-display text-3xl font-semibold text-fg sm:text-4xl">
          Essa estrela ainda não está no nosso mapa
        </h1>
        <p className="mx-auto mt-3 max-w-lg text-lg text-fg-muted">
          A página que você procurou não existe ou mudou de lugar. Que tal voltar para a constelação?
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <ButtonLink href="/" size="lg">
            <ArrowLeft aria-hidden="true" />
            Ir para o início
          </ButtonLink>
          <ButtonLink href="/papers" size="lg" variant="outline">
            <BookOpen aria-hidden="true" />
            Explorar papers
          </ButtonLink>
        </div>
      </div>
    </Container>
  );
}
