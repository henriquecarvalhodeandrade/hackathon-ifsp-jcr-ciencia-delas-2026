import { describe, expect, it } from "vitest";
import { friendlyNetworkError, networkFallback, NETWORK_RULE_MESSAGES } from "./errors";
import { connectionMessageSchema, respondConnectionSchema, sendConnectionSchema } from "./schemas";

describe("friendlyNetworkError", () => {
  it("regra do banco (CDxxx) usa a mensagem em pt-BR que veio dele", () => {
    expect(
      friendlyNetworkError({ code: "CD064", message: "Muitos convites hoje." }, "connect"),
    ).toBe("Muitos convites hoje.");
  });

  it("CDxxx sem mensagem usa o texto local", () => {
    expect(friendlyNetworkError({ code: "CD063", message: "" }, "follow")).toBe(
      NETWORK_RULE_MESSAGES.CD063,
    );
    expect(friendlyNetworkError({ code: "CD099" }, "remove")).toBe(networkFallback("remove"));
  });

  it("unicidade vira CD061 (convite) ou 'já segue' (seguir)", () => {
    expect(friendlyNetworkError({ code: "23505", message: "duplicate key" }, "connect")).toBe(
      NETWORK_RULE_MESSAGES.CD061,
    );
    expect(friendlyNetworkError({ code: "23505" }, "follow")).toBe(
      "Você já segue esta pesquisadora.",
    );
  });

  it("nunca repassa mensagem técnica", () => {
    const text = friendlyNetworkError(
      { code: "XX000", message: "internal error: relation does not exist" },
      "respond",
    );
    expect(text).toBe(networkFallback("respond"));
    expect(friendlyNetworkError(null, "load")).toBe(networkFallback("load"));
  });

  it("sessão expirada e permissão", () => {
    expect(friendlyNetworkError({ code: "PGRST301" }, "follow")).toMatch(/sessão expirou/);
    expect(friendlyNetworkError({ code: "42501" }, "remove")).toMatch(/permissão/);
  });
});

describe("schemas", () => {
  const ID = "0f3c8a52-7d4e-4c1a-9b2f-1a2b3c4d5e6f";

  it("recado vazio vira null; CRLF conta como uma quebra", () => {
    expect(connectionMessageSchema.parse("   ")).toBeNull();
    expect(connectionMessageSchema.parse(undefined)).toBeNull();
    expect(connectionMessageSchema.parse(null)).toBeNull();
    expect(connectionMessageSchema.parse(" Oi!\r\nTudo bem? ")).toBe("Oi!\nTudo bem?");
  });

  it("recado de até 300 caracteres", () => {
    expect(connectionMessageSchema.safeParse("a".repeat(300)).success).toBe(true);
    const tooLong = connectionMessageSchema.safeParse("a".repeat(301));
    expect(tooLong.success).toBe(false);
    // 150 × "a" + CRLF = 450 caracteres crus, mas 300 depois da normalização (299 sem a última).
    expect(connectionMessageSchema.safeParse("a\r\n".repeat(150)).success).toBe(true);
  });

  it("id da pesquisadora precisa ser um uuid", () => {
    expect(sendConnectionSchema.safeParse({ profile_id: ID, message: "" }).success).toBe(true);
    expect(sendConnectionSchema.safeParse({ profile_id: "abc", message: "" }).success).toBe(false);
  });

  it("resposta precisa de id e de um booleano", () => {
    expect(respondConnectionSchema.safeParse({ connection_id: ID, accept: true }).success).toBe(
      true,
    );
    expect(respondConnectionSchema.safeParse({ connection_id: ID, accept: "sim" }).success).toBe(
      false,
    );
  });
});
