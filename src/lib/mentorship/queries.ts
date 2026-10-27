import "server-only";
import type { MentorshipStatus } from "@/lib/constants";
import type { createClient } from "@/lib/supabase/server";
import type { CandidateAvailability } from "./view-models";

/**
 * Leituras da página /mentoria. Todas com o cliente da sessão (RLS): a usuária só enxerga os
 * pedidos em que participa e as próprias sugestões. Colunas de perfil sempre explícitas.
 */

export type ServerClient = Awaited<ReturnType<typeof createClient>>;

const PERSON_COLUMNS = "id, full_name, avatar_url, headline, institution, state, career_stage, mentorship_topics";

export interface Person {
  id: string;
  full_name: string;
  avatar_url: string | null;
  headline: string | null;
  institution: string | null;
  state: string | null;
  career_stage: string | null;
  mentorship_topics: string[];
  /** Nomes das áreas de pesquisa (preenchido depois, em lote). */
  areas: string[];
}

export interface RequestItem {
  id: string;
  status: MentorshipStatus;
  message: string;
  response_message: string | null;
  match_score: number | null;
  created_at: string;
  responded_at: string | null;
  updated_at: string;
  /** Papel da usuária logada neste pedido. */
  role: "mentee" | "mentor";
  /** A outra participante. */
  other: Person;
}

type PersonRow = Omit<Person, "areas">;

function toPerson(row: PersonRow | null | undefined, fallbackId: string): Person {
  return {
    id: row?.id ?? fallbackId,
    full_name: row?.full_name || "Pesquisadora",
    avatar_url: row?.avatar_url ?? null,
    headline: row?.headline ?? null,
    institution: row?.institution ?? null,
    state: row?.state ?? null,
    career_stage: row?.career_stage ?? null,
    mentorship_topics: row?.mentorship_topics ?? [],
    areas: [],
  };
}

export async function loadAreaNames(supabase: ServerClient): Promise<Map<number, string>> {
  const { data, error } = await supabase.from("research_areas").select("id, name");
  if (error) {
    console.warn(`[mentoria] research_areas — ${error.code ?? ""} ${error.message.slice(0, 160)}`);
    return new Map();
  }
  return new Map((data ?? []).map((a) => [Number(a.id), a.name]));
}

/** Áreas (ids) de vários perfis de uma vez. */
export async function loadAreaIdsByProfile(
  supabase: ServerClient,
  profileIds: readonly string[],
): Promise<Map<string, number[]>> {
  const ids = [...new Set(profileIds)];
  const out = new Map<string, number[]>();
  if (ids.length === 0) return out;
  const { data, error } = await supabase
    .from("profile_research_areas")
    .select("profile_id, area_id")
    .in("profile_id", ids);
  if (error) {
    console.warn(`[mentoria] profile_research_areas — ${error.code ?? ""} ${error.message.slice(0, 160)}`);
    return out;
  }
  for (const row of data ?? []) {
    const list = out.get(row.profile_id) ?? [];
    list.push(Number(row.area_id));
    out.set(row.profile_id, list);
  }
  return out;
}

/** Todos os pedidos em que a usuária participa (mais recentes primeiro). */
export async function loadMyRequests(
  supabase: ServerClient,
  userId: string,
  areaNames: ReadonlyMap<number, string>,
): Promise<{ items: RequestItem[]; failed: boolean }> {
  const { data, error } = await supabase
    .from("mentorship_requests")
    .select(
      `id, status, message, response_message, match_score, created_at, responded_at, updated_at, mentee_id, mentor_id,
       mentee:profiles!mentorship_requests_mentee_id_fkey(${PERSON_COLUMNS}),
       mentor:profiles!mentorship_requests_mentor_id_fkey(${PERSON_COLUMNS})`,
    )
    .or(`mentee_id.eq.${userId},mentor_id.eq.${userId}`)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    console.warn(`[mentoria] mentorship_requests — ${error.code ?? ""} ${error.message.slice(0, 160)}`);
    return { items: [], failed: true };
  }

  const items: RequestItem[] = (data ?? []).map((row) => {
    const role = row.mentee_id === userId ? "mentee" : "mentor";
    const otherRow = (role === "mentee" ? row.mentor : row.mentee) as PersonRow | null;
    const otherId = role === "mentee" ? row.mentor_id : row.mentee_id;
    return {
      id: row.id,
      status: row.status,
      message: row.message,
      response_message: row.response_message,
      match_score: row.match_score,
      created_at: row.created_at,
      responded_at: row.responded_at,
      updated_at: row.updated_at,
      role,
      other: toPerson(otherRow, otherId),
    };
  });

  const areaIds = await loadAreaIdsByProfile(
    supabase,
    items.map((i) => i.other.id),
  );
  for (const item of items) {
    item.other.areas = (areaIds.get(item.other.id) ?? [])
      .map((id) => areaNames.get(id))
      .filter((n): n is string => Boolean(n));
  }
  return { items, failed: false };
}

