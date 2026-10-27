import { describe, expect, it } from "vitest";
import { z } from "zod";
import { readReportForm, reportSchema } from "./schema";

const ID = "a1000000-0000-4000-8000-000000000006";

function form(entries: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.append(k, v);
  return fd;
}

describe("reportSchema", () => {
  it("aceita uma denúncia válida e apara os detalhes", () => {
    const values = readReportForm(form({ targetType: "post", targetId: ID, reason: "harassment", details: "  ofensa  " }));
    const parsed = reportSchema.parse(values);
    expect(parsed).toEqual({ targetType: "post", targetId: ID, reason: "harassment", details: "ofensa" });
  });

  it("exige motivo e alvo válidos", () => {
    const result = reportSchema.safeParse(readReportForm(form({ targetType: "user", targetId: "1" })));
    expect(result.success).toBe(false);
    const errors = z.flattenError(result.error!).fieldErrors;
    expect(errors.reason?.[0]).toBe("Escolha o motivo da denúncia.");
    expect(errors.targetType).toBeDefined();
    expect(errors.targetId).toBeDefined();
  });

  it("pede contexto quando o motivo é 'outro'", () => {
    const result = reportSchema.safeParse({ targetType: "thread", targetId: ID, reason: "other", details: "hm" });
    expect(result.success).toBe(false);
    expect(z.flattenError(result.error!).fieldErrors.details?.[0]).toContain("pelo menos 10");
  });

  it("limita os detalhes a 1000 caracteres", () => {
    const result = reportSchema.safeParse({ targetType: "paper", targetId: ID, reason: "spam", details: "a".repeat(1001) });
    expect(result.success).toBe(false);
  });
});
