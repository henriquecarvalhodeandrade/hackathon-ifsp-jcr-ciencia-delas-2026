import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";

describe("cabeçalhos de segurança (next.config.ts)", () => {
  it("valem para todas as rotas, com os valores da auditoria", async () => {
    const rules = (await nextConfig.headers?.()) ?? [];
    const all = rules.find((rule) => rule.source === "/:path*");
    expect(all, "regra para /:path*").toBeDefined();
    expect(Object.fromEntries(all!.headers.map(({ key, value }) => [key, value]))).toEqual({
      "X-Frame-Options": "DENY",
      "Content-Security-Policy": "frame-ancestors 'none'",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
      "Strict-Transport-Security": "max-age=63072000; includeSubDomains",
    });
  });
});
