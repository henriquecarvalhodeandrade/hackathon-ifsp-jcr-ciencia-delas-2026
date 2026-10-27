import "server-only";
import type { Database } from "@/lib/database.types";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { pickFeaturedPapers, type FeaturedPeriod } from "./featured";

/**
 * Dados públicos da landing. Só usa o que visitantes (anon) podem ler:
 * RPCs `get_platform_stats` e `get_paper_ranking` e edições publicadas da
 * newsletter. NUNCA faz embed de `profiles` (anon não tem SELECT e a consulta
 * inteira falharia).
 */

export type PlatformStats = Database["public"]["Functions"]["get_platform_stats"]["Returns"][number];
export type LandingPaper = Database["public"]["Functions"]["get_paper_ranking"]["Returns"][number];

export interface LandingData {
  stats: PlatformStats | null;
  papers: LandingPaper[];
  papersPeriod: FeaturedPeriod | null;
  latestEdition: { slug: string; title: string } | null;
}

const EMPTY: LandingData = { stats: null, papers: [], papersPeriod: null, latestEdition: null };

export async function getLandingData(): Promise<LandingData> {
  if (!isSupabaseConfigured()) return EMPTY;
  try {
    const supabase = await createClient();
    const [stats, week, hot, edition] = await Promise.all([
      supabase.rpc("get_platform_stats"),
      supabase.rpc("get_paper_ranking", { p_period: "week", p_limit: 3 }),
      supabase.rpc("get_paper_ranking", { p_period: "hot", p_limit: 3 }),
      supabase
        .from("newsletter_editions")
        .select("slug, title")
        .in("status", ["published", "sent"])
        .order("published_at", { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle(),
    ]);

    for (const [label, result] of [
      ["estatísticas", stats],
      ["ranking da semana", week],
      ["ranking em alta", hot],
      ["última edição", edition],
    ] as const) {
      if (result.error) console.error(`[landing] falha ao carregar ${label}`, result.error.code);
    }

    const featured = pickFeaturedPapers(week.data, hot.data);
    return {
      stats: stats.data?.[0] ?? null,
      papers: featured.papers,
      papersPeriod: featured.period,
      latestEdition: edition.data ?? null,
    };
  } catch (error) {
    console.error("[landing] falha ao carregar dados", error instanceof Error ? error.message : "erro");
    return EMPTY;
  }
}
