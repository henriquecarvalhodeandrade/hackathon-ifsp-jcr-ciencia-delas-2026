import * as React from "react";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface WomanBadgeProps {
  showLabel?: boolean;
  size?: "xs" | "sm" | "md";
  className?: string;
}

export function WomanBadge({
  showLabel = true,
  size = "sm",
  className,
}: WomanBadgeProps) {
  const sizeClasses = {
    xs: "text-[10px] px-1.5 py-0.5 gap-1",
    sm: "text-xs px-2 py-0.5 gap-1.5",
    md: "text-sm px-2.5 py-1 gap-2",
  };

  const iconSizes = {
    xs: "w-2.5 h-2.5",
    sm: "w-3 h-3",
    md: "w-3.5 h-3.5",
  };

  return (
    <span
      title="Autodeclaração feminina em STEM (Ciência Delas)"
      className={cn(
        "inline-flex items-center font-medium rounded-full transition-all select-none",
        // Light Mode styling
        "bg-fuchsia-50 text-fuchsia-700 border border-fuchsia-200/90 ring-1 ring-fuchsia-300/60 shadow-xs",
        // Dark Mode styling
        "dark:bg-fuchsia-950/40 dark:text-fuchsia-200 dark:border-fuchsia-500/30 dark:ring-fuchsia-400/40 dark:shadow-[0_0_12px_rgba(217,70,239,0.15)]",
        sizeClasses[size],
        className
      )}
    >
      <Sparkles
        className={cn(
          iconSizes[size],
          "text-fuchsia-600 dark:text-fuchsia-300 animate-pulse shrink-0"
        )}
      />
      {showLabel && <span>Mulher em STEM</span>}
    </span>
  );
}
