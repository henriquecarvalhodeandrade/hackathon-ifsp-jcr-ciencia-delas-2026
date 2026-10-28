import Form from "next/form";
import Link from "next/link";
import { Search, X } from "lucide-react";
import { Button, Field, Input } from "@/components/ui";
import type { AreaRow } from "@/lib/papers/params";
import { cn } from "@/lib/utils";
import { AreaSelect } from "./area-select";

export interface PaperFiltersProps {
  areas: readonly AreaRow[];
  /** Valor atual de ?periodo= (mantido ao filtrar). */
  order: string;
  areaSlug: string | null;
  q?: string;
  /** Mostra a busca por texto (a Vitrine tem; o ranking não). */
  withSearch?: boolean;
  action: string;
  /** Parâmetros extras a preservar (ex.: aba do ranking). */
  hidden?: Record<string, string>;
  clearHref: string;
}

/** Filtros por URL (GET): funcionam sem JavaScript e com navegação no cliente via next/form. */
export function PaperFilters({
  areas,
  order,
  areaSlug,
  q = "",
  withSearch = true,
  action,
  hidden,
  clearHref,
}: PaperFiltersProps) {
  const active = Boolean(areaSlug || q);
  return (
    <Form
      action={action}
      role="search"
      aria-label="Filtrar papers"
      className={cn(
        "grid gap-3 rounded-card border border-border bg-surface p-4 shadow-card sm:items-end",
        withSearch
          ? "sm:grid-cols-[minmax(0,1fr)_minmax(0,18rem)_auto]"
          : "sm:grid-cols-[minmax(0,24rem)_auto] sm:justify-start",
      )}
    >
      <input type="hidden" name="periodo" value={order} />
      {hidden &&
        Object.entries(hidden).map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}
      {withSearch ? (
        <Field label="Buscar" hint="Título, resumo, autoras, palavras-chave ou revista">
          <Input
            name="q"
            type="search"
            defaultValue={q}
            maxLength={100}
            placeholder="Ex.: abelhas, grafeno, pré-natal"
            leadingIcon={<Search />}
            enterKeyHint="search"
          />
        </Field>
      ) : null}
      <Field label="Área">
        <AreaSelect
          key={areaSlug ?? "todas"}
          areas={areas}
          mode="filter"
          name="area"
          defaultValue={areaSlug ?? ""}
          placeholder="Todas as áreas"
        />
      </Field>
      <div className="flex gap-2">
        <Button type="submit" variant="secondary" className="h-11 flex-1 sm:flex-none">
          Filtrar
        </Button>
        {active && (
          <Link
            href={clearHref}
            className="inline-flex h-11 items-center gap-1.5 rounded-control px-3 text-sm font-semibold text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
          >
            <X aria-hidden="true" className="size-4" />
            Limpar
          </Link>
        )}
      </div>
    </Form>
  );
}
