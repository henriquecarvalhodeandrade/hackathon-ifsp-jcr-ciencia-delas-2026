import Form from "next/form";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ChipLink } from "@/components/ui/chip";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { BR_STATES, CAREER_STAGE_OPTIONS } from "@/lib/constants";
import type { AreaGroup } from "@/lib/profile/areas";
import { activeFilterChips, type DirectoryFilters as Filters } from "@/lib/profile/directory";
import { TRAJECTORY_FILTER_OPTIONS } from "@/lib/trajectory/catalog";

const UF_OPTIONS = Object.entries(BR_STATES).map(([value, label]) => ({
  value,
  label: `${value} — ${label}`,
}));

export interface DirectoryFiltersProps {
  filters: Filters;
  areaGroups: readonly AreaGroup[];
  hasActive: boolean;
}

/**
 * Filtros do diretório num formulário GET (funciona sem JavaScript; com JS, o <Form> do Next
 * navega no cliente). Os valores ficam na URL — dá para compartilhar uma busca. Os filtros
 * ativos aparecem como chips; cada um remove só aquele filtro.
 */
export function DirectoryFilters({ filters, areaGroups, hasActive }: DirectoryFiltersProps) {
  const areaName = filters.area
    ? areaGroups
        .flatMap((group) => (group.general ? [group.general, ...group.areas] : group.areas))
        .find((area) => area.slug === filters.area)?.name
    : undefined;
  const chips = activeFilterChips(filters, { area: areaName });

  return (
    <Form
      action="/pesquisadoras"
      role="search"
      aria-label="Filtrar pesquisadoras"
      className="grid gap-4 rounded-card border border-border bg-surface p-4 shadow-card sm:p-5"
    >
      <div className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)]">
        <Field label="Buscar" hint="Nome, instituição, título do perfil, cidade ou palavras-chave">
          <Input
            name="q"
            type="search"
            defaultValue={filters.q}
            leadingIcon={<Search />}
            placeholder="Ex.: Marina, INPE, ecologia"
            enterKeyHint="search"
          />
        </Field>
        <Field label="Área de pesquisa" hint="Uma grande área inclui as subáreas">
          <Select name="area" defaultValue={filters.area}>
            <option value="">Todas as áreas</option>
            {areaGroups.map((group) => (
              <optgroup key={group.bigArea} label={group.bigArea}>
                {group.general && (
                  <option value={group.general.slug}>{group.general.name} (todas)</option>
                )}
                {group.areas.map((area) => (
                  <option key={area.id} value={area.slug}>
                    {area.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </Select>
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)_auto] lg:items-end">
        <Field label="Fase da carreira">
          <Select
            name="stage"
            defaultValue={filters.stage}
            placeholder="Todas as fases"
            options={CAREER_STAGE_OPTIONS}
          />
        </Field>
        <Field label="Estado">
          <Select
            name="uf"
            defaultValue={filters.uf}
            placeholder="Todos os estados"
            options={UF_OPTIONS}
          />
        </Field>
        <Field label="Trajetória">
          <Select
            name="trajetoria"
            defaultValue={filters.trajetoria}
            placeholder="Todas as trajetórias"
            options={TRAJECTORY_FILTER_OPTIONS}
          />
        </Field>
        <div className="flex min-h-11 items-center sm:self-end lg:col-span-1">
          <Checkbox
            name="mentoras"
            value="1"
            defaultChecked={filters.mentoras}
            label="Só mentoras"
          />
        </div>
      </div>

      {chips.length > 0 && (
        // min-w-0: um chip comprido não alarga a coluna do formulário no celular (ele trunca).
        <div className="grid min-w-0 gap-2 sm:flex sm:flex-wrap sm:items-center">
          <p id="filtros-ativos" className="text-sm font-semibold text-fg-muted">
            Filtros ativos:
          </p>
          <ul aria-labelledby="filtros-ativos" className="flex min-w-0 flex-wrap gap-2">
            {chips.map((chip) => (
              <li key={chip.key} className="max-w-full">
                <ChipLink
                  href={chip.href}
                  aria-label={`Remover filtro ${chip.label}`}
                  icon={<X aria-hidden="true" />}
                  className="flex-row-reverse"
                >
                  {chip.label}
                </ChipLink>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
        <Button type="submit">
          <SlidersHorizontal aria-hidden="true" />
          Filtrar
        </Button>
        {hasActive && (
          <ButtonLink href="/pesquisadoras" variant="ghost">
            Limpar filtros
          </ButtonLink>
        )}
      </div>
    </Form>
  );
}
