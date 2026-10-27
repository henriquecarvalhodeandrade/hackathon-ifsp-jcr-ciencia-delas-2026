"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, PartyPopper } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { saveOnboardingStepAction } from "@/app/onboarding/actions";
import type { AreaGroup } from "@/lib/profile/areas";
import type { ProfileFormValues, ProfileSection } from "@/lib/profile/form-values";
import type { ProfileActionState } from "@/lib/profile/types";
import { cn } from "@/lib/utils";
import { AboutFields } from "./about-fields";
import { MentorshipFields } from "./mentorship-fields";
import { PrivacyFields } from "./privacy-fields";
import { ResearchFields } from "./research-fields";

const STEPS: ReadonlyArray<{ section: ProfileSection; title: string; description: string }> = [
  { section: "sobre", title: "Sobre você", description: "Como você quer se apresentar para a comunidade." },
  {
    section: "pesquisa",
    title: "Sua pesquisa",
    description: "Áreas e palavras-chave ajudam a encontrar mentoras e pesquisadoras com interesses parecidos.",
  },
  { section: "mentoria", title: "Mentoria", description: "Você quer orientação, quer orientar — ou as duas coisas?" },
  {
    section: "privacidade",
    title: "Privacidade e IA",
    description: "Você decide se uma IA pode ajudar a sugerir e explicar mentorias. É opcional.",
  },
];

export interface OnboardingWizardProps {
  initialValues: ProfileFormValues;
  areaGroups: readonly AreaGroup[];
  /** Destino depois de concluir (validado no servidor). */
  next: string | null;
  /** Primeira etapa ainda incompleta (quem volta ao onboarding continua de onde parou). */
  initialStep: number;
}

/**
 * Onboarding em 4 etapas. Cada etapa é salva no servidor ao avançar (nada se perde se a
 * pessoa sair no meio); a última marca o perfil como concluído e redireciona.
 */
export function OnboardingWizard({ initialValues, areaGroups, next, initialStep }: OnboardingWizardProps) {
  const [state, formAction] = useActionState<ProfileActionState, FormData>(saveOnboardingStepAction, null);
  const [step, setStep] = useState(initialStep);
  const [furthest, setFurthest] = useState(initialStep);
  const [saved, setSaved] = useState<ProfileFormValues>(initialValues);
  const [version, setVersion] = useState(0);
  const [seenState, setSeenState] = useState<ProfileActionState>(state);

  // Reage a cada resposta da action durante a renderização (padrão recomendado pelo React,
  // sem efeito): avança de etapa, guarda os valores salvos e remonta os campos.
  if (state !== seenState) {
    setSeenState(state);
    setVersion((v) => v + 1);
    if (state?.ok) {
      setSaved((prev) => ({ ...prev, ...state.values }));
      if (state.nextStep) {
        setStep(state.nextStep);
        setFurthest((f) => Math.max(f, state.nextStep ?? f));
      }
    } else if (state?.goToStep) {
      setStep(state.goToStep);
    }
  }

  const current = STEPS[step - 1]!;
  const isLast = step === STEPS.length;
  const errorHere =
    state !== null && !state.ok && (state.goToStep ? state.goToStep === step : state.section === current.section);
  const values: Partial<ProfileFormValues> =
    errorHere && state && !state.ok && !state.goToStep ? { ...saved, ...state.values } : saved;
  const errors = errorHere && state && !state.ok ? state.fieldErrors : undefined;

  // Leva o foco para o título da etapa ao trocar (não na primeira renderização).
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [step]);

  // Depois de um erro de validação, foca o primeiro campo marcado como inválido.
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (!errors) return;
    formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [errors]);

  return (
    <div className="grid gap-6">
      <nav aria-label="Etapas do cadastro">
        <ol className="grid grid-cols-4 gap-2">
          {STEPS.map((item, index) => {
            const number = index + 1;
            const isCurrent = number === step;
            const isDone = number < furthest && !isCurrent;
            const canVisit = number <= furthest && !isCurrent;
            const content = (
              <>
                <span
                  aria-hidden="true"
                  className={cn(
                    "inline-flex size-8 shrink-0 items-center justify-center rounded-full border text-sm font-bold transition-colors",
                    isCurrent && "border-primary bg-primary text-primary-fg",
                    isDone && "border-secondary bg-secondary-soft text-secondary-soft-fg",
                    !isCurrent && !isDone && "border-border-strong bg-surface text-fg-subtle",
                  )}
                >
                  {isDone ? <Check className="size-4" strokeWidth={3} /> : number}
                </span>
                <span
                  className={cn(
                    "hidden text-left text-sm leading-tight font-semibold sm:block",
                    isCurrent ? "text-fg" : "text-fg-muted",
                  )}
                >
                  {item.title}
                </span>
                <span className="sr-only">
                  {`Etapa ${number}: ${item.title}`}
                  {isDone ? " (concluída)" : ""}
                </span>
              </>
            );
            return (
              <li
                key={item.section}
                aria-current={isCurrent ? "step" : undefined}
                className={cn("border-t-2 pt-2", number <= furthest ? "border-primary" : "border-border")}
              >
                {canVisit ? (
                  <button
                    type="button"
                    onClick={() => setStep(number)}
                    className="flex w-full flex-col items-center gap-2 rounded-control p-1 hover:bg-surface-2 sm:flex-row sm:items-center"
                  >
                    {content}
                  </button>
                ) : (
                  <span className="flex w-full flex-col items-center gap-2 p-1 sm:flex-row sm:items-center">{content}</span>
                )}
              </li>
            );
          })}
        </ol>
      </nav>

      <section
        aria-labelledby="etapa-titulo"
        className="rounded-dialog border border-border bg-surface p-5 shadow-card sm:p-8"
      >
        <header className="mb-6 grid gap-1.5">
          <p className="eyebrow text-primary">
            Etapa {step} de {STEPS.length}
          </p>
          <h2
            id="etapa-titulo"
            ref={headingRef}
            tabIndex={-1}
            className="font-display text-2xl font-semibold text-fg outline-none"
          >
            {current.title}
          </h2>
          <p className="text-fg-muted">{current.description}</p>
        </header>

        <form ref={formRef} action={formAction} noValidate className="grid gap-6">
          <input type="hidden" name="step" value={step} />
          {isLast && next && <input type="hidden" name="next" value={next} />}

          <FormMessage tone="error">{errorHere && state && !state.ok ? state.error : null}</FormMessage>

          <div key={`${current.section}-${version}`}>
            {current.section === "sobre" && <AboutFields values={values} errors={errors} />}
            {current.section === "pesquisa" && (
              <ResearchFields values={values} errors={errors} areaGroups={areaGroups} />
            )}
            {current.section === "mentoria" && <MentorshipFields values={values} errors={errors} />}
            {current.section === "privacidade" && <PrivacyFields values={values} errors={errors} />}
          </div>

          <div className="flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
            {step > 1 ? (
              <Button variant="ghost" onClick={() => setStep(step - 1)}>
                <ArrowLeft aria-hidden="true" />
                Voltar
              </Button>
            ) : (
              <p className="text-sm text-fg-subtle">Campos com * são obrigatórios.</p>
            )}
            {isLast ? (
              <SubmitButton size="lg" pendingText="Concluindo…">
                <PartyPopper aria-hidden="true" />
                Concluir cadastro
              </SubmitButton>
            ) : (
              <SubmitButton size="lg" pendingText="Salvando…">
                Salvar e continuar
                <ArrowRight aria-hidden="true" />
              </SubmitButton>
            )}
          </div>
        </form>
      </section>
    </div>
  );
}
