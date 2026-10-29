import Link from "next/link";
import { ArrowRight, Check, Footprints, LockKeyhole, Sparkles } from "lucide-react";
import { ButtonLink, ProgressMeter } from "@/components/ui";
import { ALL_DONE_MESSAGE, type NextStep, type NextStepsResult } from "@/lib/painel/next-steps";
import { cn, formatNumber } from "@/lib/utils";
import { PainelSection } from "./painel-section";

type StepState = "done" | "current" | "pending" | "locked";

function stateOf(step: NextStep, index: number, currentIndex: number): StepState {
  if (step.done) return "done";
  if (step.href === null) return "locked";
  return index === currentIndex ? "current" : "pending";
}

const STATE_LABEL: Record<StepState, string> = {
  done: "Concluído",
  current: "Próximo passo",
  pending: "Pendente",
  locked: "Disponível depois",
};

function StepMarker({ state, number }: { state: StepState; number: number }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative z-10 inline-flex size-8 shrink-0 items-center justify-center rounded-full font-display text-sm font-bold tabular ring-4 ring-surface [&_svg]:size-4",
        state === "done" && "bg-success-soft text-success-soft-fg",
        state === "current" && "bg-primary text-primary-fg",
        state === "pending" && "border border-border-strong bg-surface text-fg-muted",
        state === "locked" && "border border-dashed border-border-strong bg-surface text-fg-muted",
      )}
    >
      {state === "done" ? <Check strokeWidth={3} /> : state === "locked" ? <LockKeyhole /> : number}
    </span>
  );
}

function StepItem({
  step,
  index,
  state,
  isLast,
}: {
  step: NextStep;
  index: number;
  state: StepState;
  isLast: boolean;
}) {
  const current = state === "current";
  return (
    <li
      aria-current={current ? "step" : undefined}
      className={cn(
        "relative grid grid-cols-[2rem_minmax(0,1fr)] gap-x-3.5 pb-5 last:pb-0",
        current && "pb-6",
      )}
    >
      {!isLast && (
        <span
          aria-hidden="true"
          className={cn(
            "absolute top-8 bottom-0 left-4 -translate-x-1/2 border-l",
            state === "done" ? "border-success/40" : "border-dashed border-border-strong",
          )}
        />
      )}
      <StepMarker state={state} number={index + 1} />
      <div
        className={cn(
          "grid min-w-0 gap-1",
          current && "rounded-control bg-primary-soft/45 p-3.5 ring-1 ring-primary/25 sm:p-4",
          !current && "pt-1",
        )}
      >
        <h3
          className={cn(
            "font-display leading-snug font-semibold text-balance",
            current ? "text-lg text-fg" : "text-base",
            state === "done" ? "text-fg-muted" : "text-fg",
          )}
        >
          <span className="sr-only">{STATE_LABEL[state]}: </span>
          {state === "pending" && step.href ? (
            <Link
              href={step.href}
              className="rounded-control underline-offset-4 hover:text-primary hover:underline"
            >
              {step.title}
            </Link>
          ) : (
            step.title
          )}
        </h3>
        {/* No celular, passos feitos ficam só com o título: a lista encurta e o que falta sobe. */}
        <p
          className={cn(
            "text-sm",
            state === "done" ? "text-fg-subtle max-sm:hidden" : "text-fg-muted",
          )}
        >
          {step.description}
        </p>
        {current && step.href && (
          <div className="mt-2">
            <ButtonLink href={step.href} size="sm">
              {step.cta}
              <ArrowRight aria-hidden="true" />
            </ButtonLink>
          </div>
        )}
      </div>
    </li>
  );
}

export interface NextStepsCardProps {
  result: NextStepsResult;
  failed?: boolean;
}

/** "Seus próximos passos": progresso + lista ordenada; só o passo da vez ganha botão. */
export function NextStepsCard({ result, failed = false }: NextStepsCardProps) {
  const total = result.steps.length;
  const percent = total === 0 ? 100 : (result.doneCount / total) * 100;
  const valueLabel = `${formatNumber(result.doneCount)} de ${formatNumber(total)}`;

  return (
    <PainelSection
      titleId="painel-passos"
      title="Seus próximos passos"
      icon={<Footprints />}
      failed={failed}
    >
      <div className="grid gap-5">
        <ProgressMeter
          value={percent}
          label="Seu caminho na Artemis"
          valueLabel={valueLabel}
          tone="secondary"
        />

        {result.allDone && (
          <p className="flex items-start gap-2.5 rounded-control bg-success-soft px-3.5 py-3 text-sm font-medium text-success-soft-fg">
            <Sparkles aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <span>{ALL_DONE_MESSAGE}</span>
          </p>
        )}

        <ol className="grid">
          {result.steps.map((step, index) => (
            <StepItem
              key={step.id}
              step={step}
              index={index}
              state={stateOf(step, index, result.currentIndex)}
              isLast={index === total - 1}
            />
          ))}
        </ol>
      </div>
    </PainelSection>
  );
}
