"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { AreaSelect } from "@/components/papers/area-select";
import { Button, Checkbox, ChipLink, Dialog, Field, Input, Select, Spinner } from "@/components/ui";
import { CAREER_STAGE_OPTIONS, MEETING_FORMATS, type CareerStage } from "@/lib/constants";
import { countOpportunitiesAction } from "@/lib/opportunities/actions";
import { OPPORTUNITY_KIND_OPTIONS, MODALITY_ORDER } from "@/lib/opportunities/labels";
import {
  activeFilterChips,
  filtersHref,
  type OpportunityFilterKey,
  filtersToSearchParams,
  parseOpportunityFilters,
  parseSearch,
  type OpportunityFilters as Filters,
} from "@/lib/opportunities/params";
import type { AreaRow } from "@/lib/papers/params";
import { pluralize } from "@/lib/utils";

const MODALITY_OPTIONS = MODALITY_ORDER.map((value) => ({ value, label: MEETING_FORMATS[value] }));
const SEARCH_DELAY_MS = 450;
const COUNT_DELAY_MS = 250;

/** Os filtros além da busca (o que a gaveta do celular edita). */
type Choices = Omit<Filters, "q" | "page">;

const NO_CHOICES: Choices = {
  area: "",
  tipo: "",
  bolsa: false,
  modalidade: "",
  etapa: "",
  encerradas: false,
};

function choicesOf(filters: Filters): Choices {
  const { area, tipo, bolsa, modalidade, etapa, encerradas } = filters;
  return { area, tipo, bolsa, modalidade, etapa, encerradas };
}

function countChoices(choices: Choices): number {
  return Object.values(choices).filter(Boolean).length;
}

export interface OpportunityFiltersProps {
  filters: Filters;
  areas: readonly AreaRow[];
  /** Etapa da usuária: marcada como "(a sua etapa)" na lista. */
  myStage: CareerStage | null;
  /** Total de vagas com os filtros atuais (ponto de partida do "Ver N vagas"). */
  total: number | null;
}

/**
 * Filtros do Explorar ICs.
 *
 * - Computador: o formulário aplica a cada mudança (a busca, depois de uma pausa na digitação) com
 *   `router.replace` dentro de uma transição — sem recarregar nem remontar, então o foco fica no
 *   campo que mudou. A contagem de resultados (#resultados-ics) é anunciada pelo aria-live.
 * - Celular: uma barra fixa no topo com a busca e "Filtros (n)", que abre uma gaveta inferior com
 *   os demais filtros e o botão "Ver N vagas" (a contagem é feita antes de aplicar).
 *
 * A URL guarda tudo (sem parâmetros vazios): dá para compartilhar uma busca. Sem JavaScript, o
 * formulário do computador é um GET comum para /ics.
 */
