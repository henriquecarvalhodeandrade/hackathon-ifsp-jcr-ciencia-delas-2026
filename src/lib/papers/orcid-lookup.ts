import "server-only";
import { env, getSiteUrl } from "@/lib/env";
import { isValidOrcidId, orcidWorksUrl, parseOrcidWorks, type OrcidWork } from "./orcid";

/**
 * Busca a lista pública de trabalhos de um ORCID iD (API pública v3.0, sem chave).
 * Limites da API anônima: 12 req/s, rajada de 40 e 25 mil leituras/dia por IP — acima da
 * rajada o ORCID responde 503 (tratamos 429 do mesmo jeito). User-Agent com contato, como no
 * Crossref, para identificar o projeto.
 *
 * SSRF: o host é fixo (pub.orcid.org) e o iD é validado (formato + dígito verificador) antes
 * de entrar na URL; redirecionamentos não são seguidos.
 */

export const ORCID_TIMEOUT_MS = 8000;
/** Respostas maiores que isso são recusadas (proteção de memória; ~2.000 trabalhos). */
export const ORCID_MAX_RESPONSE_BYTES = 8_000_000;

/**
 * Lê o corpo até `maxBytes` e para assim que passar do limite (null): o teto vale durante a
 * leitura, não depois de o corpo inteiro já estar na memória.
 */
async function readTextUpTo(response: Response, maxBytes: number): Promise<string | null> {
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) {
    await response.body?.cancel().catch(() => {});
    return null;
  }
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

export type OrcidLookupFailure =
  "not_found" | "locked" | "rate_limited" | "unavailable" | "invalid_response";

export type OrcidLookup =
  { ok: true; works: OrcidWork[] } | { ok: false; reason: OrcidLookupFailure };

export async function fetchOrcidWorks(orcid: string): Promise<OrcidLookup> {
  if (!isValidOrcidId(orcid)) return { ok: false, reason: "not_found" };

  let response: Response;
  try {
    response = await fetch(orcidWorksUrl(orcid), {
      headers: {
        Accept: "application/json",
        // Cabeçalhos HTTP aceitam só ASCII.
        "User-Agent": `Artemis/1.0 (+${getSiteUrl()}; mailto:${env.contactEmail})`,
      },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(ORCID_TIMEOUT_MS),
    });
  } catch (error) {
    const detail = error instanceof Error ? error.name : "erro";
    console.warn(`[papers] ORCID indisponível (${detail})`);
    return { ok: false, reason: "unavailable" };
  }

  if (response.status === 404) return { ok: false, reason: "not_found" };
  // 409: registro desativado, bloqueado ou unificado com outro (deprecated).
  if (response.status === 409) return { ok: false, reason: "locked" };
  if (response.status === 429 || response.status === 503) {
    console.warn(`[papers] ORCID limitou as buscas (HTTP ${response.status})`);
    return { ok: false, reason: "rate_limited" };
  }
  if (!response.ok) {
    console.warn(`[papers] ORCID respondeu HTTP ${response.status}`);
    return { ok: false, reason: "unavailable" };
  }

  let text: string | null;
  try {
    text = await readTextUpTo(response, ORCID_MAX_RESPONSE_BYTES);
  } catch (error) {
    // O tempo limite também vale para a leitura do corpo: conexão lenta = ORCID indisponível.
    const detail = error instanceof Error ? error.name : "erro";
    console.warn(`[papers] ORCID: leitura interrompida (${detail})`);
    return { ok: false, reason: "unavailable" };
  }
  if (text === null) {
    console.warn("[papers] ORCID: resposta grande demais, recusada");
    return { ok: false, reason: "invalid_response" };
  }

  try {
    const works = parseOrcidWorks(JSON.parse(text));
    return works ? { ok: true, works } : { ok: false, reason: "invalid_response" };
  } catch {
    return { ok: false, reason: "invalid_response" };
  }
}
