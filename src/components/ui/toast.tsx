"use client";

import { Suspense, useEffect, useRef, useSyncExternalStore } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { CircleAlert, CircleCheck, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Avisos rápidos ("toasts") depois de uma ação: "Convite enviado", "Item apagado" + "Desfazer".
 *
 *   toast("Item apagado.");
 *   toast({ message: "Convite recusado.", tone: "info", action: { label: "Desfazer", onClick } });
 *
 * Um único <Toaster /> fica montado no layout raiz. A loja é do módulo (fora do React), então
 * `toast()` funciona de qualquer componente cliente, sem provider. O <Toaster /> é uma região
 * `role="status"` (educada): anuncia sem roubar o foco. Some sozinho em ~5 s — o tempo para
 * enquanto o ponteiro ou o foco estão sobre o aviso — e no máximo 3 aparecem ao mesmo tempo.
 *
 * Com `id`, um aviso novo SUBSTITUI o anterior de mesmo id (ex.: "Convite enviado" → "Convite
 * cancelado" da mesma pessoa), e `dismissToast(id)` fecha. Avisos COM ação ("Desfazer",
 * "Adicionar recado") somem quando a página muda (caminho ou filtros): a ação valia para a tela
 * anterior. Os demais seguem, e os mostrados depois da navegação aparecem normalmente.
 */

export type ToastTone = "success" | "info" | "danger";

export interface ToastOptions {
  message: string;
  tone?: ToastTone;
  /** Botão no aviso (ex.: "Desfazer"). O aviso fecha depois do clique. */
  action?: { label: string; onClick: () => void };
  /** Milissegundos até sumir (padrão 5000; com ação, 8000). */
  duration?: number;
  /** Identificador: um aviso com o mesmo id substitui o que está na tela. */
  id?: string;
}

interface ToastItem extends Required<Pick<ToastOptions, "message" | "tone" | "duration">> {
  /** Chave interna (nova a cada aviso: a substituição reinicia o cronômetro). */
  key: number;
  id?: string;
  action?: ToastOptions["action"];
  /** Página (caminho + filtros) em que o aviso nasceu. */
  route: string;
}

const MAX_TOASTS = 3;
const DEFAULT_DURATION = 5000;
const ACTION_DURATION = 8000;

// ---------------------------------------------------------------------------
// Loja do módulo (useSyncExternalStore)
// ---------------------------------------------------------------------------

let items: readonly ToastItem[] = [];
let nextKey = 1;
const listeners = new Set<() => void>();
const EMPTY: readonly ToastItem[] = [];

function emit(next: readonly ToastItem[]) {
  items = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function dismissKey(key: number) {
  if (items.some((item) => item.key === key)) emit(items.filter((item) => item.key !== key));
}

function currentRoute(): string {
  return typeof window === "undefined"
    ? ""
    : `${window.location.pathname}${window.location.search}`;
}

/** Mostra um aviso. Aceita só o texto (tom "success") ou as opções completas. */
export function toast(options: ToastOptions | string): void {
  const opts: ToastOptions = typeof options === "string" ? { message: options } : options;
  const item: ToastItem = {
    key: nextKey++,
    id: opts.id,
    message: opts.message,
    tone: opts.tone ?? "success",
    action: opts.action,
    duration: opts.duration ?? (opts.action ? ACTION_DURATION : DEFAULT_DURATION),
    route: currentRoute(),
  };
  // Mesmo id: o novo toma o lugar do antigo. O mais antigo sai quando passa do limite.
  const others = opts.id ? items.filter((existing) => existing.id !== opts.id) : items;
  emit([...others, item].slice(-MAX_TOASTS));
}

/** Fecha o aviso com este id (se estiver na tela). */
export function dismissToast(id: string): void {
  if (items.some((item) => item.id === id)) emit(items.filter((item) => item.id !== id));
}

/** A página mudou: avisos com ação nascidos em outra página saem (a ação não vale mais). */
function dismissStaleActions(route: string) {
  const next = items.filter((item) => !item.action || item.route === route);
  if (next.length !== items.length) emit(next);
}

// ---------------------------------------------------------------------------
// Visual
// ---------------------------------------------------------------------------

const TONE: Record<ToastTone, { icon: typeof CircleCheck; className: string }> = {
  success: { icon: CircleCheck, className: "text-success" },
  info: { icon: Info, className: "text-info" },
  danger: { icon: CircleAlert, className: "text-danger" },
};

function ToastCard({ item }: { item: ToastItem }) {
  const remaining = useRef(item.duration);
  const startedAt = useRef(0);
  const timer = useRef<number | undefined>(undefined);
  const hovered = useRef(false);
  const focused = useRef(false);

  // Conta o tempo só enquanto ninguém está lendo/interagindo com o aviso (WCAG 2.2.1).
  function start() {
    if (hovered.current || focused.current) return;
    window.clearTimeout(timer.current);
    startedAt.current = Date.now();
    timer.current = window.setTimeout(() => dismissKey(item.key), remaining.current);
  }
  function pause() {
    if (timer.current === undefined) return;
    window.clearTimeout(timer.current);
    timer.current = undefined;
    remaining.current = Math.max(1500, remaining.current - (Date.now() - startedAt.current));
  }

  useEffect(() => {
    start();
    return () => window.clearTimeout(timer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- o cronômetro nasce uma vez por aviso
  }, []);

  const { icon: Icon, className: iconClass } = TONE[item.tone];
  return (
    <li
      className="pointer-events-auto flex w-full animate-pop-in items-start gap-3 rounded-card border border-border bg-surface p-3.5 pr-2 text-fg shadow-overlay"
      onPointerEnter={() => {
        hovered.current = true;
        pause();
      }}
      onPointerLeave={() => {
        hovered.current = false;
        start();
      }}
      onFocus={() => {
        focused.current = true;
        pause();
      }}
      onBlur={(event) => {
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
        focused.current = false;
        start();
      }}
    >
      <Icon aria-hidden="true" className={cn("mt-0.5 size-5 shrink-0", iconClass)} />
      <p className="min-w-0 flex-1 py-0.5 text-[0.9375rem] font-medium break-words">
        {item.message}
      </p>
      {item.action && (
        <button
          type="button"
          onClick={() => {
            dismissKey(item.key);
            item.action?.onClick();
          }}
          className="shrink-0 rounded-control px-2.5 py-1 text-sm font-bold text-primary transition-colors hover:bg-primary-soft hover:text-primary-soft-fg pointer-coarse:min-h-11"
        >
          {item.action.label}
        </button>
      )}
      <button
        type="button"
        aria-label="Fechar aviso"
        onClick={() => dismissKey(item.key)}
        className="inline-flex size-8 shrink-0 items-center justify-center rounded-control text-fg-subtle transition-colors hover:bg-surface-2 hover:text-fg pointer-coarse:size-11 [&_svg]:size-4"
      >
        <X aria-hidden="true" />
      </button>
    </li>
  );
}

/** Observa a página (caminho + filtros) e tira os avisos com ação de páginas anteriores. */
function RouteWatcher() {
  const pathname = usePathname();
  const search = useSearchParams()?.toString() ?? "";
  const route = search ? `${pathname}?${search}` : pathname;
  const last = useRef(route);
  useEffect(() => {
    if (last.current === route) return;
    last.current = route;
    dismissStaleActions(currentRoute());
  }, [route]);
  return null;
}

/**
 * Onde os avisos aparecem: embaixo, no centro, acima da barra de abas do celular; no desktop (lg),
 * embaixo à direita. Monte UMA vez (layout raiz). Vazio, não tem nada focável.
 */
export function Toaster(): React.JSX.Element {
  const list = useSyncExternalStore(
    subscribe,
    () => items,
    () => EMPTY,
  );
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Avisos"
      className={cn(
        "pointer-events-none fixed inset-x-0 z-[60] flex justify-center px-4",
        "bottom-[calc(72px+env(safe-area-inset-bottom))] lg:inset-x-auto lg:right-6 lg:bottom-6 lg:px-0",
      )}
    >
      {/* useSearchParams pede um Suspense próprio (não segura a renderização da página). */}
      <Suspense fallback={null}>
        <RouteWatcher />
      </Suspense>
      {list.length > 0 && (
        <ol className="grid w-full max-w-md gap-2 lg:w-96">
          {list.map((item) => (
            <ToastCard key={item.key} item={item} />
          ))}
        </ol>
      )}
    </div>
  );
}