export function OpportunityFilters({ filters, areas, myStage, total }: OpportunityFiltersProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState(filters.q);
  const [choices, setChoices] = useState<Choices>(() => choicesOf(filters));
  const [searchFocused, setSearchFocused] = useState(false);
  const searchTimer = useRef<number | undefined>(undefined);
  const mobileSearch = useRef<HTMLInputElement>(null);
  const desktopSearch = useRef<HTMLInputElement>(null);
  // Para onde vai o foco quando a URL atualizar: o controle clicado (chip, "Limpar filtros") some
  // da tela, e o foco não pode cair no <body>. Valor = chave de um chip ou "busca".
  const focusAfter = useRef<OpportunityFilterKey | "busca" | null>(null);

  // A URL mudou por fora (chip removido, "Limpar filtros", voltar no histórico): os campos
  // acompanham. A busca só é trocada se a pessoa não estiver digitando nela.
  const key = JSON.stringify(filters);
  const [lastKey, setLastKey] = useState(key);
  if (key !== lastKey) {
    setLastKey(key);
    setChoices(choicesOf(filters));
    if (!searchFocused && parseSearch(q) !== filters.q) setQ(filters.q);
  }

  const stageOptions = CAREER_STAGE_OPTIONS.map((option) => ({
    value: option.value,
    label: option.value === myStage ? `${option.label} (a sua etapa)` : option.label,
  }));
  const areaName = filters.area ? areas.find((a) => a.slug === filters.area)?.name : undefined;
  const chips = activeFilterChips(filters, { area: areaName });
  const activeChoices = countChoices(choicesOf(filters));

  useEffect(() => {
    const target = focusAfter.current;
    if (!target) return;
    focusAfter.current = null;
    const chip =
      target === "busca" ? null : document.querySelector<HTMLElement>(`[data-filtro="${target}"]`);
    // A busca visível: a da barra do celular ou a do formulário do computador.
    const search = [desktopSearch.current, mobileSearch.current].find(
      (el) => el && el.offsetParent !== null,
    );
    (chip ?? search)?.focus();
  }, [key]);

  function navigate(next: Choices, nextQ: string) {
    window.clearTimeout(searchTimer.current);
    const href = filtersHref({ ...next, q: parseSearch(nextQ), page: 1 });
    startTransition(() => router.replace(href, { scroll: false }));
  }

  function change<K extends keyof Choices>(name: K, value: Choices[K]) {
    const next = { ...choices, [name]: value };
    setChoices(next);
    navigate(next, q);
  }

  function typeSearch(value: string) {
    setQ(value);
    window.clearTimeout(searchTimer.current);
    searchTimer.current = window.setTimeout(() => navigate(choices, value), SEARCH_DELAY_MS);
  }

  /** "Limpar filtros": tudo volta ao padrão e o foco vai para a busca. */
  function clearAll() {
    setChoices(NO_CHOICES);
    setQ("");
    focusAfter.current = "busca";
    navigate(NO_CHOICES, "");
  }

  /** Remove um chip; o foco vai para o chip seguinte (ou o anterior) e, sem chips, para a busca. */
  function removeChip(index: number) {
    const chip = chips[index]!;
    const neighbor = chips[index + 1] ?? chips[index - 1];
    focusAfter.current = neighbor?.key ?? "busca";
    if (chip.key === "q") {
      setQ("");
      navigate(choices, "");
    } else {
      const next = { ...choices, [chip.key]: NO_CHOICES[chip.key] };
      setChoices(next);
      navigate(next, q);
    }
  }

  function submitSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    navigate(choices, q);
  }

  const searchProps = {
    name: "q",
    type: "search",
    value: q,
    maxLength: 100,
    leadingIcon: <Search />,
    enterKeyHint: "search" as const,
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => typeSearch(event.currentTarget.value),
    onFocus: () => setSearchFocused(true),
    onBlur: () => setSearchFocused(false),
  };

  const status = (
    <span
      aria-hidden="true"
      className="inline-flex min-h-5 items-center gap-1.5 text-sm text-fg-subtle"
    >
      {pending && (
        <>
          <Spinner decorative />
          Atualizando…
        </>
      )}
    </span>
  );

  return (
    // No celular o invólucro não gera caixa (contents): a barra fixa (sticky) fica presa ao
    // Container da página inteira, e não só a este bloco.
    <div className="contents lg:grid lg:gap-3">
      {/* Celular: busca + "Filtros (n)" fixos no topo (abaixo do cabeçalho do site). A gaveta
          tem o próprio <form>, por isso fica fora do formulário da busca. */}
      <div className="sticky top-16 z-30 -mx-4 flex items-center gap-2 border-b border-border bg-bg/95 px-4 py-2 backdrop-blur-md sm:-mx-6 sm:px-6 lg:hidden">
        <form
          action="/ics"
          role="search"
          aria-label="Buscar vagas"
          onSubmit={submitSearch}
          className="min-w-0 flex-1"
        >
          <Field label="Buscar vagas" hideLabel>
            <Input ref={mobileSearch} {...searchProps} placeholder="Buscar vagas" />
          </Field>
        </form>
        <FilterSheet
          filters={filters}
          q={q}
          areas={areas}
          stageOptions={stageOptions}
          total={total}
          activeCount={activeChoices}
          onApply={(next) => {
            setChoices(next);
            navigate(next, q);
          }}
        />
      </div>

      {/* Computador: todos os filtros, aplicados a cada mudança. */}
      <form
        action="/ics"
        role="search"
        aria-label="Filtrar vagas"
        onSubmit={submitSearch}
        className="hidden gap-4 rounded-card border border-border bg-surface p-5 shadow-card lg:grid"
      >
        <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)] gap-4">
          <Field label="Buscar" hint="Título, descrição, palavras-chave, instituição ou cidade">
            <Input
              ref={desktopSearch}
              {...searchProps}
              placeholder="Ex.: abelhas, robótica, INPE"
            />
          </Field>
          <Field label="Área de pesquisa" hint="Uma grande área inclui as subáreas">
            <AreaSelect
              areas={areas}
              mode="filter"
              name="area"
              value={choices.area}
              onChange={(event) => change("area", event.currentTarget.value)}
              placeholder="Todas as áreas"
            />
          </Field>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <Field label="Tipo">
            <Select
              name="tipo"
              value={choices.tipo}
              onChange={(event) => change("tipo", parsed("tipo", event.currentTarget.value))}
              placeholder="Todos os tipos"
              options={OPPORTUNITY_KIND_OPTIONS}
            />
          </Field>
          <Field label="Modalidade">
            <Select
              name="modalidade"
              value={choices.modalidade}
              onChange={(event) =>
                change("modalidade", parsed("modalidade", event.currentTarget.value))
              }
              placeholder="Todas as modalidades"
              options={MODALITY_OPTIONS}
            />
          </Field>
          <Field label="Para a etapa">
            <Select
              name="etapa"
              value={choices.etapa}
              onChange={(event) => change("etapa", parsed("etapa", event.currentTarget.value))}
              placeholder="Todas as etapas"
              options={stageOptions}
            />
          </Field>
        </div>
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
          <Checkbox
            name="bolsa"
            value="1"
            checked={choices.bolsa}
            onChange={(event) => change("bolsa", event.currentTarget.checked)}
            label="Só com bolsa"
          />
          <Checkbox
            name="encerradas"
            value="1"
            checked={choices.encerradas}
            onChange={(event) => change("encerradas", event.currentTarget.checked)}
            label="Mostrar encerradas"
            description="Inclui vagas encerradas e com o prazo vencido."
          />
          <div className="ml-auto flex items-center gap-3">
            {status}
            {(chips.length > 0 || q) && (
              <Button variant="ghost" onClick={clearAll}>
                Limpar filtros
              </Button>
            )}
          </div>
        </div>
      </form>

      {chips.length > 0 && (
        // min-w-0: um chip comprido não alarga a coluna no celular (ele trunca).
        <div className="mt-3 grid min-w-0 gap-2 sm:flex sm:flex-wrap sm:items-center lg:mt-0">
          <p id="filtros-ativos-ics" className="text-sm font-semibold text-fg-muted">
            Filtros ativos:
          </p>
          <ul aria-labelledby="filtros-ativos-ics" className="flex min-w-0 flex-wrap gap-2">
            {chips.map((chip, index) => (
              <li key={chip.key} className="max-w-full">
                {/* Sem JavaScript é um link comum; com ele, remove sem recarregar e cuida do foco. */}
                <ChipLink
                  href={chip.href}
                  scroll={false}
                  data-filtro={chip.key}
                  onClick={(event) => {
                    event.preventDefault();
                    removeChip(index);
                  }}
                  aria-label={`Remover filtro ${chip.label}`}
                  icon={<X aria-hidden="true" />}
                  className="flex-row-reverse"
                >
                  {chip.label}
                </ChipLink>
              </li>
            ))}
          </ul>
          <span className="lg:hidden">{status}</span>
        </div>
      )}
    </div>
  );
}

