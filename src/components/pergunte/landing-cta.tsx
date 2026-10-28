import { ArrowRight, EyeOff, MessageCircleQuestion, ShieldCheck } from "lucide-react";
import { ButtonLink, ConstellationPattern, Container } from "@/components/ui";

/**
 * Seção da landing, logo depois de <MentorshipSteps /> (mesmo fundo): a porta de entrada para
 * quem ainda não pesquisa — sem conta, anônima e moderada. Sem respiro em cima porque a seção
 * anterior já termina com o dela.
 */
export function PergunteLandingCta() {
  return (
    <section aria-labelledby="pergunte-titulo" className="pb-16 sm:pb-20">
      <Container>
        <div className="relative isolate overflow-hidden rounded-dialog border border-border bg-surface px-6 py-10 shadow-card sm:px-10 sm:py-12">
          <ConstellationPattern
            density="low"
            align="end"
            className="absolute inset-0 -z-10 hidden size-full [mask-image:linear-gradient(100deg,transparent_45%,black_90%)] text-primary/20 md:block"
          />
          <div className="grid max-w-2xl gap-4">
            <p className="flex items-center gap-2 eyebrow text-primary">
              <MessageCircleQuestion aria-hidden="true" className="size-4" />
              Pergunte a uma cientista
            </p>
            <h2
              id="pergunte-titulo"
              className="font-display text-3xl leading-tight font-semibold text-fg sm:text-4xl"
            >
              Ainda não pesquisa? Pergunte a uma cientista.
            </h2>
            <p className="text-lg text-fg-muted">
              Para estudantes do ensino médio, do técnico e do começo da graduação: mande sua dúvida
              sobre ciência ou carreira sem criar conta e sem dizer quem é.
            </p>
            <p className="text-lg text-fg-muted">
              A moderação lê antes de publicar e cientistas da rede respondem em público.
            </p>
            <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm font-medium text-fg-muted">
              <li className="flex items-center gap-1.5">
                <EyeOff aria-hidden="true" className="size-4 text-primary" />
                Sem conta e sem nome
              </li>
              <li className="flex items-center gap-1.5">
                <ShieldCheck aria-hidden="true" className="size-4 text-primary" />
                Moderada antes de aparecer
              </li>
            </ul>
            <div className="mt-2">
              <ButtonLink href="/pergunte" size="lg">
                Fazer uma pergunta
                <ArrowRight aria-hidden="true" />
              </ButtonLink>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
