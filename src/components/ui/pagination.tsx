import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn, formatNumber } from "@/lib/utils";

type SearchParamsLike = Record<string, string | string[] | undefined>;

export interface PaginationProps {
  /** Página atual (1-based). */
  page: number;
  totalPages: number;
  /** Caminho da listagem, ex.: "/papers". */
  basePath: string;
  /** searchParams atuais (preservados nos links). */
  searchParams?: SearchParamsLike;
  /** Nome do parâmetro de página (padrão "pagina"). */
  param?: string;
  className?: string;
}

function hrefFor(basePath: string, searchParams: SearchParamsLike, param: string, page: number) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (key === param || value === undefined) continue;
    if (Array.isArray(value)) value.forEach((v) => params.append(key, v));
    else params.set(key, value);
  }
  if (page > 1) params.set(param, String(page));
  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

/** Janela de páginas com reticências: 1 … 4 5 6 … 12 */
export function pageWindow(page: number, total: number): Array<number | "…"> {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set([1, total, page - 1, page, page + 1]);
  if (page <= 3) [2, 3, 4].forEach((p) => pages.add(p));
  if (page >= total - 2) [total - 3, total - 2, total - 1].forEach((p) => pages.add(p));
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const out: Array<number | "…"> = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1]! > 1) out.push("…");
    out.push(p);
  });
  return out;
}

const base =
  "inline-flex h-10 min-w-10 items-center justify-center gap-1 rounded-control px-3 text-[0.9375rem] font-semibold transition-colors [&_svg]:size-4";

/** Paginação por links (?pagina=N), acessível e compatível com Server Components. */
export function Pagination({ page, totalPages, basePath, searchParams = {}, param = "pagina", className }: PaginationProps) {
  if (totalPages <= 1) return null;
  const current = Math.min(Math.max(1, page), totalPages);
  const link = (p: number) => hrefFor(basePath, searchParams, param, p);

  return (
    <nav aria-label="Paginação" className={cn("flex items-center justify-between gap-2 sm:justify-center", className)}>
      {current > 1 ? (
        <Link href={link(current - 1)} rel="prev" className={cn(base, "text-fg hover:bg-surface-2")}>
          <ChevronLeft aria-hidden="true" />
          <span>Anterior</span>
        </Link>
      ) : (
        <span aria-disabled="true" className={cn(base, "cursor-not-allowed text-fg-subtle opacity-60")}>
          <ChevronLeft aria-hidden="true" />
          <span>Anterior</span>
        </span>
      )}

      <ol className="hidden items-center gap-1 sm:flex">
        {pageWindow(current, totalPages).map((p, i) =>
          p === "…" ? (
            <li key={`gap-${i}`} aria-hidden="true" className="px-1 text-fg-subtle">
              …
            </li>
          ) : (
            <li key={p}>
              <Link
                href={link(p)}
                aria-current={p === current ? "page" : undefined}
                aria-label={`Página ${p}`}
                className={cn(
                  base,
                  "tabular px-2",
                  p === current ? "bg-primary text-primary-fg hover:bg-primary-hover" : "text-fg hover:bg-surface-2",
                )}
              >
                {formatNumber(p)}
              </Link>
            </li>
          ),
        )}
      </ol>
      <p className="text-sm text-fg-muted sm:hidden">
        Página {formatNumber(current)} de {formatNumber(totalPages)}
      </p>

      {current < totalPages ? (
        <Link href={link(current + 1)} rel="next" className={cn(base, "text-fg hover:bg-surface-2")}>
          <span>Próxima</span>
          <ChevronRight aria-hidden="true" />
        </Link>
      ) : (
        <span aria-disabled="true" className={cn(base, "cursor-not-allowed text-fg-subtle opacity-60")}>
          <span>Próxima</span>
          <ChevronRight aria-hidden="true" />
        </span>
      )}
    </nav>
  );
}