/** Valor de um <select> já validado (o mesmo parser da URL; valor inesperado vira ""). */
function parsed<K extends "tipo" | "modalidade" | "etapa">(name: K, value: string): Filters[K] {
  return parseOpportunityFilters({ [name]: value })[name];
}

// ---------------------------------------------------------------------------
// Gaveta de filtros (celular)
// ---------------------------------------------------------------------------

function FilterSheet({
  filters,
  q,
  areas,
  stageOptions,
  total,
  activeCount,
  onApply,
}: {
  filters: Filters;
  q: string;
  areas: readonly AreaRow[];
  stageOptions: { value: string; label: string }[];
  total: number | null;
  activeCount: number;
  onApply: (choices: Choices) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Choices>(() => choicesOf(filters));
  const [count, setCount] = useState<number | null>(total);
  const [counting, startCounting] = useTransition();
  const countTimer = useRef<number | undefined>(undefined);
  const request = useRef(0);

  function openSheet() {
    setDraft(choicesOf(filters));
    setCount(total);
    setOpen(true);
  }

  function update(next: Choices) {
    setDraft(next);
    window.clearTimeout(countTimer.current);
    const id = ++request.current;
    countTimer.current = window.setTimeout(() => {
      startCounting(async () => {
        const result = await countOpportunitiesAction(
          filtersToSearchParams({ ...next, q: parseSearch(q), page: 1 }),
        );
        // Só a resposta mais recente vale (as anteriores podem chegar fora de ordem).
        if (id === request.current) setCount(result.ok ? result.count : null);
      });
    }, COUNT_DELAY_MS);
  }

  function set<K extends keyof Choices>(name: K, value: Choices[K]) {
    update({ ...draft, [name]: value });
  }

  const applyLabel =
    count === null
      ? "Ver vagas"
      : count === 0
        ? "Aplicar filtros"
        : `Ver ${pluralize(count, "vaga")}`;

  return (
    <>
      <Button
        variant="outline"
        className="h-11 shrink-0"
        onClick={openSheet}
        aria-haspopup="dialog"
        aria-label={
          activeCount > 0 ? `Filtros, ${pluralize(activeCount, "ativo", "ativos")}` : "Filtros"
        }
      >
        <SlidersHorizontal aria-hidden="true" />
        Filtros
        {activeCount > 0 && (
          <span
            aria-hidden="true"
            className="rounded-pill bg-primary px-1.5 py-px text-xs font-bold text-primary-fg tabular"
          >
            {activeCount}
          </span>
        )}
      </Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Filtrar vagas"
        description={q ? `Busca: “${q}”` : undefined}
        className="mt-auto mb-0 w-full max-w-none rounded-b-none pb-[env(safe-area-inset-bottom)] sm:mb-auto sm:max-w-lg sm:rounded-b-dialog"
        formProps={{
          onSubmit: (event) => {
            event.preventDefault();
            onApply(draft);
            setOpen(false);
          },
        }}
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => update(NO_CHOICES)}
              disabled={countChoices(draft) === 0}
            >
              Limpar
            </Button>
            <Button type="submit" loading={counting} loadingText="Contando vagas…">
              {applyLabel}
            </Button>
          </>
        }
      >
        <div className="grid gap-4">
          <Field label="Área de pesquisa" hint="Uma grande área inclui as subáreas">
            <AreaSelect
              areas={areas}
              mode="filter"
              name="area"
              value={draft.area}
              onChange={(event) => set("area", event.currentTarget.value)}
              placeholder="Todas as áreas"
            />
          </Field>
          <Field label="Tipo">
            <Select
              name="tipo"
              value={draft.tipo}
              onChange={(event) => set("tipo", parsed("tipo", event.currentTarget.value))}
              placeholder="Todos os tipos"
              options={OPPORTUNITY_KIND_OPTIONS}
            />
          </Field>
          <Field label="Modalidade">
            <Select
              name="modalidade"
              value={draft.modalidade}
              onChange={(event) =>
                set("modalidade", parsed("modalidade", event.currentTarget.value))
              }
              placeholder="Todas as modalidades"
              options={MODALITY_OPTIONS}
            />
          </Field>
          <Field label="Para a etapa">
            <Select
              name="etapa"
              value={draft.etapa}
              onChange={(event) => set("etapa", parsed("etapa", event.currentTarget.value))}
              placeholder="Todas as etapas"
              options={stageOptions}
            />
          </Field>
          <div className="grid gap-3">
            <Checkbox
              name="bolsa"
              value="1"
              checked={draft.bolsa}
              onChange={(event) => set("bolsa", event.currentTarget.checked)}
              label="Só com bolsa"
            />
            <Checkbox
              name="encerradas"
              value="1"
              checked={draft.encerradas}
              onChange={(event) => set("encerradas", event.currentTarget.checked)}
              label="Mostrar encerradas"
              description="Inclui vagas encerradas e com o prazo vencido."
            />
          </div>
          <p aria-live="polite" className="text-sm text-fg-muted">
            {count === 0 ? "Nenhuma vaga com esses filtros — tente tirar algum." : null}
          </p>
        </div>
      </Dialog>
    </>
  );
}
