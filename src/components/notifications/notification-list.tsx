import { NOTIFICATION_TYPE_LABELS } from "@/lib/notifications/meta";
import type { NotificationItem } from "@/lib/notifications/queries";
import { cn, formatDateTime, formatRelativeTime, toIsoString } from "@/lib/utils";
import { MarkReadButton } from "./notification-actions";
import { NotificationIcon } from "./notification-icon";

/** Lista de notificações: cada item inteiro é clicável (marca como lida e abre o destino). */
export function NotificationList({ items, now = new Date() }: { items: NotificationItem[]; now?: Date }) {
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-card border border-border bg-surface shadow-card">
      {items.map((item) => {
        const unread = item.read_at === null;
        return (
          <li
            key={item.id}
            className={cn(
              "relative flex gap-3 p-4 transition-colors hover:bg-surface-2 sm:gap-4 sm:p-5",
              unread && "bg-primary-soft/40 hover:bg-primary-soft/60",
            )}
          >
            <div className="relative">
              <NotificationIcon type={item.type} />
              {unread && (
                <span
                  aria-hidden="true"
                  className="absolute -top-0.5 -right-0.5 size-3 rounded-full bg-accent ring-2 ring-surface"
                />
              )}
            </div>
            <div className="grid min-w-0 flex-1 gap-1">
              <p className="eyebrow flex flex-wrap items-center gap-x-2 text-fg-subtle">
                {NOTIFICATION_TYPE_LABELS[item.type] ?? "Aviso"}
                {unread && <span className="text-primary">· Nova</span>}
              </p>
              <h2 className={cn("font-display text-base leading-snug text-fg", unread ? "font-bold" : "font-semibold")}>
                {/* <a> comum (sem prefetch): o clique marca como lida no servidor e redireciona. */}
                <a
                  href={`/notificacoes/abrir/${item.id}`}
                  className="rounded-badge after:absolute after:inset-0 after:content-[''] hover:underline hover:underline-offset-4 focus-visible:outline-none focus-visible:after:rounded-none focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-focus"
                >
                  {item.title}
                </a>
              </h2>
              {item.body && <p className="line-clamp-2 text-[0.9375rem] text-fg-muted">{item.body}</p>}
              <p className="text-sm text-fg-subtle">
                <time dateTime={toIsoString(item.created_at)} title={formatDateTime(item.created_at)}>
                  {formatRelativeTime(item.created_at, now)}
                </time>
              </p>
            </div>
            {unread && (
              <div className="shrink-0 self-start">
                <MarkReadButton id={item.id} title={item.title} />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
