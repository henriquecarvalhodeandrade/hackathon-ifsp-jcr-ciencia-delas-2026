"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Mail } from "lucide-react";
import { Button } from "@/components/ui";

type CopyState = "idle" | "copied" | "failed";

/** E-mail da outra participante (só em mentoria aceita) com "Copiar" e link mailto. */
export function ContactCard({ email, name }: { email: string; name: string }) {
  const [copy, setCopy] = useState<CopyState>("idle");

  useEffect(() => {
    if (copy === "idle") return;
    const timer = window.setTimeout(() => setCopy("idle"), 2500);
    return () => window.clearTimeout(timer);
  }, [copy]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(email);
      setCopy("copied");
    } catch {
      setCopy("failed");
    }
  }

  const subject = encodeURIComponent("Nossa mentoria na Artemis");

  return (
    <div className="grid gap-2 rounded-control border border-border bg-surface-2 p-3.5">
      <p className="text-xs font-bold tracking-wide text-fg-subtle uppercase">Contato de {name}</p>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <a
          href={`mailto:${email}?subject=${subject}`}
          className="inline-flex min-w-0 items-center gap-2 rounded-badge font-mono text-sm font-semibold break-all text-primary underline-offset-[0.2em] hover:underline"
        >
          <Mail aria-hidden="true" className="size-4 shrink-0" />
          <span className="min-w-0">{email}</span>
          <span className="sr-only"> (escrever e-mail)</span>
        </a>
        <Button variant="outline" size="sm" onClick={handleCopy}>
          {copy === "copied" ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
          {copy === "copied" ? "Copiado" : "Copiar"}
          <span className="sr-only"> o e-mail de {name}</span>
        </Button>
      </div>
      <p aria-live="polite" className="text-xs text-fg-subtle empty:hidden">
        {copy === "copied"
          ? "E-mail copiado para a área de transferência."
          : copy === "failed"
            ? "Não deu para copiar automaticamente. Selecione o e-mail e copie manualmente."
            : ""}
      </p>
    </div>
  );
}
