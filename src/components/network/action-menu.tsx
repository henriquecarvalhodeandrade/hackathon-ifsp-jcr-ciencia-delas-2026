"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { buttonVariants, type ButtonSize, type ButtonVariant } from "@/components/ui";
import { cn } from "@/lib/utils";

export interface ActionMenuItem {
  label: string;
  icon?: React.ReactNode;
  tone?: "default" | "danger";
  onSelect: () => void;
}

export interface ActionMenuProps {
  /** Conteúdo visível do botão (ex.: ícone + "Conectadas"). */
  children: React.ReactNode;
  /** Texto extra só para leitor de tela, depois do visível (ex.: ": opções da conexão"). */
  srSuffix?: string;
  items: readonly ActionMenuItem[];
  variant?: ButtonVariant;
  size?: Extract<ButtonSize, "sm" | "md">;
  align?: "start" | "end";
  className?: string;
}

/*
 * Sem `outline-none`: no Tailwind v4 ele zera o anel de foco (docs/02 §17). O anel vem da regra
 * global :focus-visible; só puxamos para dentro.
 */
const itemClasses =
  "flex w-full items-center gap-2.5 rounded-[0.5rem] px-2.5 py-2 text-left text-[0.9375rem] transition-colors hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:-outline-offset-2 [&_svg]:size-4";

/**
 * Menu de ações com itens que rodam funções (o `DropdownMenu` do design system só aceita links e
 * formulários com URL). Padrão ARIA menu button: Enter/Espaço/↓ abre no primeiro item, ↑ no
 * último; setas, Home/End; Esc fecha e volta ao botão; Tab ou clique fora fecham.
 */
export function ActionMenu({
  children,
  srSuffix,
  items,
  variant = "outline",
  size = "md",
  align = "start",
  className,
}: ActionMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const focusLast = useRef(false);
  const menuId = useId();

  const menuItems = () =>
    Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);

  useEffect(() => {
    if (!open) return;
    const list = menuItems();
    (focusLast.current ? list[list.length - 1] : list[0])?.focus();
    focusLast.current = false;
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  function close(returnFocus: boolean) {
    setOpen(false);
    if (returnFocus) buttonRef.current?.focus();
  }

  function onButtonKeyDown(event: React.KeyboardEvent) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      focusLast.current = event.key === "ArrowUp";
      setOpen(true);
    }
  }

  function onMenuKeyDown(event: React.KeyboardEvent) {
    const list = menuItems();
    const index = list.indexOf(document.activeElement as HTMLElement);
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        list[(index + 1) % list.length]?.focus();
        break;
      case "ArrowUp":
        event.preventDefault();
        list[(index - 1 + list.length) % list.length]?.focus();
        break;
      case "Home":
        event.preventDefault();
        list[0]?.focus();
        break;
      case "End":
        event.preventDefault();
        list[list.length - 1]?.focus();
        break;
      case "Escape":
        event.preventDefault();
        close(true);
        break;
      case "Tab":
        setOpen(false);
        break;
    }
  }

  return (
    <span ref={rootRef} className="relative inline-flex">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={onButtonKeyDown}
        className={cn(buttonVariants({ variant, size }), className)}
      >
        {children}
        {srSuffix && <span className="sr-only">{srSuffix}</span>}
        <ChevronDown
          aria-hidden="true"
          className={cn("transition-transform duration-150", open && "rotate-180")}
        />
      </button>
      {open && (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-orientation="vertical"
          onKeyDown={onMenuKeyDown}
          className={cn(
            "absolute top-full z-30 mt-2 grid min-w-52 animate-pop-in gap-0.5 rounded-control border border-border bg-surface p-1 text-fg shadow-overlay",
            align === "end" ? "right-0" : "left-0",
          )}
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              tabIndex={-1}
              onClick={() => {
                // O foco volta ao botão antes da ação: um diálogo aberto por ela devolve o foco
                // para cá quando fechar.
                close(true);
                item.onSelect();
              }}
              className={cn(
                itemClasses,
                item.tone === "danger"
                  ? "text-danger [&_svg]:text-danger"
                  : "text-fg [&_svg]:text-fg-subtle",
              )}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </span>
  );
}
