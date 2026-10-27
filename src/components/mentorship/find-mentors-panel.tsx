"use client";

import { useActionState } from "react";
import { RefreshCw, Sparkles } from "lucide-react";
import { Alert, FormMessage, SkeletonCard, SubmitButton } from "@/components/ui";
import { findMentorsAction } from "@/app/mentoria/actions";
import type { FindMentorsState } from "@/lib/mentorship/types";
import { cn, pluralize } from "@/lib/utils";

export interface FindMentorsPanelProps {
  hasSuggestions: boolean;
  /** Texto curto sobre a última geração (ex.: "Sugestões de há 2 horas"). */
  summary?: React.ReactNode;
  /** Lista de cartões já renderizada no servidor. */
  children?: React.ReactNode;
}

function resultMessage(state: Exclude<FindMentorsState, null>): string {
  if (!state.ok) return state.error;
  if (state.count === 0) {
    return "Não encontramos mentoras com vagas abertas agora. Tente ampliar suas áreas e temas no perfil ou explore o diretório.";
  }
  return `Encontramos ${pluralize(state.count, "sugestão", "sugestões")} para você.`;
}

/**
 * Botão "Encontrar mentoras" (Server Action) + estado de carregamento "Analisando perfis…".
 * Enquanto analisa, a lista anterior continua visível (esmaecida) ou aparecem esqueletos.
 */
export function FindMentorsPanel({ hasSuggestions, summary, children }: FindMentorsPanelProps) {
  const [state, formAction, pending] = useActionState<FindMentorsState, FormData>(findMentorsAction, null);

  return (
    <div className="grid gap-6">
      <div className="flex flex-col gap-4 rounded-card border border-border bg-surface p-5 shadow-card sm:flex-row sm:items-center sm:justify-between">
        <div className="grid gap-1">
          <h2 className="font-display text-xl font-semibold text-fg">
            {hasSuggestions ? "Mentoras que combinam com você" : "Vamos encontrar mentoras para você?"}
          </h2>
          <p className="text-sm text-fg-muted">
            {summary ??
              "Comparamos suas áreas, temas de interesse e etapa da carreira com as mentoras que têm vagas abertas."}
          </p>
        </div>
        <form action={formAction} className="shrink-0">
          <SubmitButton pendingText="Analisando perfis…" variant={hasSuggestions ? "outline" : "primary"}>
            {hasSuggestions ? <RefreshCw aria-hidden="true" /> : <Sparkles aria-hidden="true" />}
            {hasSuggestions ? "Atualizar sugestões" : "Encontrar mentoras"}
          </SubmitButton>
        </form>
      </div>

      <div aria-live="polite" className="sr-only">
        {pending ? "Analisando perfis. Isso pode levar alguns segundos." : ""}
      </div>
      <FormMessage tone={state?.ok ? "success" : "error"}>{state && !pending ? resultMessage(state) : null}</FormMessage>
      {state?.ok && !pending && state.warnings.length > 0 && (
        <Alert variant="info" title="Sobre estas sugestões">
          <ul className="grid gap-1">
            {state.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </Alert>
      )}

      {pending && !hasSuggestions ? (
        <div aria-hidden="true" className="grid gap-5 lg:grid-cols-2">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : (
        <div
          aria-busy={pending || undefined}
          className={cn("transition-opacity duration-200", pending && "pointer-events-none opacity-60")}
        >
          {children}
        </div>
      )}
    </div>
  );
}
