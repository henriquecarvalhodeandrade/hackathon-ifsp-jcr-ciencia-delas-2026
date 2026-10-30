import { EyeOff } from "lucide-react";
import { Badge, Card, CardLink } from "@/components/ui";
import type { ForumCategoryWithCount } from "@/lib/forum/types";
import { cn, pluralize } from "@/lib/utils";
import { CategoryIcon } from "./category-icon";

/**
 * Grade de categorias do fórum (cartões inteiros clicáveis). No celular fica em duas
 * colunas compactas (sem descrição) para as conversas aparecerem logo.
 */
export function CategoryGrid({
  categories,
  className,
}: {
  categories: readonly ForumCategoryWithCount[];
  className?: string;
}) {
  return (
    <ul className={cn("grid grid-cols-2 gap-3 lg:grid-cols-4", className)}>
      {categories.map((category) => (
        <li key={category.id} className="flex">
          <Card
            variant="interactive"
            as="article"
            className="flex w-full flex-col gap-3 p-3.5 sm:p-5"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-control bg-primary-soft text-primary-soft-fg sm:size-10">
                <CategoryIcon icon={category.icon} />
              </span>
              {category.allow_anonymous && (
                <Badge variant="secondary" title="Aceita tópicos e respostas anônimas">
                  <EyeOff aria-hidden="true" />
                  <span className="hidden sm:inline">Anonimato</span>
                  <span className="sr-only sm:hidden">Aceita anonimato</span>
                </Badge>
              )}
            </div>
            <div className="grid flex-1 content-start gap-1">
              <h3 className="font-display text-[0.9375rem] leading-snug font-semibold text-fg sm:text-base">
                <CardLink href={`/forum/c/${category.slug}`} className="hover:text-primary">
                  {category.name}
                </CardLink>
              </h3>
              {category.description && (
                <p className="hidden text-sm text-fg-muted sm:line-clamp-3">
                  {category.description}
                </p>
              )}
            </div>
            <p className="text-xs font-semibold text-fg-subtle tabular">
              {pluralize(category.threadCount, "tópico")}
            </p>
          </Card>
        </li>
      ))}
    </ul>
  );
}
