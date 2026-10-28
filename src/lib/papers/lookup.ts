import "server-only";
import { env, getSiteUrl } from "@/lib/env";
import { crossrefWorkUrl, parseCrossrefWork, type CrossrefPaperData } from "./crossref";

/**
 * Busca os metadados de um DOI na API pública do Crossref (sem chave).
 * "Polite pool": o Crossref pede um User-Agent com contato (https://api.crossref.org/swagger-ui).
 */

export const CROSSREF_TIMEOUT_MS = 8000;
const CONTACT = `mailto:${env.contactEmail}`;

export type CrossrefLookup =
  | { ok: true; data: CrossrefPaperData }
  | { ok: false; reason: "not_found" | "unavailable" | "invalid_response" };

export async function fetchCrossrefWork(doi: string): Promise<CrossrefLookup> {
  let response: Response;
  try {
    response = await fetch(crossrefWorkUrl(doi), {
      headers: {
        Accept: "application/json",
        // Cabeçalhos HTTP aceitam só ASCII: nada de "Ciência" aqui.
        "User-Agent": `Artemis/1.0 (+${getSiteUrl()}; ${CONTACT})`,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(CROSSREF_TIMEOUT_MS),
    });
  } catch (error) {
    const detail = error instanceof Error ? error.name : "erro";
    console.warn(`[papers] Crossref indisponível (${detail})`);
    return { ok: false, reason: "unavailable" };
  }

  if (response.status === 404) return { ok: false, reason: "not_found" };
  if (!response.ok) {
    console.warn(`[papers] Crossref respondeu HTTP ${response.status}`);
    return { ok: false, reason: "unavailable" };
  }

  try {
    const data = parseCrossrefWork(await response.json(), doi);
    return data ? { ok: true, data } : { ok: false, reason: "invalid_response" };
  } catch {
    return { ok: false, reason: "invalid_response" };
  }
}
