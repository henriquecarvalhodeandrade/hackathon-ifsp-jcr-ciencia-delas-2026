"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";

interface ProjectFiltersProps {
  q: string;
  area: string;
  somenteAbertos: boolean;
}

export function ProjectFilters({ q, area, somenteAbertos }: ProjectFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [qValue, setQValue] = React.useState(q);
  const [areaValue, setAreaValue] = React.useState(area);
  const [abertos, setAbertos] = React.useState(somenteAbertos);
  const isFirstRender = React.useRef(true);

  const apply = React.useCallback(
    (next: { q?: string; area?: string; abertos?: boolean }) => {
      const params = new URLSearchParams(searchParams.toString());

      if (next.q !== undefined) {
        if (next.q) params.set("q", next.q);
        else params.delete("q");
      }
      if (next.area !== undefined) {
        if (next.area) params.set("area", next.area);
        else params.delete("area");
      }
      if (next.abertos !== undefined) {
        if (next.abertos) params.set("somente_abertos", "1");
        else params.delete("somente_abertos");
      }

      // Filtros novos sempre reiniciam a paginação
      params.delete("p");

      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams]
  );

  // Debounce da busca (título/descrição) e da área
  React.useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const timer = setTimeout(() => {
      if (qValue !== q || areaValue !== area) {
        apply({ q: qValue, area: areaValue });
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [qValue, areaValue, q, area, apply]);

  const hasFilters = Boolean(q || area || somenteAbertos);

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <input
            type="search"
            value={qValue}
            onChange={(e) => setQValue(e.target.value)}
            placeholder="Buscar por título ou descrição..."
            aria-label="Buscar projetos"
            className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-input bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all placeholder:text-muted-foreground/60"
          />
        </div>
        <div className="relative sm:w-64">
          <input
            type="text"
            value={areaValue}
            onChange={(e) => setAreaValue(e.target.value)}
            placeholder="Filtrar por área..."
            aria-label="Filtrar por área"
            className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all placeholder:text-muted-foreground/60"
          />
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <label className="inline-flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={abertos}
            onChange={(e) => {
              setAbertos(e.target.checked);
              apply({ abertos: e.target.checked });
            }}
            className="w-4 h-4 rounded border-border accent-[#7C3AED] cursor-pointer"
          />
          <span className="text-sm text-muted-foreground">
            Somente projetos com vagas abertas
          </span>
        </label>

        {hasFilters && (
          <button
            type="button"
            onClick={() => {
              setQValue("");
              setAreaValue("");
              setAbertos(false);
              apply({ q: "", area: "", abertos: false });
            }}
            className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
          >
            <X className="w-3.5 h-3.5" />
            Limpar filtros
          </button>
        )}
      </div>
    </div>
  );
}
