import { Accessibility, Eye, HeartHandshake, Orbit, Star } from "lucide-react";
import { ConstellationPattern } from "@/components/ui/constellation-pattern";
import { LogoMark } from "@/components/ui/logo";
import { formatNumber } from "@/lib/utils";
import { DsSection } from "./ds";

export function Hero({
  componentCount,
  tokenCount,
  pairCount,
}: {
  componentCount: number;
  tokenCount: number;
  pairCount: number;
}) {
  return (
    <div
      data-theme="dark"
      className="relative isolate overflow-hidden rounded-dialog bg-violeta-950 px-6 py-12 text-fg sm:px-10 sm:py-16"
    >
      <ConstellationPattern
        density="high"
        align="end"
        className="absolute inset-x-0 bottom-0 -z-10 h-52 w-full [mask-image:linear-gradient(to_bottom,transparent,black_70%)] text-violeta-300/50 sm:inset-0 sm:h-full sm:[mask-image:linear-gradient(100deg,transparent_25%,black_70%)] sm:text-violeta-300/60"
      />
      <div className="flex items-center gap-3 text-violeta-200">
        <LogoMark size={40} className="text-white" />
        <p className="eyebrow">Design system · versão 1.0</p>
      </div>
      <h1 className="mt-6 max-w-3xl font-display text-display font-bold text-white">Artemis</h1>
      <p className="mt-4 max-w-2xl text-xl leading-relaxed text-violeta-100">
        Cada cientista é uma estrela. Quando uma mentora encontra uma pesquisadora iniciante, quando
        um paper ganha destaque, quando alguém responde no fórum — desenhamos constelações. Este é o
        sistema visual que dá forma a isso na Artemis.
      </p>
      <dl className="mt-10 grid max-w-2xl grid-cols-3 gap-6 border-t border-white/15 pt-6">
        {[
          { label: "componentes", value: componentCount },
          { label: "tokens de cor", value: tokenCount },
          { label: "pares AA verificados", value: pairCount },
        ].map((s) => (
          <div key={s.label} className="grid gap-1">
            <dt className="order-2 text-sm text-violeta-200">{s.label}</dt>
            <dd className="font-display text-3xl font-semibold text-white tabular sm:text-4xl">
              {formatNumber(s.value)}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

const PRINCIPLES = [
  {
    icon: HeartHandshake,
    title: "Acolher antes de impressionar",
    text: "Quem chega pode estar insegura, cansada ou sozinha na pesquisa. Interfaces calmas, linguagem gentil e caminhos claros valem mais que efeitos.",
  },
  {
    icon: Accessibility,
    title: "Legível para todas",
    text: "Contraste AA nos dois temas, fonte projetada para baixa visão, foco sempre visível, nada que dependa só de cor ou de mouse.",
  },
  {
    icon: Star,
    title: "Dar luz ao trabalho delas",
    text: "O protagonismo é das pesquisadoras e dos seus papers. O âmbar das estrelas aparece pouco — só onde há algo para celebrar.",
  },
  {
    icon: Orbit,
    title: "Conexões visíveis",
    text: "Mentoria, colaboração e votos são relações. Linhas finas, nós e órbitas mostram que ninguém faz ciência sozinha.",
  },
  {
    icon: Eye,
    title: "IA com transparência",
    text: "Sugestões geradas por IA são sinalizadas, explicadas e nunca decidem sozinhas. A pessoa sempre tem a última palavra.",
  },
] as const;

export function Principles() {
  return (
    <DsSection
      id="principios"
      number="01"
      group="Fundamentos"
      title="Princípios"
      description="Cinco ideias que guiam cada decisão de interface. Na dúvida, volte aqui."
    >
      <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {PRINCIPLES.map((p, i) => (
          <li
            key={p.title}
            className="rounded-card border border-border bg-surface p-5 shadow-card"
          >
            <div className="flex items-center justify-between">
              <span className="inline-flex size-10 items-center justify-center rounded-full bg-primary-soft text-primary-soft-fg">
                <p.icon aria-hidden="true" className="size-5" />
              </span>
              <span className="font-display text-sm font-semibold text-fg-subtle tabular">
                0{i + 1}
              </span>
            </div>
            <h3 className="mt-4 font-display text-lg font-semibold text-fg">{p.title}</h3>
            <p className="mt-1.5 text-[0.9375rem] text-fg-muted">{p.text}</p>
          </li>
        ))}
      </ol>
    </DsSection>
  );
}

export function BrandStory() {
  return (
    <DsSection
      id="marca"
      number="02"
      group="Fundamentos"
      title="História da marca"
      description="Nada aqui é por acaso: as cores, o símbolo e as fontes contam de onde viemos e para quem fazemos."
    >
      <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <div className="grid gap-5 text-[1.0625rem] leading-relaxed text-fg-muted">
          <p>
            <strong className="text-fg">Roxo, branco e verde.</strong> Em 1908, a{" "}
            <em>Women&apos;s Social and Political Union</em> escolheu três cores para a luta pelo
            voto feminino:{" "}
            <span className="font-semibold text-primary">violeta pela dignidade</span>, branco pela
            pureza de propósito e{" "}
            <span className="font-semibold text-secondary">verde pela esperança</span>. Mais de um
            século depois, mulheres ainda são minoria nos cargos mais altos da ciência — a luta
            mudou de lugar, não de cor.
          </p>
          <p>
            O verde também é <strong className="text-fg">o verde dos Institutos Federais</strong>:
            nosso{" "}
            <code className="rounded-badge bg-surface-2 px-1.5 py-0.5 font-mono text-sm">
              verde-500
            </code>{" "}
            é o #32A041 da marca da Rede Federal. Nascemos num hackathon do IFSP Jacareí, e isso faz
            parte de quem somos.
          </p>
          <p>
            <strong className="text-fg">O âmbar é a luz das estrelas</strong> — destaques, votos e
            conquistas. E o fundo não é creme nem cinza frio: é um branco-papel levemente violeta de
            dia e um céu noturno à noite.
          </p>
          <p>
            <strong className="text-fg">O nome e o símbolo.</strong> Na mitologia grega, Ártemis é a
            deusa da caça e da Lua — e o nome também batiza o programa da NASA de volta à Lua. O
            símbolo é uma <strong className="text-fg">lua crescente</strong> com uma{" "}
            <strong className="text-fg">estrela âmbar</strong> de quatro pontas na curva: a lua que
            ilumina quem caminha à noite e a estrela que é cada pesquisadora ganhando luz. As pontas
            da lua são arredondadas, como as linhas do resto do sistema. O padrão de fundo inclui o{" "}
            <strong className="text-fg">Cruzeiro do Sul</strong>, que está na bandeira do Brasil.
          </p>
          <p>
            <strong className="text-fg">Atkinson Hyperlegible</strong> foi criada pelo Braille
            Institute para leitoras com baixa visão: letras como I, l e 1 ou O e 0 nunca se
            confundem. Escolher essa fonte para todo o texto da interface é uma decisão de inclusão,
            não de estilo.
          </p>
        </div>
        <div className="grid content-start gap-4">
          <div className="relative isolate flex min-h-64 items-center justify-center overflow-hidden rounded-card border border-border bg-surface p-8 shadow-card">
            <ConstellationPattern
              density="low"
              orbits={false}
              accents={false}
              className="absolute inset-0 -z-10 size-full [mask-image:radial-gradient(circle_at_center,transparent_28%,black_62%)] text-primary/25"
            />
            <LogoMark size={150} className="text-primary" title="Símbolo da Artemis" />
          </div>
          <div className="grid grid-cols-3 overflow-hidden rounded-card border border-border shadow-card">
            <div className="grid gap-1 bg-violeta-700 p-4 text-white">
              <span className="eyebrow">Dignidade</span>
              <span className="font-mono text-xs opacity-90">violeta-700</span>
            </div>
            <div className="grid gap-1 bg-white p-4 text-tinta-950">
              <span className="eyebrow">Clareza</span>
              <span className="font-mono text-xs text-tinta-700">tinta-25 / white</span>
            </div>
            <div className="grid gap-1 bg-verde-700 p-4 text-white">
              <span className="eyebrow">Esperança</span>
              <span className="font-mono text-xs opacity-90">verde-700</span>
            </div>
          </div>
        </div>
      </div>
    </DsSection>
  );
}
