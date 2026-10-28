import type { Metadata } from "next";
import { CircleCheck, FlaskConical, Map as MapIcon, QrCode } from "lucide-react";
import { DemoRoteiro, type RoteiroStep } from "@/components/demo/demo-roteiro";
import { PersonaEntryForm } from "@/components/demo/persona-entry-form";
import { Alert, Avatar, Card, Container, PageHeader } from "@/components/ui";
import { requireDemoMode } from "@/lib/demo/guard";
import { listPersonas } from "@/lib/demo/personas";
import { env, getSiteUrl } from "@/lib/env";
import { displayHost } from "@/lib/recognition/declaration-text";
import { renderQrSvg } from "@/lib/recognition/qr";

const DEMO_METADATA: Metadata = {
  title: "Modo demonstração",
  description: "Entre na Artemis como uma pessoa fictícia, com um clique.",
  robots: { index: false, follow: false },
};

/**
 * Com o modo desligado, nem o título nem a descrição da página vão na resposta: o 404 do /demo
 * fica igual ao de qualquer rota inexistente.
 */
export function generateMetadata(): Metadata {
  return env.demoMode ? DEMO_METADATA : {};
}

const MARINA_PROFILE = "/pesquisadoras/d1000000-0000-4000-8000-000000000001";
/** Declaração fictícia do seed (supabase/seeds/20_reconhecimento.sql), a mesma do slide. */
const DEMO_DECLARATION = "/verificar/ART-7K2M-Q9XD-4HNP";

/** Mesma ordem da história do pitch (docs/00): da primeira curiosidade à mentoria reconhecida. */
const ROTEIRO: readonly RoteiroStep[] = [
  {
    id: "pergunte",
    href: "/pergunte",
    title: "Pergunte a uma cientista",
    description:
      "Estudantes perguntam sem conta e sem nome; a moderação publica e cientistas da rede respondem.",
  },
  {
    id: "mentoria",
    href: "/mentoria?aba=sugestoes",
    title: "Mentoria: encontrar mentoras",
    description:
      "Sugestões com o motivo de cada combinação, como “Vocês têm em comum”, mesmo sem nenhuma IA ligada.",
  },
  {
    id: "marina",
    href: MARINA_PROFILE,
    title: "Perfil da Marina",
    description: "Uma mentora da rede: pesquisa, trajetória e temas em que ela pode ajudar.",
  },
  {
    id: "painel",
    href: "/painel",
    title: "Meu painel",
    description: "O início de quem já é da rede: próximos passos e o que está esperando por ela.",
  },
  {
    id: "declaracao",
    href: DEMO_DECLARATION,
    title: "Declaração verificável",
    description:
      "A página pública que o QR code da declaração abre: qualquer pessoa confere se ela vale.",
  },
  {
    id: "vitrine",
    href: "/papers",
    title: "Vitrine Delas",
    description: "Papers de pesquisadoras com um resumo em linguagem acessível.",
  },
];

/**
 * /demo — entrada do modo demonstração (docs/14-painel-e-modo-demo.md). Só existe com
 * DEMO_MODE=true; desligado, responde 404 como qualquer rota inexistente.
 */
export default async function DemoPage() {
  requireDemoMode();
  const personas = listPersonas();
  // QR code para o slide e para a plateia abrir no celular. A URL é montada aqui (nunca vem da
  // requisição), como pede renderQrSvg.
  const demoUrl = `${getSiteUrl()}/demo`;
  const qrSvg = await renderQrSvg(demoUrl);

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
          <ul className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
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

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
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

          <Card as="section" aria-labelledby="demo-qr" className="grid gap-4 p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <span
                aria-hidden="true"
                className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary-soft text-secondary-soft-fg [&_svg]:size-[1.125rem]"
              >
                <QrCode />
              </span>
              <div className="grid gap-1">
                <h2 id="demo-qr" className="font-display text-xl font-semibold text-fg">
                  Abra no celular
                </h2>
                <p className="text-sm text-fg-muted">
                  Aponte a câmera para entrar nesta página. É o mesmo código do slide da
                  apresentação.
                </p>
              </div>
            </div>
            {/* Ilha de tema claro: QR escuro sobre fundo claro em qualquer tema (leitores antigos
                não leem QR invertido). */}
            <div
              role="img"
              aria-label={`QR code para abrir ${displayHost(demoUrl)}`}
              data-qr-url={demoUrl}
              data-theme="light"
              className="mx-auto size-44 rounded-control border border-border bg-surface p-3 text-fg"
              dangerouslySetInnerHTML={{ __html: qrSvg }}
            />
            <p className="text-center font-mono text-sm break-all text-fg-muted">
              {displayHost(demoUrl)}
            </p>
          </Card>
        </div>
      </div>
    </Container>
  );
}
