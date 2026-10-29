/**
 * Relação entre a usuária logada e outra membra (módulo puro, coberto por testes).
 *
 * Regras de exibição (docs/18 §2.1):
 * - Convite que EU mandei e foi recusado aparece igual a um pendente ("Convite enviado"):
 *   a interface nunca conta a quem convidou que o convite foi recusado.
 * - Convite que EU recebi e recusei volta a mostrar "Conectar" — que aceita o convite dela
 *   (responder com aceite), já que não dá para criar um segundo convite para o mesmo par.
 */

export const CONNECTION_STATUSES = ["pending", "accepted", "declined"] as const;
export type ConnectionStatus = (typeof CONNECTION_STATUSES)[number];

/** Estado do botão "Conectar" visto por quem está logada. */
export type RelationshipState = "none" | "pending_sent" | "pending_received" | "connected";

/** O mínimo de uma linha de `connections` para decidir o estado. */
export interface ConnectionLike {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: ConnectionStatus | string;
}

export interface Relationship {
  state: RelationshipState;
  /**
   * Convite/conexão entre as duas, quando há uma ação possível sobre ela (cancelar, responder,
   * remover ou aceitar um convite recusado antes). Null quando não há linha.
   */
  connectionId: string | null;
  /** Eu sigo a outra pessoa. */
  followingThem: boolean;
  /** A outra pessoa me segue. */
  followsMe: boolean;
}

export interface RelationshipInput {
  myId: string;
  otherId: string;
  /** A linha de `connections` do par (em qualquer direção) ou null. */
  connection: ConnectionLike | null | undefined;
  followingThem?: boolean;
  followsMe?: boolean;
}

/** A linha pertence a este par (em qualquer direção)? */
function belongsToPair(connection: ConnectionLike, a: string, b: string): boolean {
  return (
    (connection.requester_id === a && connection.addressee_id === b) ||
    (connection.requester_id === b && connection.addressee_id === a)
  );
}

export function connectionState(
  myId: string,
  otherId: string,
  connection: ConnectionLike | null | undefined,
): { state: RelationshipState; connectionId: string | null } {
  if (!connection || myId === otherId || !belongsToPair(connection, myId, otherId)) {
    return { state: "none", connectionId: null };
  }
  const sentByMe = connection.requester_id === myId;
  switch (connection.status) {
    case "accepted":
      return { state: "connected", connectionId: connection.id };
    case "pending":
      return { state: sentByMe ? "pending_sent" : "pending_received", connectionId: connection.id };
    case "declined":
      // Quem convidou nunca fica sabendo da recusa; quem recusou pode aceitar depois.
      return { state: sentByMe ? "pending_sent" : "none", connectionId: connection.id };
    default:
      return { state: "none", connectionId: null };
  }
}

/** Estado completo da relação: conexão + seguir nos dois sentidos. */
export function relationshipState(input: RelationshipInput): Relationship {
  const { state, connectionId } = connectionState(input.myId, input.otherId, input.connection);
  const self = input.myId === input.otherId;
  return {
    state,
    connectionId,
    followingThem: !self && Boolean(input.followingThem),
    followsMe: !self && Boolean(input.followsMe),
  };
}

/**
 * "Conectar" de um convite que eu recebi e recusei antes: o clique aceita o convite dela
 * (respondConnectionAction com aceite) em vez de mandar um novo.
 */
export function connectAcceptsExisting(rel: Pick<Relationship, "state" | "connectionId">): boolean {
  return rel.state === "none" && rel.connectionId !== null;
}

/**
 * Status que a interface mostra para uma linha, do ponto de vista de quem está logada.
 * O convite enviado e recusado continua "pendente" para quem convidou.
 */
export function visibleStatus(
  myId: string,
  connection: Pick<ConnectionLike, "requester_id" | "status">,
): ConnectionStatus {
  if (connection.status === "declined" && connection.requester_id === myId) return "pending";
  return CONNECTION_STATUSES.includes(connection.status as ConnectionStatus)
    ? (connection.status as ConnectionStatus)
    : "pending";
}

/** A outra participante de uma linha de `connections`. */
export function otherParticipant(
  myId: string,
  connection: Pick<ConnectionLike, "requester_id" | "addressee_id">,
): string {
  return connection.requester_id === myId ? connection.addressee_id : connection.requester_id;
}
