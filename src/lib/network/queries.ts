import "server-only";
import type { CareerStage } from "@/lib/constants";
import type { createClient } from "@/lib/supabase/server";
import {
  EMPTY_COUNTS,
  NETWORK_LIST_LIMIT,
  SUGGESTIONS_LIMIT,
  toNetworkCounts,
  type NetworkCounts,
} from "./presentation";
import {
  otherParticipant,
  relationshipState,
  type ConnectionStatus,
  type Relationship,
} from "./relationship";
import { profileIdSchema } from "./schemas";

/**
 * Leituras da rede (seguir e conectar). Sempre com o cliente da sessão: o RLS mostra conexões
 * aceitas de todas e convites (pendentes/recusados) só às duas participantes. Colunas de perfil
 * sempre explícitas.
 */

export type ServerClient = Awaited<ReturnType<typeof createClient>>;

const PERSON_COLUMNS = "id, full_name, avatar_url, headline, institution, state, career_stage";

export interface NetworkPerson {
  id: string;
  full_name: string;
  avatar_url: string | null;
  headline: string | null;
  institution: string | null;
  state: string | null;
  career_stage: CareerStage | null;
}

type PersonRow = {
  id: string;
  full_name: string;
  avatar_url: string | null;
  headline: string | null;
  institution: string | null;
  state: string | null;
  career_stage: CareerStage | null;
} | null;

function toPerson(row: PersonRow, fallbackId: string): NetworkPerson {
  return {
    id: row?.id ?? fallbackId,
    full_name: row?.full_name || "Pesquisadora",
    avatar_url: row?.avatar_url ?? null,
    headline: row?.headline ?? null,
    institution: row?.institution ?? null,
    state: row?.state ?? null,
    career_stage: row?.career_stage ?? null,
  };
}

const isGuid = (value: string) => profileIdSchema.safeParse(value).success;

function warn(scope: string, error: { code?: string; message?: string }) {
  console.warn(`[rede] ${scope} — ${error.code ?? ""} ${(error.message ?? "").slice(0, 160)}`);
}

// ---------------------------------------------------------------------------
// Números e relação com uma pessoa
// ---------------------------------------------------------------------------

export async function loadNetworkCounts(
  supabase: ServerClient,
  profileId: string,
): Promise<NetworkCounts> {
  const { data, error } = await supabase
    .rpc("get_network_counts", { p_profile_id: profileId })
    .maybeSingle();
  if (error) {
    warn("get_network_counts", error);
    return EMPTY_COUNTS;
  }
  return toNetworkCounts(data);
}

export interface RelationshipDetails extends Relationship {
  /** Recado do convite recebido (só quando o estado é pending_received). */
  inviteMessage: string | null;
}

/** Relação de quem está logada (myId) com outra membra: conexão + seguir nos dois sentidos. */
export async function loadRelationship(
  supabase: ServerClient,
  myId: string,
  otherId: string,
): Promise<RelationshipDetails> {
  // Os ids entram num filtro `or=(...)` do PostgREST: só uuids válidos chegam lá.
  if (myId === otherId || !isGuid(myId) || !isGuid(otherId)) {
    return { ...relationshipState({ myId, otherId, connection: null }), inviteMessage: null };
  }
  const pair = `and(requester_id.eq.${myId},addressee_id.eq.${otherId}),and(requester_id.eq.${otherId},addressee_id.eq.${myId})`;
  const followPair = `and(follower_id.eq.${myId},followee_id.eq.${otherId}),and(follower_id.eq.${otherId},followee_id.eq.${myId})`;
  const [connection, follows] = await Promise.all([
    supabase
      .from("connections")
      .select("id, requester_id, addressee_id, status, message")
      .or(pair)
      .maybeSingle(),
    supabase.from("follows").select("follower_id, followee_id").or(followPair),
  ]);
  if (connection.error) warn("relação (conexão)", connection.error);
  if (follows.error) warn("relação (seguir)", follows.error);
  const rows = follows.data ?? [];
  const rel = relationshipState({
    myId,
    otherId,
    connection: connection.data,
    followingThem: rows.some((f) => f.follower_id === myId && f.followee_id === otherId),
    followsMe: rows.some((f) => f.follower_id === otherId && f.followee_id === myId),
  });
  return {
    ...rel,
    inviteMessage: rel.state === "pending_received" ? (connection.data?.message ?? null) : null,
  };
}

