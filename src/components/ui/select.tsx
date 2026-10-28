import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { controlClasses, controlSizes } from "./input";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends Omit<React.ComponentProps<"select">, "size"> {
  size?: keyof typeof controlSizes;
  /** Opções simples; alternativamente passe <option>/<optgroup> como children. */
  options?: readonly SelectOption[];
  /** Primeira opção vazia (ex.: "Selecione…"). */
  placeholder?: string;
}

/** Select nativo estilizado — acessível e ótimo no celular. */
export function Select({
  className,
  size = "md",
  options,
  placeholder,
  children,
  ...props
}: SelectProps) {
  return (
    <div className="relative">
      <select
        className={cn(
          controlClasses,
          controlSizes[size],
          "cursor-pointer appearance-none pr-10",
          className,
        )}
        {...props}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options?.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
        {children}
      </select>
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 right-3 size-[1.125rem] -translate-y-1/2 text-fg-subtle"
      />
    </div>
  );
}
