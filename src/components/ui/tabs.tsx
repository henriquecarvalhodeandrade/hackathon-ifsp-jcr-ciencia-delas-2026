"use client";

import { useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface TabItem {
  id: string;
  label: React.ReactNode;
  content: React.ReactNode;
  icon?: React.ReactNode;
  disabled?: boolean;
}

export interface TabsProps {
  tabs: readonly TabItem[];
  /** Rótulo do conjunto de abas (aria-label do tablist). */
  label: string;
  defaultTab?: string;
  /** Callback ao trocar de aba (modo não controlado). */
  onTabChange?: (id: string) => void;
  className?: string;
  listClassName?: string;
  panelClassName?: string;
}

/**
 * Abas para painéis na mesma página (padrão ARIA tablist com setas, Home e End).
 * Os painéis inativos ficam no DOM com `hidden` (conteúdo pode ser Server Component).
 */
export function Tabs({
  tabs,
  label,
  defaultTab,
  onTabChange,
  className,
  listClassName,
  panelClassName,
}: TabsProps) {
  const baseId = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const enabled = tabs.filter((t) => !t.disabled);
  const [active, setActive] = useState(defaultTab ?? enabled[0]?.id);
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  function select(id: string, focus = false) {
    setActive(id);
    onTabChange?.(id);
    if (focus) refs.current[id]?.focus();
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const index = enabled.findIndex((t) => t.id === active);
    let next: number | null = null;
    if (event.key === "ArrowRight") next = (index + 1) % enabled.length;
    else if (event.key === "ArrowLeft") next = (index - 1 + enabled.length) % enabled.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = enabled.length - 1;
    if (next !== null) {
      event.preventDefault();
      select(enabled[next]!.id, true);
    }
  }

  return (
    <div className={className}>
      <div className="-mx-4 scrollbar-none overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div
          role="tablist"
          aria-label={label}
          onKeyDown={onKeyDown}
          className={cn("flex min-w-max gap-1 border-b border-border", listClassName)}
        >
          {tabs.map((tab) => {
            const selected = tab.id === active;
            return (
              <button
                key={tab.id}
                ref={(el) => {
                  refs.current[tab.id] = el;
                }}
                type="button"
                role="tab"
                id={`${baseId}-tab-${tab.id}`}
                aria-selected={selected}
                aria-controls={`${baseId}-painel-${tab.id}`}
                tabIndex={selected ? 0 : -1}
                disabled={tab.disabled}
                onClick={() => select(tab.id)}
                className={cn(
                  "relative -mb-px inline-flex h-11 items-center gap-2 rounded-t-control border-b-2 px-3.5 text-[0.9375rem] font-semibold whitespace-nowrap transition-colors disabled:opacity-50 [&_svg]:size-4",
                  selected
                    ? "border-primary text-primary"
                    : "border-transparent text-fg-muted hover:border-border-strong hover:text-fg",
                )}
              >
                {tab.icon}
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>
      {tabs.map((tab) => (
        <div
          key={tab.id}
          role="tabpanel"
          id={`${baseId}-painel-${tab.id}`}
          aria-labelledby={`${baseId}-tab-${tab.id}`}
          hidden={tab.id !== active}
          tabIndex={0}
          className={cn("pt-5 focus-visible:outline-offset-4", panelClassName)}
        >
          {tab.content}
        </div>
      ))}
    </div>
  );
}
