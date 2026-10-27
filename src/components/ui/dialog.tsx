"use client";

import { cloneElement, isValidElement, useEffect, useId, useRef, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

type TriggerProps = { onClick?: (event: React.MouseEvent<HTMLElement>) => void; "aria-haspopup"?: "dialog" };

export interface DialogProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  /** Botões do rodapé (ex.: Cancelar / Salvar). */
  footer?: React.ReactNode;
  /** Modo controlado. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Modo não controlado: elemento que abre o diálogo (ex.: <Button>Abrir</Button>). */
  trigger?: React.ReactElement<TriggerProps>;
  size?: "sm" | "md" | "lg";
  /** Fecha com Esc e clique fora (padrão true). */
  dismissible?: boolean;
  className?: string;
}

const sizeClasses = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-2xl" } as const;

/**
 * Diálogo modal com o <dialog> nativo: foco preso dentro, Esc fecha, o foco volta
 * para quem abriu e o fundo fica inerte. Clique no fundo também fecha.
 * O foco inicial vai para o primeiro elemento com `data-autofocus` (ou o primeiro focável: "Fechar").
 */
export function Dialog({
  title,
  description,
  children,
  footer,
  open: openProp,
  onOpenChange,
  trigger,
  size = "md",
  dismissible = true,
  className,
}: DialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = openProp ?? internalOpen;
  const ref = useRef<HTMLDialogElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();

  const setOpen = (value: boolean) => {
    if (openProp === undefined) setInternalOpen(value);
    onOpenChange?.(value);
  };

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      returnFocus.current = document.activeElement as HTMLElement | null;
      dialog.showModal();
      // O conteúdo monta antes do showModal(), então o autoFocus do React não pega.
      // Marque o campo inicial com data-autofocus (ex.: <Textarea data-autofocus />).
      dialog.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <>
      {trigger && isValidElement(trigger)
        ? cloneElement(trigger, {
            "aria-haspopup": "dialog",
            onClick: (event: React.MouseEvent<HTMLElement>) => {
              trigger.props.onClick?.(event);
              setOpen(true);
            },
          })
        : null}
      <dialog
        ref={ref}
        aria-labelledby={open ? titleId : undefined}
        aria-describedby={open && description ? descriptionId : undefined}
        onCancel={(event) => {
          if (!dismissible) event.preventDefault();
        }}
        onClose={() => {
          if (open) setOpen(false);
          returnFocus.current?.focus?.();
        }}
        onClick={(event) => {
          if (dismissible && event.target === ref.current) setOpen(false);
        }}
        className={cn(
          "m-auto w-[calc(100%-2rem)] rounded-dialog border border-border bg-surface p-0 text-fg shadow-overlay",
          "open:animate-pop-in backdrop:animate-fade-in",
          sizeClasses[size],
          className,
        )}
      >
        {open && (
          <div className="grid max-h-[85dvh] grid-rows-[auto_1fr_auto]">
            <header className="flex items-start gap-4 px-5 pt-5 sm:px-6 sm:pt-6">
              <div className="grid flex-1 gap-1">
                <h2 id={titleId} className="font-display text-xl leading-snug font-semibold">
                  {title}
                </h2>
                {description && (
                  <p id={descriptionId} className="text-[0.9375rem] text-fg-muted">
                    {description}
                  </p>
                )}
              </div>
              {dismissible && (
                <Button variant="ghost" size="icon-sm" aria-label="Fechar" onClick={() => setOpen(false)} className="-mt-1 -mr-2">
                  <X aria-hidden="true" />
                </Button>
              )}
            </header>
            <div className="overflow-y-auto px-5 py-4 sm:px-6">{children}</div>
            {footer && (
              <footer className="flex flex-col-reverse gap-2 border-t border-border px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
                {footer}
              </footer>
            )}
          </div>
        )}
      </dialog>
    </>
  );
}
