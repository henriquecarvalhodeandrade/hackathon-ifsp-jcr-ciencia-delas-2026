import { Quote } from "lucide-react";

/** Texto citado (carta de apresentação, recado da dona da vaga), com as quebras de linha. */
export function QuotedMessage({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <figure className="grid gap-1.5 rounded-control bg-surface-2 p-3.5">
      <figcaption className="flex items-center gap-1.5 text-xs font-bold tracking-wide text-fg-subtle uppercase">
        <Quote aria-hidden="true" className="size-3.5" />
        {label}
      </figcaption>
      <blockquote className="text-[0.9375rem] break-words whitespace-pre-line text-fg">
        {children}
      </blockquote>
    </figure>
  );
}
