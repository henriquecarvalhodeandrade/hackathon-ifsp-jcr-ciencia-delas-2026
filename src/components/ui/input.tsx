import { cn } from "@/lib/utils";

/** Classes compartilhadas por Input, Textarea e Select. */
export const controlClasses = cn(
  "w-full rounded-control border border-border-strong bg-surface text-fg",
  "transition-[border-color,background-color,box-shadow] duration-150",
  "hover:border-fg-subtle",
  "focus-visible:border-primary focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus",
  "disabled:cursor-not-allowed disabled:border-border disabled:bg-surface-2 disabled:text-fg-subtle",
  "read-only:bg-surface-2",
  "aria-invalid:border-danger aria-invalid:hover:border-danger aria-invalid:focus-visible:outline-danger",
);

export const controlSizes = {
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-3.5 text-base",
} as const;

export interface InputProps extends Omit<React.ComponentProps<"input">, "size"> {
  /** sm (36px) ou md (44px, padrão — bom alvo de toque). */
  size?: keyof typeof controlSizes;
  /** Ícone decorativo à esquerda (ex.: <Search />). */
  leadingIcon?: React.ReactNode;
}

/** Campo de texto. Use dentro de <Field> para ganhar rótulo, dica e erro acessíveis. */
export function Input({ className, size = "md", leadingIcon, type = "text", ...props }: InputProps) {
  const input = (
    <input
      type={type}
      className={cn(controlClasses, controlSizes[size], leadingIcon ? "pl-10" : undefined, className)}
      {...props}
    />
  );
  if (!leadingIcon) return input;
  return (
    <div className="relative">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-fg-subtle [&_svg]:size-[1.125rem]"
      >
        {leadingIcon}
      </span>
      {input}
    </div>
  );
}
