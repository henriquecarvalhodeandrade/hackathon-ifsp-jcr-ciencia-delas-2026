import { Sparkles } from "lucide-react";
import { Badge } from "@/components/ui";

export interface PlainSummaryProps {
  summary: string;
  source: string | null;
  headingId?: string;
}

/** Resumo em linguagem simples, com selo e aviso obrigatórios quando foi gerado por IA. */
export function PlainSummary({
  summary,
  source,
  headingId = "resumo-acessivel",
}: PlainSummaryProps) {
  const fromAi = source === "ai";
  return (
    <section
      aria-labelledby={headingId}
      className="grid gap-3 rounded-card bg-surface-2 p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h2 id={headingId} className="font-display text-xl font-semibold text-fg">
          Resumo acessível
        </h2>
        {fromAi ? (
          <Badge variant="info">
            <Sparkles aria-hidden="true" />
            Gerado com IA
          </Badge>
        ) : (
          <Badge variant="neutral">Escrito por quem enviou</Badge>
        )}
      </div>
      <p className="font-serif text-lg leading-relaxed whitespace-pre-line text-fg">{summary}</p>
      {fromAi && (
        <p className="text-sm text-fg-muted">
          Este resumo foi gerado com inteligência artificial a partir do título e do abstract. Ele
          pode simplificar demais ou conter imprecisões — na dúvida, vale o texto original.
        </p>
      )}
    </section>
  );
}
