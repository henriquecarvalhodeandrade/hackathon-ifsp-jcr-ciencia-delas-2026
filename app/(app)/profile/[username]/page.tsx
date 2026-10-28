import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import {
  GraduationCap,
  Microscope,
  Calendar,
  Settings,
  BookOpen,
  Rss,
  FlaskConical,
  Sparkles,
  ExternalLink,
  Plus,
  FlaskRound,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { WomanBadge } from "@/components/common/WomanBadge";
import { FollowButton } from "@/components/profile/FollowButton";
import { ConnectButton } from "@/components/profile/ConnectButton";
import type { Database } from "@/lib/types/database";

type RequestStatus = Database["public"]["Enums"]["request_status"];

type ConnectionStatus =
  | "none"
  | "pending_sent"
  | "pending_received"
  | "accepted";

interface ProfilePageProps {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ tab?: string }>;
}

export default async function ProfilePage({
  params,
  searchParams,
}: ProfilePageProps) {
  const { username } = await params;
  const { tab = "posts" } = await searchParams;

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

  // Busca contagens + dados de follow/conexão em paralelo
  const [
    { count: postsCount },
    { count: projectsCount },
    { count: followersCount },
    { count: followingCount },
    { data: followRow },
    { data: connectionRow },
    { data: connectionsCount },
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
    supabase
      .from("follows")
      .select("follower_id")
      .eq("follower_id", currentUser.id)
      .eq("following_id", profile.id)
      .maybeSingle(),
    supabase
      .from("connections")
      .select("*")
      .or(
        `and(requester_id.eq.${currentUser.id},addressee_id.eq.${profile.id}),and(requester_id.eq.${profile.id},addressee_id.eq.${currentUser.id})`
      )
      .maybeSingle(),
    // Contagem de conexões aceitas (função security definer — migration 005;
    // a policy connections_select_involved impediria contar as de terceiros)
    supabase.rpc("connection_count", { p_user_id: profile.id }),
  ]);

  const isFollowing = !!followRow;

  // Determina status da conexão
  let connectionStatus: ConnectionStatus = "none";
  let connectionId: string | undefined;

  if (connectionRow) {
    connectionId = connectionRow.id;
    const status = connectionRow.status as RequestStatus;
    if (status === "accepted") {
      connectionStatus = "accepted";
    } else if (status === "pending") {
      connectionStatus =
        connectionRow.requester_id === currentUser.id
          ? "pending_sent"
          : "pending_received";
    }
  }

  // Formatação de data
  const memberSince = new Date(profile.created_at).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });

  // ─── Tab: Posts ───────────────────────────────────────────────────────────
  const { data: userPosts } = await supabase
    .from("posts")
    .select("id, content, created_at")
    .eq("author_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(10);

  // ─── Tab: Projetos de IC ──────────────────────────────────────────────────
  const [{ data: createdProjects }, { data: participatingInterests }] =
    await Promise.all([
      supabase
        .from("projects")
        .select("id, title, area, tags, is_open, created_at")
        .eq("creator_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(5),
      supabase
        .from("project_interests")
        .select("projects(id, title, area, is_open, created_at)")
        .eq("user_id", profile.id)
        .eq("status", "accepted")
        .limit(5),
    ]);

  type ProjectRow = {
    id: string;
    title: string;
    area: string;
    is_open: boolean;
    created_at: string;
  };

  const participatingProjects: ProjectRow[] = (participatingInterests ?? [])
    .map((interest) => interest.projects)
    .filter((p): p is ProjectRow => p !== null);

  // ─── Tab: Vitrine ─────────────────────────────────────────────────────────
  const { data: showcases } = await supabase
    .from("showcases")
    .select("id, title, summary, image_urls, external_url, created_at")
    .eq("author_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(6);

  // ─── Tab navigation ───────────────────────────────────────────────────────
  const tabs = [
    { key: "posts", label: "Posts" },
    { key: "projects", label: "Projetos de IC" },
    { key: "vitrine", label: "Vitrine" },
  ];

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

          {/* Botões de Ação */}
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
                <FollowButton
                  targetUserId={profile.id}
                  targetUsername={profile.username}
                  initialIsFollowing={isFollowing}
                />
                <ConnectButton
                  targetUserId={profile.id}
                  connectionStatus={connectionStatus}
                  connectionId={connectionId}
                />
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
                {connectionsCount ?? 0}
              </span>{" "}
              <span className="text-muted-foreground">conexões</span>
            </div>
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
              <span className="text-muted-foreground">projetos de pesquisa</span>
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

      {/* Tabs de Navegação */}
      <div className="border-b border-border">
        <nav className="flex gap-0">
          {tabs.map((t) => {
            const isActive = tab === t.key;
            return (
              <Link
                key={t.key}
                href={`/profile/${username}?tab=${t.key}`}
                className={`px-4 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "border-b-2 border-primary text-primary font-semibold"
                    : "text-muted-foreground hover:text-foreground border-b-2 border-transparent"
                }`}
              >
                {t.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Conteúdo da Tab */}
      <div>
        {/* ─── Tab: Posts ──────────────────────────────────────────────── */}
        {tab === "posts" && (
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
                <Rss className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  Nenhuma publicação compartilhada ainda.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ─── Tab: Projetos de IC ─────────────────────────────────────── */}
        {tab === "projects" && (
          <div className="space-y-4">
            <h2 className="font-heading font-bold text-xl text-foreground flex items-center gap-2">
              <FlaskConical className="w-5 h-5 text-primary" />
              Projetos de Iniciação Científica
            </h2>

            {/* Projetos criados */}
            {createdProjects && createdProjects.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">
                  Criados
                </h3>
                {createdProjects.map((project) => (
                  <Link
                    key={project.id}
                    href={`/explore/${project.id}`}
                    className="flex items-center justify-between p-4 rounded-xl bg-card border border-border hover:border-primary/30 transition-colors group"
                  >
                    <div>
                      <p className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors">
                        {project.title}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {project.area}
                      </p>
                    </div>
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        project.is_open
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {project.is_open ? "Aberto" : "Fechado"}
                    </span>
                  </Link>
                ))}
              </div>
            )}

            {/* Projetos participando */}
            {participatingProjects.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">
                  Participando
                </h3>
                {participatingProjects.map((project) => (
                  <Link
                    key={project.id}
                    href={`/explore/${project.id}`}
                    className="flex items-center justify-between p-4 rounded-xl bg-card border border-border hover:border-primary/30 transition-colors group"
                  >
                    <div>
                      <p className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors">
                        {project.title}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {project.area}
                      </p>
                    </div>
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        project.is_open
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {project.is_open ? "Aberto" : "Fechado"}
                    </span>
                  </Link>
                ))}
              </div>
            )}

            {(!createdProjects || createdProjects.length === 0) &&
              participatingProjects.length === 0 && (
                <div className="p-8 text-center rounded-2xl bg-card border border-border">
                  <FlaskRound className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Nenhum projeto de IC ainda.
                  </p>
                  {isOwner && (
                    <Link
                      href="/explore/new"
                      className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Criar projeto
                    </Link>
                  )}
                </div>
              )}
          </div>
        )}

        {/* ─── Tab: Vitrine ─────────────────────────────────────────────── */}
        {tab === "vitrine" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-heading font-bold text-xl text-foreground flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                Vitrine Científica
              </h2>
              {isOwner && (
                <Link
                  href="/settings/vitrine"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border hover:bg-muted font-semibold text-xs transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Adicionar Trabalho
                </Link>
              )}
            </div>

            {showcases && showcases.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {showcases.map((showcase) => (
                  <Link
                    key={showcase.id}
                    href={`/vitrine/${showcase.id}`}
                    className="group rounded-2xl bg-card border border-border overflow-hidden hover:border-primary/30 transition-colors shadow-xs"
                  >
                    {/* Imagem de capa ou placeholder */}
                    {showcase.image_urls && showcase.image_urls.length > 0 ? (
                      <div className="aspect-video overflow-hidden">
                        <img
                          src={showcase.image_urls[0]}
                          alt={showcase.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      </div>
                    ) : (
                      <div className="aspect-video bg-gradient-to-br from-primary/10 to-secondary/10 flex items-center justify-center">
                        <Sparkles className="w-8 h-8 text-primary/30" />
                      </div>
                    )}
                    <div className="p-4">
                      <h3 className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors line-clamp-1">
                        {showcase.title}
                      </h3>
                      <p className="mt-1 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                        {showcase.summary}
                      </p>
                      {showcase.external_url && (
                        <span className="mt-2 inline-flex items-center gap-1 text-xs text-primary">
                          <ExternalLink className="w-3 h-3" />
                          Link externo
                        </span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center rounded-2xl bg-card border border-border">
                <Sparkles className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  Nenhum trabalho publicado na vitrine ainda.
                </p>
                {isOwner && (
                  <Link
                    href="/settings/vitrine"
                    className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Adicionar primeiro trabalho
                  </Link>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
