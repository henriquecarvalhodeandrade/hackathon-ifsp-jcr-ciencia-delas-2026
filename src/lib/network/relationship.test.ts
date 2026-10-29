import { describe, expect, it } from "vitest";
import {
  connectAcceptsExisting,
  connectionState,
  otherParticipant,
  relationshipState,
  visibleStatus,
  type ConnectionLike,
} from "./relationship";

const ME = "11111111-1111-4111-8111-111111111111";
const HER = "22222222-2222-4222-8222-222222222222";
const SOMEONE = "33333333-3333-4333-8333-333333333333";

function row(
  requester: string,
  addressee: string,
  status: ConnectionLike["status"],
  id = "c1",
): ConnectionLike {
  return { id, requester_id: requester, addressee_id: addressee, status };
}

describe("connectionState", () => {
  it("sem linha → none, sem id", () => {
    expect(connectionState(ME, HER, null)).toEqual({ state: "none", connectionId: null });
    expect(connectionState(ME, HER, undefined)).toEqual({ state: "none", connectionId: null });
  });

  it("convite pendente que eu mandei → pending_sent", () => {
    expect(connectionState(ME, HER, row(ME, HER, "pending"))).toEqual({
      state: "pending_sent",
      connectionId: "c1",
    });
  });

  it("convite pendente que eu recebi → pending_received", () => {
    expect(connectionState(ME, HER, row(HER, ME, "pending"))).toEqual({
      state: "pending_received",
      connectionId: "c1",
    });
  });

  it("aceita (em qualquer direção) → connected", () => {
    expect(connectionState(ME, HER, row(ME, HER, "accepted")).state).toBe("connected");
    expect(connectionState(ME, HER, row(HER, ME, "accepted")).state).toBe("connected");
  });

  it("convite que eu mandei e foi recusado parece EXATAMENTE um pendente", () => {
    expect(connectionState(ME, HER, row(ME, HER, "declined"))).toEqual(
      connectionState(ME, HER, row(ME, HER, "pending")),
    );
  });

  it("convite que eu recebi e recusei → none, mas com o id (Conectar aceita o dela)", () => {
    expect(connectionState(ME, HER, row(HER, ME, "declined"))).toEqual({
      state: "none",
      connectionId: "c1",
    });
  });

  it("linha de outro par é ignorada", () => {
    expect(connectionState(ME, HER, row(ME, SOMEONE, "accepted"))).toEqual({
      state: "none",
      connectionId: null,
    });
  });

  it("eu mesma → none", () => {
    expect(connectionState(ME, ME, row(ME, HER, "accepted")).state).toBe("none");
  });

  it("status desconhecido → none", () => {
    expect(connectionState(ME, HER, row(ME, HER, "blocked"))).toEqual({
      state: "none",
      connectionId: null,
    });
  });
});

describe("relationshipState", () => {
  it("junta conexão e seguir nos dois sentidos", () => {
    expect(
      relationshipState({
        myId: ME,
        otherId: HER,
        connection: row(HER, ME, "pending"),
        followingThem: true,
        followsMe: false,
      }),
    ).toEqual({
      state: "pending_received",
      connectionId: "c1",
      followingThem: true,
      followsMe: false,
    });
  });

  it("flags ausentes viram false", () => {
    expect(relationshipState({ myId: ME, otherId: HER, connection: null })).toEqual({
      state: "none",
      connectionId: null,
      followingThem: false,
      followsMe: false,
    });
  });

  it("não segue a si mesma", () => {
    const rel = relationshipState({
      myId: ME,
      otherId: ME,
      connection: null,
      followingThem: true,
      followsMe: true,
    });
    expect(rel.followingThem).toBe(false);
    expect(rel.followsMe).toBe(false);
  });

  it("recusa de quem convidou não vaza nem pelo estado completo", () => {
    const declined = relationshipState({
      myId: ME,
      otherId: HER,
      connection: row(ME, HER, "declined"),
    });
    const pending = relationshipState({
      myId: ME,
      otherId: HER,
      connection: row(ME, HER, "pending"),
    });
    expect(declined).toEqual(pending);
  });
});

describe("connectAcceptsExisting", () => {
  it("só para o convite recebido e recusado antes", () => {
    expect(connectAcceptsExisting(connectionState(ME, HER, row(HER, ME, "declined")))).toBe(true);
    expect(connectAcceptsExisting(connectionState(ME, HER, null))).toBe(false);
    expect(connectAcceptsExisting(connectionState(ME, HER, row(ME, HER, "declined")))).toBe(false);
    expect(connectAcceptsExisting(connectionState(ME, HER, row(HER, ME, "pending")))).toBe(false);
  });
});

describe("visibleStatus / otherParticipant", () => {
  it("recusado enviado por mim aparece pendente; recebido aparece recusado", () => {
    expect(visibleStatus(ME, row(ME, HER, "declined"))).toBe("pending");
    expect(visibleStatus(ME, row(HER, ME, "declined"))).toBe("declined");
    expect(visibleStatus(ME, row(ME, HER, "accepted"))).toBe("accepted");
  });

  it("acha a outra participante nos dois sentidos", () => {
    expect(otherParticipant(ME, row(ME, HER, "pending"))).toBe(HER);
    expect(otherParticipant(ME, row(HER, ME, "pending"))).toBe(HER);
  });
});
