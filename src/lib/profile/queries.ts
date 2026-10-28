import "server-only";
import { cache } from "react";
import type { Enums } from "@/lib/database.types";
import { isSupabaseConfigured } from "@/lib/env";
import { applySearchText } from "@/lib/search/normalize";
import { createClient } from "@/lib/supabase/server";
import { normalizeTrajectoryTags } from "@/lib/trajectory/catalog";
import { areaIdsForFilter, sortAreas, type ResearchArea } from "./areas";
import { DIRECTORY_PAGE_SIZE, isUuid, pageRange, type DirectoryFilters } from "./directory";

/**
 * Leituras de perfis para as páginas (sessão da usuária + RLS). Perfis de OUTRAS pessoas
 * sempre com colunas públicas explícitas — nunca `select('*')` (ai_consent, role e objetivos
 * de mentoria são dados internos).
 */

type ServerClient = Awaited<ReturnType<typeof createClient>>;

/** Catálogo de áreas (público), memoizado por requisição. */
export const getResearchAreas = cache(async (): Promise<ResearchArea[]> => {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("research_areas")
    .select("id, slug, name, big_area")
    .order("id");
  if (error) {
    console.warn(`[perfil] falha ao carregar áreas de pesquisa (${error.code})`);
    return [];
  }
  return data ?? [];
});

/** Áreas do próprio perfil (ids). */
export async function getProfileAreaIds(
  profileId: string,
  client?: ServerClient,
): Promise<number[]> {
  const supabase = client ?? (await createClient());
  const { data, error } = await supabase
    .from("profile_research_areas")
    .select("area_id")
    .eq("profile_id", profileId)
    .order("area_id");
  if (error) return [];
  return (data ?? []).map((row) => row.area_id);
}

export interface MentorAvailability {
  openSlots: number;
}

/** Máximo de ids por chamada de `get_mentor_open_slots` (o banco também corta em 200). */
export const MENTOR_SLOTS_MAX_IDS = 200;

/**
 * Vagas abertas (capacidade − mentorias aceitas) das mentoras indicadas, via RPC SECURITY
 * DEFINER `get_mentor_open_slots` (a usuária não enxerga as mentorias das outras). Inclui
 * mentoras pausadas ou sem vagas (0) e a própria usuária; quem não é mentora fica fora do
 * mapa. Falha → mapa vazio (a página continua funcionando, o selo mostra "sem vagas agora").
 */
export async function getMentorAvailability(
  mentorIds: readonly string[],
): Promise<Map<string, MentorAvailability>> {
  const map = new Map<string, MentorAvailability>();
  const ids = [...new Set(mentorIds.filter(isUuid))].slice(0, MENTOR_SLOTS_MAX_IDS);
  if (ids.length === 0 || !isSupabaseConfigured()) return map;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_mentor_open_slots", { p_ids: ids });
  if (error) {
    console.warn(`[perfil] falha ao consultar vagas de mentoras (${error.code})`);
    return map;
  }
  for (const row of data ?? []) {
    map.set(row.mentor_id, { openSlots: row.open_slots });
  }
  return map;
}

export interface OpenRequestBetween {
  status: Extract<Enums<"mentorship_status">, "pending" | "accepted">;
  /** Papel da usuária logada nesse pedido. */
  myRole: "mentee" | "mentor";
}

/**
 * Pedido em aberto (pendente ou aceito) entre a usuária logada e outra pessoa, nos dois sentidos.
 * Consulta direta (o RLS só mostra pedidos de que ela participa) — ao contrário da RPC de
 * candidatas, funciona também quando a mentora está sem vagas ou pausada.
 */
