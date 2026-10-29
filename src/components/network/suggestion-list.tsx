"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { ChevronDown, Orbit, X } from "lucide-react";
import { Avatar, Button, Chip, toast } from "@/components/ui";
import { firstNameOf, suggestionHighlights, SUGGESTIONS_VISIBLE } from "@/lib/network/presentation";
import type { SuggestionItem } from "@/lib/network/queries";
import { cn } from "@/lib/utils";
import { ConnectButton } from "./connect-button";
import { FollowButton } from "./follow-button";
import { handOffFocus } from "./network-announcer";

// ---------------------------------------------------------------------------
// Sugestões dispensadas: só neste navegador (localStorage), nada vai ao servidor.
// ---------------------------------------------------------------------------

const STORAGE_KEY = "artemis:rede:sugestoes-dispensadas";
const CHANGE_EVENT = "artemis:rede:dispensadas";

function readRaw(): string {
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? "[]";
  } catch {
    return "[]";
  }
}

function writeIds(ids: readonly string[]) {
  try {
    // Guarda as 200 mais recentes: a lista não cresce para sempre.
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids.slice(-200)));
  } catch {
    // modo privado / armazenamento bloqueado: a dispensa vale só até recarregar
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

function parseIds(raw: string): string[] {
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function useDismissed() {
  const raw = useSyncExternalStore(subscribe, readRaw, () => "[]");
  const ids = useMemo(() => new Set(parseIds(raw)), [raw]);
  return {
    ids,
    dismiss: (id: string) => writeIds([...parseIds(readRaw()).filter((v) => v !== id), id]),
    restore: (id: string) => writeIds(parseIds(readRaw()).filter((v) => v !== id)),
  };
}

// ---------------------------------------------------------------------------
// Lista
// ---------------------------------------------------------------------------

/**
 * Sugestões de conexão em linhas compactas (no celular) ou cartões (telas maiores): avatar, nome,
 * título em uma linha e um selo com o motivo principal ("Marina e mais 1 em comum"). "Conectar"
 * é um toque (o aviso oferece "Adicionar recado"); "Seguir" fica em contorno; "×" dispensa a
 * sugestão só neste navegador. Mostra 6 e o resto em "Ver mais".
 */
export function SuggestionList({
  items,
  headingId,
}: {
  items: readonly SuggestionItem[];
  /** Título da seção: recebe o foco quando uma sugestão é dispensada. */
  headingId: string;
}) {
  const dismissed = useDismissed();
  const [expanded, setExpanded] = useState(false);
  const visible = items.filter((item) => !dismissed.ids.has(item.id));
  const shown = expanded ? visible : visible.slice(0, SUGGESTIONS_VISIBLE);
  const hiddenCount = visible.length - shown.length;

  function dismiss(item: SuggestionItem) {
    const name = firstNameOf(item.full_name) || item.full_name;
    // O foco vai para a próxima sugestão (ou para o título, se era a última).
    const index = shown.findIndex((s) => s.id === item.id);
    const next = shown[index + 1] ?? shown[index - 1];
    dismissed.dismiss(item.id);
    if (next) {
      window.setTimeout(() => document.getElementById(`sugestao-nome-${next.id}`)?.focus(), 50);
    } else {
      handOffFocus(headingId);
    }
    toast({
      message: `${name} não aparece mais nas suas sugestões neste aparelho.`,
      tone: "info",
      action: { label: "Desfazer", onClick: () => dismissed.restore(item.id) },
    });
  }

  if (visible.length === 0) {
    return (
      <p className="rounded-card border border-dashed border-border-strong bg-surface p-5 text-fg-muted">
        Você dispensou todas as sugestões deste momento. Procure pesquisadoras pelo nome, área ou
        instituição em{" "}
        <Link
          href="/pesquisadoras"
          className="font-semibold text-primary underline underline-offset-2"
        >
          Pesquisadoras
        </Link>
        .
      </p>
    );
  }

  return (
    <div className="grid gap-4">
      {/* Duas colunas no máximo: cabe "Convite enviado · Cancelar · Seguindo" numa linha só. */}
      <ul className="grid gap-3 md:grid-cols-2 md:gap-4">
        {shown.map((item) => (
          <SuggestionRow key={item.id} item={item} onDismiss={() => dismiss(item)} />
        ))}
      </ul>
      {hiddenCount > 0 && (
        <Button
          variant="outline"
          className="justify-self-center pointer-coarse:h-11"
          onClick={() => {
            const firstHidden = visible[SUGGESTIONS_VISIBLE];
            setExpanded(true);
            // Leva o foco à primeira sugestão que apareceu (o botão some).
            if (firstHidden) {
              window.setTimeout(
                () => document.getElementById(`sugestao-nome-${firstHidden.id}`)?.focus(),
                50,
              );
            }
          }}
        >
          <ChevronDown aria-hidden="true" />
          Ver mais {hiddenCount} {hiddenCount === 1 ? "sugestão" : "sugestões"}
        </Button>
      )}
    </div>
  );
}

function SuggestionRow({ item, onDismiss }: { item: SuggestionItem; onDismiss: () => void }) {
  const { main, others } = suggestionHighlights(item, item.mutualNames);
  const headingId = `sugestao-${item.id}`;
  return (
    <li
      aria-labelledby={headingId}
      className="relative grid min-w-0 grid-cols-[3rem_minmax(0,1fr)] content-start gap-x-3 gap-y-3 rounded-card border border-border bg-surface p-3.5 shadow-card sm:p-4"
    >
      <Avatar
        name={item.full_name}
        src={item.avatar_url}
        seed={item.id}
        size="md"
        className="size-12 shrink-0 text-base"
      />
      {/* Espaço à direita só no texto (o "×" fica no canto); as ações usam a largura toda. */}
      <div className="grid min-w-0 content-start gap-1 pr-8 pointer-coarse:pr-11">
        <h3
          id={headingId}
          className="font-display text-base leading-snug font-semibold break-words text-fg"
        >
          <Link
            id={`sugestao-nome-${item.id}`}
            href={`/pesquisadoras/${item.id}`}
            className="rounded-badge underline-offset-[0.2em] hover:text-primary hover:underline"
          >
            {item.full_name}
          </Link>
        </h3>
        {item.headline && <p className="line-clamp-1 text-sm text-fg-muted">{item.headline}</p>}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Chip size="sm" variant="primary" icon={<Orbit aria-hidden="true" />}>
            {main}
          </Chip>
          {others.length > 0 && (
            <span className="text-xs text-fg-subtle max-sm:hidden">{others.join(" · ")}</span>
          )}
        </div>
      </div>
      <div
        id={`sugestao-acoes-${item.id}`}
        className="col-span-2 flex flex-wrap items-center gap-2"
      >
        <ConnectButton
          profileId={item.id}
          state="none"
          personName={item.full_name}
          size="sm"
          oneTap
          revalidate={false}
        />
        <FollowButton
          profileId={item.id}
          following={item.following}
          personName={item.full_name}
          size="sm"
          revalidate={false}
        />
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label={`Dispensar a sugestão: ${item.full_name}`}
        className={cn(
          "absolute top-2 right-2 inline-flex size-8 items-center justify-center rounded-control text-fg-subtle transition-colors hover:bg-surface-2 hover:text-fg pointer-coarse:size-11 [&_svg]:size-4",
        )}
      >
        <X aria-hidden="true" />
      </button>
    </li>
  );
}
