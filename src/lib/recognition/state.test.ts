import { describe, expect, it } from "vitest";
import {
  buildRecognitionStates,
  buildRecognitionTodos,
  latestDeclaration,
  toDeclarationView,
  type DeclarationRow,
} from "./state";

const ME = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const T0 = "2026-10-01T12:00:00.000Z";
const T1 = "2026-10-02T12:00:00.000Z";
const T2 = "2026-10-03T12:00:00.000Z";

function row(overrides: Partial<DeclarationRow> = {}): DeclarationRow {
  return {
    id: "d1",
    request_id: "r1",
    code: "ART-7K2M-Q9XD-4HNP",
    requested_by: OTHER,
    mentee_consented_at: T0,
    mentor_consented_at: null,
    issued_at: null,
    revoked_at: null,
    revoked_by: null,
    revoke_reason: null,
    created_at: T0,
    ...overrides,
  };
}

describe("toDeclarationView", () => {
  it("pedido da outra, falta a minha autorização (sou a mentora)", () => {
    expect(toDeclarationView(row(), "mentor", OTHER)).toMatchObject({
      status: "awaiting-me",
      requestedByMe: false,
    });
  });

  it("eu pedi (sou a mentoranda), falta a outra", () => {
    expect(toDeclarationView(row({ requested_by: ME }), "mentee", OTHER)).toMatchObject({
      status: "awaiting-other",
      requestedByMe: true,
    });
  });

  it("emitida, revogada (depois de emitida) e cancelada (antes)", () => {
    const issued = row({ mentor_consented_at: T1, issued_at: T1 });
    expect(toDeclarationView(issued, "mentee", OTHER).status).toBe("issued");
    expect(
      toDeclarationView({ ...issued, revoked_at: T2, revoked_by: ME }, "mentee", OTHER),
    ).toMatchObject({ status: "revoked", revokedByMe: true });
    expect(
      toDeclarationView(row({ revoked_at: T1, revoked_by: OTHER }), "mentee", OTHER),
    ).toMatchObject({ status: "cancelled", revokedByMe: false });
  });
});

describe("latestDeclaration", () => {
  it("a ativa ganha das revogadas; entre iguais, a mais nova", () => {
    const old = row({ id: "a", created_at: T0, revoked_at: T1 });
    const active = row({ id: "b", created_at: T1 });
    const newerRevoked = row({ id: "c", created_at: T2, revoked_at: T2 });
    expect(latestDeclaration([old, active, newerRevoked])?.id).toBe("b");
    expect(latestDeclaration([old, newerRevoked])?.id).toBe("c");
    expect(latestDeclaration([])).toBeNull();
  });
});

describe("buildRecognitionStates", () => {
  it("junta retornos e declarações por mentoria", () => {
    const states = buildRecognitionStates(
      [
        { id: "r1", role: "mentee", otherId: OTHER },
        { id: "r2", role: "mentor", otherId: OTHER },
      ],
      ["r2"],
      [row({ request_id: "r1", requested_by: ME })],
      new Map([["r1", T2]]),
    );
    expect(states.get("r1")).toMatchObject({
      completedAt: T2,
      feedbackSent: false,
      declaration: { status: "awaiting-other" },
    });
    expect(states.get("r2")).toEqual({ completedAt: null, feedbackSent: true, declaration: null });
  });
});

describe("buildRecognitionTodos", () => {
  const now = new Date("2026-10-28T12:00:00.000Z");
  const completed = [
    {
      id: "r1",
      role: "mentor" as const,
      otherId: OTHER,
      otherName: "Gabriela Lima",
      completedAt: "2026-10-27T12:00:00.000Z",
    },
    {
      id: "r2",
      role: "mentee" as const,
      otherId: OTHER,
      otherName: "Patrícia Santos",
      completedAt: "2026-10-20T12:00:00.000Z",
    },
    {
      id: "r3",
      role: "mentee" as const,
      otherId: OTHER,
      otherName: "Luiza Fernandes",
      completedAt: "2026-07-01T12:00:00.000Z",
    },
  ];

  it("autorizações pendentes primeiro, depois retornos recentes sem resposta", () => {
    const todos = buildRecognitionTodos({
      completed,
      feedbackRequestIds: ["r2"],
      declarations: [row({ request_id: "r1" })],
      now,
    });
    expect(todos).toEqual([
      { kind: "consent", requestId: "r1", declarationId: "d1", otherName: "Gabriela Lima" },
      {
        kind: "feedback",
        requestId: "r1",
        otherName: "Gabriela Lima",
        completedAt: "2026-10-27T12:00:00.000Z",
      },
    ]);
  });

  it("o lembrete de retorno some depois de 30 dias (é opcional)", () => {
    const todos = buildRecognitionTodos({
      completed,
      feedbackRequestIds: [],
      declarations: [],
      now,
    });
    expect(todos.map((t) => t.requestId)).toEqual(["r1", "r2"]);
  });

  it("nada a fazer quando ela já autorizou, a declaração saiu ou foi revogada", () => {
    const todos = buildRecognitionTodos({
      completed: completed.slice(0, 1),
      feedbackRequestIds: ["r1"],
      declarations: [
        row({ request_id: "r1", mentor_consented_at: T1 }),
        row({ id: "d2", request_id: "r1", revoked_at: T1, created_at: T2 }),
      ],
      now,
    });
    expect(todos).toEqual([]);
  });
});
