"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export type DropdownItem =
  | {
      type?: "link";
      label: string;
      href: string;
      icon?: React.ReactNode;
      /** Texto/elemento à direita (ex.: contador). */
      end?: React.ReactNode;
    }
  | {
      /** Envia um formulário (ex.: POST /auth/sair). */
      type: "form";
      label: string;
      action: string;
      method?: "post" | "get";
      icon?: React.ReactNode;
      tone?: "default" | "danger";
    }
  | { type: "separator" }
  | { type: "label"; label: React.ReactNode };

export interface DropdownMenuProps {
  /** Conteúdo do botão que abre o menu (avatar, ícone...). */
  trigger: React.ReactNode;
  /** Nome acessível do botão, ex.: "Menu da conta". */
  triggerLabel: string;
  items: readonly DropdownItem[];
  align?: "start" | "end";
  /** Conteúdo fixo no topo do menu (ex.: nome e e-mail). */
  header?: React.ReactNode;
  className?: string;
  triggerClassName?: string;
}

/*
 * Sem `outline-none` aqui: no Tailwind v4 ele zera --tw-outline-style e o anel de foco
 * (focus-visible:outline-2) some. O anel vem da regra global :focus-visible; só puxamos para dentro.
 */
const itemClasses =
  "flex w-full items-center gap-2.5 rounded-[0.5rem] px-2.5 py-2 text-left text-[0.9375rem] text-fg transition-colors hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:-outline-offset-2 [&_svg]:size-4 [&_svg]:text-fg-subtle";

const GAP = 8;

/**
 * Menu suspenso acessível (padrão ARIA menu button): setas, Home/End, Esc e Tab.
 * Itens são dados serializáveis — dá para montar a lista num Server Component.
 * O menu abre na camada superior (popover), então não é cortado por `overflow-hidden`
 * de cartões ou tabelas roláveis.
 */
export function DropdownMenu({
  trigger,
  triggerLabel,
  items,
  align = "end",
  header,
  className,
  triggerClassName,
}: DropdownMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const focusLast = useRef(false);
  const menuId = useId();

  const menuItems = () =>
    Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);

  // Mostra na camada superior e posiciona junto ao botão (antes da pintura: sem salto).
  useLayoutEffect(() => {
    const menu = menuRef.current;
    const button = buttonRef.current;
    if (!open || !menu || !button) return;
    try {
      menu.showPopover?.();
    } catch {
      // navegador sem Popover API: o menu continua com position: fixed
    }
    function place() {
      if (!menu || !button) return;
      const r = button.getBoundingClientRect();
      const width = menu.offsetWidth;
      const height = menu.offsetHeight;
      const vw = document.documentElement.clientWidth;
      const vh = window.innerHeight;
      let left = align === "end" ? r.right - width : r.left;
      left = Math.max(GAP, Math.min(left, vw - width - GAP));
      let top = r.bottom + GAP;
      if (top + height > vh - GAP && r.top - height - GAP >= GAP) top = r.top - height - GAP;
      menu.style.left = `${Math.round(left)}px`;
      menu.style.top = `${Math.round(top)}px`;
    }
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
      try {
        menu.hidePopover?.();
      } catch {
        // já fechado
      }
    };
  }, [open, align]);

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

  function close(focusTrigger = true) {
    setOpen(false);
    if (focusTrigger) buttonRef.current?.focus();
  }

  function onMenuKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const list = menuItems();
    const index = list.indexOf(document.activeElement as HTMLElement);
    let next: number | null = null;
    switch (event.key) {
      case "ArrowDown":
        next = (index + 1) % list.length;
        break;
      case "ArrowUp":
        next = (index - 1 + list.length) % list.length;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = list.length - 1;
        break;
      case "Escape":
        event.preventDefault();
        close();
        return;
      case "Tab":
        setOpen(false);
        return;
    }
    if (next !== null) {
      event.preventDefault();
      list[next]?.focus();
    }
  }

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        ref={buttonRef}
        type="button"
        aria-label={triggerLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(event) => {
          if ((event.key === "ArrowDown" || event.key === "ArrowUp") && !open) {
            event.preventDefault();
            focusLast.current = event.key === "ArrowUp";
            setOpen(true);
          }
        }}
        className={cn("inline-flex items-center rounded-full transition-opacity hover:opacity-90", triggerClassName)}
      >
        {trigger}
      </button>
      {open && (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label={triggerLabel}
          popover="manual"
          onKeyDown={onMenuKeyDown}
          className="fixed inset-auto z-50 m-0 w-64 max-w-[calc(100vw-1rem)] animate-pop-in overflow-visible rounded-card border border-border bg-surface p-1.5 text-fg shadow-overlay"
        >
          {header && <div className="mb-1.5 border-b border-border px-2.5 pt-1.5 pb-2.5">{header}</div>}
          {items.map((item, index) => {
            if (item.type === "separator") {
              return <div key={`sep-${index}`} role="separator" className="my-1.5 h-px bg-border" />;
            }
            if (item.type === "label") {
              return (
                <div key={`label-${index}`} role="presentation" className="eyebrow px-2.5 pt-2 pb-1 text-fg-subtle">
                  {item.label}
                </div>
              );
            }
            if (item.type === "form") {
              return (
                <form key={`form-${index}`} action={item.action} method={item.method ?? "post"} role="none">
                  <button
                    type="submit"
                    role="menuitem"
                    tabIndex={-1}
                    className={cn(itemClasses, item.tone === "danger" && "text-danger [&_svg]:text-danger")}
                  >
                    {item.icon}
                    {item.label}
                  </button>
                </form>
              );
            }
            return (
              <Link
                key={`${item.href}::${item.label}`}
                href={item.href}
                role="menuitem"
                tabIndex={-1}
                onClick={() => close(false)}
                className={itemClasses}
              >
                {item.icon}
                <span className="flex-1">{item.label}</span>
                {item.end}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