export async function getOpenRequestBetween(
  myId: string,
  otherId: string,
): Promise<OpenRequestBetween | null> {
  if (!isUuid(myId) || !isUuid(otherId) || myId === otherId) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("mentorship_requests")
    .select("status, mentee_id")
    .or(
      `and(mentee_id.eq.${myId},mentor_id.eq.${otherId}),and(mentee_id.eq.${otherId},mentor_id.eq.${myId})`,
    )
    .in("status", ["pending", "accepted"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data || (data.status !== "pending" && data.status !== "accepted")) return null;
  return { status: data.status, myRole: data.mentee_id === myId ? "mentee" : "mentor" };
}

/** Vagas da própria usuária como mentora (ela participa das próprias mentorias, então o RLS deixa contar). */
export async function getOwnOpenSlots(profileId: string, capacity: number): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("mentorship_requests")
    .select("id", { count: "exact", head: true })
    .eq("mentor_id", profileId)
    .eq("status", "accepted");
  if (error) return Math.max(0, capacity);
  return Math.max(0, capacity - (count ?? 0));
}

export interface AreaChip {
  id: number;
  slug: string;
  name: string;
}

export interface DirectoryProfile {
  id: string;
  full_name: string;
  avatar_url: string | null;
  pronouns: string | null;
  headline: string | null;
  institution: string | null;
  city: string | null;
  state: string | null;
  career_stage: Enums<"career_stage"> | null;
  is_mentor: boolean;
  mentor_available: boolean;
  areas: AreaChip[];
  /** Marcas de trajetória (opcionais; só membras veem — docs/17), na ordem do catálogo. */
  trajectory_tags: string[];
}

export interface DirectoryPage {
  items: DirectoryProfile[];
  total: number;
  totalPages: number;
  page: number;
  error: boolean;
  /** A página pedida fica além da última (ex.: ?pagina=99). */
  outOfRange: boolean;
}

/** Página do diretório de pesquisadoras (só perfis com onboarding concluído). */
export async function getDirectoryPage(filters: DirectoryFilters): Promise<DirectoryPage> {
  const empty = { items: [], total: 0, totalPages: 0, page: filters.page, outOfRange: false };
  if (!isSupabaseConfigured()) return { ...empty, error: true };

  const supabase = await createClient();
  let areaIds: number[] = [];
  if (filters.area) {
    areaIds = areaIdsForFilter(await getResearchAreas(), filters.area);
    if (areaIds.length === 0) return { ...empty, error: false };
  }

  const columns =
    "id, full_name, avatar_url, pronouns, headline, institution, city, state, career_stage, is_mentor, mentor_available, trajectory_tags, research_areas(id, slug, name)";
  const { from, to } = pageRange(filters.page, DIRECTORY_PAGE_SIZE);

  let query = areaIds.length
    ? supabase
        .from("profiles")
        .select(`${columns}, area_filter:profile_research_areas!inner(area_id)`, { count: "exact" })
        .in("area_filter.area_id", areaIds)
    : supabase.from("profiles").select(columns, { count: "exact" });

  query = query.not("onboarded_at", "is", null);
  // Busca sem acento e sem diferença de maiúsculas em nome, instituição, título, cidade e
  // palavras-chave (coluna gerada `search_text`); cada palavra precisa aparecer em algum deles.
  query = applySearchText(query, filters.q);
  if (filters.stage) query = query.eq("career_stage", filters.stage);
  if (filters.uf) query = query.eq("state", filters.uf);
  if (filters.mentoras) query = query.eq("is_mentor", true);
  // trajectory_tags @> '{slug}' (índice GIN). O slug já veio validado contra o catálogo.
  if (filters.trajetoria) query = query.contains("trajectory_tags", [filters.trajetoria]);

  const { data, count, error } = await query
    .order("full_name", { ascending: true })
    .order("id", { ascending: true })
    .range(from, to);

  if (error) {
    // Página além do fim (PGRST103) não é erro para a usuária: só não há resultados.
    if (error.code === "PGRST103") return { ...empty, error: false, outOfRange: true };
    console.warn(`[perfil] falha ao listar pesquisadoras (${error.code})`);
    return { ...empty, error: true };
  }

  const total = count ?? 0;
  const items: DirectoryProfile[] = (data ?? []).map((row) => ({
    id: row.id,
    full_name: row.full_name,
    avatar_url: row.avatar_url,
    pronouns: row.pronouns,
    headline: row.headline,
    institution: row.institution,
    city: row.city,
    state: row.state,
    career_stage: row.career_stage,
    is_mentor: row.is_mentor,
    mentor_available: row.mentor_available,
    areas: sortAreas(row.research_areas ?? []),
    trajectory_tags: normalizeTrajectoryTags(row.trajectory_tags),
  }));
  const totalPages = Math.ceil(total / DIRECTORY_PAGE_SIZE);
  return {
    items,
    total,
    totalPages,
    page: filters.page,
    error: false,
    outOfRange: items.length === 0 && filters.page > 1,
  };
}

