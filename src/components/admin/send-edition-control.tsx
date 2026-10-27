"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { MailCheck, Send } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { sendEditionAction, type SendSummary } from "@/lib/admin/actions";
import type { ActionState } from "@/lib/admin/action-state";
import { announce } from "./flash";

function ModeButton({
  mode,
  pendingText,
  children,
  variant = "primary",
  disabled,
}: {
  mode: "preview" | "send";
  pendingText: string;
  children: React.ReactNode;
  variant?: "primary" | "outline";
  disabled?: boolean;
}) {
  const { pending, data } = useFormStatus();
  return (
    <Button
      type="submit"
      name="mode"
      value={mode}
      size="sm"
      variant={variant}
      loading={pending && data?.get("mode") === mode}
      loadingText={pendingText}
      disabled={pending || disabled}
    >
      {children}
    </Button>
  );
}

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

function SendFlow({ editionId, label, onReset }: { editionId: string; label: string; onReset: () => void }) {
  const [state, formAction] = useActionState<ActionState<SendSummary>, FormData>(async (prev, formData) => {
    const result = await sendEditionAction(prev, formData);
    if (result?.ok && !result.data.dryRun) announce(result.message);
    return result;
  }, null);

  const preview = state?.ok && state.data.dryRun ? state.data : null;
  const done = state?.ok && !state.data.dryRun ? state.data : null;

  return (
    <form action={formAction} className="grid gap-3">
      <input type="hidden" name="editionId" value={editionId} />

      {!preview && !done && (
        <div className="flex flex-wrap items-center gap-2">
          <ModeButton mode="preview" pendingText="Contando…" variant="outline">
            <Send aria-hidden="true" />
            {label}
          </ModeButton>
          <p className="text-sm text-fg-subtle">Primeiro mostramos quantas pessoas receberiam.</p>
        </div>
      )}

      {preview && (
        <Alert
          variant={preview.sent > 0 ? "info" : "warning"}
          title={
            preview.sent > 0
              ? `${plural(preview.sent, "inscrita receberá", "inscritas receberão")} esta edição`
              : "Ninguém receberia esta edição agora"
          }
          live
          actions={
            <>
              <ModeButton mode="send" pendingText="Enviando…" disabled={preview.sent === 0}>
                <MailCheck aria-hidden="true" />
                Confirmar envio
              </ModeButton>
              <Button type="button" variant="ghost" size="sm" onClick={onReset}>
                Cancelar
              </Button>
            </>
          }
        >
          {preview.skipped > 0 && (
            <p>
              {plural(preview.skipped, "inscrita será pulada", "inscritas serão puladas")} (por exemplo, quem já recebeu
              esta edição).
            </p>
          )}
          {preview.reason && <p>{preview.reason}</p>}
        </Alert>
      )}

      {done && (
        <Alert variant={done.failed > 0 ? "warning" : "success"} title="Envio processado" live>
          <p>
            {plural(done.sent, "enviado", "enviados")} · {plural(done.skipped, "pulado", "pulados")} ·{" "}
            {plural(done.failed, "falha", "falhas")}
          </p>
          {done.reason && <p>{done.reason}</p>}
        </Alert>
      )}

      <FormMessage tone="error">{state && !state.ok ? state.error : null}</FormMessage>
    </form>
  );
}

/** Envio de uma edição em dois passos: prévia (dry-run) e confirmação. */
export function SendEditionControl({ editionId, label }: { editionId: string; label: string }) {
  const [round, setRound] = useState(0);
  return <SendFlow key={round} editionId={editionId} label={label} onReset={() => setRound((r) => r + 1)} />;
}
