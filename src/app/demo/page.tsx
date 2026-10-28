import type { Metadata } from "next";
import { CircleCheck, FlaskConical, Map as MapIcon } from "lucide-react";
import { DemoRoteiro, type RoteiroStep } from "@/components/demo/demo-roteiro";
import { PersonaEntryForm } from "@/components/demo/persona-entry-form";
import { Alert, Avatar, Card, Container, PageHeader } from "@/components/ui";
import { requireDemoMode } from "@/lib/demo/guard";
import { listPersonas } from "@/lib/demo/personas";

export const metadata: Metadata = {
  title: "Modo demonstração",
  description: "Entre na Artemis como uma pessoa fictícia, com um clique.",
  robots: { index: false, follow: false },
};

const MARINA_PROFILE = "/pesquisadoras/d1000000-0000-4000-8000-000000000001";

const ROTEIRO: readonly RoteiroStep[] = [
  {
    id: "painel",
    href: "/painel",
    title: "Meu painel",
    description: "O início de quem já é da rede: próximos passos e o que está esperando por ela.",
  },
  {
    id: "mentoria",
    href: "/mentoria?aba=sugestoes",
    title: "Mentoria: encontrar mentoras",
    description: "Sugestões com o motivo de cada combinação, mesmo sem nenhuma IA ligada.",
  },
  {
    id: "marina",
    href: MARINA_PROFILE,
    title: "Perfil da Marina",
    description: "Uma mentora da rede: pesquisa, temas de mentoria e como ela pode ajudar.",
  },
  {
    id: "forum",
    href: "/forum",
    title: "Fórum",
    description: "Dúvidas de pesquisa, carreira e espaços de apoio que aceitam relatos anônimos.",
  },
  {
    id: "vitrine",
    href: "/papers",
    title: "Vitrine Delas",
    description: "Papers de pesquisadoras com um resumo em linguagem acessível.",
  },
  {
    id: "ranking",
    href: "/ranking",
    title: "Ranking",
    description: "Os papers mais destacados pela comunidade na semana, no mês e desde sempre.",
  },
];

/**
 * /demo — entrada do modo demonstração (docs/14-painel-e-modo-demo.md). Só existe com
 * DEMO_MODE=true; desligado, responde 404 como qualquer rota inexistente.
 */
export default function DemoPage() {
  requireDemoMode();
  const personas = listPersonas();

  return (
    <Container className="pb-16">
      <PageHeader
        eyebrow="Modo demonstração"
        title="Conheça a Artemis por dentro"
        description="Entre como uma pessoa fictícia com um clique: sem senha, sem e-mail e sem cadastro."
      />

      <div className="grid gap-8">
        <Alert variant="info" icon={<FlaskConical />}>
          <p>
            <strong>
              Modo demonstração: todas as pessoas, papers e conversas daqui são fictícios.
            </strong>{" "}
            Outras pessoas podem estar usando a mesma conta agora, então o que você publicar aparece
            para elas também. Ao entrar, você sai da conta atual neste navegador.
          </p>
        </Alert>

        <section aria-labelledby="demo-personas" className="grid gap-4">
          <h2 id="demo-personas" className="font-display text-2xl font-semibold text-fg">
            Escolha com quem entrar
          </h2>
          <ul className="grid gap-5 md:grid-cols-2">
            {personas.map((persona) => (
              <Card as="li" key={persona.slug} className="flex flex-col gap-5 p-5 sm:p-6">
                <div className="flex items-start gap-4">
                  <Avatar name={persona.name} seed={persona.id} size="lg" />
                  <div className="grid min-w-0 gap-1">
                    <h3 className="font-display text-xl leading-snug font-semibold text-fg">
                      {persona.name}
                    </h3>
                    <p className="text-fg-muted">{persona.description}</p>
                  </div>
                </div>
                <ul className="grid gap-2 text-sm text-fg-muted">
                  {persona.highlights.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <CircleCheck
                        aria-hidden="true"
                        className="mt-0.5 size-4 shrink-0 text-success"
                      />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-auto">
                  <PersonaEntryForm slug={persona.slug} firstName={persona.firstName} />
                </div>
              </Card>
            ))}
          </ul>
        </section>

        <Card as="section" aria-labelledby="demo-roteiro" className="grid gap-4 p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <span
              aria-hidden="true"
              className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-soft-fg [&_svg]:size-[1.125rem]"
            >
              <MapIcon />
            </span>
            <div className="grid gap-1">
              <h2 id="demo-roteiro" className="font-display text-xl font-semibold text-fg">
                Roteiro de 3 minutos
              </h2>
              <p className="text-sm text-fg-muted">
                Depois de entrar, siga estas paradas. Cada uma leva direto à tela.
              </p>
            </div>
          </div>
          <DemoRoteiro steps={ROTEIRO} />
        </Card>
      </div>
    </Container>
  );
}
