import { useId } from "react";
import { Star } from "lucide-react";
import { cn, formatNumber } from "@/lib/utils";
import { Spinner } from "./spinner";

export interface VoteButtonProps extends Omit<
  React.ComponentProps<"button">,
  "children" | "aria-pressed"
> {
  /** Você já destacou este paper? Vira `aria-pressed`. */
  pressed: boolean;
  /** Total de destaques (vote_count). */
  count: number;
  /**
   * Nome acessível FIXO do botão. O estado (destacado ou não) é anunciado pelo aria-pressed —
   * não troque o texto ao alternar ("Destacar" → "Remover destaque" confunde o leitor de tela).
   */
  label?: string;
  /** vertical = estrela com o número embaixo (cartões da Vitrine) · horizontal = pílula compacta. */
  layout?: "vertical" | "horizontal";
  /** Enquanto a action roda (useFormStatus/useTransition/useOptimistic no componente da feature). */
  pending?: boolean;
}

const base =
  "inline-flex items-center justify-center border font-semibold transition-colors duration-150 select-none disabled:cursor-not-allowed disabled:opacity-55 aria-busy:cursor-progress [&_svg]:size-5";
const idle =
  "border-border-strong bg-surface text-fg-muted hover:border-accent-strong hover:text-accent-strong";
const on =
  "border-accent-strong bg-accent-soft text-accent-soft-fg hover:bg-accent-soft [&_svg]:text-accent-strong";

/**
 * Botão de destaque (voto) da Vitrine — um toggle com `aria-pressed`. Não é cliente: use dentro de um
 * <form action={serverAction}> com `type="submit"`, ou controle `pressed`/`count` num Client Component
 * com useOptimistic. Já vem com `relative z-10` para funcionar dentro de cartões com <CardLink>.
 */
export function VoteButton({
  pressed,
  count,
  label = "Destacar",
  layout = "vertical",
  pending = false,
  disabled,
  type = "button",
  className,
  ...props
}: VoteButtonProps) {
  const countId = `destaques-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const unit = count === 1 ? "destaque" : "destaques";
  const icon = pending ? (
    <Spinner decorative size={18} />
  ) : (
    <Star aria-hidden="true" className={cn(pressed && "fill-accent")} />
  );

  if (layout === "horizontal") {
    return (
      <button
        type={type}
        aria-pressed={pressed}
        aria-busy={pending || undefined}
        disabled={disabled || pending}
        className={cn(
          base,
          "relative z-10 h-9 gap-1.5 rounded-pill px-3 text-sm",
          pressed ? on : idle,
          className,
        )}
        {...props}
      >
        {icon}
        <span className="sr-only">{label}, </span>
        <span className="tabular">{formatNumber(count)}</span>
        <span className="sr-only"> {unit}</span>
      </button>
    );
  }

  return (
    <span
      className={cn("relative z-10 inline-flex shrink-0 flex-col items-center gap-1", className)}
    >
      <button
        type={type}
        aria-pressed={pressed}
        aria-label={label}
        aria-describedby={countId}
        aria-busy={pending || undefined}
        disabled={disabled || pending}
        className={cn(base, "size-10 rounded-control", pressed ? on : idle)}
        {...props}
      >
        {icon}
      </button>
      <span id={countId} className="text-sm font-bold text-fg tabular">
        {formatNumber(count)}
        <span className="sr-only"> {unit}</span>
      </span>
    </span>
  );
}
