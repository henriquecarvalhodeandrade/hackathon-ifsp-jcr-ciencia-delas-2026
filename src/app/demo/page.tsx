import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  ChevronDown,
  CircleCheck,
  FlaskConical,
  MapPin,
  Map as MapIcon,
  QrCode,
} from "lucide-react";
import { DemoRoteiro, type RoteiroStep } from "@/components/demo/demo-roteiro";
import { PersonaEntryForm } from "@/components/demo/persona-entry-form";
import { Alert, Avatar, Card, Container, PageHeader } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { requireDemoMode } from "@/lib/demo/guard";
import { listPersonas, personaByEmail, type DemoPersona } from "@/lib/demo/personas";
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

/**
 * Abre com a rede social em ação (docs/18) e segue para o resto da história do pitch (docs/00).
 * A plateia inteira usa a MESMA persona ao mesmo tempo: as paradas pedem ações que todo mundo
 * pode repetir (curtir, comentar, seguir, abrir uma conversa, olhar) — nunca as que só valem uma
 * vez (aceitar o convite da Juliana, responder um pedido, se candidatar), que a primeira pessoa
 * gastaria para as outras. Os ids ficam estáveis: são a chave do "Já vi" no navegador.
 */
const ROTEIRO: readonly RoteiroStep[] = [
  {
    id: "feed",
    href: "/feed",
    title: "Curta e comente uma publicação",
    description:
      "O dia a dia da pesquisa no feed: curta, comente e veja o aviso chegar para quem publicou.",
  },
  {
    id: "marina",
    href: MARINA_PROFILE,
    title: "Perfil e portfólio da Marina",
    description:
      "Pesquisa, trajetória, portfólio e publicações recentes de uma mentora, com o botão de mensagem.",
  },
  {
    id: "rede",
    href: "/rede",
    title: "Sua rede",
    description:
      "Pessoas sugeridas com o motivo (áreas e conexões em comum): siga quem te interessar.",
  },
  {
    id: "mensagens",
    href: "/mensagens",
    title: "Mensagens",
    description:
      "Abra uma conversa e mande um oi: chega ao vivo. Sem vínculo, a primeira mensagem vira um pedido.",
  },
  {
    id: "ics",
    href: "/ics",
    title: "Explorar ICs",
    description:
      "Vagas de iniciação científica com filtros por área, bolsa e etapa, e o andamento de uma candidatura aprovada.",
  },
  {
    id: "mentoria",
    href: "/mentoria?aba=sugestoes",
    title: "Mentoria: encontrar mentoras",
    description:
      "Sugestões com o motivo de cada combinação, como “Vocês têm em comum”, mesmo sem nenhuma IA ligada.",
  },
  {
    id: "pergunte",
    href: "/pergunte",
    title: "Pergunte a uma cientista",
    description:
      "Estudantes perguntam sem conta e sem nome; a moderação publica e cientistas da rede respondem.",
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

/** Persona da sessão atual (para marcar o cartão dela), ou null. Nunca derruba a página. */
async function currentPersonaSlug(): Promise<string | null> {
  try {
    const user = await getCurrentUser();
    return personaByEmail(user?.email)?.slug ?? null;
  } catch {
    return null;
  }
}

/**
 * Cartão compacto de uma persona: no celular, nome, descrição e o botão cabem em poucas linhas
 * (dois "Entrar como…" já na primeira tela); o que ela vai encontrar abre em "O que você vai ver".
 * Se a pessoa já está como ela: "Você está aqui · Ir para o painel", e o botão vira secundário
 * (continua lá: entrar de novo abre uma sessão nova dessa persona).
 */
function PersonaCard({ persona, current }: { persona: DemoPersona; current: boolean }) {
  return (
    <Card
      as="li"
      className={
        current
          ? "flex flex-col gap-3 p-4 ring-2 ring-primary sm:gap-4 sm:p-5"
          : "flex flex-col gap-3 p-4 sm:gap-4 sm:p-5"
      }
    >
      <div className="flex items-center gap-3">
        <Avatar name={persona.name} seed={persona.id} />
        <div className="grid min-w-0 gap-0.5">
          <h3 className="font-display text-lg leading-snug font-semibold text-fg">
            {persona.name}
          </h3>
          <p className="text-sm text-fg-muted">{persona.description}</p>
        </div>
      </div>
      {current && (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-control bg-primary-soft px-3 py-2 text-sm text-primary-soft-fg">
          <MapPin aria-hidden="true" className="size-4 shrink-0" />
          <strong className="font-semibold">Você está aqui</strong>
          <span aria-hidden="true">·</span>
          <Link
            href="/painel"
            className="inline-flex items-center gap-1 rounded-control font-semibold underline underline-offset-2 hover:decoration-2"
          >
            Ir para o painel
            <ArrowRight aria-hidden="true" className="size-3.5" />
          </Link>
        </p>
      )}
      <div className="mt-auto">
        <PersonaEntryForm
          slug={persona.slug}
          firstName={persona.firstName}
          variant={current ? "outline" : "primary"}
        />
      </div>
      <details className="group -mx-1">
        <summary className="flex min-h-8 cursor-pointer list-none items-center justify-between gap-2 rounded-control px-1 text-sm font-semibold text-fg-muted select-none hover:text-fg [&::-webkit-details-marker]:hidden">
          O que você vai ver
          <ChevronDown
            aria-hidden="true"
            className="size-4 shrink-0 text-fg-subtle transition-transform group-open:rotate-180 motion-reduce:transition-none"
          />
        </summary>
        <ul className="grid gap-2 px-1 pt-2 text-sm text-fg-muted">
          {persona.highlights.map((item) => (
            <li key={item} className="flex items-start gap-2">
              <CircleCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-success" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </details>
    </Card>
  );
}

/**
 * /demo — entrada do modo demonstração (docs/14-painel-e-modo-demo.md). Só existe com
 * DEMO_MODE=true; desligado, responde 404 como qualquer rota inexistente.
 */
export default async function DemoPage() {
  requireDemoMode();
  const personas = listPersonas();
  const current = await currentPersonaSlug();
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
        className="pb-5 sm:pb-8"
      />

      <div className="grid gap-8">
        {/* A escolha vem primeiro: quem abre pelo QR code vê dois "Entrar como…" na primeira tela. */}
        <section aria-labelledby="demo-personas" className="grid gap-3 sm:gap-4">
          <h2 id="demo-personas" className="font-display text-xl font-semibold text-fg sm:text-2xl">
            Escolha com quem entrar
          </h2>
          <ul className="grid gap-3 sm:gap-5 md:grid-cols-2 xl:grid-cols-3">
            {personas.map((persona) => (
              <PersonaCard
                key={persona.slug}
                persona={persona}
                current={persona.slug === current}
              />
            ))}
          </ul>
          <Alert variant="info" icon={<FlaskConical />}>
            <p>
              <strong>
                Modo demonstração: todas as pessoas, papers e conversas daqui são fictícios.
              </strong>
            </p>
            <details className="group mt-1">
              <summary className="inline-flex min-h-6 cursor-pointer list-none items-center gap-1 rounded-control font-semibold underline underline-offset-2 select-none hover:decoration-2 [&::-webkit-details-marker]:hidden">
                Saiba mais
                <ChevronDown
                  aria-hidden="true"
                  className="size-4 shrink-0 transition-transform group-open:rotate-180 motion-reduce:transition-none"
                />
              </summary>
              <p className="mt-1">
                Outras pessoas podem estar usando a mesma conta agora, então o que você publicar
                aparece para elas também. Ao entrar, você sai da conta atual neste navegador.
              </p>
            </details>
          </Alert>
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
                  Depois de entrar, siga estas paradas: cada uma leva direto à tela, com ações que
                  todo mundo pode repetir ao mesmo tempo (curtir, comentar, seguir, conversar).
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
