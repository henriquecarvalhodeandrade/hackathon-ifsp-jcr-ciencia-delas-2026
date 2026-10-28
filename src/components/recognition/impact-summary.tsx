import { FileCheck2, HeartHandshake, MessageSquareText, ShieldCheck } from "lucide-react";
import { Alert, Badge, Container, ProgressMeter, Stat, StatGroup } from "@/components/ui";
import { isSupabaseConfigured } from "@/lib/env";
import {
  CELL_MIN,
  SUPPRESSED_LABEL,
  formatAverage,
  missingForResults,
  outcomeValueLabel,
  pendingForNextBlock,
  type ImpactData,
} from "@/lib/recognition/impact";
import { loadImpact } from "@/lib/recognition/queries";
import { cn, pluralize } from "@/lib/utils";

/**
 * "O que mudou para quem concluiu uma mentoria" — impacto agregado e honesto (público).
 * Só números gerais: nada aparece por opção antes de 5 retornos de mentorandas, e opções com
 * menos de 3 marcações viram "menos de 3". Rotulado "Dados de demonstração" enquanto existirem
 * as contas fictícias do seed.
 *
 * `variant="section"` (padrão, para a landing) traz o próprio Container e respiro;
 * `variant="embedded"` encaixa numa página que já tem Container.
 */
export async function ImpactSummary({
  variant = "section",
  headingLevel: Heading = "h2",
  className,
}: {
  variant?: "section" | "embedded";
  headingLevel?: "h2" | "h3";
  className?: string;
}) {
  if (!isSupabaseConfigured()) return null;
  const data = await loadImpact();
  if (!data) return null;

  const content = <ImpactContent data={data} Heading={Heading} compact={variant === "embedded"} />;
  if (variant === "embedded") {
    return (
      <section aria-labelledby="impacto-titulo" className={cn("grid gap-5", className)}>
        {content}
      </section>
    );
  }
  return (
    <section aria-labelledby="impacto-titulo" className={cn("py-14 sm:py-16", className)}>
      <Container className="grid gap-6">{content}</Container>
    </section>
  );
}

function ImpactContent({
  data,
  Heading,
  compact,
}: {
  data: ImpactData;
  Heading: "h2" | "h3";
  /** Dentro de outra página: título um pouco menor. */
  compact: boolean;
}) {
  const missing = missingForResults(data);
  const pending = pendingForNextBlock(data);
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="grid max-w-2xl gap-2">
          <p className="eyebrow text-primary">Impacto da mentoria</p>
          <Heading
            id="impacto-titulo"
            className={cn(
              "font-display font-semibold text-fg",
              compact || Heading === "h3" ? "text-2xl sm:text-3xl" : "text-3xl sm:text-4xl",
            )}
          >
            O que mudou para quem concluiu uma mentoria
          </Heading>
          <p className="text-fg-muted">
            Ao concluir, cada participante pode deixar um retorno privado. Aqui aparecem só os
            números gerais — nunca respostas individuais.
          </p>
        </div>
        {data.isDemo && (
          <Badge variant="accent" size="md">
            Dados de demonstração
          </Badge>
        )}
      </div>

      <StatGroup className="md:grid-cols-3">
        <Stat
          label="mentorias concluídas"
          value={data.completed}
          icon={<HeartHandshake aria-hidden="true" />}
        />
        <Stat
          label="retornos de mentorandas"
          value={data.menteeFeedback}
          icon={<MessageSquareText aria-hidden="true" />}
        />
        <Stat
          label="declarações emitidas"
          value={data.declarationsIssued}
          icon={<FileCheck2 aria-hidden="true" />}
          className="col-span-2 md:col-span-1"
        />
      </StatGroup>

      {data.allowed ? (
        <div className="grid gap-5 rounded-card border border-border bg-surface p-5 shadow-card sm:p-6">
          <div className="grid gap-1">
            <p className="font-display text-lg font-semibold text-fg">
              Entre as {data.publishedFeedback} mentorandas que responderam
            </p>
            {data.helpfulnessAvg !== null && (
              <p className="text-sm text-fg-muted">
                Em média, deram nota{" "}
                <strong className="font-semibold text-fg">
                  {formatAverage(data.helpfulnessAvg)} de 5
                </strong>{" "}
                para quanto a mentoria ajudou.
              </p>
            )}
            {pending > 0 && (
              <p className="text-sm text-fg-muted">
                {pending === 1
                  ? "O retorno mais recente entra"
                  : `Os ${pending} retornos mais recentes entram`}{" "}
                na conta quando o próximo bloco de {data.kMin} se completar.
              </p>
            )}
          </div>
          <ul className="grid gap-4 md:grid-cols-2 md:gap-x-8">
            {data.outcomes.map((outcome) =>
              outcome.percent === null ? (
                <li key={outcome.slug} className="grid gap-1.5">
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="font-medium text-fg">{outcome.label}</span>
                    <span className="shrink-0 font-semibold text-fg-muted">{SUPPRESSED_LABEL}</span>
                  </div>
                  <div
                    aria-hidden="true"
                    className="h-2.5 rounded-pill border border-dashed border-border-strong"
                  />
                </li>
              ) : (
                <li key={outcome.slug}>
                  <ProgressMeter
                    value={outcome.percent}
                    label={outcome.label}
                    valueLabel={outcomeValueLabel(outcome, data.publishedFeedback)}
                    tone="secondary"
                    className="[&_.tabular]:whitespace-nowrap"
                  />
                </li>
              ),
            )}
          </ul>
        </div>
      ) : (
        <Alert variant="info" icon={<ShieldCheck />}>
          Para proteger quem respondeu, só mostramos os resultados a partir de {data.kMin} retornos.{" "}
          {missing > 0 &&
            `Ainda ${missing === 1 ? "falta" : "faltam"} ${pluralize(missing, "retorno", "retornos")}.`}
        </Alert>
      )}

      <details className="group rounded-control border border-border bg-surface">
        <summary className="cursor-pointer rounded-control px-4 py-3 text-sm font-semibold text-fg-muted hover:text-fg">
          Como calculamos
        </summary>
        <div className="grid gap-2 border-t border-border px-4 py-3 text-sm text-fg-muted">
          <p>
            Contamos as mentorias concluídas na plataforma e os retornos que as mentorandas deixam
            ao concluir — eles são opcionais e privados. Cada barra mostra a parte de quem respondeu
            que marcou aquela opção, não de todas as participantes.
          </p>
          <p>
            Nada aparece antes de {data.kMin} retornos, e opções marcadas por menos de {CELL_MIN}{" "}
            pessoas aparecem como “{SUPPRESSED_LABEL}”, para que ninguém possa ser identificada.
            Notas e comentários individuais nunca são publicados.
          </p>
          <p>
            Os resultados são atualizados em blocos de {data.kMin} retornos. Assim, ninguém consegue
            descobrir a resposta de uma pessoa comparando os números de antes e de depois que ela
            respondeu.
          </p>
          {data.isDemo && (
            <p>
              Enquanto as contas fictícias de demonstração existirem, estes números incluem os dados
              delas.
            </p>
          )}
        </div>
      </details>
    </>
  );
}
