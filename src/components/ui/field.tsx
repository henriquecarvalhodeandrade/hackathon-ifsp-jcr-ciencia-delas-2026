import { cloneElement, isValidElement, useId } from "react";
import { CircleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { Label } from "./label";

type ControlProps = {
  id?: string;
  required?: boolean;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean | "true" | "false";
};

export type FieldError = string | readonly string[] | null | undefined;

export interface FieldProps {
  label: React.ReactNode;
  /** O controle (Input, Textarea, Select...). Recebe id, aria-describedby, aria-invalid e required. */
  children: React.ReactElement<ControlProps>;
  /** Texto de ajuda abaixo do rótulo. */
  hint?: React.ReactNode;
  /** Mensagem(ns) de erro — aceita direto `fieldErrors.campo` do zod. */
  error?: FieldError;
  required?: boolean;
  optional?: boolean;
  /** id do controle; se omitido, é gerado. */
  id?: string;
  /** Esconde o rótulo visualmente (continua acessível). */
  hideLabel?: boolean;
  className?: string;
}

function firstError(error: FieldError): string | undefined {
  if (!error) return undefined;
  if (typeof error === "string") return error || undefined;
  return error[0];
}

/**
 * Agrupa rótulo + dica + controle + erro e liga tudo com aria-describedby/aria-invalid.
 *
 * <Field label="Instituição" hint="Onde você estuda ou trabalha" error={state.fieldErrors?.institution}>
 *   <Input name="institution" />
 * </Field>
 */
export function Field({ label, children, hint, error, required, optional, id, hideLabel, className }: FieldProps) {
  const autoId = useId();
  const controlId = id ?? children.props.id ?? `campo-${autoId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const hintId = hint ? `${controlId}-dica` : undefined;
  const message = firstError(error);
  const errorId = message ? `${controlId}-erro` : undefined;
  const describedBy =
    [children.props["aria-describedby"], hintId, errorId].filter(Boolean).join(" ") || undefined;

  const control = isValidElement(children)
    ? cloneElement(children, {
        id: controlId,
        required: required ?? children.props.required,
        "aria-describedby": describedBy,
        "aria-invalid": message ? true : children.props["aria-invalid"],
      })
    : children;

  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label htmlFor={controlId} required={required} optional={optional} className={hideLabel ? "sr-only" : undefined}>
        {label}
      </Label>
      {hint && (
        <p id={hintId} className="-mt-0.5 text-sm text-fg-muted">
          {hint}
        </p>
      )}
      {control}
      {message && (
        <p id={errorId} className="flex items-start gap-1.5 text-sm font-medium text-danger">
          <CircleAlert aria-hidden="true" className="mt-0.5 size-4" />
          <span>{message}</span>
        </p>
      )}
    </div>
  );
}
