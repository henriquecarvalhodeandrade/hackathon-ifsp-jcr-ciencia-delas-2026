import "server-only";
import type { Tables } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/server";
import { sortNotifications, type NotificationFilter } from "./meta";

export type NotificationItem = Pick<
  Tables<"notifications">,
  "id" | "type" | "title" | "body" | "link" | "read_at" | "created_at"
>;

export interface NotificationsPage {
  items: NotificationItem[];
  /** Total de não lidas (independente do filtro). */
  unread: number;
  /** Total de notificações da usuária. */
  total: number;
  /** Quantas lidas existem (para o botão "Limpar lidas"). */
  read: number;
  /** A lista foi cortada no limite. */
  truncated: boolean;
  error: boolean;
}

const LIMIT = 100;

/**
 * Notificações da usuária logada (RLS: só as próprias). Não lidas primeiro.
 * `userId` vem da sessão (nunca do cliente) e é usado só para deixar a consulta explícita.
 */
export async function listMyNotifications(userId: string, filter: NotificationFilter): Promise<NotificationsPage> {
  const supabase = await createClient();

  let query = supabase
    .from("notifications")
    .select("id, type, title, body, link, read_at, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(LIMIT + 1);
  if (filter === "nao-lidas") query = query.is("read_at", null);

  const [list, unreadCount, totalCount] = await Promise.all([
    query,
    supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", userId).is("read_at", null),
    supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", userId),
  ]);

  if (list.error) {
    console.error("[notificacoes] falha ao listar", list.error.code);
    return { items: [], unread: 0, total: 0, read: 0, truncated: false, error: true };
  }

  const rows = list.data ?? [];
  const unread = unreadCount.count ?? rows.filter((n) => n.read_at === null).length;
  const total = totalCount.count ?? rows.length;
  return {
    items: sortNotifications(rows.slice(0, LIMIT)),
    unread,
    total,
    read: Math.max(0, total - unread),
    truncated: rows.length > LIMIT,
    error: false,
  };
}
