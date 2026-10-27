import type { ReactionCounts } from "@/lib/forum/types";
import { cn, formatNumber, pluralize } from "@/lib/utils";
import { REACTIONS } from "./reaction-icons";

/** Resumo compacto das reações (listas). Não renderiza nada sem reações. */
export function ReactionSummary({ counts, className }: { counts: ReactionCounts; className?: string }) {
  const present = REACTIONS.filter((r) => counts[r.kind] > 0);
  if (present.length === 0) return null;
  return (
    <p className={cn("inline-flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-fg-subtle", className)}>
      <span className="sr-only">Reações: </span>
      {present.map(({ kind, label, Icon }) => (
        <span key={kind} className="inline-flex items-center gap-1" title={label}>
          <Icon aria-hidden="true" className="size-3.5" />
          <span aria-hidden="true" className="tabular font-semibold">
            {formatNumber(counts[kind])}
          </span>
          <span className="sr-only">
            {pluralize(counts[kind], "reação", "reações")} de {label.toLocaleLowerCase("pt-BR")};
          </span>
        </span>
      ))}
    </p>
  );
}
