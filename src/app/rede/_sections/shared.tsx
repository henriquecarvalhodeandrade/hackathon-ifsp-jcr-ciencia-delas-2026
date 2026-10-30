import { Alert } from "@/components/ui";
import { cn, formatDate, formatRelativeTime, toIsoString } from "@/lib/utils";

/** Título de seção de uma aba (h2), com contador opcional. */
export function SectionTitle({
  id,
  children,
  count,
  description,
  compactOnMobile = false,
}: {
  id: string;
  children: React.ReactNode;
  count?: number;
  description?: React.ReactNode;
  /** Abaixo de `sm`, esconde a descrição (a lista sobe para a primeira dobra). */
  compactOnMobile?: boolean;
}) {
  return (
    <div className="grid gap-1">
      {/* tabIndex -1: recebe o foco quando um cartão sai da lista (handOffFocus). */}
      <h2
        id={id}
        tabIndex={-1}
        className="flex items-center gap-2 font-display text-xl font-semibold text-fg"
      >
        {children}
        {count !== undefined && count > 0 && (
          <span className="rounded-pill bg-surface-2 px-2 py-0.5 text-sm font-semibold text-fg-subtle tabular">
            {count}
          </span>
        )}
      </h2>
      {description && (
        <p className={cn("text-sm text-fg-muted", compactOnMobile && "max-sm:hidden")}>
          {description}
        </p>
      )}
    </div>
  );
}

/** "Enviado há 3 dias" com a data completa no title. */
export function TimeAgo({ date, prefix }: { date: string; prefix: string }) {
  return (
    <span>
      {prefix}{" "}
      <time
        dateTime={toIsoString(date)}
        title={formatDate(date, { dateStyle: "long", timeStyle: "short" })}
      >
        {formatRelativeTime(date)}
      </time>
    </span>
  );
}

export function LoadError() {
  return (
    <Alert variant="danger" title="Não conseguimos carregar esta lista agora">
      Recarregue a página em instantes. Se continuar, tente sair e entrar de novo.
    </Alert>
  );
}

/** Linha discreta de "lista vazia" dentro de uma seção (o estado vazio grande fica para a aba inteira). */
export function EmptyLine({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-card border border-dashed border-border-strong px-4 py-3 text-sm text-fg-muted">
      {children}
    </p>
  );
}

/** Grade das listas de pessoas. */
export const PEOPLE_GRID = "grid gap-5 md:grid-cols-2 xl:grid-cols-3";
