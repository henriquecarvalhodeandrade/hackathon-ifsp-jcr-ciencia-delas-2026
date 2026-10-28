import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import {
  GraduationCap,
  Microscope,
  Calendar,
  Settings,
  BookOpen,
  Users,
  Rss,
  Sparkles,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { WomanBadge } from "@/components/common/WomanBadge";

interface ProfilePageProps {
  params: Promise<{
    username: string;
  }>;
}

export default async function ProfilePage({ params }: ProfilePageProps) {
  const { username } = await params;
  const supabase = await createClient();

  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser();

  if (!currentUser) {
    redirect("/login");
  }

  // Busca perfil alvo
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("username", username.toLowerCase())
    .single();

  if (!profile) {
    notFound();
  }

  const isOwner = currentUser.id === profile.id;

  // Busca contagens em paralelo via PostgREST
  const [
    { count: postsCount },
    { count: projectsCount },
    { count: followersCount },
    { count: followingCount },
  ] = await Promise.all([
    supabase
      .from("posts")
      .select("*", { count: "exact", head: true })
      .eq("author_id", profile.id),
    supabase
      .from("projects")
      .select("*", { count: "exact", head: true })
      .eq("creator_id", profile.id),
    supabase
      .from("follows")
      .select("*", { count: "exact", head: true })
      .eq("following_id", profile.id),
    supabase
      .from("follows")
      .select("*", { count: "exact", head: true })
      .eq("follower_id", profile.id),
  ]);

  // Busca posts do usuário
  const { data: userPosts } = await supabase
    .from("posts")
    .select("id, content, created_at")
    .eq("author_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(10);

  // Formatação de data
  const memberSince = new Date(profile.created_at).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Profile Card Header */}
      <div className="rounded-2xl bg-card border border-border p-6 sm:p-8 shadow-xs relative overflow-hidden">
        {/* Glow de fundo para autodeclaração feminina */}
        {profile.is_self_declared_woman && (
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-gradient-to-br from-primary/10 via-secondary/10 to-transparent blur-3xl pointer-events-none" />
        )}

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            {/* Avatar */}
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-gradient-to-tr from-primary/20 to-secondary/20 border-2 border-primary/30 flex items-center justify-center text-primary font-heading font-extrabold text-3xl shadow-inner shrink-0">
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={profile.full_name}
                  className="w-full h-full object-cover rounded-2xl"
                />
              ) : (
                profile.full_name.charAt(0).toUpperCase()
              )}
            </div>

            {/* Informações Principais */}
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-foreground">
                  {profile.full_name}
                </h1>
                {profile.is_self_declared_woman && (
                  <WomanBadge size="sm" showLabel={true} />
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">
                  @{profile.username}
                </span>
                <span>•</span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-muted text-foreground">
                  {profile.account_type === "scientist" ? (
                    <>
                      <Microscope className="w-3 h-3 text-secondary" />
                      Cientista / Pesquisadora
                    </>
                  ) : (
                    <>
                      <GraduationCap className="w-3 h-3 text-primary" />
                      Estudante
                    </>
                  )}
                </span>
              </div>

              {profile.course_or_area && (
                <p className="text-xs sm:text-sm font-medium text-muted-foreground flex items-center gap-1.5 pt-0.5">
                  <BookOpen className="w-3.5 h-3.5 text-primary shrink-0" />
                  {profile.course_or_area}
                </p>
              )}
            </div>
          </div>

          {/* Botão de Ação (Editar ou Seguir) */}
          <div className="w-full sm:w-auto flex items-center gap-2">
            {isOwner ? (
              <Link
                href="/settings/profile"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-border hover:bg-muted font-semibold text-xs sm:text-sm transition-colors"
              >
                <Settings className="w-4 h-4" />
                Editar Perfil
              </Link>
            ) : (
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  className="flex-1 sm:flex-initial px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs transition-colors"
                >
                  Seguir
                </button>
                <button
                  type="button"
                  className="flex-1 sm:flex-initial px-4 py-2 rounded-xl border border-border hover:bg-muted font-semibold text-xs transition-colors"
                >
                  Conectar
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Bio */}
        {profile.bio && (
          <p className="mt-5 text-sm sm:text-base text-foreground/90 leading-relaxed font-sans border-t border-border/60 pt-4">
            {profile.bio}
          </p>
        )}

        {/* Metadados e Contadores */}
        <div className="mt-6 pt-4 border-t border-border flex flex-wrap items-center justify-between gap-4 text-xs sm:text-sm">
          <div className="flex flex-wrap items-center gap-6">
            <div>
              <span className="font-bold text-foreground">
                {followersCount || 0}
              </span>{" "}
              <span className="text-muted-foreground">seguidores</span>
            </div>
            <div>
              <span className="font-bold text-foreground">
                {followingCount || 0}
              </span>{" "}
              <span className="text-muted-foreground">seguindo</span>
            </div>
            <div>
              <span className="font-bold text-foreground">
                {projectsCount || 0}
              </span>{" "}
              <span className="text-muted-foreground">
                projetos de pesquisa
              </span>
            </div>
            <div>
              <span className="font-bold text-foreground">
                {postsCount || 0}
              </span>{" "}
              <span className="text-muted-foreground">posts</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
            <Calendar className="w-3.5 h-3.5" />
            Membro desde {memberSince}
          </div>
        </div>
      </div>

      {/* Seção de Conteúdo do Perfil */}
      <div className="space-y-4">
        <h2 className="font-heading font-bold text-xl text-foreground flex items-center gap-2">
          <Rss className="w-5 h-5 text-primary" />
          Publicações Recentes
        </h2>

        {userPosts && userPosts.length > 0 ? (
          <div className="space-y-3">
            {userPosts.map((post) => (
              <div
                key={post.id}
                className="p-5 rounded-2xl bg-card border border-border shadow-xs hover:border-primary/30 transition-colors"
              >
                <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                  {post.content}
                </p>
                <div className="mt-3 text-xs text-muted-foreground flex items-center justify-between">
                  <span>
                    {new Date(post.created_at).toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center rounded-2xl bg-card border border-border">
            <p className="text-sm text-muted-foreground">
              Nenhuma publicação compartilhada ainda.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
