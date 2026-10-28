"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Check, Copy, ExternalLink, KeyRound, PenLine } from "lucide-react";
import { Alert, Button, ButtonLink, Card } from "@/components/ui";
import { trackingPath, trackingUrl } from "@/lib/pergunte/token";

const noop = () => () => {};
const readOrigin = () => window.location.origin;
const serverOrigin = () => "";

export interface TrackingLinkCardProps {
  token: string;
  /** Volta ao formulário vazio (o link some da tela: por isso pedimos para guardar antes). */
  onNewQuestion: () => void;
}

/**
 * Tela de sucesso do envio: o ÚNICO lugar onde o token aparece. Não guardamos o link no
 * navegador (o computador pode ser compartilhado, como no laboratório da escola) e ele nunca
 * vai para uma URL de redirect.
 */
export function TrackingLinkCard({ token, onNewQuestion }: TrackingLinkCardProps) {
  const origin = useSyncExternalStore(noop, readOrigin, serverOrigin);
  const url = origin ? trackingUrl(origin, token) : trackingPath(token);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [copy, setCopy] = useState<"idle" | "copied" | "manual">("idle");

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopy("copied");
    } catch {
      // Sem permissão de área de transferência (ou http sem HTTPS): seleciona para copiar à mão.
      inputRef.current?.focus();
      inputRef.current?.select();
      setCopy("manual");
    }
  }

  return (
    <div className="grid gap-5">
      <Alert variant="success" live title="Pergunta enviada!">
        A moderação lê cada pergunta antes de publicar. Isso pode levar alguns dias. Obrigada pela
        coragem de perguntar.
      </Alert>

      <Card variant="outline" className="grid gap-4 p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-soft-fg [&_svg]:size-[1.125rem]"
          >
            <KeyRound />
          </span>
          <h3
            ref={headingRef}
            tabIndex={-1}
            className="font-display text-xl leading-snug font-semibold text-fg"
          >
            Guarde este link para acompanhar sua pergunta
          </h3>
        </div>

        <div className="grid gap-2">
          <label htmlFor="link-acompanhamento" className="text-sm font-semibold text-fg">
            Seu link de acompanhamento
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              ref={inputRef}
              id="link-acompanhamento"
              readOnly
              value={url}
              onFocus={(event) => event.currentTarget.select()}
              aria-describedby="link-acompanhamento-aviso"
              className="h-11 w-full min-w-0 rounded-control border border-border-strong bg-surface-2 px-3.5 font-mono text-sm text-fg"
            />
            <Button type="button" onClick={copyLink} className="shrink-0">
              {copy === "copied" ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
              Copiar link
            </Button>
          </div>
          <p aria-live="polite" className="min-h-5 text-sm font-medium text-success">
            {copy === "copied" && "Link copiado. Cole num lugar só seu, como as notas do celular."}
            {copy === "manual" && (
              <span className="text-fg-muted">
                O link está selecionado: copie com Ctrl+C (ou toque e segure no celular).
              </span>
            )}
          </p>
        </div>

        <p
          id="link-acompanhamento-aviso"
          className="rounded-control bg-warning-soft px-3.5 py-2.5 text-sm text-warning-soft-fg"
        >
          <strong className="font-semibold">
            Só quem tiver este link vê o andamento. Não conseguimos recuperá-lo depois.
          </strong>{" "}
          Por ele você também pode apagar a pergunta quando quiser.
        </p>

        <div className="flex flex-wrap gap-2">
          <ButtonLink href={trackingPath(token)} variant="outline">
            <ExternalLink aria-hidden="true" />
            Abrir o acompanhamento
          </ButtonLink>
          <Button type="button" variant="ghost" onClick={onNewQuestion}>
            <PenLine aria-hidden="true" />
            Enviar outra pergunta
          </Button>
        </div>
      </Card>
    </div>
  );
}
