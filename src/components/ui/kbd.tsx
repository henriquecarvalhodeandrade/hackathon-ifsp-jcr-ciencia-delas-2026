import { cn } from "@/lib/utils";

/** Tecla do teclado: <Kbd>Enter</Kbd>. */
export function Kbd({ className, ...props }: React.ComponentProps<"kbd">) {
  return (
    <kbd
      className={cn(
        "inline-flex h-6 min-w-6 items-center justify-center rounded-badge border border-border-strong border-b-2 bg-surface px-1.5 font-mono text-xs font-semibold text-fg-muted",
        className,
      )}
      {...props}
    />
  );
}
