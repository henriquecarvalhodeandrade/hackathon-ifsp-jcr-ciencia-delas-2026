import { describe, expect, it } from "vitest";
import { countUnread, parseNotificationFilter, safeInternalPath, sortNotifications } from "./meta";

describe("safeInternalPath", () => {
  it("aceita caminhos internos com query e âncora", () => {
    expect(safeInternalPath("/mentoria")).toBe("/mentoria");
    expect(safeInternalPath("/forum/t/abc#post-1")).toBe("/forum/t/abc#post-1");
    expect(safeInternalPath("  /papers/1?x=1 ")).toBe("/papers/1?x=1");
  });

  it("recusa URLs externas e truques de redirecionamento", () => {
    expect(safeInternalPath("https://evil.example")).toBeNull();
    expect(safeInternalPath("//evil.example")).toBeNull();
    expect(safeInternalPath("/\\evil.example")).toBeNull();
    expect(safeInternalPath("javascript:alert(1)")).toBeNull();
    expect(safeInternalPath("/a b")).toBeNull();
    expect(safeInternalPath("/a\nb")).toBeNull();
    expect(safeInternalPath("")).toBeNull();
    expect(safeInternalPath(null)).toBeNull();
    expect(safeInternalPath(`/${"a".repeat(600)}`)).toBeNull();
  });
});

describe("sortNotifications", () => {
  it("coloca as não lidas primeiro e ordena por data desc", () => {
    const items = [
      { id: "lida-nova", read_at: "2026-10-27T10:00:00Z", created_at: "2026-10-27T09:00:00Z" },
      { id: "nao-lida-velha", read_at: null, created_at: "2026-10-20T09:00:00Z" },
      { id: "lida-velha", read_at: "2026-10-21T10:00:00Z", created_at: "2026-10-19T09:00:00Z" },
      { id: "nao-lida-nova", read_at: null, created_at: "2026-10-26T09:00:00Z" },
    ];
    expect(sortNotifications(items).map((n) => n.id)).toEqual([
      "nao-lida-nova",
      "nao-lida-velha",
      "lida-nova",
      "lida-velha",
    ]);
    // não altera o array original
    expect(items[0]!.id).toBe("lida-nova");
  });
});

describe("countUnread / parseNotificationFilter", () => {
  it("conta só as não lidas", () => {
    expect(
      countUnread([{ read_at: null }, { read_at: "2026-10-27T10:00:00Z" }, { read_at: null }]),
    ).toBe(2);
    expect(countUnread([])).toBe(0);
  });

  it("interpreta o filtro da URL com fallback seguro", () => {
    expect(parseNotificationFilter("nao-lidas")).toBe("nao-lidas");
    expect(parseNotificationFilter(["nao-lidas", "x"])).toBe("nao-lidas");
    expect(parseNotificationFilter("qualquer")).toBe("todas");
    expect(parseNotificationFilter(undefined)).toBe("todas");
  });
});
