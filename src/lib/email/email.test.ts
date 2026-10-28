import { describe, expect, it, vi } from "vitest";
import { maskEmail, normalizeEmail, parseAddress, parseRetryAfter } from "./address";
import { getMailpitUrl } from "./config";
import { sendBatch, sendEmail } from "./resend";
import type { EmailMessage } from "./types";

describe("address helpers", () => {
  it("parseAddress", () => {
    expect(parseAddress("Ciência Delas <onboarding@resend.dev>")).toEqual({
      name: "Ciência Delas",
      email: "onboarding@resend.dev",
    });
    expect(parseAddress('"Boletim" <a@b.co>')).toEqual({ name: "Boletim", email: "a@b.co" });
    expect(parseAddress("a@b.co")).toEqual({ name: null, email: "a@b.co" });
  });

  it("normalizeEmail", () => {
    expect(normalizeEmail("  Ana@Exemplo.ORG ")).toBe("ana@exemplo.org");
  });

  it("maskEmail esconde parte do endereço", () => {
    expect(maskEmail("larissa@demo.cienciadelas.dev")).toBe("la••••a@demo.cienciadelas.dev");
    expect(maskEmail("ana@x.org")).toBe("a•a@x.org");
    expect(maskEmail("ab@x.org")).toBe("a•@x.org");
    expect(maskEmail("sem-arroba")).toBe("•••");
  });

  it("parseRetryAfter", () => {
    expect(parseRetryAfter("2")).toBe(2000);
    expect(parseRetryAfter("0.5")).toBe(500);
    expect(parseRetryAfter(new Date(10_000).toUTCString(), 4_000)).toBe(6000);
    expect(parseRetryAfter("lixo")).toBeNull();
    expect(parseRetryAfter(null)).toBeNull();
  });
});

describe("getMailpitUrl", () => {
  it("em produção só aceita MAILPIT_URL explícita no próprio computador", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
    try {
      vi.stubEnv("MAILPIT_URL", "");
      expect(getMailpitUrl()).toBeNull();
      vi.stubEnv("MAILPIT_URL", "http://127.0.0.1:54324/");
      expect(getMailpitUrl()).toBe("http://127.0.0.1:54324");
      vi.stubEnv("MAILPIT_URL", "https://mailpit.exemplo.org");
      expect(getMailpitUrl()).toBeNull();
      vi.stubEnv("MAILPIT_URL", "off");
      expect(getMailpitUrl()).toBeNull();
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("fora de produção deduz do Supabase local e respeita MAILPIT_URL=off", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
    try {
      vi.stubEnv("MAILPIT_URL", "");
      expect(getMailpitUrl()).toBe("http://127.0.0.1:54324");
      vi.stubEnv("MAILPIT_URL", "off");
      expect(getMailpitUrl()).toBeNull();
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

const message: EmailMessage = {
  to: "ana@exemplo.org",
  subject: "Oi",
  html: "<p>Oi</p>",
  text: "Oi",
  headers: { "List-Unsubscribe": "<https://x/u>" },
};

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    ...init,
  });
}

describe("Resend client", () => {
  it("sem chave → skipped (nunca lança)", async () => {
    const fetchImpl = vi.fn();
    const result = await sendEmail(message, {}, { apiKey: "", fetchImpl });
    expect(result).toEqual({ ok: false, skipped: true, reason: "RESEND_API_KEY não configurada." });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("envia com Authorization, Idempotency-Key e cabeçalhos do e-mail", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ id: "email_1" }));
    const result = await sendEmail(
      message,
      { idempotencyKey: "k1" },
      { apiKey: "re_x", from: "CD <a@b.co>", fetchImpl },
    );
    expect(result).toEqual({ ok: true, provider: "resend", id: "email_1" });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer re_x");
    expect(headers["Idempotency-Key"]).toBe("k1");
    expect(JSON.parse(String(init.body))).toMatchObject({
      from: "CD <a@b.co>",
      to: ["ana@exemplo.org"],
      headers: { "List-Unsubscribe": "<https://x/u>" },
    });
  });

  it("429 → espera o Retry-After uma vez e tenta de novo", async () => {
    const sleep = vi.fn(async () => {});
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ message: "rate" }, { status: 429, headers: { "retry-after": "3" } }),
      )
      .mockResolvedValueOnce(jsonResponse({ id: "email_2" }));
    const result = await sendEmail(message, {}, { apiKey: "re_x", fetchImpl, sleep });
    expect(result).toMatchObject({ ok: true, id: "email_2" });
    expect(sleep).toHaveBeenCalledWith(3000);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("422 → falha sem repetir", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ message: "Invalid `to` field" }, { status: 422 }),
    );
    const result = await sendEmail(message, {}, { apiKey: "re_x", fetchImpl });
    expect(result).toMatchObject({ ok: false, status: 422 });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("5xx só repete com chave de idempotência", async () => {
    const sleep = vi.fn(async () => {});
    const failing = () => vi.fn(async () => jsonResponse({ message: "boom" }, { status: 503 }));
    const withoutKey = failing();
    await sendEmail(message, {}, { apiKey: "re_x", fetchImpl: withoutKey, sleep });
    expect(withoutKey).toHaveBeenCalledTimes(1);
    const withKey = failing();
    await sendEmail(
      message,
      { idempotencyKey: "k" },
      { apiKey: "re_x", fetchImpl: withKey, sleep },
    );
    expect(withKey).toHaveBeenCalledTimes(2);
  });

  it("lote: até 100 e ids na mesma ordem", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ data: [{ id: "a" }, { id: "b" }] }));
    const result = await sendBatch(
      [message, { ...message, to: "bia@exemplo.org" }],
      {},
      { apiKey: "re_x", fetchImpl },
    );
    expect(result).toEqual({ ok: true, provider: "resend", ids: ["a", "b"] });
    expect((fetchImpl.mock.calls[0] as unknown as [string])[0]).toBe(
      "https://api.resend.com/emails/batch",
    );

    const tooMany = await sendBatch(
      Array.from({ length: 101 }, () => message),
      {},
      { apiKey: "re_x", fetchImpl },
    );
    expect(tooMany.ok).toBe(false);
  });
});
