import { cn } from "@/lib/utils";

export interface SpinnerProps extends React.ComponentProps<"span"> {
  /** Tamanho em px (padrão 16). */
  size?: number;
  /** Texto para leitores de tela. Ignorado quando `decorative`. */
  label?: string;
  /** Use dentro de botões/elementos que já anunciam o estado (aria-busy). */
  decorative?: boolean;
}

/** Indicador de carregamento — uma órbita girando. Herda a cor do texto. */
export function Spinner({ size = 16, label = "Carregando", decorative = false, className, ...props }: SpinnerProps) {
  return (
    <span
      role={decorative ? undefined : "status"}
      aria-hidden={decorative || undefined}
      className={cn("inline-flex shrink-0 items-center justify-center", className)}
      {...props}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        className="animate-spin [animation-duration:900ms] motion-reduce:animate-none"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.22" strokeWidth="2.5" />
        <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="21" cy="12" r="1.9" fill="currentColor" />
      </svg>
      {!decorative && <span className="sr-only">{label}</span>}
    </span>
  );
}
