import { CircleAlert, CircleCheck, Info } from "lucide-react";
import { cn } from "@/lib/utils";

export type FormMessageTone = "error" | "success" | "info";

export interface FormMessageProps extends Omit<React.ComponentProps<"div">, "children"> {
  tone?: FormMessageTone;
  /** Quando vazio, a região continua montada (para o aria-live funcionar) mas não aparece. */
  children?: React.ReactNode;
}

const toneClasses: Record<FormMessageTone, string> = {
  error: "bg-danger-soft text-danger-soft-fg border-danger/30",
  success: "bg-success-soft text-success-soft-fg border-success/30",
  info: "bg-info-soft text-info-soft-fg border-info/30",
};

const toneIcon = { error: CircleAlert, success: CircleCheck, info: Info } as const;

/**
 * Mensagem de status do formulário (resultado da Server Action).
 * Mantenha-a sempre renderizada e só troque o conteúdo: assim o leitor de tela anuncia.
 */
export function FormMessage({ tone = "error", children, className, ...props }: FormMessageProps) {
  const Icon = toneIcon[tone];
  const hasContent =
    children !== undefined && children !== null && children !== false && children !== "";
  return (
    <div
      aria-live={tone === "error" ? "assertive" : "polite"}
      aria-atomic="true"
      className={className}
      {...props}
    >
      {hasContent && (
        <p
          className={cn(
            "flex items-start gap-2 rounded-control border px-3.5 py-2.5 text-sm font-medium",
            toneClasses[tone],
          )}
        >
          <Icon aria-hidden="true" className="mt-0.5 size-4" />
          <span>{children}</span>
        </p>
      )}
    </div>
  );
}

/**
 * Rola a página até a mensagem quando ela está fora da tela (respeita "reduzir movimento"). Para
 * formulários longos: o erro geral aparece no topo, longe do botão de enviar, e sem isso a pessoa
 * só via o botão voltar ao normal. Chame num efeito, depois de um envio sem campo inválido.
 */
export function revealFormMessage(element: HTMLElement | null) {
  if (!element) return;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  element.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "nearest" });
}
