import Link from "next/link";
import { CheckCircle2, Lock, MessageSquare, Pin } from "lucide-react";
import { Badge, ChipLink } from "@/components/ui";
import type { ThreadListItem } from "@/lib/forum/types";
import { cn, formatNumber, formatRelativeTime, pluralize, toIsoString, truncate } from "@/lib/utils";
import { AuthorName, ForumAvatar } from "./author";
import { CategoryIcon } from "./category-icon";
import { ReactionSummary } from "./reaction-summary";

export interface ThreadListProps {
  threads: readonly ThreadListItem[];
  /** Mostra a categoria em cada linha (lista geral/busca). */
  showCategory?: boolean;
  /** Mostra um trecho do texto (resultados de busca). */
  showExcerpt?: boolean;
  /** Base dos links de tag (?tag=), ex.: "/forum" ou "/forum/c/carreira". */
  tagBasePath?: string;
  /** Nível dos títulos das linhas (padrão h3 — a lista fica sob um h2). */
  headingLevel?: "h2" | "h3";
  className?: string;
}

/** Lista de tópicos: autora (ou "Anônima"), selos, atividade, respostas, reações e tags. */
export function ThreadList({
  threads,
  showCategory = true,
  showExcerpt = false,
  tagBasePath = "/forum",
  headingLevel = "h3",
  className,
}: ThreadListProps) {
  return (
    <ul
      className={cn(
        "divide-y divide-border overflow-hidden rounded-card border border-border bg-surface shadow-card",
        className,
      )}
    >
      {threads.map((thread) => (
        <ThreadRow
          key={thread.id}
          thread={thread}
          showCategory={showCategory}
          showExcerpt={showExcerpt}
          tagBasePath={tagBasePath}
          headingLevel={headingLevel}
        />
      ))}
    </ul>
  );
}

function ThreadRow({
  thread,
  showCategory,
  showExcerpt,
  tagBasePath,
  headingLevel: Heading,
}: Required<Omit<ThreadListProps, "threads" | "className">> & { thread: ThreadListItem }) {
  const visibleTags = thread.tags.slice(0, 4);
  const hiddenTags = thread.tags.length - visibleTags.length;
  const hasReplies = thread.replyCount > 0;

  return (
    <li
      className={cn(
        "relative flex gap-3 px-4 py-4 transition-colors hover:bg-surface-2 sm:gap-4 sm:px-5",
        "has-[[data-row-link]:focus-visible]:outline-2 has-[[data-row-link]:focus-visible]:-outline-offset-2 has-[[data-row-link]:focus-visible]:outline-focus",
      )}
    >
      <ForumAvatar author={thread.author} className="mt-0.5" />

      <div className="grid min-w-0 flex-1 gap-1.5">
        {(thread.isPinned || thread.isSolved || thread.isLocked) && (
          <div className="flex flex-wrap gap-1.5">
            {thread.isPinned && (
              <Badge variant="primary">
                <Pin aria-hidden="true" />
                Fixado
              </Badge>
            )}
            {thread.isSolved && (
              <Badge variant="success">
                <CheckCircle2 aria-hidden="true" />
                Resolvido
              </Badge>
            )}
            {thread.isLocked && (
              <Badge variant="warning">
                <Lock aria-hidden="true" />
                Trancado
              </Badge>
            )}
          </div>
        )}

        <Heading className="font-display text-base leading-snug font-semibold text-pretty text-fg sm:text-[1.0625rem]">
          <Link
            href={`/forum/t/${thread.id}`}
            data-row-link=""
            className="transition-colors after:absolute after:inset-0 after:content-[''] hover:text-primary focus-visible:outline-none"
          >
            {thread.title}
          </Link>
        </Heading>

        {showExcerpt && thread.excerpt && (
          <p className="line-clamp-2 text-sm text-fg-muted">{truncate(thread.excerpt, 220)}</p>
        )}

        <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-fg-subtle">
          <AuthorName author={thread.author} isOwnAnonymous={thread.isOwnAnonymous} linkClassName="relative z-10" />
          {showCategory && thread.category && (
            <>
              <span aria-hidden="true">·</span>
              <Link
                href={`/forum/c/${thread.category.slug}`}
                className="relative z-10 inline-flex items-center gap-1 font-medium text-fg-muted transition-colors hover:text-primary hover:underline"
              >
                <CategoryIcon icon={thread.category.icon} className="size-3.5" />
                {thread.category.name}
              </Link>
            </>
          )}
          <span aria-hidden="true">·</span>
          <span>
            {hasReplies ? "última resposta " : "aberto "}
            <time dateTime={toIsoString(thread.lastActivityAt)}>{formatRelativeTime(thread.lastActivityAt)}</time>
          </span>
          <span aria-hidden="true" className="sm:hidden">
            ·
          </span>
          <span className="inline-flex items-center gap-1 sm:hidden">
            <MessageSquare aria-hidden="true" className="size-3.5" />
            {pluralize(thread.replyCount, "resposta")}
          </span>
        </p>

        {(visibleTags.length > 0 || thread.reactions.support + thread.reactions.useful + thread.reactions.celebrate > 0) && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 pt-0.5">
            {visibleTags.length > 0 && (
              <ul className="flex flex-wrap gap-1.5" aria-label="Tags">
                {visibleTags.map((tag) => (
                  <li key={tag}>
                    <ChipLink
                      href={`${tagBasePath}?tag=${encodeURIComponent(tag)}`}
                      className="relative z-10 h-7 px-2.5 text-xs"
                    >
                      {tag}
                    </ChipLink>
                  </li>
                ))}
                {hiddenTags > 0 && (
                  <li className="inline-flex h-7 items-center text-xs text-fg-subtle">+{formatNumber(hiddenTags)}</li>
                )}
              </ul>
            )}
            <ReactionSummary counts={thread.reactions} />
          </div>
        )}
      </div>

      <div className="hidden w-16 shrink-0 flex-col items-end justify-start pt-0.5 text-right sm:flex">
        <span className={cn("tabular font-display text-xl leading-none font-semibold", hasReplies ? "text-fg" : "text-fg-subtle")}>
          {formatNumber(thread.replyCount)}
        </span>
        <span className="mt-1 text-xs text-fg-subtle">
          {pluralize(thread.replyCount, "resposta", "respostas", { withCount: false })}
        </span>
      </div>
    </li>
  );
}
