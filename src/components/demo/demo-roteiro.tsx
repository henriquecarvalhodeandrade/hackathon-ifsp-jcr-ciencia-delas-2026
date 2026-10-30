"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { Checkbox } from "@/components/ui";
import { cn, formatNumber } from "@/lib/utils";

export interface RoteiroStep {
  id: string;
  href: string;
  title: string;
  description: string;
}

const STORAGE_KEY = "artemis-demo-roteiro";
const CHANGE_EVENT = "artemis-demo-roteiro-change";

/** Lê os passos já vistos (só neste navegador). Armazenamento bloqueado = nada visto. */
function readSnapshot(): string {
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

function subscribe(callback: () => void) {
  window.addEventListener(CHANGE_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(CHANGE_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

function parseSeen(snapshot: string, validIds: ReadonlySet<string>): Set<string> {
  return new Set(snapshot.split(",").filter((id) => validIds.has(id)));
}

function writeSeen(seen: ReadonlySet<string>) {
  try {
    window.localStorage.setItem(STORAGE_KEY, [...seen].join(","));
  } catch {
    // armazenamento bloqueado (aba anônima, política do navegador): a marcação vale só agora
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export interface DemoRoteiroProps {
  steps: readonly RoteiroStep[];
}

/**
 * "Roteiro de 3 minutos": links diretos para as telas da demonstração, com um "já vi" opcional
 * guardado só neste navegador (conveniência; nada vai para o servidor).
 */
export function DemoRoteiro({ steps }: DemoRoteiroProps) {
  const snapshot = useSyncExternalStore(subscribe, readSnapshot, () => "");
  const validIds = new Set(steps.map((s) => s.id));
  const seen = parseSeen(snapshot, validIds);
  const seenCount = steps.filter((s) => seen.has(s.id)).length;

  function toggle(id: string, checked: boolean) {
    const next = parseSeen(readSnapshot(), validIds);
    if (checked) next.add(id);
    else next.delete(id);
    writeSeen(next);
  }

  return (
    <div className="grid gap-4">
      <p aria-live="polite" className="text-sm font-medium text-fg-muted">
        {seenCount === 0
          ? "Marque cada parada quando passar por ela."
          : seenCount === steps.length
            ? "Roteiro completo. Obrigada pela visita!"
            : `${formatNumber(seenCount)} de ${formatNumber(steps.length)} paradas vistas.`}
      </p>
      <ol className="grid gap-2.5">
        {steps.map((step, index) => {
          const checked = seen.has(step.id);
          const checkboxId = `roteiro-${step.id}`;
          return (
            <li
              key={step.id}
              className={cn(
                "grid grid-cols-[2rem_minmax(0,1fr)] items-start gap-x-3 gap-y-2 rounded-control border border-border bg-surface p-3 transition-colors sm:grid-cols-[2rem_minmax(0,1fr)_auto] sm:items-center sm:p-3.5",
                checked && "bg-surface-2",
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "inline-flex size-8 items-center justify-center rounded-full font-display text-sm font-bold tabular",
                  checked
                    ? "bg-success-soft text-success-soft-fg"
                    : "bg-primary-soft text-primary-soft-fg",
                )}
              >
                {checked ? <Check strokeWidth={3} className="size-4" /> : index + 1}
              </span>
              <div className="grid min-w-0 gap-0.5">
                <Link
                  href={step.href}
                  className="justify-self-start rounded-control font-semibold text-fg underline-offset-4 hover:text-primary hover:underline"
                >
                  {step.title}
                </Link>
                <p className={cn("text-sm", checked ? "text-fg-subtle" : "text-fg-muted")}>
                  {step.description}
                </p>
              </div>
              <Checkbox
                id={checkboxId}
                checked={checked}
                onChange={(event) => toggle(step.id, event.currentTarget.checked)}
                label={
                  <>
                    Já vi<span className="sr-only">: {step.title}</span>
                  </>
                }
                className="col-start-2 justify-self-start text-sm sm:col-start-3 sm:items-center"
              />
            </li>
          );
        })}
      </ol>
    </div>
  );
}
