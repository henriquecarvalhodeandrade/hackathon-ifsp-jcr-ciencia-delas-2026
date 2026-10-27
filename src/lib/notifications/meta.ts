import type { Enums } from "@/lib/database.types";

/**
 * Regras puras das notificações (sem acesso ao banco): rótulos, filtros,
 * ordenação e validação de links. Testadas em meta.test.ts.
 */

export type NotificationType = Enums<"notification_type">;

/** Rótulo curto do tipo, mostrado acima do título. */
export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  mentorship_request: "Pedido de mentoria",
  mentorship_response: "Mentoria",
  thread_reply: "Resposta no fórum",
  solution_marked: "Solução no fórum",
  paper_comment: "Comentário em paper",
};

export type NotificationFilter = "todas" | "nao-lidas";

export function parseNotificationFilter(value: string | string[] | undefined): NotificationFilter {
  const v = Array.isArray(value) ? value[0] : value;
  return v === "nao-lidas" ? "nao-lidas" : "todas";
}

/** Fallback quando a notificação não tem link válido. */
export const NOTIFICATIONS_PATH = "/notificacoes";

/**
 * Aceita só caminhos internos ("/forum/t/..."), nunca URLs absolutas,
 * "//host" (protocol-relative) ou barras invertidas — evita open redirect.
 */
export function safeInternalPath(link: string | null | undefined): string | null {
  if (!link) return null;
  const value = link.trim();
  if (value.length === 0 || value.length > 500) return null;
  if (!value.startsWith("/")) return null;
  if (value.startsWith("//") || value.includes("\\")) return null;
  // Sem espaços nem caracteres de controle (U+0000–U+001F, U+007F).
  for (const ch of value) {
    const code = ch.charCodeAt(0);
    if (code <= 0x20 || code === 0x7f) return null;
  }
  return value;
}

interface Sortable {
  read_at: string | null;
  created_at: string;
}

/** Não lidas primeiro; dentro de cada grupo, as mais recentes primeiro. */
export function sortNotifications<T extends Sortable>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => {
    const unreadA = a.read_at === null ? 0 : 1;
    const unreadB = b.read_at === null ? 0 : 1;
    if (unreadA !== unreadB) return unreadA - unreadB;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

export function countUnread(items: readonly Pick<Sortable, "read_at">[]): number {
  return items.reduce((total, item) => (item.read_at === null ? total + 1 : total), 0);
}
