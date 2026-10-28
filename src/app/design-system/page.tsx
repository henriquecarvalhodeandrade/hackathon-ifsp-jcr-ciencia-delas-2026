import type { Metadata } from "next";
import { Container } from "@/components/ui/container";
import { CONTRAST_PAIRS, SEMANTIC } from "./_data/tokens";
import { Colors } from "./_components/colors";
import { ComponentsShowcase } from "./_components/components-showcase";
import { Foundations, Iconography, Typography } from "./_components/foundations";
import { AccessibilityChecklist, ThemeCompare, VoiceTone } from "./_components/guidelines";
import { BrandStory, Hero, Principles } from "./_components/intro";
import { Patterns } from "./_components/patterns";

export const metadata: Metadata = {
  title: "Design system",
  description:
    "Artemis: o design system da plataforma — cores com contraste verificado, tipografia legível, componentes acessíveis e guia de voz.",
};

const TOC = [
  { id: "principios", label: "Princípios" },
  { id: "marca", label: "História da marca" },
  { id: "cores", label: "Cores" },
  { id: "contraste", label: "Contraste", sub: true },
  { id: "tipografia", label: "Tipografia" },
  { id: "fundamentos", label: "Espaço e forma" },
  { id: "icones", label: "Iconografia" },
  { id: "componentes", label: "Componentes" },
  { id: "c-botoes", label: "Botões", sub: true },
  { id: "c-campos", label: "Campos", sub: true },
  { id: "c-chips", label: "Badges e chips", sub: true },
  { id: "c-cartoes", label: "Cartões", sub: true },
  { id: "c-navegacao", label: "Navegação", sub: true },
  { id: "c-feedback", label: "Feedback", sub: true },
  { id: "c-dados", label: "Dados", sub: true },
  { id: "c-conteudo", label: "Conteúdo", sub: true },
  { id: "padroes", label: "Padrões" },
  { id: "formulario", label: "Formulário", sub: true },
  { id: "temas", label: "Claro e escuro" },
  { id: "voz", label: "Voz e tom" },
  { id: "acessibilidade", label: "Acessibilidade" },
] as const;

/** Número de componentes exportados por @/components/ui (atualize ao criar novos). */
const COMPONENT_COUNT = 66;

export default function DesignSystemPage() {
  return (
    <Container size="wide" className="pt-6 pb-10 sm:pt-10">
      <Hero
        componentCount={COMPONENT_COUNT}
        tokenCount={Object.keys(SEMANTIC).length}
        pairCount={CONTRAST_PAIRS.length * 2}
      />

      {/* Sumário no celular: rolagem horizontal */}
      <nav aria-label="Seções do guia" className="-mx-4 mt-6 overflow-x-auto px-4 scrollbar-none lg:hidden">
        <ul className="flex min-w-max gap-2">
          {TOC.filter((t) => !("sub" in t)).map((item) => (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                className="inline-flex h-9 items-center rounded-pill border border-border-strong bg-surface px-3.5 text-sm font-semibold text-fg-muted hover:bg-surface-2 hover:text-fg"
              >
                {item.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="mt-6 lg:mt-12 lg:grid lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-12">
        <nav aria-label="Sumário do guia" className="hidden lg:block">
          <ul className="sticky top-24 grid max-h-[calc(100dvh-7rem)] gap-0.5 overflow-y-auto pb-6 text-sm">
            {TOC.map((item) => (
              <li key={item.id}>
                <a
                  href={`#${item.id}`}
                  className={
                    "sub" in item
                      ? "block rounded-badge py-1 pl-6 text-fg-subtle hover:text-primary"
                      : "block rounded-badge py-1.5 pl-2 font-semibold text-fg-muted hover:text-primary"
                  }
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="min-w-0">
          <Principles />
          <BrandStory />
          <Colors />
          <Typography />
          <Foundations />
          <Iconography />
          <ComponentsShowcase />
          <Patterns />
          <ThemeCompare />
          <VoiceTone />
          <AccessibilityChecklist />
        </div>
      </div>
    </Container>
  );
}
