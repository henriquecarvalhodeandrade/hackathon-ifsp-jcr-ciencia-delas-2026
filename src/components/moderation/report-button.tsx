"use client";

import { useActionState, useState } from "react";
import { usePathname } from "next/navigation";
import { Flag, Phone } from "lucide-react";
import {
  Alert,
  Button,
  ButtonLink,
  Dialog,
  Field,
  FormMessage,
  RadioGroup,
  SubmitButton,
  Textarea,
} from "@/components/ui";
import { REPORT_REASONS } from "@/lib/constants";
import { createReport, type ReportState } from "@/lib/moderation/actions";
import {
  REPORT_DETAILS_MAX,
  REPORT_TARGET_LABELS,
  type ReportTarget,
} from "@/lib/moderation/schema";
import { cn } from "@/lib/utils";

const REASON_OPTIONS = Object.entries(REPORT_REASONS).map(([value, label]) => ({ value, label }));

export interface ReportButtonProps {
  targetType: ReportTarget;
  targetId: string;
  /** Texto do botão (padrão "Denunciar"). */
  label?: string;
  /** "text" = ícone + texto (padrão) · "icon" = só o ícone (com aria-label). */
  display?: "text" | "icon";
  size?: "sm" | "md";
  /**
   * Passe `false` para visitantes (páginas públicas): o botão vira um link para entrar
   * e voltar à página atual.
   */
  signedIn?: boolean;
  className?: string;
}

/**
 * Botão "Denunciar" com diálogo: motivo (REPORT_REASONS) + detalhes opcionais.
 * Envia para a Server Action `createReport` (src/lib/moderation/actions.ts).
 *
 * <ReportButton targetType="thread" targetId={thread.id} />
 */
export function ReportButton({
  targetType,
  targetId,
  label = "Denunciar",
  display = "text",
  size = "sm",
  signedIn = true,
  className,
}: ReportButtonProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const targetLabel = REPORT_TARGET_LABELS[targetType];
  const accessibleLabel = display === "icon" ? `${label} ${targetLabel}` : undefined;
  const buttonSize = display === "icon" ? (size === "sm" ? "icon-sm" : "icon") : size;

  if (!signedIn) {
    return (
      <ButtonLink
        href={`/entrar?next=${encodeURIComponent(pathname || "/")}`}
        variant="ghost"
        size={buttonSize}
        aria-label={accessibleLabel ?? `${label} ${targetLabel} (é preciso entrar)`}
        className={cn("text-fg-muted", className)}
      >
        <Flag aria-hidden="true" />
        {display === "text" && label}
      </ButtonLink>
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      size="md"
      title={`Denunciar ${targetLabel}`}
      description="Sua denúncia é sigilosa: a pessoa denunciada não fica sabendo quem denunciou."
      trigger={
        <Button
          variant="ghost"
          size={buttonSize}
          aria-label={accessibleLabel}
          className={cn("text-fg-muted", className)}
        >
          <Flag aria-hidden="true" />
          {display === "text" && label}
        </Button>
      }
    >
      {/* O formulário só existe com o diálogo aberto: reabrir começa do zero. */}
      <ReportForm targetType={targetType} targetId={targetId} onClose={() => setOpen(false)} />
    </Dialog>
  );
}

function ReportForm({
  targetType,
  targetId,
  onClose,
}: {
  targetType: ReportTarget;
  targetId: string;
  onClose: () => void;
}) {
  const [state, formAction] = useActionState<ReportState, FormData>(createReport, null);
  const errors = state && !state.ok ? state.fieldErrors : undefined;

  if (state?.ok) {
    return (
      <div className="grid gap-5 pb-1">
        <Alert variant="success" title="Recebemos sua denúncia" live>
          {state.message}
        </Alert>
        <div className="flex justify-end">
          <Button onClick={onClose}>Entendi</Button>
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} noValidate className="grid gap-5 pb-1">
      <input type="hidden" name="targetType" value={targetType} />
      <input type="hidden" name="targetId" value={targetId} />

      <FormMessage tone="error">{state && !state.ok ? state.error : null}</FormMessage>

      <RadioGroup
        key={`reason-${state?.values.reason ?? ""}`}
        name="reason"
        legend="Qual é o problema?"
        options={REASON_OPTIONS}
        defaultValue={state?.values.reason}
        required
        error={errors?.reason}
      />

      <Field
        label="Detalhes"
        optional
        hint="O que aconteceu? Trechos, datas ou contexto ajudam a moderação a agir."
        error={errors?.details}
      >
        <Textarea
          name="details"
          rows={3}
          maxLength={REPORT_DETAILS_MAX}
          showCount
          defaultValue={state?.values.details}
          key={`details-${state ? "r" : "i"}`}
        />
      </Field>

      <p className="flex items-start gap-2 rounded-control bg-surface-2 px-3.5 py-2.5 text-sm text-fg-muted">
        <Phone aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-fg-subtle" />
        <span>
          Em situação de violência ou perigo, procure ajuda imediata:{" "}
          <strong className="text-fg">Ligue 180</strong> (Central de Atendimento à Mulher) ou{" "}
          <strong className="text-fg">190</strong> (Polícia Militar).
        </span>
      </p>

      <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
        <Button variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <SubmitButton variant="danger" pendingText="Enviando…">
          <Flag aria-hidden="true" />
          Enviar denúncia
        </SubmitButton>
      </div>
    </form>
  );
}
