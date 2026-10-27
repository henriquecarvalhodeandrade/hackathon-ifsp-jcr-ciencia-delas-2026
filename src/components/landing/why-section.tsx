import { ArrowUpRight, Eye, ShieldCheck, Users } from "lucide-react";
import { Container } from "@/components/ui/container";

/** Fonte verificada (out/2026): página da ONU sobre o Dia Internacional das Mulheres e Meninas na Ciência. */
const UN_SOURCE = "https://www.un.org/en/observances/women-and-girls-in-science-day";

const OBSTACLES = [
  {
    icon: Users,
    title: "Faltam referências por perto",
    text: "É difícil encontrar uma pesquisadora mais experiente, da sua área, disposta a conversar sobre carreira, bolsas, publicação ou maternidade.",
  },
  {
    icon: ShieldCheck,
    title: "Dúvidas e situações difíceis ficam no silêncio",
    text: "Sem um espaço seguro, temas como assédio e saúde mental são enfrentados sozinha. Aqui há anonimato nos temas sensíveis e moderação ativa.",
  },
  {
    icon: Eye,
    title: "O trabalho delas circula pouco",
    text: "Papers de pesquisadoras chegam menos ao público. A Vitrine traz resumos em linguagem simples e destaques da comunidade.",
  },
] as const;

export function WhySection() {
  return (
    <section aria-labelledby="por-que-titulo" className="py-16 sm:py-20">
      <Container className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:gap-16">
        <div className="grid gap-5">
          <p className="eyebrow text-primary">Por que existimos</p>
          <h2 id="por-que-titulo" className="font-display text-3xl font-semibold text-fg sm:text-4xl">
            Mulheres ainda são minoria na pesquisa — e quase sempre começam sem rede
          </h2>
          <figure className="grid gap-3 rounded-card border border-border bg-surface p-6 shadow-card">
            <p aria-hidden="true" className="font-display text-5xl font-bold tracking-[-0.03em] text-primary">
              &lt;&nbsp;1/3
            </p>
            <p className="text-lg text-fg">
              Segundo a UNESCO, as mulheres são <strong>menos de um terço</strong> das pessoas que fazem pesquisa no
              mundo.
            </p>
            <figcaption className="text-sm text-fg-subtle">
              Fonte:{" "}
              <a
                href={UN_SOURCE}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-primary underline underline-offset-2"
              >
                ONU — Dia Internacional das Mulheres e Meninas na Ciência (dados da UNESCO)
                <ArrowUpRight aria-hidden="true" className="ml-0.5 inline size-3.5 align-[-0.125em]" />
                <span className="sr-only"> (abre em nova aba, em inglês)</span>
              </a>
            </figcaption>
          </figure>
        </div>
        <ul className="grid gap-4">
          {OBSTACLES.map((item) => (
            <li key={item.title} className="flex gap-4 rounded-card p-2">
              <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-soft-fg">
                <item.icon aria-hidden="true" className="size-5" />
              </span>
              <div className="grid gap-1">
                <h3 className="font-display text-lg font-semibold text-fg">{item.title}</h3>
                <p className="text-fg-muted">{item.text}</p>
              </div>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