/** Quem, entre `ids`, eu sigo (para os botões "Seguir" das listas). */
export async function loadFollowingSet(
  supabase: ServerClient,
  myId: string,
  ids: readonly string[],
): Promise<Set<string>> {
  const unique = [...new Set(ids)].filter((id) => id !== myId);
  if (unique.length === 0) return new Set();
  const { data, error } = await supabase
    .from("follows")
    .select("followee_id")
    .eq("follower_id", myId)
    .in("followee_id", unique);
  if (error) {
    warn("seguindo (lote)", error);
    return new Set();
  }
  return new Set((data ?? []).map((f) => f.followee_id));
}

// ---------------------------------------------------------------------------
// Contagens das abas da /rede
// ---------------------------------------------------------------------------

export interface NetworkTabCounts extends NetworkCounts {
  /** Convites recebidos aguardando resposta. */
  invitesReceived: number;
}

export async function loadTabCounts(
  supabase: ServerClient,
  myId: string,
): Promise<NetworkTabCounts> {
  const [counts, invites] = await Promise.all([
    loadNetworkCounts(supabase, myId),
    supabase
      .from("connections")
      .select("id", { count: "exact", head: true })
      .eq("addressee_id", myId)
      .eq("status", "pending"),
  ]);
  if (invites.error) warn("contagem de convites", invites.error);
  return { ...counts, invitesReceived: invites.count ?? 0 };
}

// ---------------------------------------------------------------------------
// Sugestões
// ---------------------------------------------------------------------------

export interface SuggestionItem extends NetworkPerson {
  shared_areas: number;
  mutual_connections: number;
  same_institution: boolean;
  /** Eu já sigo esta pessoa (sem convite nem conexão). */
  following: boolean;
}

export async function loadSuggestions(
  supabase: ServerClient,
  myId: string,
  limit = SUGGESTIONS_LIMIT,
): Promise<{ items: SuggestionItem[]; failed: boolean }> {
  const { data, error } = await supabase.rpc("get_connection_suggestions", { p_limit: limit });
  if (error) {
    warn("get_connection_suggestions", error);
    return { items: [], failed: true };
  }
  const rows = data ?? [];
  const following = await loadFollowingSet(
    supabase,
    myId,
    rows.map((r) => r.id),
  );
  return {
    failed: false,
    items: rows.map((row) => ({
      ...toPerson({ ...row, state: null }, row.id),
      shared_areas: row.shared_areas ?? 0,
      mutual_connections: row.mutual_connections ?? 0,
      same_institution: Boolean(row.same_institution),
      following: following.has(row.id),
    })),
  };
}

// ---------------------------------------------------------------------------
// Convites e conexões
// ---------------------------------------------------------------------------

export interface ConnectionItem {
  id: string;
  /** Status como a usuária deve vê-lo (recusa de quem convidou aparece "pending"). */
  status: ConnectionStatus;
  message: string | null;
  created_at: string;
  responded_at: string | null;
  sentByMe: boolean;
  other: NetworkPerson;
}

const CONNECTION_COLUMNS = `id, requester_id, addressee_id, status, message, created_at, responded_at,
  requester:profiles!connections_requester_id_fkey(${PERSON_COLUMNS}),
  addressee:profiles!connections_addressee_id_fkey(${PERSON_COLUMNS})`;

type ConnectionRow = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: ConnectionStatus;
  message: string | null;
  created_at: string;
  responded_at: string | null;
  requester: PersonRow;
  addressee: PersonRow;
};

function toConnectionItem(myId: string, row: ConnectionRow): ConnectionItem {
  const sentByMe = row.requester_id === myId;
  const otherId = otherParticipant(myId, row);
  return {
    id: row.id,
    // Quem convidou nunca vê a recusa: o convite continua "pendente" para ela.
    status: row.status === "declined" && sentByMe ? "pending" : row.status,
    message: row.message,
    created_at: row.created_at,
    responded_at: row.responded_at,
    sentByMe,
    other: toPerson(sentByMe ? row.addressee : row.requester, otherId),
  };
}

