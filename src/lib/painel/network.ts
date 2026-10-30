import "server-only";
import { createClient } from "@/lib/supabase/server";

/**
 * O que a rede social (docs/18) está esperando dela, COM NOMES, para "O que está esperando você"
 * no /painel: mensagens diretas novas, pedidos de mensagem, convites de conexão e candidaturas
 * nas vagas que ela publicou.
 *
 * Fica fora de loadPainelData de propósito (aquele faz exatamente 6 idas, ver queries.test.ts):
 * a página chama os dois em paralelo. São 3 idas, com a sessão (o RLS decide o que ela vê) e com
 * limite explícito. Se falhar, devolve null e só esta parte some — o resto do bloco continua.
 */

/** Linhas mostradas de cada tipo (o resto vira "E mais N…"). */
export const NETWORK_WAITING_LIMITS = {
  conversations: 3,
  invites: 3,
  applications: 3,
  /** Conversas lidas da caixa de entrada (as mais recentes primeiro). */
  inbox: 100,
} as const;

export interface WaitingPerson {
  id: string;
  name: string;
  avatarUrl: string | null;
}

export interface WaitingDirectConversation {
  id: string;
  /** "message" = mensagem nova numa conversa aceita; "request" = pedido de mensagem para ela. */
  kind: "message" | "request";
  person: WaitingPerson;
  at: string;
}

export interface WaitingInvite {
  id: string;
  person: WaitingPerson;
  at: string;
}

export interface WaitingApplication {
  id: string;
  opportunityId: string;
  opportunityTitle: string;
  person: WaitingPerson;
  at: string;
}

export interface NetworkWaiting {
  conversations: WaitingDirectConversation[];
  conversationsTotal: number;
  invites: WaitingInvite[];
  invitesTotal: number;
  applications: WaitingApplication[];
  applicationsTotal: number;
}

export interface InboxRow {
  id: string;
  status: "request" | "active" | "declined";
  initiator_id: string;
  unread: boolean;
  last_message_at: string | null;
  created_at: string;
  other_id: string;
  other_name: string;
  other_avatar_url: string | null;
}

/**
 * Conversas que pedem ação: pedidos de mensagem que ela recebeu (lidos ou não — falta responder)
 * e conversas aceitas com mensagem nova. Pedidos primeiro; depois, as mais recentes.
 */
export function pickWaitingConversations(
  rows: readonly InboxRow[],
  userId: string,
): WaitingDirectConversation[] {
  const waiting: WaitingDirectConversation[] = [];
  for (const row of rows) {
    const kind =
      row.status === "request" && row.initiator_id !== userId
        ? "request"
        : row.status === "active" && row.unread
          ? "message"
          : null;
    if (!kind) continue;
    waiting.push({
      id: row.id,
      kind,
      person: { id: row.other_id, name: row.other_name, avatarUrl: row.other_avatar_url },
      at: row.last_message_at ?? row.created_at,
    });
  }
  return waiting.sort((a, b) =>
    a.kind === b.kind ? b.at.localeCompare(a.at) : a.kind === "request" ? -1 : 1,
  );
}

function person(row: unknown, id: string): WaitingPerson {
  const p = row as { full_name?: string | null; avatar_url?: string | null } | null;
  return { id, name: p?.full_name?.trim() || "Pesquisadora", avatarUrl: p?.avatar_url ?? null };
}

export async function loadNetworkWaiting(userId: string): Promise<NetworkWaiting | null> {
  try {
    const supabase = await createClient();
    const [inbox, invites, applications] = await Promise.all([
      supabase.rpc("list_my_conversations").limit(NETWORK_WAITING_LIMITS.inbox),
      supabase
        .from("connections")
        .select(
          "id, requester_id, created_at, requester:profiles!connections_requester_id_fkey(full_name, avatar_url)",
          { count: "exact" },
        )
        .eq("addressee_id", userId)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(NETWORK_WAITING_LIMITS.invites),
      supabase
        .from("opportunity_applications")
        .select(
          `id, applicant_id, created_at,
           applicant:profiles!opportunity_applications_applicant_id_fkey(full_name, avatar_url),
           opportunity:research_opportunities!opportunity_applications_opportunity_id_fkey!inner(id, title, owner_id)`,
          { count: "exact" },
        )
        // Só as vagas DELA (a candidata também enxerga as próprias candidaturas pelo RLS).
        .eq("opportunity.owner_id", userId)
        .eq("status", "submitted")
        .order("created_at", { ascending: false })
        .limit(NETWORK_WAITING_LIMITS.applications),
    ]);
    if (inbox.error || invites.error || applications.error) {
      const error = inbox.error ?? invites.error ?? applications.error;
      console.warn(`[painel] rede — ${error?.code ?? ""} ${error?.message.slice(0, 160) ?? ""}`);
      return null;
    }

    const conversations = pickWaitingConversations((inbox.data ?? []) as InboxRow[], userId);
    const inviteRows = invites.data ?? [];
    const applicationRows = applications.data ?? [];
    return {
      conversations: conversations.slice(0, NETWORK_WAITING_LIMITS.conversations),
      conversationsTotal: conversations.length,
      invites: inviteRows.map((row) => ({
        id: row.id,
        person: person(row.requester, row.requester_id),
        at: row.created_at,
      })),
      invitesTotal: invites.count ?? inviteRows.length,
      applications: applicationRows.map((row) => ({
        id: row.id,
        opportunityId: row.opportunity.id,
        opportunityTitle: row.opportunity.title,
        person: person(row.applicant, row.applicant_id),
        at: row.created_at,
      })),
      applicationsTotal: applications.count ?? applicationRows.length,
    };
  } catch {
    return null;
  }
}
