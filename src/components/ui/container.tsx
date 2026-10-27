import { useId } from "react";
import { cn } from "@/lib/utils";

const widths = {
  /** Leitura confortável (posts, artigos, formulários longos). */
  narrow: "max-w-3xl",
  /** Padrão das páginas. */
  default: "max-w-6xl",
  /** Painéis e grades largas. */
  wide: "max-w-7xl",
} as const;

export interface ContainerProps extends React.ComponentProps<"div"> {
  size?: keyof typeof widths;
}

/** Largura máxima + respiro lateral (16px no celular). Use dentro do <main> do layout. */
export function Container({ size = "default", className, ...props }: ContainerProps) {
  return <div className={cn("mx-auto w-full px-4 sm:px-6 lg:px-8", widths[size], className)} {...props} />;
}

export interface SectionProps extends Omit<React.ComponentProps<"section">, "title"> {
  /** Título da seção (vira h2 e nomeia a região). */
  title?: React.ReactNode;
  description?: React.ReactNode;
  /** Link/botão alinhado à direita do título (ex.: "Ver todos"). */
  action?: React.ReactNode;
  /** Espaçamento vertical. */
  spacing?: "sm" | "md" | "lg";
  /** Id do título — útil para âncoras. */
  titleId?: string;
}

const spacingClasses = { sm: "py-6 sm:py-8", md: "py-10 sm:py-14", lg: "py-14 sm:py-20" } as const;

/** Bloco de página com cabeçalho opcional. Não inclui Container — combine os dois. */
export function Section({
  title,
  description,
  action,
  spacing = "md",
  titleId,
  className,
  children,
  ...props
}: SectionProps) {
  const autoId = useId();
  const headingId = titleId ?? `secao-${autoId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  return (
    <section aria-labelledby={title ? headingId : undefined} className={cn(spacingClasses[spacing], className)} {...props}>
      {(title || action) && (
        <div className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <div className="grid max-w-2xl gap-1.5">
            {title && (
              <h2 id={headingId} className="font-display text-2xl font-semibold text-fg sm:text-3xl">
                {title}
              </h2>
            )}
            {description && <p className="text-fg-muted">{description}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      {children}
    </section>
  );
}
