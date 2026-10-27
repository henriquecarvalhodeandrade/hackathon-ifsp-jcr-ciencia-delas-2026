import Link from "next/link";
import { cn, formatNumber } from "@/lib/utils";

export interface TabNavItem {
  href: string;
  label: string;
  count?: number;
  active?: boolean;
  icon?: React.ReactNode;
}

export interface TabNavProps extends Omit<React.ComponentProps<"nav">, "children"> {
  items: readonly TabNavItem[];
  /** Rótulo da navegação para leitores de tela, ex.: "Períodos do ranking". */
  label: string;
}

/**
 * Abas baseadas em links (cada aba é uma URL). Funciona em Server Components:
 * calcule `active` a partir de searchParams/rota. Para painéis na mesma página use <Tabs>.
 */
export function TabNav({ items, label, className, ...props }: TabNavProps) {
  return (
    <nav aria-label={label} className={cn("-mx-4 overflow-x-auto px-4 scrollbar-none sm:mx-0 sm:px-0", className)} {...props}>
      <ul className="flex min-w-max gap-1 border-b border-border">
        {items.map((item) => (
          <li key={`${item.href}::${item.label}`}>
            <Link
              href={item.href}
              aria-current={item.active ? "page" : undefined}
              className={cn(
                "relative -mb-px inline-flex h-11 items-center gap-2 rounded-t-control border-b-2 px-3.5 text-[0.9375rem] font-semibold whitespace-nowrap transition-colors [&_svg]:size-4",
                item.active
                  ? "border-primary text-primary"
                  : "border-transparent text-fg-muted hover:border-border-strong hover:text-fg",
              )}
            >
              {item.icon}
              {item.label}
              {item.count !== undefined && (
                <span
                  className={cn(
                    "tabular rounded-pill px-1.5 py-px text-xs",
                    item.active ? "bg-primary-soft text-primary-soft-fg" : "bg-surface-2 text-fg-subtle",
                  )}
                >
                  {formatNumber(item.count)}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