export interface Invitations {
  /** Recebidos aguardando resposta. */
  received: ConnectionItem[];
  /** Enviados aguardando resposta (inclui os recusados, que quem convidou vê como pendentes). */
  sent: ConnectionItem[];
  /** Recebidos que eu recusei (posso aceitar depois ou apagar). */
  declined: ConnectionItem[];
  failed: boolean;
}

export async function loadInvitations(supabase: ServerClient, myId: string): Promise<Invitations> {
  const [received, sent] = await Promise.all([
    supabase
      .from("connections")
      .select(CONNECTION_COLUMNS)
      .eq("addressee_id", myId)
      .in("status", ["pending", "declined"])
      .order("created_at", { ascending: false })
      .limit(NETWORK_LIST_LIMIT),
    supabase
      .from("connections")
      .select(CONNECTION_COLUMNS)
      .eq("requester_id", myId)
      .in("status", ["pending", "declined"])
      .order("created_at", { ascending: false })
      .limit(NETWORK_LIST_LIMIT),
  ]);
  if (received.error) warn("convites recebidos", received.error);
  if (sent.error) warn("convites enviados", sent.error);
  const receivedItems = ((received.data ?? []) as ConnectionRow[]).map((r) =>
    toConnectionItem(myId, r),
  );
  return {
    received: receivedItems.filter((c) => c.status === "pending"),
    declined: receivedItems.filter((c) => c.status === "declined"),
    sent: ((sent.data ?? []) as ConnectionRow[]).map((r) => toConnectionItem(myId, r)),
    failed: Boolean(received.error || sent.error),
  };
}

export async function loadConnections(
  supabase: ServerClient,
  myId: string,
): Promise<{ items: ConnectionItem[]; failed: boolean }> {
  const { data, error } = await supabase
    .from("connections")
    .select(CONNECTION_COLUMNS)
    .eq("status", "accepted")
    .or(`requester_id.eq.${myId},addressee_id.eq.${myId}`)
    .order("responded_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(NETWORK_LIST_LIMIT);
  if (error) {
    warn("conexões", error);
    return { items: [], failed: true };
  }
  return {
    items: ((data ?? []) as ConnectionRow[]).map((r) => toConnectionItem(myId, r)),
    failed: false,
  };
}

// ---------------------------------------------------------------------------
// Seguindo e seguidoras
// ---------------------------------------------------------------------------

export interface FollowItem {
  person: NetworkPerson;
  since: string;
  /** Eu sigo esta pessoa (sempre true em "Seguindo"). */
  following: boolean;
}

export async function loadFollowing(
  supabase: ServerClient,
  myId: string,
): Promise<{ items: FollowItem[]; failed: boolean }> {
  const { data, error } = await supabase
    .from("follows")
    .select(`followee_id, created_at, person:profiles!follows_followee_id_fkey(${PERSON_COLUMNS})`)
    .eq("follower_id", myId)
    .order("created_at", { ascending: false })
    .limit(NETWORK_LIST_LIMIT);
  if (error) {
    warn("seguindo", error);
    return { items: [], failed: true };
  }
  return {
    failed: false,
    items: (data ?? []).map((row) => ({
      person: toPerson(row.person as PersonRow, row.followee_id),
      since: row.created_at,
      following: true,
    })),
  };
}

export async function loadFollowers(
  supabase: ServerClient,
  myId: string,
): Promise<{ items: FollowItem[]; failed: boolean }> {
  const { data, error } = await supabase
    .from("follows")
    .select(`follower_id, created_at, person:profiles!follows_follower_id_fkey(${PERSON_COLUMNS})`)
    .eq("followee_id", myId)
    .order("created_at", { ascending: false })
    .limit(NETWORK_LIST_LIMIT);
  if (error) {
    warn("seguidoras", error);
    return { items: [], failed: true };
  }
  const rows = data ?? [];
  const followingBack = await loadFollowingSet(
    supabase,
    myId,
    rows.map((r) => r.follower_id),
  );
  return {
    failed: false,
    items: rows.map((row) => ({
      person: toPerson(row.person as PersonRow, row.follower_id),
      since: row.created_at,
      following: followingBack.has(row.follower_id),
    })),
  };
}
