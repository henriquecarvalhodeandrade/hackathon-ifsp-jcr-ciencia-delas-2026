import { ArrowRight, Newspaper } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { ConstellationPattern } from "@/components/ui/constellation-pattern";
import { Container } from "@/components/ui/container";

export function NewsletterCta({
  latestEdition,
}: {
  latestEdition: { slug: string; title: string } | null;
}) {
  return (
    <section aria-labelledby="boletim-titulo" className="py-16 sm:py-20">
      <Container>
        <div
          data-theme="dark"
          className="relative isolate overflow-hidden rounded-dialog bg-violeta-950 px-6 py-10 text-fg sm:px-10 sm:py-14"
        >
          <ConstellationPattern
            density="medium"
            align="end"
            className="absolute inset-0 -z-10 size-full [mask-image:linear-gradient(100deg,transparent_40%,black_85%)] text-violeta-300/55"
          />
          <div className="grid max-w-2xl gap-4">
            <p className="flex items-center gap-2 eyebrow text-violeta-200">
              <Newspaper aria-hidden="true" className="size-4" />
              Boletim Delas · toda segunda-feira
            </p>
            <h2
              id="boletim-titulo"
              className="font-serif text-3xl leading-tight font-semibold text-white sm:text-4xl"
            >
              As estrelas da semana na ciência feita por mulheres, no seu e-mail
            </h2>
            <p className="text-lg text-violeta-100">
              Papers mais destacados, conversas abertas do fórum e novas mentoras da rede. Gratuito,
              sem spam, com confirmação por e-mail e descadastro em um clique.
            </p>
            <div className="mt-2 flex flex-wrap gap-3">
              <ButtonLink href="/newsletter" size="lg">
                Assinar o Boletim
                <ArrowRight aria-hidden="true" />
              </ButtonLink>
              {latestEdition && (
                <ButtonLink href={`/newsletter/${latestEdition.slug}`} size="lg" variant="outline">
                  Ler a edição mais recente
                </ButtonLink>
              )}
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
