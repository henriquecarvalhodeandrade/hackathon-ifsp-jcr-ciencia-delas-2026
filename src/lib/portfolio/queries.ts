import "server-only";
import type { createClient } from "@/lib/supabase/server";
import { sortPortfolioItems, type PortfolioKind } from "./presentation";

/**
 * Leituras do portfólio, sempre com o cliente da sessão: todas as membras leem todos os
 * portfólios (RLS); só a dona escreve.
 */

export type ServerClient = Awaited<ReturnType<typeof createClient>>;

const ITEM_COLUMNS =
  "id, owner_id, kind, title, description, url, venue, year, tags, pinned, created_at, updated_at";

export interface PortfolioItem {
  id: string;
  owner_id: string;
  kind: PortfolioKind;
  title: string;
  description: string | null;
  url: string | null;
  venue: string | null;
  year: number | null;
  tags: string[];
  pinned: boolean;
  created_at: string;
  updated_at: string;
}

/** Itens de uma pessoa: destacados primeiro, depois ano (mais recente) e criação. */
export async function listPortfolioItems(
  supabase: ServerClient,
  ownerId: string,
): Promise<{ items: PortfolioItem[]; failed: boolean }> {
  const { data, error } = await supabase
    .from("portfolio_items")
    .select(ITEM_COLUMNS)
    .eq("owner_id", ownerId)
    .order("pinned", { ascending: false })
    .order("year", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    // O banco limita a 50 por pessoa (CD066).
    .limit(60);
  if (error) {
    console.warn(`[portfólio] listar — ${error.code ?? ""} ${error.message.slice(0, 160)}`);
    return { items: [], failed: true };
  }
  // A ordem do banco já é esta; a ordenação pura garante o desempate estável.
  return { items: sortPortfolioItems(data ?? []), failed: false };
}

/** Um item da própria usuária (para editar). Item de outra pessoa ou inexistente → null. */
export async function getOwnPortfolioItem(
  supabase: ServerClient,
  id: string,
  ownerId: string,
): Promise<PortfolioItem | null> {
  const { data, error } = await supabase
    .from("portfolio_items")
    .select(ITEM_COLUMNS)
    .eq("id", id)
    .eq("owner_id", ownerId)
    .maybeSingle();
  if (error) {
    console.warn(`[portfólio] item — ${error.code ?? ""} ${error.message.slice(0, 160)}`);
    return null;
  }
  return data;
}

/**
 * Quantas publicações MINHAS no feed anexam cada item (as de "Compartilhar no feed"). Usado no
 * diálogo de apagar: "Apagar também a publicação no feed". Falhou? Mapa vazio (sem a opção).
 */
export async function loadSharedPostCounts(
  supabase: ServerClient,
  ownerId: string,
  itemIds: readonly string[],
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (itemIds.length === 0) return counts;
  const { data, error } = await supabase
    .from("posts")
    .select("portfolio_item_id")
    .eq("author_id", ownerId)
    .in("portfolio_item_id", [...itemIds]);
  if (error) {
    console.warn(`[portfólio] publicações — ${error.code ?? ""} ${error.message.slice(0, 160)}`);
    return counts;
  }
  for (const row of data ?? []) {
    if (row.portfolio_item_id) {
      counts.set(row.portfolio_item_id, (counts.get(row.portfolio_item_id) ?? 0) + 1);
    }
  }
  return counts;
}
