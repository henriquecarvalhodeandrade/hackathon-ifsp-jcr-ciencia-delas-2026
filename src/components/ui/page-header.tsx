import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PageHeaderProps extends Omit<React.ComponentProps<"header">, "title"> {
  /** Texto pequeno acima do título (seção, categoria). */
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Botões à direita (no celular, vão para baixo do texto). */
  actions?: React.ReactNode;
  /** Link de volta acima do título. */
  back?: { href: string; label: string };
  /** Conteúdo abaixo (ex.: <TabNav>, filtros). */
  children?: React.ReactNode;
  /** Elemento do título (padrão h1 — só um por página). */
  titleAs?: "h1" | "h2" | "p";
}

/** Cabeçalho padrão de página: um único h1 por página. */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  back,
  children,
  titleAs: Title = "h1",
  className,
  ...props
}: PageHeaderProps) {
  return (
    <header className={cn("pt-8 pb-6 sm:pt-12 sm:pb-8", className)} {...props}>
      {back && (
        <Link
          href={back.href}
          className="mb-4 inline-flex items-center gap-1.5 rounded-control text-sm font-semibold text-fg-muted transition-colors hover:text-primary"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          {back.label}
        </Link>
      )}
      <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div className="grid max-w-3xl gap-2">
          {eyebrow && <p className="eyebrow text-primary">{eyebrow}</p>}
          <Title className="font-display text-3xl leading-tight font-semibold tracking-[-0.025em] text-balance text-fg sm:text-4xl">
            {title}
          </Title>
          {description && <p className="text-lg text-fg-muted">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
      </div>
      {children && <div className="mt-6">{children}</div>}
    </header>
  );
}