export interface MemberProfile extends DirectoryProfile {
  bio: string | null;
  keywords: string[];
  mentorship_topics: string[];
  meeting_formats: Enums<"meeting_format">[];
  languages: string[];
  mentoring_offer: string | null;
  mentor_capacity: number;
  lattes_url: string | null;
  orcid: string | null;
  linkedin_url: string | null;
  website_url: string | null;
  created_at: string;
  areas: Array<AreaChip & { big_area: string }>;
}

/** Perfil público (para membros) de uma pesquisadora com onboarding concluído. */
export const getMemberProfile = cache(async (id: string): Promise<MemberProfile | null> => {
  if (!isSupabaseConfigured() || !isUuid(id)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, full_name, avatar_url, pronouns, headline, bio, institution, city, state, career_stage, keywords, mentorship_topics, meeting_formats, languages, mentoring_offer, mentor_capacity, is_mentor, mentor_available, lattes_url, orcid, linkedin_url, website_url, created_at, trajectory_tags, research_areas(id, slug, name, big_area)",
    )
    .eq("id", id)
    .not("onboarded_at", "is", null)
    .maybeSingle();
  if (error || !data) return null;
  const { research_areas, trajectory_tags, ...rest } = data;
  return {
    ...rest,
    areas: sortAreas(research_areas ?? []),
    trajectory_tags: normalizeTrajectoryTags(trajectory_tags),
  };
});

export interface MemberPaper {
  id: string;
  title: string;
  year: number | null;
  venue: string | null;
  vote_count: number;
  comment_count: number;
  created_at: string;
  area: { name: string } | null;
}

/** Papers que a pesquisadora divulgou na Vitrine (não ocultos). */
export async function getMemberPapers(
  profileId: string,
  limit = 6,
): Promise<{ items: MemberPaper[]; total: number }> {
  const supabase = await createClient();
  const { data, count, error } = await supabase
    .from("papers")
    .select(
      "id, title, year, venue, vote_count, comment_count, created_at, area:research_areas(name)",
      {
        count: "exact",
      },
    )
    .eq("submitted_by", profileId)
    .eq("is_hidden", false)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return { items: [], total: 0 };
  return { items: data ?? [], total: count ?? 0 };
}

export interface MemberThread {
  id: string;
  title: string;
  reply_count: number;
  created_at: string;
  category: { slug: string; name: string } | null;
}

/** Tópicos recentes NÃO anônimos (os anônimos têm author_id NULL e nunca aparecem aqui). */
export async function getMemberThreads(
  profileId: string,
  limit = 5,
): Promise<{ items: MemberThread[]; total: number }> {
  const supabase = await createClient();
  const { data, count, error } = await supabase
    .from("forum_threads")
    .select("id, title, reply_count, created_at, category:forum_categories(slug, name)", {
      count: "exact",
    })
    .eq("author_id", profileId)
    .eq("is_anonymous", false)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return { items: [], total: 0 };
  return { items: data ?? [], total: count ?? 0 };
}
