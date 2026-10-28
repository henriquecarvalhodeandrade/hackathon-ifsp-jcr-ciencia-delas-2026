import Link from "next/link";
import { Check } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const chipVariants = cva(
  "inline-flex max-w-full items-center gap-1.5 rounded-pill font-medium whitespace-nowrap [&_svg]:size-3.5",
  {
    variants: {
      variant: {
        neutral: "bg-surface-2 text-fg-muted",
        primary: "bg-primary-soft text-primary-soft-fg",
        secondary: "bg-secondary-soft text-secondary-soft-fg",
        accent: "bg-accent-soft text-accent-soft-fg",
        outline: "border border-border-strong text-fg-muted",
      },
      size: {
        sm: "h-7 px-2.5 text-xs",
        md: "h-8 px-3 text-sm",
      },
    },
    defaultVariants: { variant: "neutral", size: "md" },
  },
);

export interface ChipProps extends React.ComponentProps<"span">, VariantProps<typeof chipVariants> {
  icon?: React.ReactNode;
}

/** Tag estática (palavra-chave, tópico). Para filtros clicáveis use <ChipLink> ou <ChipToggle>. */
export function Chip({ className, variant, size, icon, children, ...props }: ChipProps) {
  return (
    <span className={cn(chipVariants({ variant, size }), className)} {...props}>
      {icon}
      <span className="truncate">{children}</span>
    </span>
  );
}

const interactiveChip = cn(
  "inline-flex h-8 max-w-full cursor-pointer items-center gap-1.5 rounded-pill border px-3 text-sm font-medium whitespace-nowrap select-none",
  "transition-colors duration-150 [&_svg]:size-3.5",
);

export interface ChipLinkProps extends React.ComponentProps<typeof Link> {
  /** Filtro ativo (marca aria-current e destaca). */
  active?: boolean;
  icon?: React.ReactNode;
  count?: number;
}

/** Chip-filtro baseado em link (funciona em Server Components; filtros via searchParams). */
export function ChipLink({ active, icon, count, className, children, ...props }: ChipLinkProps) {
  return (
    <Link
      aria-current={active ? "true" : undefined}
      className={cn(
        interactiveChip,
        active
          ? "border-primary bg-primary text-primary-fg hover:bg-primary-hover"
          : "border-border-strong bg-surface text-fg hover:border-fg-subtle hover:bg-surface-2",
        className,
      )}
      {...props}
    >
      {icon}
      <span className="truncate">{children}</span>
      {count !== undefined && (
        <span className={cn("text-xs tabular", active ? "text-primary-fg/85" : "text-fg-subtle")}>
          {count}
        </span>
      )}
    </Link>
  );
}

export interface ChipToggleProps extends Omit<React.ComponentProps<"input">, "type" | "size"> {
  label: React.ReactNode;
  icon?: React.ReactNode;
}

/**
 * Chip selecionável = checkbox nativo com cara de chip. Envia `name=value` no formulário quando marcado.
 * Funciona sem JavaScript; para limite de seleção use <ChipGroup>.
 */
export function ChipToggle({ label, icon, className, ...props }: ChipToggleProps) {
  return (
    <label
      className={cn(
        interactiveChip,
        "border-border-strong bg-surface text-fg hover:border-fg-subtle hover:bg-surface-2",
        "has-checked:border-primary has-checked:bg-primary-soft has-checked:text-primary-soft-fg has-checked:hover:bg-primary-soft",
        "has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus",
        "has-aria-invalid:border-danger",
        "has-disabled:cursor-not-allowed has-disabled:opacity-50 has-disabled:hover:bg-surface",
        className,
      )}
    >
      <input type="checkbox" className="peer sr-only" {...props} />
      <Check aria-hidden="true" strokeWidth={3} className="hidden peer-checked:block" />
      {icon && <span className="peer-checked:hidden">{icon}</span>}
      <span className="truncate">{label}</span>
    </label>
  );
}
