"use client";

import { useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { THEME_EVENT, THEME_STORAGE_KEY, type ThemePreference } from "./theme";

const ORDER: ThemePreference[] = ["system", "light", "dark"];
const LABELS: Record<ThemePreference, string> = {
  system: "automático (do sistema)",
  light: "claro",
  dark: "escuro",
};
const ICONS = { system: Monitor, light: Sun, dark: Moon } as const;

function readPreference(): ThemePreference {
  const p = document.documentElement.dataset.themePreference;
  return p === "light" || p === "dark" ? p : "system";
}

function subscribe(callback: () => void) {
  window.addEventListener(THEME_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(THEME_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

/** Aplica e persiste a preferência de tema (usado pelo botão e por quem mais precisar). */
export function setThemePreference(preference: ThemePreference) {
  const root = document.documentElement;
  const resolved =
    preference === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : preference;
  root.dataset.themePreference = preference;
  root.dataset.theme = resolved;
  try {
    if (preference === "system") localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // armazenamento bloqueado: o tema vale só para esta página
  }
  window.dispatchEvent(new Event(THEME_EVENT));
}

export interface ThemeToggleProps {
  className?: string;
  /** Mostra o nome do tema ao lado do ícone (útil no menu do celular). */
  showLabel?: boolean;
}

/** Alterna o tema: automático → claro → escuro. */
export function ThemeToggle({ className, showLabel = false }: ThemeToggleProps) {
  const preference = useSyncExternalStore<ThemePreference>(subscribe, readPreference, () => "system");
  const next = ORDER[(ORDER.indexOf(preference) + 1) % ORDER.length]!;
  const Icon = ICONS[preference];

  return (
    <button
      type="button"
      onClick={() => setThemePreference(next)}
      aria-label={`Tema ${LABELS[preference]}. Mudar para tema ${LABELS[next]}`}
      title={`Tema ${LABELS[preference]}`}
      className={cn(
        "inline-flex h-10 items-center justify-center gap-2 rounded-control text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg [&_svg]:size-5",
        showLabel ? "px-3 text-[0.9375rem] font-semibold" : "w-10",
        className,
      )}
    >
      <Icon aria-hidden="true" />
      {showLabel && <span>Tema {LABELS[preference]}</span>}
    </button>
  );
}
