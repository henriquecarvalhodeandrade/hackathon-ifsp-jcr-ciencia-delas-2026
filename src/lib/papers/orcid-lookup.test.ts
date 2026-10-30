import { describe, expect, it, vi } from "vitest";
import { ORCID_WORKS_FIXTURE } from "./orcid.fixture";
import { fetchOrcidWorks, ORCID_MAX_RESPONSE_BYTES, ORCID_TIMEOUT_MS } from "./orcid-lookup";

const ID = "0000-0002-1825-0097";

function stubFetch(impl: (url: string, init: RequestInit) => Promise<Response>) {
  const fetchMock = vi.fn(impl);
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "warn").mockImplementation(() => {});
  return fetchMock;
}

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });

describe("fetchOrcidWorks", () => {
  it("chama só o host fixo da API pública, com Accept, User-Agent, sem cache e sem redirect", async () => {
    vi.stubEnv("CONTACT_EMAIL", "contato@exemplo.org");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://artemis.exemplo.org/");
    const fetchMock = stubFetch(async () => json(ORCID_WORKS_FIXTURE));
    const timeout = vi.spyOn(AbortSignal, "timeout");

    const result = await fetchOrcidWorks(ID);

    expect(result.ok && result.works.length).toBe(4);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(`https://pub.orcid.org/v3.0/${ID}/works`);
    expect(init.headers).toEqual({
      Accept: "application/json",
      "User-Agent": "Artemis/1.0 (+https://artemis.exemplo.org; mailto:contato@exemplo.org)",
    });
    expect(init).toMatchObject({ cache: "no-store", redirect: "error" });
    expect(timeout).toHaveBeenCalledWith(ORCID_TIMEOUT_MS);
    expect(ORCID_TIMEOUT_MS).toBe(8000);
  });

  it("não faz nenhuma chamada com um iD inválido", async () => {
    const fetchMock = stubFetch(async () => json(ORCID_WORKS_FIXTURE));
    for (const id of ["0000-0002-1825-0098", "../../x", "0000-0002-1825-0097@evil.example"]) {
      expect(await fetchOrcidWorks(id)).toEqual({ ok: false, reason: "not_found" });
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    [404, "not_found"],
    [409, "locked"],
    [429, "rate_limited"],
    [503, "rate_limited"],
    [500, "unavailable"],
    [502, "unavailable"],
  ] as const)("HTTP %i → %s", async (status, reason) => {
    stubFetch(async () => json({ "response-code": status }, { status }));
    expect(await fetchOrcidWorks(ID)).toEqual({ ok: false, reason });
  });

  it("erro de rede ou tempo esgotado → unavailable", async () => {
    stubFetch(async () => {
      throw new DOMException("The operation was aborted due to timeout", "TimeoutError");
    });
    expect(await fetchOrcidWorks(ID)).toEqual({ ok: false, reason: "unavailable" });
  });

  it("corpo interrompido no meio da leitura → unavailable", async () => {
    stubFetch(async () => {
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('{"group":['));
          controller.error(new DOMException("timeout", "TimeoutError"));
        },
      });
      return new Response(body, { status: 200 });
    });
    expect(await fetchOrcidWorks(ID)).toEqual({ ok: false, reason: "unavailable" });
  });

  it("JSON quebrado ou em formato desconhecido → invalid_response", async () => {
    stubFetch(async () => new Response("<html>manutenção</html>", { status: 200 }));
    expect(await fetchOrcidWorks(ID)).toEqual({ ok: false, reason: "invalid_response" });
    stubFetch(async () => json({ "response-code": 200 }));
    expect(await fetchOrcidWorks(ID)).toEqual({ ok: false, reason: "invalid_response" });
  });

  it("recusa resposta acima do teto pelo Content-Length, sem ler o corpo", async () => {
    let pulled = false;
    stubFetch(async () => {
      // highWaterMark 0: o stream só puxa dados quando alguém lê.
      const body = new ReadableStream<Uint8Array>(
        {
          pull(controller) {
            pulled = true;
            controller.close();
          },
        },
        { highWaterMark: 0 },
      );
      return new Response(body, {
        status: 200,
        headers: { "content-length": String(ORCID_MAX_RESPONSE_BYTES + 1) },
      });
    });
    expect(await fetchOrcidWorks(ID)).toEqual({ ok: false, reason: "invalid_response" });
    expect(pulled).toBe(false);
  });

  it("para de ler assim que o corpo passa do teto (sem Content-Length)", async () => {
    const chunk = new Uint8Array(1_000_000).fill(32);
    let sent = 0;
    stubFetch(async () => {
      const body = new ReadableStream<Uint8Array>({
        pull(controller) {
          sent += chunk.byteLength;
          controller.enqueue(chunk);
          if (sent > 50_000_000) controller.close();
        },
      });
      return new Response(body, { status: 200 });
    });
    expect(await fetchOrcidWorks(ID)).toEqual({ ok: false, reason: "invalid_response" });
    expect(sent).toBeLessThanOrEqual(ORCID_MAX_RESPONSE_BYTES + 2 * chunk.byteLength);
  });

  it("aceita lista vazia (nenhum trabalho público)", async () => {
    stubFetch(async () => json({ group: [], path: `/${ID}/works` }));
    expect(await fetchOrcidWorks(ID)).toEqual({ ok: true, works: [] });
  });
});
