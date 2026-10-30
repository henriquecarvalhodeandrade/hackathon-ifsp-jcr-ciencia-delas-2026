import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CheckboxProps extends Omit<React.ComponentProps<"input">, "type"> {
  label: React.ReactNode;
  /** Texto auxiliar abaixo do rótulo. */
  description?: React.ReactNode;
}

/** Caixa de seleção nativa (funciona sem JS e em formulários) com visual da marca. */
export function Checkbox({ label, description, className, id, ...props }: CheckboxProps) {
  return (
    <label
      htmlFor={id}
      className={cn(
        "group flex cursor-pointer items-start gap-3 text-[0.9375rem] has-disabled:cursor-not-allowed has-disabled:opacity-60",
        className,
      )}
    >
      <span className="relative mt-0.5 flex size-5 shrink-0">
        <input
          id={id}
          type="checkbox"
          className={cn(
            "peer size-5 cursor-pointer appearance-none rounded-[0.3125rem] border-[1.5px] border-border-strong bg-surface",
            "transition-colors duration-150 checked:border-primary checked:bg-primary hover:border-fg-subtle checked:hover:border-primary-hover checked:hover:bg-primary-hover",
            "disabled:cursor-not-allowed aria-invalid:border-danger",
            "forced-colors:appearance-auto",
          )}
          {...props}
        />
        <Check
          aria-hidden="true"
          strokeWidth={3.25}
          className="pointer-events-none absolute inset-0 m-auto size-3.5 text-primary-fg opacity-0 transition-opacity peer-checked:opacity-100 forced-colors:hidden"
        />
      </span>
      <span className="grid gap-0.5 leading-snug">
        <span className="font-medium text-fg">{label}</span>
        {description && <span className="text-sm text-fg-muted">{description}</span>}
      </span>
    </label>
  );
}
