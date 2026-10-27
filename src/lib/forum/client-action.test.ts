import { redirect } from "next/navigation";
import { describe, expect, it } from "vitest";
import { CONNECTION_ERROR, freshNonce, withConnectionFallback } from "./client-action";

type State = { ok: boolean; error?: string } | null;

describe("withConnectionFallback", () => {
  it("devolve o resultado da action quando ela responde", async () => {
    const wrapped = withConnectionFallback<State, FormData>(
      async () => ({ ok: true }),
      () => ({ ok: false, error: CONNECTION_ERROR }),
    );
    await expect(wrapped(null, new FormData())).resolves.toEqual({ ok: true });
  });

  it("troca uma falha de rede pelo estado de erro (com o que foi enviado)", async () => {
    const wrapped = withConnectionFallback<State, FormData>(
      async () => {
        throw new TypeError("Failed to fetch");
      },
      (fd) => ({ ok: false, error: `${CONNECTION_ERROR} ${String(fd.get("body"))}` }),
    );
    const fd = new FormData();
    fd.set("body", "meu texto");
    await expect(wrapped(null, fd)).resolves.toEqual({
      ok: false,
      error: `${CONNECTION_ERROR} meu texto`,
    });
  });

  it("não engole o redirect() do Next", async () => {
    const wrapped = withConnectionFallback<State, FormData>(
      async () => redirect("/forum/t/abc"),
      () => ({ ok: false, error: CONNECTION_ERROR }),
    );
    await expect(wrapped(null, new FormData())).rejects.toMatchObject({
      digest: expect.stringContaining("NEXT_REDIRECT"),
    });
  });
});

describe("freshNonce", () => {
  it("gera chaves diferentes sem depender de crypto.randomUUID", () => {
    expect(freshNonce()).not.toBe(freshNonce());
  });
});
