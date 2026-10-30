import { ChipLink } from "@/components/ui";
import { QUESTION_STAGES, STAGE_LABELS, type QuestionStage } from "@/lib/pergunte/labels";
import { filterHref } from "@/lib/pergunte/params";
import type { BigArea } from "@/lib/pergunte/queries";

export interface QuestionFiltersProps {
  stage: QuestionStage | null;
  areaId: number | null;
  areas: readonly BigArea[];
}

/** Filtros por etapa e grande área (links: funcionam sem JavaScript e voltam à página 1). */
export function QuestionFilters({ stage, areaId, areas }: QuestionFiltersProps) {
  return (
    <div className="grid gap-4">
      <nav aria-labelledby="filtro-etapa" className="grid gap-2">
        <p id="filtro-etapa" className="text-sm font-semibold text-fg-muted">
          Etapa de quem perguntou
        </p>
        <ul className="flex flex-wrap gap-2">
          <li>
            <ChipLink href={filterHref({ stage: null, areaId })} active={!stage}>
              Todas
            </ChipLink>
          </li>
          {QUESTION_STAGES.map((value) => (
            <li key={value}>
              <ChipLink href={filterHref({ stage: value, areaId })} active={stage === value}>
                {STAGE_LABELS[value]}
              </ChipLink>
            </li>
          ))}
        </ul>
      </nav>
      {areas.length > 0 && (
        <nav aria-labelledby="filtro-area" className="grid gap-2">
          <p id="filtro-area" className="text-sm font-semibold text-fg-muted">
            Área
          </p>
          <ul className="flex flex-wrap gap-2">
            <li>
              <ChipLink href={filterHref({ stage, areaId: null })} active={!areaId}>
                Todas as áreas
              </ChipLink>
            </li>
            {areas.map((area) => (
              <li key={area.id} className="max-w-full">
                <ChipLink href={filterHref({ stage, areaId: area.id })} active={areaId === area.id}>
                  {area.name}
                </ChipLink>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </div>
  );
}
