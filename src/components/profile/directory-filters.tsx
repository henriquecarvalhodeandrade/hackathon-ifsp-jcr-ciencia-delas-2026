import Form from "next/form";
import { Search, SlidersHorizontal } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { BR_STATES, CAREER_STAGE_OPTIONS } from "@/lib/constants";
import type { AreaGroup } from "@/lib/profile/areas";
import type { DirectoryFilters as Filters } from "@/lib/profile/directory";

const UF_OPTIONS = Object.entries(BR_STATES).map(([value, label]) => ({ value, label: `${value} — ${label}` }));

export interface DirectoryFiltersProps {
  filters: Filters;
  areaGroups: readonly AreaGroup[];
  hasActive: boolean;
}

/**
 * Filtros do diretório num formulário GET (funciona sem JavaScript; com JS, o <Form> do Next
 * navega no cliente). Os valores ficam na URL — dá para compartilhar uma busca.
 */
export function DirectoryFilters({ filters, areaGroups, hasActive }: DirectoryFiltersProps) {
  return (
    <Form
      action="/pesquisadoras"
      role="search"
      aria-label="Filtrar pesquisadoras"
      className="grid gap-4 rounded-card border border-border bg-surface p-4 shadow-card sm:p-5"
    >
      <div className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)]">
        <Field label="Buscar" hint="Nome, instituição ou título do perfil">
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
                {group.general && <option value={group.general.slug}>{group.general.name} (todas)</option>}
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

      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end">
        <Field label="Fase da carreira">
          <Select name="stage" defaultValue={filters.stage} placeholder="Todas as fases" options={CAREER_STAGE_OPTIONS} />
        </Field>
        <Field label="Estado">
          <Select name="uf" defaultValue={filters.uf} placeholder="Todos os estados" options={UF_OPTIONS} />
        </Field>
        <div className="flex min-h-11 items-center sm:col-span-2 md:col-span-1">
          <Checkbox name="mentoras" value="1" defaultChecked={filters.mentoras} label="Só mentoras" />
        </div>
      </div>

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
