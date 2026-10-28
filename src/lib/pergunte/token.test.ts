import { describe, expect, it } from "vitest";
import { isTrackingToken, trackingPath, trackingUrl } from "./token";

describe("token do link de acompanhamento", () => {
  it("aceita 32 caracteres base64url", () => {
    expect(isTrackingToken("DemoPergunte-Artemis2026-IFSPjcr")).toBe(true);
    expect(isTrackingToken("abcdefghijklmnopqrstuvwxyz012_-A")).toBe(true);
  });

  it("recusa tamanho errado, caracteres fora do alfabeto e não-strings", () => {
    expect(isTrackingToken("curto")).toBe(false);
    expect(isTrackingToken("a".repeat(31))).toBe(false);
    expect(isTrackingToken("a".repeat(33))).toBe(false);
    expect(isTrackingToken(`${"a".repeat(31)}=`)).toBe(false);
    expect(isTrackingToken(`${"a".repeat(31)}+`)).toBe(false);
    expect(isTrackingToken(`${"a".repeat(31)}/`)).toBe(false);
    expect(isTrackingToken(`../${"a".repeat(29)}`)).toBe(false);
    expect(isTrackingToken(undefined)).toBe(false);
    expect(isTrackingToken(123)).toBe(false);
  });

  it("monta caminho e endereço completo", () => {
    const token = "DemoPergunte-Artemis2026-IFSPjcr";
    expect(trackingPath(token)).toBe(`/pergunte/acompanhar/${token}`);
    expect(trackingUrl("https://artemis.example/", token)).toBe(
      `https://artemis.example/pergunte/acompanhar/${token}`,
    );
  });
});