/**
 * Mentoras disponíveis agora (com vaga e recebendo pedidos), via RPC SECURITY DEFINER.
 * Retorna null se a RPC falhar — a interface deixa o banco decidir no momento do pedido.
 */
export async function loadCandidateAvailability(
  supabase: ServerClient,
): Promise<Map<string, CandidateAvailability> | null> {
  const { data, error } = await supabase.rpc("get_mentor_candidates", { p_limit: 100 });
  if (error) {
    console.warn(`[mentoria] get_mentor_candidates — ${error.code ?? ""} ${error.message.slice(0, 160)}`);
    return null;
  }
  return new Map(
    (data ?? []).map((c) => [
      c.mentor_id,
      { open_slots: c.open_slots ?? null, existing_request_status: c.existing_request_status ?? null },
    ]),
  );
}

export interface Contact {
  email: string;
  full_name: string;
}

/** E-mail da outra participante — a RPC só devolve algo para mentorias aceitas. */
export async function loadContacts(
  supabase: ServerClient,
  requestIds: readonly string[],
): Promise<Map<string, Contact | null>> {
  const entries = await Promise.all(
    requestIds.map(async (id) => {
      const { data, error } = await supabase.rpc("get_mentorship_contact", { p_request_id: id });
      if (error) {
        console.warn(`[mentoria] get_mentorship_contact — ${error.code ?? ""} ${error.message.slice(0, 160)}`);
        return [id, null] as const;
      }
      const row = data?.[0];
      return [id, row ? { email: row.email, full_name: row.full_name } : null] as const;
    }),
  );
  return new Map(entries);
}

export interface DeepLinkMentor {
  id: string;
  full_name: string;
  avatar_url: string | null;
  headline: string | null;
  institution: string | null;
  state: string | null;
  career_stage: string | null;
  mentorship_topics: string[];
  meeting_formats: string[];
  mentoring_offer: string | null;
  is_mentor: boolean;
  mentor_available: boolean;
  onboarded: boolean;
}

/** Perfil público da mentora aberta por link direto (?mentora=<id>). */
export async function loadDeepLinkMentor(supabase: ServerClient, mentorId: string): Promise<DeepLinkMentor | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, full_name, avatar_url, headline, institution, state, career_stage, mentorship_topics, meeting_formats, mentoring_offer, is_mentor, mentor_available, onboarded_at",
    )
    .eq("id", mentorId)
    .maybeSingle();
  if (error) {
    console.warn(`[mentoria] perfil da mentora — ${error.code ?? ""} ${error.message.slice(0, 160)}`);
    return null;
  }
  if (!data) return null;
  return {
    id: data.id,
    full_name: data.full_name || "Pesquisadora",
    avatar_url: data.avatar_url,
    headline: data.headline,
    institution: data.institution,
    state: data.state,
    career_stage: data.career_stage,
    mentorship_topics: data.mentorship_topics ?? [],
    meeting_formats: data.meeting_formats ?? [],
    mentoring_offer: data.mentoring_offer,
    is_mentor: data.is_mentor,
    mentor_available: data.mentor_available,
    onboarded: Boolean(data.onboarded_at),
  };
}

/** Nota e motivo da sugestão salva para esta dupla (gravados junto com o pedido). */
export async function loadSuggestionMatch(
  supabase: ServerClient,
  menteeId: string,
  mentorId: string,
): Promise<{ score: number | null; reason: string | null }> {
  const { data } = await supabase
    .from("mentor_suggestions")
    .select("score, reason")
    .eq("mentee_id", menteeId)
    .eq("mentor_id", mentorId)
    .maybeSingle();
  return { score: data?.score ?? null, reason: data?.reason?.trim() ? data.reason.slice(0, 1500) : null };
}
