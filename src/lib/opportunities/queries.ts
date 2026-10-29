import "server-only";
import { cache } from "react";
import { areaIdsForSlug, type AreaRow } from "@/lib/papers/params";
import { applySearchText } from "@/lib/search/normalize";
import { createClient } from "@/lib/supabase/server";
import type { ApplicationStatus } from "./labels";
import { OPPORTUNITIES_PAGE_SIZE } from "./limits";
import { pageRange, type OpportunityFilters } from "./params";
import { todayInSaoPaulo } from "./presentation";
import type {
  Application,
  ListResult,
  MyApplicationItem,
  MyOpportunityItem,
  OpportunityDetail,
  OpportunityListItem,
  ReceivedApplication,
} from "./types";

/**
 * Leituras do Explorar ICs (servidor, sempre com a sessão da usuária → RLS). Todas as membras
 * leem as vagas; candidaturas, só a candidata (as dela) e a dona da vaga (as da vaga). Perfis
 * sempre com colunas públicas explícitas.
 *
 * Os embeds usam a coluna como dica (`profiles!owner_id`): `opportunity_applications` e `posts`
 * também ligam vagas a perfis, e sem a dica o PostgREST acharia mais de um caminho.
 */

const OWNER =
  "owner:profiles!owner_id(id, full_name, avatar_url, headline, institution, career_stage)";
const AREA = "area:research_areas!area_id(id, slug, name)";

const LIST_COLUMNS = `id, owner_id, kind, title, institution, city, state, modality, has_scholarship, scholarship_info, weekly_hours, vacancies, deadline, status, application_count, created_at, ${AREA}, ${OWNER}`;

const DETAIL_COLUMNS = `${LIST_COLUMNS}, description, requirements, area_id, keywords, target_stages, updated_at, closed_at`;

const APPLICATION_COLUMNS =
  "id, opportunity_id, applicant_id, status, message, owner_note, created_at, updated_at, responded_at";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Consulta de vagas com os filtros da URL. Padrão: só as abertas e dentro do prazo (São Paulo).
 * `areaIds` já resolvido (grande área inclui as subáreas); `today` vem do servidor, nunca da URL.
 */
function filteredOpportunities(
  supabase: ServerClient,
  filters: OpportunityFilters,
  areaIds: number[] | null,
  today: string,
  head: boolean,
) {
  let q = supabase.from("research_opportunities").select(LIST_COLUMNS, { count: "exact", head });
  if (!filters.encerradas) {
    q = q.eq("status", "open").or(`deadline.is.null,deadline.gte.${today}`);
  }
  // Sem acento e sem diferença de maiúsculas (coluna gerada `search_text`); cada palavra
  // precisa aparecer.
  q = applySearchText(q, filters.q);
  if (areaIds) q = q.in("area_id", areaIds);
  if (filters.tipo) q = q.eq("kind", filters.tipo);
  if (filters.bolsa) q = q.eq("has_scholarship", true);
  if (filters.modalidade) q = q.eq("modality", filters.modalidade);
  // target_stages @> '{etapa}'
  if (filters.etapa) q = q.contains("target_stages", [filters.etapa]);
  return q;
}

/** Vagas por filtro, 12 por página. Padrão: só as abertas e dentro do prazo (São Paulo). */
export async function listOpportunities(
  filters: OpportunityFilters,
  areas: readonly AreaRow[],
  now: Date = new Date(),
): Promise<ListResult<OpportunityListItem>> {
  const areaIds = areaIdsForSlug(areas, filters.area || null);
  // Slug de área desconhecido: nenhum resultado (em vez de ignorar o filtro em silêncio).
  if (filters.area && !areaIds) return { ok: true, items: [], total: 0 };

  const supabase = await createClient();
  const today = todayInSaoPaulo(now);
  const { from, to } = pageRange(filters.page, OPPORTUNITIES_PAGE_SIZE);
  const { data, error, count } = await filteredOpportunities(
    supabase,
    filters,
    areaIds,
    today,
    false,
  )
    .order("created_at", { ascending: false })
    .order("id")
    .range(from, to);

  if (error?.code === "PGRST103") {
    // Página além do fim: o PostgREST responde 416 sem contagem — contamos à parte.
    const counted = await filteredOpportunities(supabase, filters, areaIds, today, true);
    if (counted.error) return { ok: false, items: [], total: 0 };
    return { ok: true, items: [], total: counted.count ?? 0 };
  }
  if (error) {
    console.error("[ics] falha ao listar vagas", error.code, error.message);
    return { ok: false, items: [], total: 0 };
  }
  return { ok: true, total: count ?? 0, items: (data ?? []).map(toListItem) };
}

/** Quantas vagas esses filtros encontram (botão "Ver N vagas" dos filtros no celular). */
export async function countOpportunities(
  filters: OpportunityFilters,
  areas: readonly AreaRow[],
  now: Date = new Date(),
): Promise<number | null> {
  const areaIds = areaIdsForSlug(areas, filters.area || null);
  if (filters.area && !areaIds) return 0;
  const supabase = await createClient();
  const { count, error } = await filteredOpportunities(
    supabase,
    filters,
    areaIds,
    todayInSaoPaulo(now),
    true,
  );
  if (error) {
    console.error("[ics] falha ao contar vagas", error.code, error.message);
    return null;
  }
  return count ?? 0;
}

