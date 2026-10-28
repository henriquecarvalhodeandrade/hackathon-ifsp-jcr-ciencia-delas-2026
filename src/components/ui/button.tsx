import Link from "next/link";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { Spinner } from "./spinner";

export const buttonVariants = cva(
  [
    "relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-control font-semibold",
    "transition-[background-color,color,border-color,box-shadow,transform] duration-150 ease-out-soft",
    "active:translate-y-px disabled:pointer-events-none disabled:opacity-55 aria-disabled:pointer-events-none aria-disabled:opacity-55",
    "aria-busy:cursor-progress aria-busy:disabled:opacity-85 select-none",
  ],
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-fg hover:bg-primary-hover",
        secondary: "bg-secondary text-secondary-fg hover:bg-secondary-hover",
        accent: "bg-accent text-accent-fg hover:bg-accent-hover",
        outline:
          "border border-border-strong bg-surface text-fg hover:border-fg-subtle hover:bg-surface-2",
        ghost: "text-fg-muted hover:bg-surface-2 hover:text-fg",
        danger: "bg-danger text-danger-fg hover:bg-danger-hover",
        link: "h-auto px-0 text-primary underline decoration-1 underline-offset-[0.2em] hover:decoration-2 active:translate-y-0",
      },
      size: {
        sm: "h-8 px-3 text-sm [&_svg]:size-4",
        md: "h-10 px-4 text-[0.9375rem] [&_svg]:size-[1.125rem]",
        lg: "h-12 px-6 text-base [&_svg]:size-5",
        icon: "size-10 p-0 [&_svg]:size-5",
        "icon-sm": "size-8 p-0 [&_svg]:size-4",
      },
      fullWidth: {
        true: "w-full",
      },
    },
    compoundVariants: [{ variant: "link", size: ["sm", "md", "lg"], class: "h-auto px-0" }],
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

export type ButtonVariant = NonNullable<VariantProps<typeof buttonVariants>["variant"]>;
export type ButtonSize = NonNullable<VariantProps<typeof buttonVariants>["size"]>;

export interface ButtonProps
  extends React.ComponentProps<"button">, VariantProps<typeof buttonVariants> {
  /** Mostra o spinner, desabilita o botão e marca aria-busy. */
  loading?: boolean;
  /** Texto alternativo enquanto carrega (ex.: "Salvando…"). */
  loadingText?: string;
}

/**
 * Botão do design system. Para links com cara de botão use <ButtonLink>.
 * Botões só com ícone (size="icon") PRECISAM de aria-label.
 */
export function Button({
  className,
  variant,
  size,
  fullWidth,
  loading = false,
  loadingText,
  disabled,
  children,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(buttonVariants({ variant, size, fullWidth }), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <Spinner decorative size={size === "lg" ? 20 : 16} />}
      {loading && loadingText ? loadingText : children}
    </button>
  );
}

export interface ButtonLinkProps
  extends
    Omit<React.ComponentProps<typeof Link>, "className">,
    VariantProps<typeof buttonVariants> {
  className?: string;
  /** Abre em nova aba com rel seguro (para URLs externas). */
  external?: boolean;
}

/** Link (next/link) com aparência de botão. */
export function ButtonLink({
  className,
  variant,
  size,
  fullWidth,
  external,
  children,
  ...props
}: ButtonLinkProps) {
  const externalProps = external ? { target: "_blank", rel: "noopener noreferrer" } : {};
  return (
    <Link
      className={cn(buttonVariants({ variant, size, fullWidth }), className)}
      {...externalProps}
      {...props}
    >
      {children}
      {external && <span className="sr-only"> (abre em nova aba)</span>}
    </Link>
  );
}
