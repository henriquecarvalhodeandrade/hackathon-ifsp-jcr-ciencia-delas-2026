"use client";

import { useId, useMemo, useState } from "react";
import { ChevronDown, CircleAlert, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ChipGroup } from "@/components/ui/chip-group";
import type { FieldError } from "@/components/ui/field";
import type { AreaGroup } from "@/lib/profile/areas";
import { cn, formatNumber } from "@/lib/utils";

export interface AreaPickerProps {
  groups: readonly AreaGroup[];
  /** Nome do campo (um checkbox por área marcada → formData.getAll(name)). */
  name?: string;
  defaultValue?: readonly string[];
  max?: number;
  error?: FieldError;
  legend?: string;
  hint?: React.ReactNode;
}

/**
 * Escolha de áreas de pesquisa agrupadas pelas grandes áreas do CNPq, com limite total.
 * Cada grande área é um <details> nativo (abre sozinho quando já tem algo marcado);
 * no topo, as áreas escolhidas aparecem como chips removíveis.
 */
export function AreaPicker({
  groups,
  name = "area_ids",
  defaultValue = [],
  max = 5,
  error,
  legend = "Áreas de pesquisa",
  hint = "Escolha até 5. Elas guiam as sugestões de mentoria e os filtros do diretório.",
}: AreaPickerProps) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const [selected, setSelected] = useState<string[]>(() => [...defaultValue]);
  const [initiallyOpen] = useState(() => {
    const chosen = new Set(defaultValue);
    return new Set(
      groups
        .filter((g) => [g.general, ...g.areas].some((area) => area && chosen.has(String(area.id))))
        .map((g) => g.bigArea),
    );
  });

  const labels = useMemo(() => {
    const map = new Map<string, string>();
    for (const group of groups) {
      if (group.general) map.set(String(group.general.id), group.general.name);
      for (const area of group.areas) map.set(String(area.id), area.name);
    }
    return map;
  }, [groups]);

  const atLimit = selected.length >= max;
  const message = typeof error === "string" ? error : error?.[0];
  const hintId = `${id}-dica`;
  const statusId = `${id}-status`;
  const errorId = message ? `${id}-erro` : undefined;

  return (
    <fieldset className="grid gap-3" aria-describedby={[hintId, statusId, errorId].filter(Boolean).join(" ")}>
      <legend className="mb-1 text-sm font-semibold text-fg">
        {legend}
        <span aria-hidden="true" className="ml-0.5 text-danger">
          *
        </span>
      </legend>
      <p id={hintId} className="-mt-1 text-sm text-fg-muted">
        {hint}
      </p>

      <div className="grid gap-2 rounded-control border border-dashed border-border-strong bg-surface-2 p-3">
        {selected.length === 0 ? (
          <p className="text-sm text-fg-subtle">Nenhuma área escolhida ainda. Abra uma grande área abaixo.</p>
        ) : (
          <ul aria-label="Áreas escolhidas" className="flex flex-wrap gap-2">
            {selected.map((value) => {
              const label = labels.get(value) ?? value;
              return (
                <li
                  key={value}
                  className="inline-flex h-8 max-w-full items-center gap-1 rounded-pill bg-primary-soft pr-1 pl-3 text-sm font-medium text-primary-soft-fg"
                >
                  <span className="truncate">{label}</span>
                  <button
                    type="button"
                    onClick={() => setSelected((prev) => prev.filter((v) => v !== value))}
                    className="inline-flex size-6 items-center justify-center rounded-full transition-colors hover:bg-primary/15"
                    aria-label={`Remover ${label}`}
                  >
                    <X aria-hidden="true" className="size-3.5" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <p
          id={statusId}
          aria-live="polite"
          className={cn("text-xs", atLimit ? "font-semibold text-fg-muted" : "text-fg-subtle")}
        >
          {formatNumber(selected.length)} de {formatNumber(max)} selecionadas
          {atLimit && " — limite atingido. Remova uma para trocar."}
        </p>
      </div>

      <div className="grid gap-2">
        {groups.map((group) => {
          const areas = group.general ? [group.general, ...group.areas] : group.areas;
          const optionIds = new Set(areas.map((area) => String(area.id)));
          const groupSelected = selected.filter((value) => optionIds.has(value));
          const options = areas.map((area) => {
            const value = String(area.id);
            return {
              value,
              label: area === group.general ? "Geral (toda a grande área)" : area.name,
              disabled: atLimit && !selected.includes(value),
            };
          });
          return (
            <details
              key={group.bigArea}
              open={initiallyOpen.has(group.bigArea) || undefined}
              className="group rounded-control border border-border bg-surface open:border-border-strong"
            >
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-control px-4 py-2.5 font-semibold text-fg select-none hover:bg-surface-2 [&::-webkit-details-marker]:hidden">
                <span>{group.bigArea}</span>
                <span className="flex shrink-0 items-center gap-2">
                  {groupSelected.length > 0 && (
                    <Badge variant="primary">
                      {formatNumber(groupSelected.length)}
                      <span className="sr-only"> selecionada(s)</span>
                    </Badge>
                  )}
                  <ChevronDown
                    aria-hidden="true"
                    className="size-4 text-fg-subtle transition-transform duration-150 group-open:rotate-180"
                  />
                </span>
              </summary>
              <div className="px-4 pt-1 pb-4">
                <ChipGroup
                  name={name}
                  legend={group.bigArea}
                  hideLegend
                  options={options}
                  value={groupSelected}
                  onValueChange={(next) =>
                    setSelected((prev) => [...prev.filter((value) => !optionIds.has(value)), ...next])
                  }
                />
              </div>
            </details>
          );
        })}
      </div>

      {message && (
        <p id={errorId} className="flex items-start gap-1.5 text-sm font-medium text-danger">
          <CircleAlert aria-hidden="true" className="mt-0.5 size-4" />
          <span>{message}</span>
        </p>
      )}
    </fieldset>
  );
}
