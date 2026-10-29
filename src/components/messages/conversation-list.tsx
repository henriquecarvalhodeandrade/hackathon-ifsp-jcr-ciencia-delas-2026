import Link from "next/link";
import { Avatar, Badge, type BadgeVariant } from "@/components/ui";
import { INBOX_BADGE_LABELS, type InboxBadge, type InboxItem } from "@/lib/messages/inbox";
import { careerStageLabel } from "@/lib/mentorship/view-models";
import { cn, formatDateTime, formatRelativeTime, toIsoString } from "@/lib/utils";

const BADGE_VARIANTS: Record<Exclude<InboxBadge, null>, BadgeVariant> = {
  draft: "neutral",
  waiting: "neutral",
  request: "primary",
  "declined-by-me": "warning",
};

/**
 * Lista da caixa de entrada: cada linha inteira é um link para a conversa (avatar, nome, horário,
 * prévia da última mensagem). Não lida: nome em negrito, ponto colorido e "Nova mensagem" para
 * leitor de tela — nunca só a cor. `currentId` destaca a conversa aberta (lista lateral).
 */
export function ConversationList({
  items,
  currentId,
  now = new Date(),
  className,
}: {
  items: readonly InboxItem[];
  currentId?: string;
  now?: Date;
  className?: string;
}) {
  return (
    <ul className={cn("divide-y divide-border", className)}>
      {items.map((item) => {
        const current = item.id === currentId;
        const meta = item.other.headline || careerStageLabel(item.other.careerStage);
        return (
          <li key={item.id}>
            <Link
              href={item.href}
              aria-current={current ? "page" : undefined}
              className={cn(
                "flex gap-3 px-4 py-3.5 transition-colors hover:bg-surface-2 focus-visible:-outline-offset-2 sm:px-5",
                item.unread && "bg-primary-soft/40 hover:bg-primary-soft/60",
                current && "bg-surface-2 shadow-[inset_3px_0_0_var(--color-primary)]",
              )}
            >
              <span className="relative shrink-0">
                <Avatar
                  name={item.other.name}
                  src={item.other.avatarUrl}
                  seed={item.other.id}
                  size="md"
                />
                {item.unread && (
                  <span
                    aria-hidden="true"
                    className="absolute -top-0.5 -right-0.5 size-3 rounded-full bg-accent ring-2 ring-surface"
                  />
                )}
              </span>
              <span className="grid min-w-0 flex-1 gap-0.5">
                <span className="flex items-baseline justify-between gap-2">
                  <span
                    className={cn(
                      "truncate text-[0.9375rem] text-fg",
                      item.unread ? "font-bold" : "font-semibold",
                    )}
                  >
                    {item.other.name}
                  </span>
                  <time
                    dateTime={toIsoString(item.at)}
                    title={formatDateTime(item.at)}
                    className={cn(
                      "shrink-0 text-xs",
                      item.unread ? "font-semibold text-primary" : "text-fg-subtle",
                    )}
                  >
                    {formatRelativeTime(item.at, now)}
                  </time>
                </span>
                {meta && <span className="truncate text-xs text-fg-subtle">{meta}</span>}
                <span
                  className={cn(
                    "line-clamp-1 text-sm wrap-anywhere",
                    item.unread ? "font-semibold text-fg" : "text-fg-muted",
                    !item.preview && "italic",
                  )}
                >
                  {item.unread && <span className="sr-only">Nova mensagem: </span>}
                  {item.preview ?? "Nenhuma mensagem ainda"}
                </span>
                {item.badge && (
                  <span className="mt-1 flex">
                    <Badge variant={BADGE_VARIANTS[item.badge]} size="sm">
                      {INBOX_BADGE_LABELS[item.badge]}
                    </Badge>
                  </span>
                )}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
