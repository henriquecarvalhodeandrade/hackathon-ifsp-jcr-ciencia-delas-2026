"use client";

import { useActionState } from "react";
import { RefreshCw, Sparkles } from "lucide-react";
import { Alert, FormMessage, SkeletonCard, SubmitButton } from "@/components/ui";
import { findMentorsAction } from "@/app/mentoria/actions";
import type { FindMentorsState } from "@/lib/mentorship/types";
import { cn, pluralize } from "@/lib/utils";

export interface FindMentorsPanelProps {
  hasSuggestions: boolean;
  /**
   * "heuristic": só regras da plataforma (sem consentimento de IA — nada sai do servidor);
   * "ai": com consentimento, a IA refina a ordem e explica quando está disponível.
   */
  mode: "ai" | "heuristic";
  /** Texto curto sobre a última geração (ex.: "Sugestões de há 2 horas"). */
  summary?: React.ReactNode;
  /** Conteúdo entre o botão e a lista (ex.: o cartão "Ativar sugestões com IA"). */
  aside?: React.ReactNode;
  /** Lista de cartões já renderizada no servidor. */
  children?: React.ReactNode;
}

const MODE_DESCRIPTION: Record<FindMentorsPanelProps["mode"], string> = {
  heuristic:
    "Comparamos suas áreas, temas de interesse e etapa da carreira com as mentoras que têm vagas abertas, usando as regras da própria plataforma. Nenhum dado seu vai para serviços de IA.",
  ai: "Comparamos suas áreas, temas de interesse e etapa da carreira com as mentoras que têm vagas abertas. Com a sua autorização, quando a IA está disponível, ela refina a ordem e explica cada combinação.",
};

function resultMessage(state: Exclude<FindMentorsState, null>): string {
  if (!state.ok) return state.error;
  if (state.count === 0) {
    return "Não encontramos mentoras com vagas abertas agora. Tente ampliar suas áreas e temas no perfil ou explore o diretório.";
  }
  return `Encontramos ${pluralize(state.count, "sugestão", "sugestões")} para você.`;
}

/**
 * Botão "Encontrar mentoras" (Server Action) + estado de carregamento "Analisando perfis…".
 * Funciona com ou sem consentimento de IA (modo "heuristic" = só regras da plataforma).
 * Enquanto analisa, a lista anterior continua visível (esmaecida) ou aparecem esqueletos.
 */
export function FindMentorsPanel({
  hasSuggestions,
  mode,
  summary,
  aside,
  children,
}: FindMentorsPanelProps) {
  const [state, formAction, pending] = useActionState<FindMentorsState, FormData>(
    findMentorsAction,
    null,
  );

  // Espaçamento por margem (e não gap): a região de status vazia não abre um buraco na página.
  return (
    <div className="grid">
      <div className="flex flex-col gap-4 rounded-card border border-border bg-surface p-5 shadow-card sm:flex-row sm:items-center sm:justify-between">
        <div className="grid gap-1">
          <h2 className="font-display text-xl font-semibold text-fg">
            {hasSuggestions
              ? "Mentoras que combinam com você"
              : "Vamos encontrar mentoras para você?"}
          </h2>
          <p className="text-sm text-fg-muted">{summary ?? MODE_DESCRIPTION[mode]}</p>
        </div>
        <form action={formAction} className="shrink-0">
          <SubmitButton
            pendingText="Analisando perfis…"
            variant={hasSuggestions ? "outline" : "primary"}
          >
            {hasSuggestions ? <RefreshCw aria-hidden="true" /> : <Sparkles aria-hidden="true" />}
            {hasSuggestions ? "Atualizar sugestões" : "Encontrar mentoras"}
          </SubmitButton>
        </form>
      </div>

      <div aria-live="polite" className="sr-only">
        {pending ? "Analisando perfis. Isso pode levar alguns segundos." : ""}
      </div>
      <FormMessage
        tone={!state?.ok ? "error" : state.count > 0 ? "success" : "info"}
        className="[&>p]:mt-6"
      >
        {state && !pending ? resultMessage(state) : null}
      </FormMessage>
      {state?.ok && !pending && state.warnings.length > 0 && (
        <Alert variant="info" title="Sobre estas sugestões" className="mt-6">
          <ul className="grid gap-1">
            {state.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </Alert>
      )}

      {aside && <div className="mt-6">{aside}</div>}

      {pending && !hasSuggestions ? (
        <div aria-hidden="true" className="mt-6 grid gap-5 lg:grid-cols-2">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : (
        <div
          aria-busy={pending || undefined}
          className={cn(
            "mt-6 transition-opacity duration-200",
            pending && "pointer-events-none opacity-60",
          )}
        >
          {children}
        </div>
      )}
    </div>
  );
}
