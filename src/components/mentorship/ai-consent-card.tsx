"use client";

import { useActionState } from "react";
import Link from "next/link";
import { ChevronDown, EyeOff, ShieldCheck, Sparkles } from "lucide-react";
import { Card, Checkbox, FormMessage, SubmitButton } from "@/components/ui";
import { grantAiConsentAction } from "@/app/mentoria/actions";
import { AI_CONSENT_TEXT, AI_CONSENT_TITLE } from "@/lib/profile/consent";
import type { ActionState } from "@/lib/mentorship/types";

/**
 * Cartão compacto "Ativar sugestões com IA" (aba Sugestões, para quem ainda não autorizou).
 * As sugestões já funcionam sem IA, pelas regras da plataforma; a autorização só liga a análise
 * semântica (embeddings do Gemini) e a explicação/reordenação por IA. O formulário fica num
 * <details> nativo (funciona sem JavaScript) e grava ai_consent — o trigger do banco registra a data.
 */
export function AiConsentCard() {
  const [state, formAction] = useActionState<ActionState, FormData>(grantAiConsentAction, null);
  const consentError = state && !state.ok ? state.fieldErrors?.ai_consent?.[0] : undefined;

  return (
    <Card as="section" aria-labelledby="ativar-ia-titulo" padding="md" className="grid gap-4">
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-soft-fg [&_svg]:size-5"
        >
          <Sparkles />
        </span>
        <div className="grid gap-1">
          <h3 id="ativar-ia-titulo" className="font-display text-lg font-semibold text-fg">
            Ativar sugestões com IA
          </h3>
          <p className="text-sm text-fg-muted">
            Opcional. As sugestões já funcionam sem IA, com as regras da própria plataforma. Com a
            sua autorização, uma IA também compara o sentido dos perfis de pesquisa (não só palavras
            iguais) e explica cada combinação em poucas frases.
          </p>
        </div>
      </div>

      <details className="group rounded-control border border-border open:border-border-strong">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-control px-4 py-2.5 text-sm font-semibold text-fg select-none hover:bg-surface-2 [&::-webkit-details-marker]:hidden">
          Ver o que é enviado e autorizar
          <ChevronDown
            aria-hidden="true"
            className="size-4 shrink-0 text-fg-subtle transition-transform group-open:rotate-180 motion-reduce:transition-none"
          />
        </summary>

        <div className="grid gap-5 border-t border-border p-4">
          <ul className="grid gap-3 sm:grid-cols-2">
            <li className="flex gap-3 rounded-control bg-surface-2 p-3.5 text-sm text-fg-muted">
              <ShieldCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-success" />
              <span>
                <strong className="text-fg">O que a IA recebe:</strong> etapa da carreira, áreas,
                palavras-chave, temas, frase de apresentação e objetivos de mentoria (ou, para
                mentoras, como pode ajudar), com códigos no lugar dos nomes.
              </span>
            </li>
            <li className="flex gap-3 rounded-control bg-surface-2 p-3.5 text-sm text-fg-muted">
              <EyeOff aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary" />
              <span>
                <strong className="text-fg">O que nunca sai daqui:</strong> nome, e-mail,
                instituição, cidade, links e foto.
              </span>
            </li>
          </ul>

          <form action={formAction} noValidate className="grid gap-4">
            <FormMessage tone="error">
              {state && !state.ok && !consentError ? state.error : null}
            </FormMessage>
            <div className="grid gap-1.5">
              <Checkbox
                name="ai_consent"
                id="ai_consent"
                label={AI_CONSENT_TITLE}
                description={AI_CONSENT_TEXT}
                aria-invalid={consentError ? true : undefined}
                aria-describedby={consentError ? "ai_consent-erro" : undefined}
              />
              {consentError && (
                <p id="ai_consent-erro" className="pl-8 text-sm font-medium text-danger">
                  {consentError}
                </p>
              )}
            </div>
            <p className="text-sm text-fg-muted">
              Tem menos de 18 anos? Não marque: as sugestões por regras e todo o restante da
              plataforma funcionam normalmente. Saiba mais em{" "}
              <Link
                href="/privacidade#ia"
                className="font-semibold text-primary underline underline-offset-2"
              >
                Privacidade
              </Link>
              .
            </p>
            <div>
              <SubmitButton pendingText="Salvando…">
                <Sparkles aria-hidden="true" />
                Ativar sugestões com IA
              </SubmitButton>
            </div>
          </form>
        </div>
      </details>
    </Card>
  );
}
