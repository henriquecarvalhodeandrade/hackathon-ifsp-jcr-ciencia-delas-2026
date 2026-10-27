import Link from "next/link";
import { ArrowRight, BookOpen, HeartHandshake, MessagesSquare } from "lucide-react";
import { Container } from "@/components/ui/container";
import { cn } from "@/lib/utils";

const PILLARS = [
  {
    icon: MessagesSquare,
    tone: "bg-secondary-soft text-secondary-soft-fg",
    eyebrow: "Comunidade",
    title: "Fórum seguro",
    text: "Discussões por tema — carreira, bolsas e editais, dúvidas de pesquisa, maternidade, saúde mental e eventos. Só para membras, com reações de apoio e respostas marcadas como solução.",
    points: ["Publicação anônima nos temas sensíveis", "Denúncia em todo conteúdo e moderação ativa"],
    links: [{ href: "/forum", label: "Entrar no fórum" }],
  },
  {
    icon: HeartHandshake,
    tone: "bg-primary-soft text-primary-soft-fg",
    eyebrow: "Mentoria",
    title: "Mentoria com IA",
    text: "Conte sobre a sua pesquisa e receba sugestões de mentoras com o porquê de cada combinação e ideias para a primeira conversa.",
    points: [
      "Sugestões só com a sua autorização (e 18 anos ou mais)",
      "Se a IA estiver fora do ar, a afinidade vem de regras transparentes",
    ],
    links: [{ href: "/mentoria", label: "Encontrar mentoras" }],
  },
  {
    icon: BookOpen,
    tone: "bg-accent-soft text-accent-soft-fg",
    eyebrow: "Visibilidade",
    title: "Vitrine e Boletim",
    text: "Papers com autoria de mulheres, resumo em linguagem simples, destaques da comunidade e rankings por período e área. Toda semana, o Boletim Delas reúne o melhor.",
    points: ["Aberta ao público, sem precisar de conta", "Boletim gratuito, com descadastro em um clique"],
    links: [
      { href: "/papers", label: "Ver a Vitrine" },
      { href: "/newsletter", label: "Conhecer o Boletim" },
    ],
  },
] as const;

export function Pillars() {
  return (
    <section aria-labelledby="pilares-titulo" className="border-y border-border bg-surface py-16 sm:py-20">
      <Container>
        <div className="mb-10 grid max-w-2xl gap-3">
          <p className="eyebrow text-primary">Três pilares, uma rede</p>
          <h2 id="pilares-titulo" className="font-display text-3xl font-semibold text-fg sm:text-4xl">
            Tudo o que ajuda uma pesquisadora a não caminhar sozinha
          </h2>
        </div>
        <ul className="grid gap-5 md:grid-cols-3">
          {PILLARS.map((pillar) => (
            <li key={pillar.title} className="flex flex-col gap-4 rounded-card border border-border bg-bg p-6 shadow-card">
              <span className={cn("inline-flex size-12 items-center justify-center rounded-full", pillar.tone)}>
                <pillar.icon aria-hidden="true" className="size-6" />
              </span>
              <div className="grid gap-2">
                <p className="eyebrow text-fg-subtle">{pillar.eyebrow}</p>
                <h3 className="font-display text-xl font-semibold text-fg">{pillar.title}</h3>
                <p className="text-fg-muted">{pillar.text}</p>
              </div>
              <ul className="grid gap-1.5 text-[0.9375rem] text-fg">
                {pillar.points.map((point) => (
                  <li key={point} className="flex gap-2">
                    <span aria-hidden="true" className="mt-2.5 size-1.5 shrink-0 rounded-full bg-primary" />
                    {point}
                  </li>
                ))}
              </ul>
              <div className="mt-auto flex flex-wrap gap-x-5 gap-y-2 pt-2">
                {pillar.links.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="inline-flex items-center gap-1.5 font-semibold text-primary underline-offset-4 hover:underline"
                  >
                    {link.label}
                    <ArrowRight aria-hidden="true" className="size-4" />
                  </Link>
                ))}
              </div>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
