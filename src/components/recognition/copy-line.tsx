"use client";

import { useEffect, useId, useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui";

type CopyState = "idle" | "copied" | "failed";

/** Texto pronto para copiar (ex.: a linha do currículo), com aviso acessível do resultado. */
export function CopyLine({ text, label }: { text: string; label: string }) {
  const [copy, setCopy] = useState<CopyState>("idle");
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");

  useEffect(() => {
    if (copy === "idle") return;
    const timer = window.setTimeout(() => setCopy("idle"), 3000);
    return () => window.clearTimeout(timer);
  }, [copy]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopy("copied");
    } catch {
      setCopy("failed");
    }
  }

  return (
    <div className="grid gap-2">
      <p
        id={`${id}-texto`}
        className="rounded-control border border-border bg-surface-2 px-3.5 py-3 text-[0.9375rem] break-words text-fg select-all"
      >
        {text}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" size="sm" onClick={handleCopy} aria-describedby={`${id}-texto`}>
          {copy === "copied" ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
          {copy === "copied" ? "Copiado" : label}
        </Button>
        <p aria-live="polite" className="text-sm text-fg-muted">
          {copy === "copied"
            ? "Copiado para a área de transferência."
            : copy === "failed"
              ? "Não deu para copiar automaticamente. Selecione o texto acima e copie."
              : ""}
        </p>
      </div>
    </div>
  );
}
