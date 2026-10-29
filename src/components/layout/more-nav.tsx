"use client";

import { ChevronDown } from "lucide-react";
import { usePathname } from "next/navigation";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { NavItem } from "./nav-items";
import { isActivePath } from "./nav-link";

/**
 * Páginas que marcam o "Mais". Perfis (/pesquisadoras/<id>) ficam de fora: a gente chega neles
 * pelo feed, pela rede, pelas ICs… e marcar "Mais" ali dava a impressão de estar em outra área.
 */
export function isMoreNavActive(pathname: string | null, items: readonly NavItem[]): boolean {
  return items.some((item) =>
    item.href === "/pesquisadoras"
      ? pathname === item.href
      : isActivePath(pathname, item.href) !== false,
  );
}

/**
 * "Mais" da navegação desktop: as áreas que não cabem na barra. Fica marcado (o "nó" da
 * constelação embaixo) quando a página atual é uma delas (ver isMoreNavActive).
 */
export function MoreNav({
  items,
  className,
  activeClassName,
}: {
  items: readonly NavItem[];
  className: string;
  activeClassName: string;
}) {
  const pathname = usePathname();
  const active = isMoreNavActive(pathname, items);
  return (
    <DropdownMenu
      triggerLabel="Mais"
      trigger={
        <span className="inline-flex items-center gap-1">
          Mais
          <ChevronDown aria-hidden="true" className="size-4" />
        </span>
      }
      triggerClassName={cn(className, active && activeClassName)}
      items={items.map((item) => ({ href: item.href, label: item.label }))}
    />
  );
}
