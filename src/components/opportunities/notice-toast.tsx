"use client";

import { useEffect, useRef } from "react";
import { toast } from "@/components/ui/toast";
import type { OpportunityNotice } from "@/lib/opportunities/presentation";

/**
 * Aviso depois de uma ação (?aviso=publicada, candidatura-enviada, removida…): vira um toast e
 * o parâmetro sai da URL (history.replaceState, sem nova requisição) — recarregar a página ou
 * voltar no histórico não repete o aviso.
 */
export function NoticeToast({ notice }: { notice: OpportunityNotice }) {
  const shown = useRef(false);
  useEffect(() => {
    if (shown.current) return;
    shown.current = true;
    toast({ message: notice.message, tone: notice.variant });
    const url = new URL(window.location.href);
    url.searchParams.delete("aviso");
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }, [notice]);
  return null;
}
