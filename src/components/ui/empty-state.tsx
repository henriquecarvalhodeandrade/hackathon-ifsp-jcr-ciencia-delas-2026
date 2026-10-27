import { Telescope } from "lucide-react";
import { cn } from "@/lib/utils";

export interface EmptyStateProps extends Omit<React.ComponentProps<"div">, "title"> {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Ícone lucide no centro da órbita (padrão: telescópio). */
  icon?: React.ReactNode;
  /** Botões/links de ação. */
  action?: React.ReactNode;
  /** compact = sem moldura, para dentro de cartões. */
  variant?: "default" | "compact";
  /** Nível do título (padrão h2). */
  headingLevel?: "h2" | "h3" | "h4" | "p";
}

/** Ilustração: órbita tracejada, pequena constelação e uma estrela âmbar. */
function EmptyIllustration({ icon }: { icon: React.ReactNode }) {
  return (
    <div className="relative mx-auto h-28 w-40" aria-hidden="true">
      <svg viewBox="0 0 160 112" fill="none" className="absolute inset-0 size-full text-primary">
        <ellipse
          cx="80"
          cy="56"
          rx="66"
          ry="30"
          stroke="currentColor"
          strokeOpacity="0.35"
          strokeDasharray="2 6"
          strokeLinecap="round"
          transform="rotate(-12 80 56)"
        />
        <path d="M16 30 L34 18 L52 26" stroke="currentColor" strokeOpacity="0.45" strokeLinecap="round" />
        <path d="M118 94 L134 82 L148 88" stroke="currentColor" strokeOpacity="0.45" strokeLinecap="round" />
        <g fill="currentColor">
          <circle cx="16" cy="30" r="2.5" fillOpacity="0.6" />
          <circle cx="34" cy="18" r="3" fillOpacity="0.75" />
          <circle cx="52" cy="26" r="2" fillOpacity="0.5" />
          <circle cx="118" cy="94" r="2" fillOpacity="0.5" />
          <circle cx="148" cy="88" r="2.5" fillOpacity="0.6" />
          <circle cx="104" cy="12" r="1.5" fillOpacity="0.4" />
          <circle cx="22" cy="86" r="1.5" fillOpacity="0.4" />
        </g>
        <circle cx="134" cy="82" r="4.5" fill="var(--color-accent)" />
      </svg>
      <div className="absolute top-1/2 left-1/2 flex size-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-surface text-primary shadow-card [&_svg]:size-6">
        {icon}
      </div>
    </div>
  );
}

/** Estado vazio acolhedor: diga o que falta e qual o próximo passo. */
export function EmptyState({
  title,
  description,
  icon = <Telescope />,
  action,
  variant = "default",
  headingLevel = "h2",
  className,
  ...props
}: EmptyStateProps) {
  const Heading = headingLevel;
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center px-6 text-center",
        variant === "default" ? "rounded-card border border-dashed border-border-strong bg-surface py-12" : "py-8",
        className,
      )}
      {...props}
    >
      <EmptyIllustration icon={icon} />
      <Heading className="mt-4 font-display text-xl font-semibold text-balance text-fg">{title}</Heading>
      {description && <p className="mt-2 max-w-md text-[0.9375rem] text-fg-muted">{description}</p>}
      {action && <div className="mt-6 flex flex-wrap justify-center gap-3">{action}</div>}
    </div>
  );
}
