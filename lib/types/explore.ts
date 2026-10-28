/** Tipos das respostas do PostgREST para o domínio Explorar IC. */

export interface ExploreProfile {
  id: string;
  username: string;
  full_name: string;
  avatar_url: string | null;
  is_self_declared_woman: boolean;
}

/**
 * Linha de projeto na listagem. O PostgREST retorna o embed de profiles como
 * objeto (many-to-one) e, dependendo do caminho, como array — daí a união.
 */
export interface ProjectListRow {
  id: string;
  title: string;
  description: string;
  area: string;
  tags: string[];
  slots: number;
  is_open: boolean;
  created_at: string;
  profiles: ExploreProfile | ExploreProfile[] | null;
  project_interests: Array<{ status: "pending" | "accepted" | "rejected" }>;
}

export interface ProjectInterestRow {
  id: string;
  project_id: string;
  user_id: string;
  origin: "user_request" | "creator_invite";
  message: string | null;
  status: "pending" | "accepted" | "rejected";
  created_at: string;
  profiles: ExploreProfile | ExploreProfile[] | null;
}

export interface ProjectDetailRow {
  id: string;
  title: string;
  description: string;
  area: string;
  tags: string[];
  slots: number;
  is_open: boolean;
  created_at: string;
  creator_id: string;
  profiles: ExploreProfile | ExploreProfile[] | null;
  project_interests: ProjectInterestRow[];
}

/** Normaliza embed many-to-one/one-to-many do PostgREST. */
export function firstProfile(
  value: ExploreProfile | ExploreProfile[] | null | undefined
): ExploreProfile | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}
