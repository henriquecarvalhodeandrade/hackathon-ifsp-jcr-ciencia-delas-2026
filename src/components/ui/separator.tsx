import { cn } from "@/lib/utils";

export interface SeparatorProps extends React.ComponentProps<"div"> {
  orientation?: "horizontal" | "vertical";
  /** Decorativo (padrão) não é anunciado; semântico vira role="separator". */
  decorative?: boolean;
  /** Texto no meio da linha, ex.: "ou". */
  label?: React.ReactNode;
}

export function Separator({
  orientation = "horizontal",
  decorative = true,
  label,
  className,
  ...props
}: SeparatorProps) {
  const a11y = decorative
    ? { role: "none" as const }
    : { role: "separator" as const, "aria-orientation": orientation };

  if (label && orientation === "horizontal") {
    return (
      <div
        className={cn(
          "flex items-center gap-3 text-xs font-semibold text-fg-subtle uppercase",
          className,
        )}
        {...a11y}
        {...props}
      >
        <span className="h-px flex-1 bg-border" />
        <span>{label}</span>
        <span className="h-px flex-1 bg-border" />
      </div>
    );
  }

  return (
    <div
      {...a11y}
      className={cn(
        "shrink-0 bg-border",
        orientation === "horizontal" ? "h-px w-full" : "w-px self-stretch",
        className,
      )}
      {...props}
    />
  );
}
