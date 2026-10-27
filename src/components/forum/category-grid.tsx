import { EyeOff } from "lucide-react";
import { Badge, Card, CardLink } from "@/components/ui";
import type { ForumCategoryWithCount } from "@/lib/forum/types";
import { cn, pluralize } from "@/lib/utils";
import { CategoryIcon } from "./category-icon";

/** Grade de categorias do fórum (cartões inteiros clicáveis). */
export function CategoryGrid({
  categories,
  className,
}: {
  categories: readonly ForumCategoryWithCount[];
  className?: string;
}) {
  return (
    <ul className={cn("grid gap-3 sm:grid-cols-2 lg:grid-cols-4", className)}>
      {categories.map((category) => (
        <li key={category.id} className="flex">
          <Card variant="interactive" as="article" className="flex w-full flex-col gap-3 p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-control bg-primary-soft text-primary-soft-fg">
                <CategoryIcon icon={category.icon} />
              </span>
              {category.allow_anonymous && (
                <Badge variant="secondary" title="Aceita tópicos e respostas anônimas">
                  <EyeOff aria-hidden="true" />
                  Anonimato
                </Badge>
              )}
            </div>
            <div className="grid flex-1 gap-1">
              <h3 className="font-display text-base leading-snug font-semibold text-fg">
                <CardLink href={`/forum/c/${category.slug}`} className="hover:text-primary">
                  {category.name}
                </CardLink>
              </h3>
              {category.description && (
                <p className="line-clamp-3 text-sm text-fg-muted">{category.description}</p>
              )}
            </div>
            <p className="tabular text-xs font-semibold text-fg-subtle">{pluralize(category.threadCount, "tópico")}</p>
          </Card>
        </li>
      ))}
    </ul>
  );
}
