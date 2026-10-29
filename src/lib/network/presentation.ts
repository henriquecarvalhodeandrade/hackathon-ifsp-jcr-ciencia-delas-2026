/**
 * Regras de apresentação da rede (puras, sem rede nem banco — cobertas por testes):
 * abas da /rede, motivo das sugestões, números do perfil e limites do convite.
 */
import { pluralize } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Abas (?aba=)
// ---------------------------------------------------------------------------

export const NETWORK_TABS = [
  "sugestoes",
  "convites",
  "conexoes",
  "seguindo",
  "seguidoras",
] as const;
export type NetworkTab = (typeof NETWORK_TABS)[number];

export const DEFAULT_NETWORK_TAB: NetworkTab = "sugestoes";

export const NETWORK_TAB_LABELS: Record<NetworkTab, string> = {
  sugestoes: "Sugestões",
  convites: "Convites",
  conexoes: "Conexões",
  seguindo: "Seguindo",
  seguidoras: "Seguidoras",
};

export function parseNetworkTab(value: unknown): NetworkTab | null {
  const v = Array.isArray(value) ? value[0] : value;
  return typeof v === "string" && (NETWORK_TABS as readonly string[]).includes(v)
    ? (v as NetworkTab)
    : null;
}

export function networkTabHref(tab: NetworkTab): string {
  return tab === DEFAULT_NETWORK_TAB ? "/rede" : `/rede?aba=${tab}`;
}

// ---------------------------------------------------------------------------
// Convite
// ---------------------------------------------------------------------------

/** Recado opcional do convite (connections.message ≤ 300). */
export const CONNECTION_MESSAGE_MAX = 300;

/** Falha de rede/servidor num botão (a action nem respondeu). */
export const NETWORK_CONNECTION_ERROR =
  "Não conseguimos falar com o servidor. Confira sua conexão e tente de novo.";

/** Quantas sugestões a /rede pede à RPC. */
export const SUGGESTIONS_LIMIT = 24;

/** Teto de pessoas listadas em cada aba (conexões, seguindo, seguidoras, convites). */
export const NETWORK_LIST_LIMIT = 200;

// ---------------------------------------------------------------------------
// Sugestões
// ---------------------------------------------------------------------------

export interface SuggestionSignals {
  shared_areas: number | null | undefined;
  mutual_connections: number | null | undefined;
  same_institution: boolean | null | undefined;
}

/** Texto quando a sugestão não tem nada em comum (gente nova na comunidade). */
export const SUGGESTION_FALLBACK_REASON = "Nova na comunidade";

/** Partes do motivo, na ordem de peso: áreas, conexões em comum, instituição. */
export function suggestionReasonParts(signals: SuggestionSignals): string[] {
  const areas = Math.max(0, Math.floor(signals.shared_areas ?? 0));
  const mutual = Math.max(0, Math.floor(signals.mutual_connections ?? 0));
  const parts: string[] = [];
  if (areas > 0) parts.push(pluralize(areas, "área em comum", "áreas em comum"));
  if (mutual > 0) parts.push(pluralize(mutual, "conexão em comum", "conexões em comum"));
  if (signals.same_institution) parts.push("Mesma instituição");
  return parts;
}

/** "3 áreas em comum · 2 conexões em comum · Mesma instituição" (ou o texto padrão). */
export function suggestionReason(signals: SuggestionSignals): string {
  const parts = suggestionReasonParts(signals);
  return parts.length > 0 ? parts.join(" · ") : SUGGESTION_FALLBACK_REASON;
}

// ---------------------------------------------------------------------------
// Números da rede
// ---------------------------------------------------------------------------

export interface NetworkCounts {
  connections: number;
  followers: number;
  following: number;
}

export const EMPTY_COUNTS: NetworkCounts = { connections: 0, followers: 0, following: 0 };

/** Linha da RPC get_network_counts → números (nunca negativos nem nulos). */
export function toNetworkCounts(
  row: { connections?: number | null; followers?: number | null; following?: number | null } | null,
): NetworkCounts {
  const n = (value: number | null | undefined) => Math.max(0, Math.floor(Number(value ?? 0) || 0));
  return {
    connections: n(row?.connections),
    followers: n(row?.followers),
    following: n(row?.following),
  };
}

export interface CountItem {
  key: "conexoes" | "seguidoras" | "seguindo";
  value: number;
  /** "conexão"/"conexões", "seguidora"/"seguidoras", "seguindo". */
  label: string;
}

/** Os três números do perfil, na ordem em que aparecem. */
export function networkCountItems(counts: NetworkCounts): CountItem[] {
  return [
    {
      key: "conexoes",
      value: counts.connections,
      label: pluralize(counts.connections, "conexão", "conexões", { withCount: false }),
    },
    {
      key: "seguidoras",
      value: counts.followers,
      label: pluralize(counts.followers, "seguidora", "seguidoras", { withCount: false }),
    },
    { key: "seguindo", value: counts.following, label: "seguindo" },
  ];
}

// ---------------------------------------------------------------------------
// Textos
// ---------------------------------------------------------------------------

/** Primeiro nome (ignora títulos como "Dra."), com "ela" quando não há nome. */
export function firstNameOf(fullName: string | null | undefined): string {
  const titles = new Set(["dra", "dra.", "dr", "dr.", "profa", "profa.", "prof", "prof."]);
  const parts = (fullName ?? "").trim().split(/\s+/).filter(Boolean);
  return parts.find((p) => !titles.has(p.toLowerCase())) ?? "";
}
