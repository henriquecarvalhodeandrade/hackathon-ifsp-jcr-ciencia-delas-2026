import Link from "next/link";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const cardVariants = cva("relative rounded-card text-fg", {
  variants: {
    variant: {
      /** Superfície padrão: fundo branco/escuro, borda sutil e sombra baixa. */
      default: "border border-border bg-surface shadow-card",
      /** Cartão clicável: eleva no hover. Coloque um link "esticado" com <CardLink>. */
      interactive:
        "border border-border bg-surface shadow-card transition-[box-shadow,border-color,transform] duration-200 ease-out-soft hover:-translate-y-0.5 hover:border-border-strong hover:shadow-raised motion-reduce:hover:translate-y-0",
      /** Só contorno, sem sombra — para agrupar dentro de outras superfícies. */
      outline: "border border-border bg-transparent",
      /** Preenchido sutil — notas, citações, resumos. */
      muted: "bg-surface-2",
    },
    padding: {
      none: "",
      sm: "p-4",
      md: "p-5 sm:p-6",
      lg: "p-6 sm:p-8",
    },
  },
  defaultVariants: { variant: "default", padding: "none" },
});

export interface CardProps extends React.ComponentProps<"div">, VariantProps<typeof cardVariants> {
  /** Renderiza como outro elemento semântico (article, section, li). */
  as?: "div" | "article" | "section" | "li" | "aside";
}

export function Card({ className, variant, padding, as = "div", ...props }: CardProps) {
  const Comp = as as React.ElementType;
  return <Comp className={cn(cardVariants({ variant, padding }), className)} {...props} />;
}

export function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("grid gap-1.5 p-5 pb-0 sm:p-6 sm:pb-0", className)} {...props} />;
}

export interface CardTitleProps extends React.ComponentProps<"h3"> {
  as?: "h2" | "h3" | "h4" | "p";
}

export function CardTitle({ className, as: Comp = "h3", ...props }: CardTitleProps) {
  return (
    <Comp
      className={cn("font-display text-lg leading-snug font-semibold text-fg", className)}
      {...props}
    />
  );
}

export function CardDescription({ className, ...props }: React.ComponentProps<"p">) {
  return <p className={cn("text-sm text-fg-muted", className)} {...props} />;
}

export function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("p-5 sm:p-6", className)} {...props} />;
}

export function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-3 border-t border-border px-5 py-3.5 sm:px-6",
        className,
      )}
      {...props}
    />
  );
}

/**
 * Link "esticado": cobre o ancestral posicionado mais próximo (o Card, ou um `<li className="relative">`
 * de lista) sem aninhar links. O anel de foco é desenhado na própria área esticada — para dentro,
 * então não é cortado por `overflow-hidden` — e funciona fora de cartões também.
 * Outros links/botões dentro da área precisam de `relative z-10` para continuar clicáveis.
 */
export function CardLink({ className, ...props }: React.ComponentProps<typeof Link>) {
  return (
    <Link
      data-card-link=""
      className={cn(
        "after:absolute after:inset-0 after:rounded-card after:content-['']",
        "focus-visible:[outline:none] focus-visible:after:[outline:2px_solid_var(--color-focus)] focus-visible:after:[outline-offset:-2px]",
        className,
      )}
      {...props}
    />
  );
}
