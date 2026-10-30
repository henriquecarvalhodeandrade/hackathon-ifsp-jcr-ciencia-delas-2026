import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { env, getSiteUrl, isSupabaseConfigured } from "@/lib/env";

/**
 * sitemap.xml: rotas públicas + edições publicadas do Boletim + papers visíveis.
 * Usa um cliente anônimo SEM cookies (o RLS de anon já esconde papers ocultos e
 * rascunhos). Sem Supabase (ou se o banco falhar), devolve só as rotas fixas.
 * Regerado no máximo a cada hora.
 */
export const revalidate = 3600;

const MAX_PAPERS = 1000;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = getSiteUrl();
  const now = new Date();

  const fixed: MetadataRoute.Sitemap = [
    { url: `${site}/`, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${site}/papers`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${site}/ranking`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
    { url: `${site}/newsletter`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${site}/pergunte`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
    { url: `${site}/verificar`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${site}/sobre`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${site}/conduta`, changeFrequency: "yearly", priority: 0.5 },
    { url: `${site}/privacidade`, changeFrequency: "yearly", priority: 0.4 },
  ];

  if (!isSupabaseConfigured()) return fixed;

  try {
    const supabase = createClient<Database>(env.supabaseUrl!, env.supabasePublishableKey!, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const [editions, papers] = await Promise.all([
      supabase
        .from("newsletter_editions")
        .select("slug, published_at, updated_at")
        .in("status", ["published", "sent"])
        .order("published_at", { ascending: false })
        .limit(200),
      supabase
        .from("papers")
        .select("id, updated_at")
        .eq("is_hidden", false)
        .order("created_at", { ascending: false })
        .limit(MAX_PAPERS),
    ]);
    if (editions.error) console.error("[sitemap] falha nas edições", editions.error.code);
    if (papers.error) console.error("[sitemap] falha nos papers", papers.error.code);

    return [
      ...fixed,
      ...(editions.data ?? []).map((e) => ({
        url: `${site}/newsletter/${encodeURIComponent(e.slug)}`,
        lastModified: new Date(e.updated_at ?? e.published_at ?? now),
        changeFrequency: "monthly" as const,
        priority: 0.6,
      })),
      ...(papers.data ?? []).map((p) => ({
        url: `${site}/papers/${p.id}`,
        lastModified: new Date(p.updated_at),
        changeFrequency: "weekly" as const,
        priority: 0.7,
      })),
    ];
  } catch (error) {
    console.error("[sitemap] falha ao montar", error instanceof Error ? error.message : "erro");
    return fixed;
  }
}
