import { CategoryIcon as DsCategoryIcon } from "@/components/ui";
import { cn } from "@/lib/utils";

/**
 * Ícone (decorativo) de uma categoria do fórum, a partir de `forum_categories.icon`.
 * O mapa kebab-case → lucide é o do design system (`CATEGORY_ICONS` em
 * src/components/ui/category-icon.tsx: `shield-heart` → ShieldPlus, nome desconhecido →
 * MessagesSquare); aqui só fixamos o tamanho padrão do fórum (20px).
 */
export function CategoryIcon({
  icon,
  className,
}: {
  icon: string | null | undefined;
  className?: string;
}) {
  return <DsCategoryIcon name={icon} className={cn("size-5", className)} />;
}
