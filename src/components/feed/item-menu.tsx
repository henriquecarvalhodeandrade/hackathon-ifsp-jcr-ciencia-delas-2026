"use client";

import { useEffect, useRef, useState } from "react";
import { Flag, Link2, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { ReportButton } from "@/components/moderation/report-button";
import { ActionMenu, type ActionMenuItem } from "@/components/network/action-menu";
import { ConfirmDialog, toast } from "@/components/ui";
import type { SimpleActionState } from "@/lib/feed/actions";
import { cn } from "@/lib/utils";
import {
  announce,
  focusById,
  focusFeedTabs,
  focusPost,
  neighborPostId,
  notifyPostChanged,
  waitForElement,
} from "./dom";
import { useItem } from "./item-context";

/**
 * Abre um diálogo do design system (ConfirmDialog, ReportButton) a partir de um item de menu:
 * o gatilho próprio do componente fica escondido e recebe o clique a cada novo `request`. Quando
 * o diálogo fecha, o navegador devolve o foco ao botão "…" (focado antes de o diálogo abrir).
 */
function DialogSlot({ request, children }: { request: number; children: React.ReactNode }) {
  const root = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (request === 0) return;
    root.current?.querySelector<HTMLElement>(":scope > span > button")?.click();
  }, [request]);
  return (
    <span ref={root} className="contents [&>span>button]:hidden">
      {children}
    </span>
  );
}

/** redirect() do Next chega como erro com digest "NEXT_REDIRECT;…". */
function isRedirect(error: unknown): boolean {
  const digest = (error as { digest?: unknown } | null)?.digest;
  return typeof digest === "string" && digest.startsWith("NEXT_REDIRECT");
}

type DeleteAction = (prev: SimpleActionState, formData: FormData) => Promise<SimpleActionState>;

export interface ItemMenuProps {
  /** Nome acessível do botão: "Mais ações: publicação de Marina Souza". */
  label: string;
  /** Endereço para "Copiar link" (relativo; vira absoluto no navegador). */
  permalink: string;
  canEdit: boolean;
  /** Apagar (autora, autora da publicação ou moderação). Ausente = sem o item. */
  remove?: {
    action: DeleteAction;
    hiddenFields: Record<string, string>;
    title: string;
    description: string;
    /**
     * "post": foca a publicação vizinha · "comment": foca o título dos comentários (página da
     * publicação) · "panel-comment": o painel do cartão tira o comentário e cuida do foco.
     */
    after:
      | { kind: "post"; postId: string }
      | { kind: "comment"; commentId: string }
      | { kind: "panel-comment"; commentId: string; onRemoved: () => void };
  };
  report?: { targetType: "feed_post" | "feed_comment"; targetId: string };
  className?: string;
}

/** Menu "…" de uma publicação ou comentário (padrão ARIA menu button, via ActionMenu). */
export function ItemMenu({ label, permalink, canEdit, remove, report, className }: ItemMenuProps) {
  const { startEditing, menuSlotRef } = useItem();
  const [deleteRequest, setDeleteRequest] = useState(0);
  const [reportRequest, setReportRequest] = useState(0);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(null), 2500);
    return () => window.clearTimeout(timer);
  }, [copied]);

  async function copyLink() {
    const url = new URL(permalink, window.location.origin).href;
    try {
      await navigator.clipboard.writeText(url);
      setCopied("Link copiado.");
    } catch {
      setCopied("Não conseguimos copiar. O link está na barra de endereço da publicação.");
    }
  }

  const items: ActionMenuItem[] = [
    { label: "Copiar link", icon: <Link2 aria-hidden="true" />, onSelect: copyLink },
  ];
  if (canEdit)
    items.push({ label: "Editar", icon: <Pencil aria-hidden="true" />, onSelect: startEditing });
  if (remove)
    items.push({
      label: "Apagar",
      icon: <Trash2 aria-hidden="true" />,
      tone: "danger",
      onSelect: () => setDeleteRequest((n) => n + 1),
    });
  if (report)
    items.push({
      label: "Denunciar",
      icon: <Flag aria-hidden="true" />,
      onSelect: () => setReportRequest((n) => n + 1),
    });

  // Envolve a action para levar o foco a um lugar que continua existindo depois de apagar.
  async function removeAndRefocus(prev: SimpleActionState, formData: FormData) {
    if (!remove) return null;
    const after = remove.after;
    const neighbor = after.kind === "post" ? neighborPostId(after.postId) : null;
    let result: SimpleActionState;
    try {
      result = await remove.action(prev, formData);
    } catch (error) {
      // Apagar na página da publicação volta para o feed (redirect): o aviso vai junto.
      if (isRedirect(error)) toast("Publicação apagada.");
      throw error;
    }
    if (result?.ok) {
      toast(after.kind === "post" ? "Publicação apagada." : "Comentário apagado.");
      if (after.kind === "post") {
        // Páginas carregadas com "Carregar mais" não são revalidadas: elas tiram o cartão.
        notifyPostChanged({ postId: after.postId, deleted: true });
        waitForElement(`post-${after.postId}`, false, () => {
          if (!(neighbor && focusPost(neighbor))) focusFeedTabs();
          announce("Publicação apagada.");
        });
      } else if (after.kind === "panel-comment") {
        after.onRemoved();
      } else {
        waitForElement(`comentario-${after.commentId}`, false, () => {
          focusById("comentarios-titulo");
          announce("Comentário apagado.");
        });
      }
    }
    return result;
  }

  return (
    <span ref={menuSlotRef} className={cn("relative inline-flex shrink-0", className)}>
      <ActionMenu
        items={items}
        variant="ghost"
        size="sm"
        align="end"
        srSuffix={label}
        // O ActionMenu sempre desenha uma seta no fim; num botão "…" ela sobra (escondida aqui).
        className="size-8 px-0 text-fg-muted pointer-coarse:size-11 [&>svg:last-child]:hidden"
      >
        <MoreHorizontal aria-hidden="true" />
      </ActionMenu>
      <span aria-live="polite" className="sr-only">
        {copied ?? ""}
      </span>
      {copied && (
        <span
          aria-hidden="true"
          className="absolute top-full right-0 z-20 mt-1 rounded-control border border-border bg-surface px-2.5 py-1.5 text-xs font-medium whitespace-nowrap text-fg shadow-overlay"
        >
          {copied}
        </span>
      )}
      {remove && (
        <DialogSlot request={deleteRequest}>
          <ConfirmDialog
            stateAction={removeAndRefocus}
            hiddenFields={remove.hiddenFields}
            trigger={<button type="button" tabIndex={-1} />}
            title={remove.title}
            description={remove.description}
            confirmLabel="Sim, apagar"
            pendingLabel="Apagando…"
          />
        </DialogSlot>
      )}
      {report && (
        <DialogSlot request={reportRequest}>
          <ReportButton targetType={report.targetType} targetId={report.targetId} />
        </DialogSlot>
      )}
    </span>
  );
}
