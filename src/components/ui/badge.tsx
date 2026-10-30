import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const badgeVariants = cva(
  "inline-flex max-w-full items-center gap-1 rounded-badge font-semibold whitespace-nowrap [&_svg]:size-3.5",
  {
    variants: {
      variant: {
        neutral: "bg-surface-2 text-fg-muted ring-1 ring-border ring-inset",
        primary: "bg-primary-soft text-primary-soft-fg",
        secondary: "bg-secondary-soft text-secondary-soft-fg",
        accent: "bg-accent-soft text-accent-soft-fg",
        success: "bg-success-soft text-success-soft-fg",
        warning: "bg-warning-soft text-warning-soft-fg",
        danger: "bg-danger-soft text-danger-soft-fg",
        info: "bg-info-soft text-info-soft-fg",
        /** Contorno discreto (ex.: área de pesquisa dentro de cartões). */
        outline: "text-fg-muted ring-1 ring-border-strong ring-inset",
      },
      size: {
        sm: "px-1.5 py-0.5 text-xs",
        md: "px-2 py-0.5 text-[0.8125rem] leading-5",
      },
    },
    defaultVariants: { variant: "neutral", size: "sm" },
  },
);

export type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

export interface BadgeProps
  extends React.ComponentProps<"span">, VariantProps<typeof badgeVariants> {}

/** Rótulo curto de status/categoria. Não é clicável — para filtros use <Chip>. */
export function Badge({ className, variant, size, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant, size }), className)} {...props} />;
}
