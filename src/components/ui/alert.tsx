import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

export type AlertVariant = "info" | "success" | "warning" | "danger";

const variantClasses: Record<AlertVariant, { box: string; icon: string }> = {
  info: { box: "bg-info-soft text-info-soft-fg border-info/25", icon: "text-info" },
  success: { box: "bg-success-soft text-success-soft-fg border-success/25", icon: "text-success" },
  warning: { box: "bg-warning-soft text-warning-soft-fg border-warning/30", icon: "text-warning" },
  danger: { box: "bg-danger-soft text-danger-soft-fg border-danger/25", icon: "text-danger" },
};

const defaultIcons = {
  info: Info,
  success: CircleCheck,
  warning: TriangleAlert,
  danger: CircleAlert,
} as const;

export interface AlertProps extends Omit<React.ComponentProps<"div">, "title"> {
  variant?: AlertVariant;
  title?: React.ReactNode;
  /** Substitui o ícone padrão; passe `null` para nenhum. */
  icon?: React.ReactNode | null;
  /** Ações (links/botões) no rodapé do alerta. */
  actions?: React.ReactNode;
  /**
   * Use `true` só para mensagens que surgem após uma ação (vira role="alert"/"status").
   * Alertas que já vêm na página não devem interromper o leitor de tela.
   */
  live?: boolean;
}

/** Mensagem destacada em linha (informação, sucesso, atenção, erro). */
export function Alert({
  variant = "info",
  title,
  icon,
  actions,
  live = false,
  className,
  children,
  ...props
}: AlertProps) {
  const Icon = defaultIcons[variant];
  const styles = variantClasses[variant];
  const role = live ? (variant === "danger" || variant === "warning" ? "alert" : "status") : undefined;
  return (
    <div role={role} className={cn("flex gap-3 rounded-card border p-4 text-sm", styles.box, className)} {...props}>
      {icon !== null && (
        <span aria-hidden="true" className={cn("mt-0.5 shrink-0 [&_svg]:size-5", styles.icon)}>
          {icon ?? <Icon />}
        </span>
      )}
      <div className="grid min-w-0 flex-1 gap-1">
        {title && <p className="font-semibold leading-snug">{title}</p>}
        {children && <div className="leading-relaxed [&_a]:font-semibold [&_a]:underline [&_a]:underline-offset-2">{children}</div>}
        {actions && <div className="mt-2 flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
}
