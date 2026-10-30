"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui";

/** Abre a impressão do navegador (que também salva em PDF). */
export function PrintButton() {
  return (
    <Button onClick={() => window.print()}>
      <Printer aria-hidden="true" />
      Imprimir ou salvar em PDF
    </Button>
  );
}
