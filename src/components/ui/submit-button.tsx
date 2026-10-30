"use client";

import { useFormStatus } from "react-dom";
import { Button, type ButtonProps } from "./button";

export interface SubmitButtonProps extends Omit<ButtonProps, "type" | "loading"> {
  /** Texto exibido enquanto o formulário envia (ex.: "Enviando…"). */
  pendingText?: string;
}

/**
 * Botão de envio que entra em estado de carregamento sozinho enquanto a Server Action roda.
 * Precisa estar DENTRO do <form>.
 */
export function SubmitButton({ pendingText, children, ...props }: SubmitButtonProps) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending} loadingText={pendingText} {...props}>
      {children}
    </Button>
  );
}
