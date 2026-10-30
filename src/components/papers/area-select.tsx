import { Select, type SelectProps } from "@/components/ui";
import { groupAreas, type AreaRow } from "@/lib/papers/params";

export interface AreaSelectProps extends Omit<SelectProps, "options" | "children"> {
  areas: readonly AreaRow[];
  /**
   * "filter": valor = slug; cada grande área aparece como "todas" (inclui as subáreas).
   * "form": valor = id; a grande área também pode ser escolhida (trabalhos interdisciplinares).
   */
  mode: "filter" | "form";
}

/** Select nativo de áreas do CNPq agrupadas por grande área (<optgroup>). */
export function AreaSelect({ areas, mode, ...props }: AreaSelectProps) {
  const groups = groupAreas(areas);
  return (
    <Select {...props}>
      {groups.map((group) => (
        <optgroup key={group.bigArea} label={group.bigArea}>
          {group.parent && (
            <option value={mode === "filter" ? group.parent.slug : String(group.parent.id)}>
              {mode === "filter" ? `${group.bigArea} (todas)` : `${group.bigArea} (geral)`}
            </option>
          )}
          {group.children.map((area) => (
            <option key={area.id} value={mode === "filter" ? area.slug : String(area.id)}>
              {area.name}
            </option>
          ))}
        </optgroup>
      ))}
    </Select>
  );
}
