"use server";

import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ORCID_MAX_WORKS, parseOrcidId, type OrcidWork } from "./orcid";
import { fetchOrcidWorks, type OrcidLookupFailure } from "./orcid-lookup";

/**
 * Server Action do painel "Importar do ORCID" em /papers/novo. Confere a sessão, valida o iD
 * (dígito verificador) antes de qualquer chamada externa, busca os trabalhos públicos e marca
 * os que já estão na Vitrine (pelo DOI, com o cliente da usuária — o RLS decide o que ela vê).
 * Escolher um trabalho acontece no navegador: com DOI, o formulário chama a busca no Crossref
 * (`lookupDoi`); sem DOI, preenche título, ano e revista com os dados do ORCID.
 */

export interface OrcidWorkItem extends OrcidWork {
  /** Paper da Vitrine com o mesmo DOI (null se não houver). */
  existingPaperId: string | null;
}

export type OrcidSearchState =
  | {
      ok: true;
      orcid: string;
      works: OrcidWorkItem[];
      /** Quantas publicações o ORCID devolveu (antes do corte em ORCID_MAX_WORKS). */
      total: number;
      message: string;
      values: { orcid: string };
    }
  | { ok: false; error: string; fieldError?: string; values: { orcid: string } }
  | null;

const FAILURES: Record<OrcidLookupFailure, string> = {
  not_found: "Não encontramos esse ORCID iD. Confira os números no seu registro em orcid.org.",
  locked:
    "Este registro ORCID está desativado, bloqueado ou foi unificado com outro. Confira o iD em orcid.org.",
  rate_limited:
    "O ORCID recebeu muitas buscas agora. Espere um minutinho e tente de novo — ou preencha os campos à mão.",
  unavailable:
    "O ORCID não respondeu agora. Tente de novo em instantes ou preencha os campos à mão.",
  invalid_response:
    "O ORCID respondeu num formato inesperado. Preencha os campos à mão, por favor.",
};

/** Proteção simples: uma busca a cada 3 s por pessoa (melhor esforço, por instância do servidor). */
const COOLDOWN_MS = 3000;
const lastSearchAt = new Map<string, number>();

function inCooldown(userId: string): boolean {
  const now = Date.now();
  if (now - (lastSearchAt.get(userId) ?? 0) < COOLDOWN_MS) return true;
  lastSearchAt.set(userId, now);
  if (lastSearchAt.size > 5000) lastSearchAt.clear();
  return false;
}

const IN_CHUNK = 100;

async function existingPapersByDoi(dois: string[]): Promise<Map<string, string>> {
  const found = new Map<string, string>();
  if (dois.length === 0) return found;
  const supabase = await createClient();
  for (let i = 0; i < dois.length; i += IN_CHUNK) {
    const { data, error } = await supabase
      .from("papers")
      .select("id, doi")
      .in("doi", dois.slice(i, i + IN_CHUNK));
    // Sem a marcação a lista ainda funciona: o envio repetido é barrado no salvar (DOI único).
    if (error) return found;
    for (const row of data ?? []) if (row.doi) found.set(row.doi, row.id);
  }
  return found;
}

function plural(n: number, one: string, many: string) {
  return `${n.toLocaleString("pt-BR")} ${n === 1 ? one : many}`;
}

export async function searchOrcidWorks(
  _prev: OrcidSearchState,
  formData: FormData,
): Promise<OrcidSearchState> {
  const raw = formData.get("orcid");
  const input = typeof raw === "string" ? raw.slice(0, 100) : "";
  const values = { orcid: input };

  const user = await getCurrentUser();
  if (!user) {
    return {
      ok: false,
      error: "Sua sessão expirou. Entre de novo na sua conta para continuar.",
      values,
    };
  }

  const parsed = parseOrcidId(input);
  if (!parsed.ok) return { ok: false, error: parsed.error, fieldError: parsed.error, values };
  const orcid = parsed.value;

  if (inCooldown(user.id)) {
    return {
      ok: false,
      error: "Aguarde alguns segundos antes de buscar de novo.",
      values: { orcid },
    };
  }

  const lookup = await fetchOrcidWorks(orcid);
  if (!lookup.ok) {
    return {
      ok: false,
      error: FAILURES[lookup.reason],
      fieldError: lookup.reason === "not_found" ? FAILURES.not_found : undefined,
      values: { orcid },
    };
  }

  const total = lookup.works.length;
  const shown = lookup.works.slice(0, ORCID_MAX_WORKS);
  const existing = await existingPapersByDoi(shown.flatMap((work) => (work.doi ? [work.doi] : [])));
  const works: OrcidWorkItem[] = shown.map((work) => ({
    ...work,
    existingPaperId: work.doi ? (existing.get(work.doi) ?? null) : null,
  }));

  const message =
    total === 0
      ? "Este ORCID iD não tem publicações públicas. No ORCID, a visibilidade de cada trabalho precisa estar como “Todos” para aparecer aqui."
      : total > ORCID_MAX_WORKS
        ? `Encontramos ${plural(total, "publicação pública", "publicações públicas")}. Mostramos as ${ORCID_MAX_WORKS} mais recentes.`
        : `Encontramos ${plural(total, "publicação pública", "publicações públicas")}. Escolha uma para preencher o formulário.`;

  return { ok: true, orcid, works, total, message, values: { orcid } };
}
