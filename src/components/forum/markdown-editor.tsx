"use client";

import { useState } from "react";
import { Eye, PencilLine } from "lucide-react";
import { Markdown, Tabs, Textarea } from "@/components/ui";
import { cn } from "@/lib/utils";

export interface MarkdownEditorProps {
  name: string;
  defaultValue?: string;
  maxLength: number;
  rows?: number;
  placeholder?: string;
  /** Usado no nome acessível das abas ("Modo de edição: Texto do tópico"). */
  label: string;
  className?: string;
  // Recebidos de <Field>:
  id?: string;
  required?: boolean;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean | "true" | "false";
}

/**
 * Campo de texto com abas "Escrever" / "Pré-visualizar". A prévia usa o mesmo
 * componente <Markdown> da página (HTML cru descartado, links seguros).
 * O textarea continua no formulário mesmo com a prévia aberta.
 */
export function MarkdownEditor({
  name,
  defaultValue = "",
  maxLength,
  rows = 8,
  placeholder,
  label,
  className,
  id,
  required,
  ...aria
}: MarkdownEditorProps) {
  const [value, setValue] = useState(defaultValue);

  return (
    <div className={cn("grid gap-2", className)}>
      <Tabs
        label={`Modo de edição: ${label}`}
        panelClassName="pt-3"
        tabs={[
          {
            id: "escrever",
            label: "Escrever",
            icon: <PencilLine aria-hidden="true" />,
            content: (
              <Textarea
                id={id}
                name={name}
                value={value}
                onChange={(event) => setValue(event.currentTarget.value)}
                maxLength={maxLength}
                showCount
                rows={rows}
                placeholder={placeholder}
                required={required}
                aria-describedby={aria["aria-describedby"]}
                aria-invalid={aria["aria-invalid"]}
              />
            ),
          },
          {
            id: "previa",
            label: "Pré-visualizar",
            icon: <Eye aria-hidden="true" />,
            content: value.trim() ? (
              <div className="min-h-24 rounded-control border border-border bg-surface px-4 py-3">
                <Markdown>{value}</Markdown>
              </div>
            ) : (
              <p className="flex min-h-24 items-center justify-center rounded-control border border-dashed border-border-strong px-4 py-3 text-sm text-fg-subtle">
                Nada para pré-visualizar ainda. Escreva na aba “Escrever”.
              </p>
            ),
          },
        ]}
      />
      <p className="text-xs text-fg-subtle">
        Aceita Markdown: <code className="font-mono">**negrito**</code>, <code className="font-mono">_itálico_</code>,
        listas com <code className="font-mono">-</code>, <code className="font-mono">[link](https://…)</code> e{" "}
        <code className="font-mono">`código`</code>.
      </p>
    </div>
  );
}
