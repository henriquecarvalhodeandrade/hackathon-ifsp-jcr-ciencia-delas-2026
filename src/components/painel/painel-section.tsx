import { CircleAlert } from "lucide-react";
import { Card } from "@/components/ui";
import { cn } from "@/lib/utils";

export interface PainelSectionProps {
  /** id do h2 (a seção é nomeada por ele). */
  titleId: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  icon: React.ReactNode;
  /** Link/ação à direita do título. */
  action?: React.ReactNode;
  /** O bloco não carregou: mostra um aviso calmo no lugar de dados incompletos. */
  failed?: boolean;
  className?: string;
  children?: React.ReactNode;
}

/**
 * Moldura comum dos blocos do /painel: cartão com um h2 que nomeia a região. Cada bloco é
 * independente — se um falhar, os outros continuam.
 */
export function PainelSection({
  titleId,
  title,
  description,
  icon,
  action,
  failed = false,
  className,
  children,
}: PainelSectionProps) {
  return (
    <Card as="section" aria-labelledby={titleId} className={cn("min-w-0", className)}>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 px-5 pt-5 sm:px-6 sm:pt-6">
        <div className="flex min-w-0 items-start gap-3">
          <span
            aria-hidden="true"
            className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-soft-fg [&_svg]:size-[1.125rem]"
          >
            {icon}
          </span>
          <div className="grid min-w-0 gap-1">
            <h2 id={titleId} className="font-display text-xl leading-snug font-semibold text-fg">
              {title}
            </h2>
            {description && <p className="text-sm text-fg-muted">{description}</p>}
          </div>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      <div className="px-5 pt-4 pb-5 sm:px-6 sm:pb-6">
        {failed ? (
          <p className="flex items-start gap-2 rounded-control bg-surface-2 px-3.5 py-3 text-sm text-fg-muted">
            <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-warning" />
            <span>
              Não conseguimos carregar esta parte agora. Recarregue a página em instantes.
            </span>
          </p>
        ) : (
          children
        )}
      </div>
    </Card>
  );
}
