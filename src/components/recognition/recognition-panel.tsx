import Link from "next/link";
import { CircleCheck, Lock, MessageSquareText } from "lucide-react";
import type { RecognitionState } from "@/lib/recognition/state";
import { DeclarationPanel } from "./declaration-panel";

export function completionHref(requestId: string, section?: "retorno" | "declaracao"): string {
  return `/mentoria/concluida/${requestId}${section ? `#${section}` : ""}`;
}

/**
 * Reconhecimento no cartão de uma mentoria concluída (/mentoria?aba=ativas): o retorno privado
 * (já enviado ou o link para contar) e a declaração de participação em cada estado.
 * `state` null = não deu para carregar (o resto do cartão continua funcionando).
 */
export function RecognitionPanel({
  requestId,
  otherFirstName,
  state,
}: {
  requestId: string;
  otherFirstName: string;
  state: RecognitionState | null;
}) {
  const retornoId = `retorno-${requestId}`;
  const declaracaoId = `declaracao-${requestId}`;

  if (!state) {
    return (
      <p className="rounded-control bg-surface-2 p-3.5 text-sm text-fg-muted">
        Não conseguimos carregar o retorno e a declaração agora. Recarregue a página em instantes.
      </p>
    );
  }

  return (
    <div className="grid gap-5 border-t border-border pt-4 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:gap-6">
      <section aria-labelledby={retornoId} className="grid content-start gap-2">
        <h4 id={retornoId} className="text-sm font-semibold text-fg">
          Seu retorno
        </h4>
        {state.feedbackSent ? (
          <p className="flex items-start gap-2 text-sm text-fg-muted">
            <CircleCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-success" />
            <span>Você já contou como foi. Obrigada!</span>
          </p>
        ) : (
          <>
            <p className="flex items-start gap-2 text-sm text-fg-muted">
              <Lock aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-fg-subtle" />
              <span>Leva uns 30 segundos. Só você vê suas respostas.</span>
            </p>
            <Link
              href={completionHref(requestId, "retorno")}
              className="inline-flex w-fit items-center gap-1.5 rounded-badge text-sm font-semibold text-primary underline-offset-[0.2em] hover:underline"
            >
              <MessageSquareText aria-hidden="true" className="size-4" />
              Conte como foi (privado)
              <span className="sr-only"> a mentoria com {otherFirstName}</span>
            </Link>
          </>
        )}
      </section>

      <section aria-labelledby={declaracaoId} className="grid content-start gap-2">
        <h4 id={declaracaoId} className="text-sm font-semibold text-fg">
          Declaração de participação
        </h4>
        <DeclarationPanel
          requestId={requestId}
          otherFirstName={otherFirstName}
          declaration={state.declaration}
          returnTo="ativas"
        />
      </section>
    </div>
  );
}
