import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import type { LandingViewer } from "./hero";

const STEPS = [
  {
    title: "Conte sobre a sua pesquisa",
    text: "No cadastro, em quatro passos: etapa da carreira, áreas, palavras-chave e o que você busca (ou oferece) numa mentoria.",
  },
  {
    title: "Receba sugestões explicadas",
    text: "Cada mentora sugerida vem com uma nota de afinidade, o motivo da combinação e temas para puxar a primeira conversa.",
  },
  {
    title: "Peça mentoria e combinem",
    text: "Você envia uma mensagem; a mentora aceita conforme as vagas dela. O contato de vocês só aparece depois do aceite.",
  },
] as const;

export function MentorshipSteps({ viewer }: { viewer: LandingViewer | null }) {
  return (
    <section aria-labelledby="mentoria-titulo" className="py-16 sm:py-20">
      <Container>
        <div className="mb-10 flex flex-wrap items-end justify-between gap-6">
          <div className="grid max-w-2xl gap-3">
            <p className="eyebrow text-primary">Como funciona a mentoria</p>
            <h2 id="mentoria-titulo" className="font-display text-3xl font-semibold text-fg sm:text-4xl">
              Da primeira dúvida à primeira conversa, em três passos
            </h2>
          </div>
          {viewer?.onboarded ? (
            <ButtonLink href="/mentoria" variant="outline">
              Ir para a mentoria
              <ArrowRight aria-hidden="true" />
            </ButtonLink>
          ) : (
            <ButtonLink href={viewer ? "/onboarding" : "/cadastro"} variant="outline">
              {viewer ? "Completar meu perfil" : "Quero participar"}
              <ArrowRight aria-hidden="true" />
            </ButtonLink>
          )}
        </div>

        <ol className="relative grid gap-8 md:grid-cols-3 md:gap-6">
          {/* trilha tracejada que liga os passos (vertical no celular, horizontal no desktop) */}
          <span
            aria-hidden="true"
            className="absolute top-6 right-[16%] left-[16%] hidden border-t border-dashed border-border-strong md:block"
          />
          {STEPS.map((step, i) => (
            <li key={step.title} className="relative grid grid-cols-[3rem_1fr] gap-4 md:grid-cols-1 md:justify-items-center md:text-center">
              {i < STEPS.length - 1 && (
                <span
                  aria-hidden="true"
                  className="absolute top-12 -bottom-8 left-6 border-l border-dashed border-border-strong md:hidden"
                />
              )}
              <span
                aria-hidden="true"
                className={
                  i === STEPS.length - 1
                    ? "tabular relative z-10 inline-flex size-12 items-center justify-center rounded-full bg-accent font-display text-lg font-bold text-accent-fg ring-8 ring-bg"
                    : "tabular relative z-10 inline-flex size-12 items-center justify-center rounded-full bg-primary font-display text-lg font-bold text-primary-fg ring-8 ring-bg"
                }
              >
                {i + 1}
              </span>
              <div className="grid gap-1.5">
                <h3 className="font-display text-xl font-semibold text-fg">
                  <span className="sr-only">Passo {i + 1}: </span>
                  {step.title}
                </h3>
                <p className="text-fg-muted">{step.text}</p>
              </div>
            </li>
          ))}
        </ol>

        <p className="mt-10 flex items-start gap-2 rounded-card bg-surface-2 p-4 text-[0.9375rem] text-fg-muted sm:items-center">
          <Sparkles aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-info sm:mt-0" />
          <span>
            As sugestões dependem da sua autorização (e de você ter 18 anos ou mais): analisamos o seu perfil de pesquisa
            e, quando a IA gratuita está disponível, ela explica as combinações — sem receber seu nome, e-mail ou
            contatos. Sem autorização, você ainda encontra mentoras no diretório e pode pedir mentoria diretamente.{" "}
            <Link href="/privacidade#ia" className="font-semibold text-primary underline underline-offset-2">
              Como tratamos seus dados
            </Link>
          </span>
        </p>
      </Container>
    </section>
  );
}
