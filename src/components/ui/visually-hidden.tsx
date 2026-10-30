import { cn } from "@/lib/utils";

/** Conteúdo só para leitores de tela (equivale à classe sr-only). */
export function VisuallyHidden({ className, ...props }: React.ComponentProps<"span">) {
  return <span className={cn("sr-only", className)} {...props} />;
}
