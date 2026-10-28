import { redirect } from "next/navigation";
import Link from "next/link";
import { Sparkles, Compass, Users, MessageSquare } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { WomanBadge } from "@/components/common/WomanBadge";

export default async function FeedPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  // Busca os posts mais recentes para exibição inicial
  const { data: posts } = await supabase
    .from("posts")
    .select(`
      id,
      content,
      created_at,
      profiles (
        username,
        full_name,
        avatar_url,
        course_or_area,
        is_self_declared_woman
      )
    `)
    .order("created_at", { ascending: false })
    .limit(20);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Boas-vindas personalizadas */}
      {profile && (
        <div className="p-6 rounded-2xl bg-gradient-to-r from-primary/10 via-secondary/10 to-transparent border border-border flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-heading font-bold text-lg text-foreground">
                Olá, {profile.full_name}!
              </span>
              {profile.is_self_declared_woman && (
                <WomanBadge size="xs" showLabel={true} />
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Bem-vinda à comunidade científica Ártemis. Conecte-se com pesquisadoras e projetos de Iniciação Científica.
            </p>
          </div>
          <Link
            href="/explore"
            className="shrink-0 px-3.5 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs shadow-xs transition-colors hidden sm:inline-flex items-center gap-1.5"
          >
            <Compass className="w-3.5 h-3.5" />
            Explorar Vagas
          </Link>
        </div>
      )}

      {/* Feed List Preliminar */}
      <div className="space-y-4">
        <h2 className="font-heading font-bold text-lg text-foreground">
          Feed da Comunidade Científica
        </h2>

        {posts && posts.length > 0 ? (
          <div className="space-y-4">
            {posts.map((post) => {
              const author = Array.isArray(post.profiles)
                ? post.profiles[0]
                : post.profiles;
              return (
                <div
                  key={post.id}
                  className="p-5 rounded-2xl bg-card border border-border shadow-xs hover:border-primary/20 transition-all"
                >
                  <div className="flex items-center justify-between mb-3">
                    <Link
                      href={`/profile/${author?.username || ""}`}
                      className="flex items-center gap-2.5 group"
                    >
                      <div className="w-9 h-9 rounded-full bg-primary/15 text-primary flex items-center justify-center font-heading font-bold text-xs">
                        {author?.full_name?.charAt(0).toUpperCase() || "C"}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors">
                            {author?.full_name}
                          </span>
                          {author?.is_self_declared_woman && (
                            <WomanBadge size="xs" showLabel={false} />
                          )}
                        </div>
                        <span className="text-[11px] text-muted-foreground">
                          @{author?.username} • {author?.course_or_area}
                        </span>
                      </div>
                    </Link>
                    <span className="text-[11px] text-muted-foreground">
                      {new Date(post.created_at).toLocaleDateString("pt-BR", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <p className="text-sm text-foreground/95 leading-relaxed whitespace-pre-wrap">
                    {post.content}
                  </p>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-12 text-center rounded-2xl bg-card border border-border">
            <Sparkles className="w-8 h-8 text-primary mx-auto mb-3" />
            <p className="font-heading font-semibold text-foreground mb-1">
              O feed está pronto para as primeiras publicações!
            </p>
            <p className="text-xs text-muted-foreground">
              Na próxima etapa vamos adicionar o Publicador de Posts com curtidas interativas.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
