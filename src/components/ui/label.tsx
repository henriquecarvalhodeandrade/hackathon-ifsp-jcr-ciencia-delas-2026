import { cn } from "@/lib/utils";

export interface LabelProps extends React.ComponentProps<"label"> {
  /** Mostra o asterisco de obrigatório (o atributo `required` do campo é que informa o leitor de tela). */
  required?: boolean;
  /** Mostra "(opcional)" — prefira marcar os opcionais quando a maioria dos campos é obrigatória. */
  optional?: boolean;
}

export function Label({ className, required, optional, children, ...props }: LabelProps) {
  return (
    <label className={cn("text-sm leading-snug font-semibold text-fg", className)} {...props}>
      {children}
      {required && (
        <span aria-hidden="true" className="ml-0.5 text-danger">
          *
        </span>
      )}
      {optional && <span className="ml-1 font-normal text-fg-subtle">(opcional)</span>}
    </label>
  );
}
