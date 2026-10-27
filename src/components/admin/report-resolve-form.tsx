"use client";

import { useId, useState } from "react";
import { useFormStatus } from "react-dom";
import { Archive, CircleCheck, RotateCcw } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { resolveReport } from "@/lib/admin/actions";
import type { ReportStatus } from "@/lib/admin/params";
import { announce } from "./flash";

/** Botão de envio que só mostra "carregando" quando foi ele que enviou o formulário. */
function StatusButton({
  value,
  pendingText,
  children,
  ...props
}: Omit<ButtonProps, "type" | "name" | "value"> & { value: ReportStatus; pendingText: string }) {
  const { pending, data } = useFormStatus();
  const mine = pending && data?.get("status") === value;
  return (
    <Button
      type="submit"
      name="status"
      value={value}
      loading={mine}
      loadingText={pendingText}
      disabled={pending}
      {...props}
    >
      {children}
    </Button>
  );
}

/** Resolver / arquivar (ou reabrir) uma denúncia, com nota opcional da moderação. */
export function ReportResolveForm({ reportId, status }: { reportId: string; status: ReportStatus }) {
  const [error, setError] = useState<{ message: string; note?: string } | null>(null);
  const noteId = useId();

  async function run(formData: FormData) {
    setError(null);
    try {
      const result = await resolveReport(null, formData);
      if (!result) return;
      if (result.ok) announce(result.message);
      else setError({ message: result.fieldErrors?.note?.[0] ?? result.error, note: String(formData.get("note") ?? "") });
    } catch {
      setError({ message: "Não conseguimos falar com o servidor. Verifique sua conexão e tente de novo." });
    }
  }

  const open = status === "open";
  return (
    <form action={run} className="grid gap-3">
      <input type="hidden" name="id" value={reportId} />
      <div className="grid gap-1.5">
        <Label htmlFor={noteId} optional>
          {open ? "Nota da moderação" : "Nova nota (ao reabrir)"}
        </Label>
        <Textarea
          key={error?.note ?? "nota"}
          id={noteId}
          name="note"
          rows={2}
          maxLength={800}
          defaultValue={error?.note}
          placeholder={open ? "Ex.: conteúdo removido; conversei com a autora." : "Por que a denúncia voltou para a fila?"}
          aria-describedby={`${noteId}-dica`}
        />
        <p id={`${noteId}-dica`} className="text-sm text-fg-subtle">
          Fica no histórico da denúncia. A denunciante não é avisada, mas consegue consultar a própria denúncia:
          escreva só o necessário, sem dados pessoais.
        </p>
      </div>
      <FormMessage tone="error">{error?.message}</FormMessage>
      <div className="flex flex-wrap gap-2">
        {open ? (
          <>
            <StatusButton value="resolved" pendingText="Resolvendo…" variant="secondary" size="sm">
              <CircleCheck aria-hidden="true" />
              Marcar como resolvida
            </StatusButton>
            <StatusButton value="dismissed" pendingText="Arquivando…" variant="outline" size="sm">
              <Archive aria-hidden="true" />
              Arquivar sem ação
            </StatusButton>
          </>
        ) : (
          <StatusButton value="open" pendingText="Reabrindo…" variant="outline" size="sm">
            <RotateCcw aria-hidden="true" />
            Reabrir denúncia
          </StatusButton>
        )}
      </div>
    </form>
  );
}
