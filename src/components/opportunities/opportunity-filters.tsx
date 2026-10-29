import Form from "next/form";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { AreaSelect } from "@/components/papers/area-select";
import { Button, ButtonLink, Checkbox, ChipLink, Field, Input, Select } from "@/components/ui";
import { CAREER_STAGE_OPTIONS, MEETING_FORMATS, type CareerStage } from "@/lib/constants";
import { OPPORTUNITY_KIND_OPTIONS, MODALITY_ORDER } from "@/lib/opportunities/labels";
import { activeFilterChips, type OpportunityFilters as Filters } from "@/lib/opportunities/params";
import type { AreaRow } from "@/lib/papers/params";

const MODALITY_OPTIONS = MODALITY_ORDER.map((value) => ({ value, label: MEETING_FORMATS[value] }));

export interface OpportunityFiltersProps {
  filters: Filters;
  areas: readonly AreaRow[];
  /** Etapa da usuária: marcada como "(a sua etapa)" na lista. */
  myStage: CareerStage | null;
  hasActive: boolean;
}

/**
 * Filtros do Explorar ICs num formulário GET (funciona sem JavaScript; com JS, o <Form> do Next
 * navega no cliente). Os valores ficam na URL — dá para compartilhar uma busca. Os filtros ativos
 * aparecem como chips; cada um remove só aquele filtro.
 */
export function OpportunityFilters({
  filters,
  areas,
  myStage,
  hasActive,
}: OpportunityFiltersProps) {
  const areaName = filters.area ? areas.find((a) => a.slug === filters.area)?.name : undefined;
  const chips = activeFilterChips(filters, { area: areaName });
  const stageOptions = CAREER_STAGE_OPTIONS.map((option) => ({
    value: option.value,
    label: option.value === myStage ? `${option.label} (a sua etapa)` : option.label,
  }));

  return (
    <Form
      action="/ics"
      role="search"
      aria-label="Filtrar vagas"
      className="grid gap-4 rounded-card border border-border bg-surface p-4 shadow-card sm:p-5"
    >
      <div className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)]">
        <Field label="Buscar" hint="Título, descrição, palavras-chave, instituição ou cidade">
          <Input
            name="q"
            type="search"
            defaultValue={filters.q}
            maxLength={100}
            leadingIcon={<Search />}
            placeholder="Ex.: abelhas, robótica, INPE"
            enterKeyHint="search"
          />
        </Field>
        <Field label="Área de pesquisa" hint="Uma grande área inclui as subáreas">
          <AreaSelect
            areas={areas}
            mode="filter"
            name="area"
            defaultValue={filters.area}
            placeholder="Todas as áreas"
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Tipo">
          <Select
            name="tipo"
            defaultValue={filters.tipo}
            placeholder="Todos os tipos"
            options={OPPORTUNITY_KIND_OPTIONS}
          />
        </Field>
        <Field label="Modalidade">
          <Select
            name="modalidade"
            defaultValue={filters.modalidade}
            placeholder="Todas as modalidades"
            options={MODALITY_OPTIONS}
          />
        </Field>
        <Field label="Para a etapa">
          <Select
            name="etapa"
            defaultValue={filters.etapa}
            placeholder="Todas as etapas"
            options={stageOptions}
          />
        </Field>
      </div>

      <div className="flex flex-wrap gap-x-8 gap-y-3">
        <Checkbox name="bolsa" value="1" defaultChecked={filters.bolsa} label="Só com bolsa" />
        <Checkbox
          name="encerradas"
          value="1"
          defaultChecked={filters.encerradas}
          label="Mostrar encerradas"
          description="Inclui vagas encerradas e com o prazo vencido."
        />
      </div>

      {chips.length > 0 && (
        // min-w-0: um chip comprido não alarga a coluna do formulário no celular (ele trunca).
        <div className="grid min-w-0 gap-2 sm:flex sm:flex-wrap sm:items-center">
          <p id="filtros-ativos-ics" className="text-sm font-semibold text-fg-muted">
            Filtros ativos:
          </p>
          <ul aria-labelledby="filtros-ativos-ics" className="flex min-w-0 flex-wrap gap-2">
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
          <ButtonLink href="/ics" variant="ghost">
            Limpar filtros
          </ButtonLink>
        )}
      </div>
    </Form>
  );
}
