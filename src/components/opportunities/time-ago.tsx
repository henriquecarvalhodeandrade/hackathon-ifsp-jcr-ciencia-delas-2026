import { formatDate, formatRelativeTime, toIsoString } from "@/lib/utils";

/** "Enviada há 2 dias" — tempo relativo visível, data completa no title. */
export function TimeAgo({ date, prefix }: { date: string; prefix: string }) {
  return (
    <span className="text-sm text-fg-subtle">
      {prefix}{" "}
      <time
        dateTime={toIsoString(date)}
        title={formatDate(date, { dateStyle: "long", timeStyle: "short" })}
      >
        {formatRelativeTime(date)}
      </time>
    </span>
  );
}
