import { BookOpen, HeartHandshake, MessagesSquare } from "lucide-react";
import { ConstellationPattern } from "@/components/ui/constellation-pattern";
import { Container } from "@/components/ui/container";
import { Logo } from "@/components/ui/logo";
import { cn } from "@/lib/utils";

export interface AuthShellProps {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  /** Links abaixo do formulário (ex.: "Ainda não tem conta?"). */
  footer?: React.ReactNode;
  className?: string;
}

const PILLARS = [
  { icon: MessagesSquare, text: "Fórum acolhedor, com espaços anônimos para temas sensíveis." },
  { icon: HeartHandshake, text: "Mentoras experientes sugeridas a partir da sua pesquisa." },
  { icon: BookOpen, text: "Vitrine e boletim semanal com o trabalho de pesquisadoras." },
] as const;

/**
 * Moldura das telas de autenticação: painel da marca (violeta, igual nos dois temas) à
 * esquerda no desktop e o formulário à direita. No celular, só o formulário.
 */
export function AuthShell({ eyebrow, title, description, children, footer, className }: AuthShellProps) {
  return (
    <Container size="wide" className={cn("py-6 sm:py-12", className)}>
      <div className="mx-auto grid max-w-5xl overflow-hidden rounded-dialog border border-border bg-surface shadow-card lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        {/* Ilha de tema escuro: o violeta da marca (Logo, "Delas") fica claro sobre o fundo violeta-950. */}
        <aside
          aria-label="Sobre a Ciência Delas"
          data-theme="dark"
          className="relative isolate hidden min-h-[36rem] flex-col gap-8 overflow-hidden bg-violeta-950 p-10 text-white lg:flex"
        >
          <ConstellationPattern
            density="medium"
            align="end"
            className="absolute inset-x-0 top-0 -z-10 h-3/5 w-full text-violeta-300/60 [mask-image:linear-gradient(to_bottom,black_30%,transparent_100%)]"
          />
          <Logo size={30} className="text-white" />
          <div className="mt-auto grid gap-4">
            <p className="font-serif text-4xl leading-tight font-semibold text-balance">Ciência também é delas.</p>
            <p className="max-w-sm text-violeta-100">
              Uma rede para conectar, apoiar e dar visibilidade a mulheres que fazem pesquisa no Brasil.
            </p>
          </div>
          <ul className="grid gap-3 text-sm text-violeta-100">
            {PILLARS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3">
                <span className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-ambar-300">
                  <Icon aria-hidden="true" className="size-4" />
                </span>
                <span>{text}</span>
              </li>
            ))}
          </ul>
        </aside>

        <div className="grid content-start gap-6 p-5 sm:p-10">
          <header className="grid gap-2">
            {eyebrow && <p className="eyebrow text-primary">{eyebrow}</p>}
            <h1 className="font-display text-3xl leading-tight font-semibold tracking-[-0.025em] text-balance text-fg">
              {title}
            </h1>
            {description && <p className="text-fg-muted">{description}</p>}
          </header>
          {children}
          {footer && <div className="grid gap-2 border-t border-border pt-5 text-sm text-fg-muted">{footer}</div>}
        </div>
      </div>
    </Container>
  );
}
