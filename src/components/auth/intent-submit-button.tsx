"use client";

import { useFormStatus } from "react-dom";
import { Button, type ButtonProps } from "@/components/ui/button";

export interface IntentSubmitButtonProps extends Omit<
  ButtonProps,
  "type" | "name" | "value" | "loading"
> {
  /** Valor enviado em `intent` — a Server Action decide o que fazer com ele. */
  intent: string;
  pendingText?: string;
}

/**
 * Botão de envio para formulários com mais de uma ação (ex.: "Entrar" e "Receber link").
 * Só o botão clicado mostra o carregamento; os outros ficam desabilitados enquanto isso.
 */
export function IntentSubmitButton({
  intent,
  pendingText,
  disabled,
  children,
  ...props
}: IntentSubmitButtonProps) {
  const { pending, data } = useFormStatus();
  const isMine = pending && data?.get("intent") === intent;
  return (
    <Button
      type="submit"
      name="intent"
      value={intent}
      loading={isMine}
      loadingText={pendingText}
      disabled={disabled || (pending && !isMine)}
      {...props}
    >
      {children}
    </Button>
  );
}
