"use client";

import { useActionState } from "react";
import Link from "next/link";
import { EyeOff, ShieldCheck, Sparkles, Users } from "lucide-react";
import { ButtonLink, Card, Checkbox, FormMessage, SubmitButton } from "@/components/ui";
import { grantAiConsentAction } from "@/app/mentoria/actions";
import { AI_CONSENT_TEXT, AI_CONSENT_TITLE } from "@/lib/mentorship/consent";
import type { ActionState } from "@/lib/mentorship/types";

/**
 * Pedido de consentimento antes do matching: explica o que é analisado, o que nunca sai da
 * plataforma e grava ai_consent (o trigger do banco registra a data).
 */
export function AiConsentCard() {
  const [state, formAction] = useActionState<ActionState, FormData>(grantAiConsentAction, null);
  const consentError = state && !state.ok ? state.fieldErrors?.ai_consent?.[0] : undefined;

  return (
    <Card as="section" aria-labelledby="consentimento-ia" padding="lg" className="grid gap-6">
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:gap-4">
        <span
          aria-hidden="true"
          className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-soft-fg [&_svg]:size-6"
        >
          <Sparkles />
        </span>
        <div className="grid gap-1.5">
          <h2 id="consentimento-ia" className="font-display text-2xl font-semibold text-fg">
            Antes das sugestões, a sua autorização
          </h2>
          <p className="text-fg-muted">
            Para indicar mentoras, analisamos o seu perfil de pesquisa e, quando a IA está disponível, enviamos esses
            dados — sem nome nem contatos — para um serviço de IA explicar cada combinação. Você decide.
          </p>
        </div>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2">
        <li className="flex gap-3 rounded-control bg-surface-2 p-4 text-sm text-fg-muted">
          <ShieldCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-success" />
          <span>
            <strong className="text-fg">O que usamos:</strong> etapa da carreira, áreas, palavras-chave, temas e
            objetivos de mentoria.
          </span>
        </li>
        <li className="flex gap-3 rounded-control bg-surface-2 p-4 text-sm text-fg-muted">
          <EyeOff aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary" />
          <span>
            <strong className="text-fg">O que nunca sai daqui:</strong> nome, e-mail, instituição, cidade, links e foto.
          </span>
        </li>
      </ul>

      <form action={formAction} noValidate className="grid gap-5">
        <FormMessage tone="error">{state && !state.ok && !consentError ? state.error : null}</FormMessage>
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
        <div className="grid gap-1 text-sm text-fg-muted">
          <p>
            Sem essa autorização, você ainda pode explorar o diretório de pesquisadoras e pedir mentoria diretamente a
            quem quiser. Saiba mais em{" "}
            <Link href="/privacidade" className="font-semibold text-primary underline underline-offset-2">
              Privacidade
            </Link>
            .
          </p>
          <p>Tem menos de 18 anos? Não marque: todo o restante da plataforma funciona normalmente.</p>
        </div>
        <div className="flex flex-wrap gap-3 border-t border-border pt-5">
          <SubmitButton pendingText="Salvando…">Autorizar e continuar</SubmitButton>
          <ButtonLink href="/pesquisadoras?mentoras=1" variant="outline">
            <Users aria-hidden="true" />
            Explorar o diretório de mentoras
          </ButtonLink>
        </div>
      </form>
    </Card>
  );
}
