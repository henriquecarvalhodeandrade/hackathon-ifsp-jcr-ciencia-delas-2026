import Link from "next/link";
import { redirect } from "next/navigation";
import { Compass, Plus, SearchX } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ProjectCard } from "@/components/explore/ProjectCard";
import { ProjectFilters } from "@/components/explore/ProjectFilters";
import type { ProjectListRow } from "@/lib/types/explore";

const PAGE_SIZE = 12;

interface ExplorePageProps {
  searchParams: Promise<{
    q?: string;
    area?: string;
    somente_abertos?: string;
    p?: string;
  }>;
}

/** Remove curingas do ilike para evitar erro de sintaxe do PostgREST. */
function sanitize(value: string): string {
  return value.replace(/[%_,()]/g, " ").trim().slice(0, 80);
}

export default async function ExplorePage({ searchParams }: ExplorePageProps) {
  const sp = await searchParams;
  const q = sanitize(sp.q ?? "");
  const area = sanitize(sp.area ?? "");
  const somenteAbertos = sp.somente_abertos === "1" || sp.somente_abertos === "true";
  const page = Math.max(1, Number.parseInt(sp.p ?? "1", 10) || 1);

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  let query = supabase
    .from("projects")
    .select(
      `id, title, description, area, tags, slots, is_open, created_at,
       profiles!projects_creator_id_fkey (id, username, full_name, avatar_url, is_self_declared_woman),
       project_interests (status)`,
      { count: "exact" }
    );

  if (q) {
    query = query.or(`title.ilike.%${q}%,description.ilike.%${q}%`);
  }
  if (area) {
    query = query.ilike("area", `%${area}%`);
  }
  if (somenteAbertos) {
    query = query.eq("is_open", true);
  }

  const [{ data: myProfile }, queryResult] = await Promise.all([
    supabase.from("profiles").select("account_type").eq("id", user.id).maybeSingle(),
    query.order("created_at", { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1),
  ]);

  const isScientist = myProfile?.account_type === "scientist";
  const { data, count, error } = queryResult;
  const projects = (data ?? []) as unknown as ProjectListRow[];
  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasFilters = Boolean(q || area || somenteAbertos);

  const buildPageLink = (target: number) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (area) params.set("area", area);
    if (somenteAbertos) params.set("somente_abertos", "1");
    if (target > 1) params.set("p", String(target));
    const qs = params.toString();
    return qs ? `/explore?${qs}` : "/explore";
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-foreground flex items-center gap-2">
            <Compass className="w-6 h-6 text-primary" />
            Explorar Iniciação Científica
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Encontre projetos de IC e mostre seu interesse — ou crie o seu.
          </p>
        </div>
        {isScientist && (
          <Link
            href="/explore/new"
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-sm shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            Novo projeto
          </Link>
        )}
      </div>

      {/* Filtros */}
      <ProjectFilters q={q} area={area} somenteAbertos={somenteAbertos} />

      {/* Resultados */}
      {error ? (
        <div className="p-10 text-center rounded-2xl bg-card border border-destructive/30">
          <p className="text-sm text-destructive">
            Erro ao carregar os projetos. Tente novamente em instantes.
          </p>
        </div>
      ) : projects.length > 0 ? (
        <>
          <p className="text-xs text-muted-foreground">
            {total} projeto{total === 1 ? "" : "s"} encontrado{total === 1 ? "" : "s"}
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            {projects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>

          {totalPages > 1 && (
            <nav className="flex items-center justify-center gap-4 pt-2" aria-label="Paginação">
              {page > 1 ? (
                <Link
                  href={buildPageLink(page - 1)}
                  className="px-4 py-2 rounded-xl border border-border text-sm font-semibold text-foreground hover:bg-muted transition-colors"
                >
                  ← Anteriores
                </Link>
              ) : (
                <span className="px-4 py-2 rounded-xl border border-border/50 text-sm text-muted-foreground/50">
                  ← Anteriores
                </span>
              )}
              <span className="text-xs text-muted-foreground">
                Página {page} de {totalPages}
              </span>
              {page < totalPages ? (
                <Link
                  href={buildPageLink(page + 1)}
                  className="px-4 py-2 rounded-xl border border-border text-sm font-semibold text-foreground hover:bg-muted transition-colors"
                >
                  Próximos →
                </Link>
              ) : (
                <span className="px-4 py-2 rounded-xl border border-border/50 text-sm text-muted-foreground/50">
                  Próximos →
                </span>
              )}
            </nav>
          )}
        </>
      ) : (
        <div className="p-12 text-center rounded-2xl bg-card border border-border">
          <SearchX className="w-8 h-8 text-primary mx-auto mb-3" />
          <p className="font-heading font-semibold text-foreground mb-1">
            {hasFilters
              ? "Nenhum projeto corresponde aos filtros"
              : "Nenhum projeto de IC publicado ainda"}
          </p>
          <p className="text-xs text-muted-foreground mb-4">
            {hasFilters
              ? "Tente ajustar a busca ou limpar os filtros."
              : "Seja a primeira a propor uma Iniciação Científica na Ártemis."}
          </p>
          {hasFilters ? (
            <Link
              href="/explore"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-border text-sm font-semibold text-foreground hover:bg-muted transition-colors"
            >
              <Compass className="w-4 h-4" />
              Ver todos os projetos
            </Link>
          ) : (
            isScientist && (
              <Link
                href="/explore/new"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-sm shadow-xs transition-colors"
              >
                <Plus className="w-4 h-4" />
                Criar projeto
              </Link>
            )
          )}
        </div>
      )}
    </div>
  );
}