type ListRow = Omit<OpportunityListItem, "area" | "owner"> & {
  area: OpportunityListItem["area"] | null;
  owner: OpportunityListItem["owner"] | null;
};

function toListItem<T extends ListRow>(row: T): T & OpportunityListItem {
  return { ...row, area: row.area ?? null, owner: row.owner ?? null };
}

/**
 * Status das candidaturas da usuária nestas vagas (selo "Aprovada", "Em análise"… nos cartões).
 * Uma consulta só, nos ids visíveis.
 */
export async function getMyApplicationStatuses(
  userId: string,
  opportunityIds: string[],
): Promise<Map<string, ApplicationStatus>> {
  const map = new Map<string, ApplicationStatus>();
  if (opportunityIds.length === 0) return map;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("opportunity_applications")
    .select("opportunity_id, status")
    .eq("applicant_id", userId)
    .in("opportunity_id", opportunityIds);
  if (error) {
    console.error("[ics] falha ao carregar candidaturas da usuária", error.code, error.message);
    return map;
  }
  for (const row of data ?? []) map.set(row.opportunity_id, row.status);
  return map;
}

/** Vaga completa (todas as membras leem). Memoizada por requisição (metadata + página). */
export const getOpportunity = cache(async (id: string): Promise<OpportunityDetail | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("research_opportunities")
    .select(DETAIL_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) {
    console.error("[ics] falha ao carregar vaga", error.code, error.message);
    throw new Error("Não foi possível carregar a vaga.");
  }
  return data ? toListItem(data) : null;
});

/** A candidatura da usuária a esta vaga (o RLS só mostra as dela). */
export async function getMyApplication(
  opportunityId: string,
  userId: string,
): Promise<Application | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("opportunity_applications")
    .select(APPLICATION_COLUMNS)
    .eq("opportunity_id", opportunityId)
    .eq("applicant_id", userId)
    .maybeSingle();
  if (error) {
    console.error("[ics] falha ao carregar a candidatura", error.code, error.message);
    return null;
  }
  return data ?? null;
}

/** Candidaturas recebidas numa vaga (só a dona enxerga — o RLS devolve vazio às demais). */
export async function listReceivedApplications(
  opportunityId: string,
): Promise<ListResult<ReceivedApplication>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("opportunity_applications")
    .select(
      `${APPLICATION_COLUMNS}, applicant:profiles!applicant_id(id, full_name, avatar_url, headline, institution, career_stage, city, state, lattes_url, orcid)`,
    )
    .eq("opportunity_id", opportunityId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) {
    console.error("[ics] falha ao carregar candidaturas recebidas", error.code, error.message);
    return { ok: false, items: [], total: 0 };
  }
  const items = (data ?? []).map((row) => ({ ...row, applicant: row.applicant ?? null }));
  return { ok: true, items, total: items.length };
}

/** As candidaturas da usuária, com a vaga e a dona (mais recentes primeiro). */
export async function listMyApplications(userId: string): Promise<ListResult<MyApplicationItem>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("opportunity_applications")
    .select(
      `${APPLICATION_COLUMNS}, opportunity:research_opportunities!opportunity_id(id, title, kind, status, deadline, institution, owner_id, owner:profiles!owner_id(id, full_name, avatar_url))`,
    )
    .eq("applicant_id", userId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) {
    console.error("[ics] falha ao carregar minhas candidaturas", error.code, error.message);
    return { ok: false, items: [], total: 0 };
  }
  const items = (data ?? []).map((row) => ({
    ...row,
    opportunity: row.opportunity
      ? { ...row.opportunity, owner: row.opportunity.owner ?? null }
      : null,
  }));
  return { ok: true, items, total: items.length };
}

/** As vagas que a usuária publicou, com quantas candidaturas novas (enviadas) esperam resposta. */
export async function listMyOpportunities(userId: string): Promise<ListResult<MyOpportunityItem>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("research_opportunities")
    .select(LIST_COLUMNS)
    .eq("owner_id", userId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) {
    console.error("[ics] falha ao carregar vagas publicadas", error.code, error.message);
    return { ok: false, items: [], total: 0 };
  }
  const opportunities = (data ?? []).map(toListItem);
  const fresh = new Map<string, number>();
  if (opportunities.length > 0) {
    const { data: pending, error: pendingError } = await supabase
      .from("opportunity_applications")
      .select("opportunity_id")
      .in(
        "opportunity_id",
        opportunities.map((o) => o.id),
      )
      .eq("status", "submitted");
    if (pendingError) {
      console.error("[ics] falha ao contar candidaturas novas", pendingError.code);
    }
    for (const row of pending ?? []) {
      fresh.set(row.opportunity_id, (fresh.get(row.opportunity_id) ?? 0) + 1);
    }
  }
  const items = opportunities.map((o) => ({ ...o, new_applications: fresh.get(o.id) ?? 0 }));
  return { ok: true, items, total: items.length };
}

/**
 * A dona tem publicação no feed que aponta para esta vaga (a de "Compartilhar no feed")? Decide se
 * a exclusão oferece "Apagar também a publicação no feed".
 */
export async function hasOwnFeedPost(opportunityId: string, userId: string): Promise<boolean> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("posts")
    .select("id", { count: "exact", head: true })
    .eq("opportunity_id", opportunityId)
    .eq("author_id", userId);
  if (error) {
    console.error("[ics] falha ao procurar a publicação da vaga no feed", error.code);
    return false;
  }
  return (count ?? 0) > 0;
}
