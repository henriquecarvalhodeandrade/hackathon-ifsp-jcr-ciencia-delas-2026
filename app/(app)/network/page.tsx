import { redirect } from "next/navigation";
import Link from "next/link";
import { Users, UserCheck, Rss, UserMinus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { WomanBadge } from "@/components/common/WomanBadge";
import { ConnectButton } from "@/components/profile/ConnectButton";

interface NetworkPageProps {
  searchParams: Promise<{ tab?: string }>;
}

/** Resumo de perfil usado em listas da rede */
interface ProfileSummary {
  id: string;
  username: string;
  full_name: string;
  avatar_url: string | null;
  course_or_area: string | null;
  is_self_declared_woman: boolean;
}

/**
 * Linha de connections aceitas com os dois embeds explícitos por FK.
 * O PostgREST retorna `profiles!<fk>` (e não `profiles`) quando há dois
 * embeds da mesma tabela, então os tipos gerados não servem aqui.
 */
interface AcceptedConnectionRow {
  id: string;
  requester_id: string;
  addressee_id: string;
  "profiles!connections_requester_id_fkey": ProfileSummary | ProfileSummary[];
  "profiles!connections_addressee_id_fkey": ProfileSummary | ProfileSummary[];
}

function normalizeProfile(
  value: ProfileSummary | ProfileSummary[] | null | undefined
): ProfileSummary | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export default async function NetworkPage({ searchParams }: NetworkPageProps) {
  const { tab = "requests" } = await searchParams;
  const supabase = await createClient();

  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser();

  if (!currentUser) {
    redirect("/login");
  }

  // Busca em paralelo todos os dados necessários
  const [
    { data: pendingRequests },
    { data: acceptedConnections },
    { data: followingRows },
    { data: followerRows },
  ] = await Promise.all([
    // Pedidos pendentes recebidos (eu sou o addressee)
    supabase
      .from("connections")
      .select(
        "id, requester_id, created_at, profiles!connections_requester_id_fkey(id, username, full_name, avatar_url, course_or_area, is_self_declared_woman)"
      )
      .eq("addressee_id", currentUser.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false }),

    // Conexões aceitas
    supabase
      .from("connections")
      .select(
        "id, requester_id, addressee_id, profiles!connections_requester_id_fkey(id, username, full_name, avatar_url, course_or_area, is_self_declared_woman), profiles!connections_addressee_id_fkey(id, username, full_name, avatar_url, course_or_area, is_self_declared_woman)"
      )
      .or(
        `requester_id.eq.${currentUser.id},addressee_id.eq.${currentUser.id}`
      )
      .eq("status", "accepted")
      .order("created_at", { ascending: false }),

    // Quem eu sigo
    supabase
      .from("follows")
      .select(
        "following_id, profiles!follows_following_id_fkey(id, username, full_name, avatar_url, course_or_area, is_self_declared_woman)"
      )
      .eq("follower_id", currentUser.id)
      .order("created_at", { ascending: false }),

    // Meus seguidores
    supabase
      .from("follows")
      .select(
        "follower_id, profiles!follows_follower_id_fkey(id, username, full_name, avatar_url, course_or_area, is_self_declared_woman)"
      )
      .eq("following_id", currentUser.id)
      .order("created_at", { ascending: false }),
  ]);

  const tabs = [
    {
      key: "requests",
      label: "Pedidos",
      count: pendingRequests?.length ?? 0,
    },
    {
      key: "connections",
      label: "Conexões",
      count: acceptedConnections?.length ?? 0,
    },
    {
      key: "following",
      label: "Seguindo",
      count: followingRows?.length ?? 0,
    },
    {
      key: "followers",
      label: "Seguidores",
      count: followerRows?.length ?? 0,
    },
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-foreground flex items-center gap-2">
          <Users className="w-6 h-6 text-primary" />
          Minha Rede
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gerencie suas conexões e seguidores
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-border">
        <nav className="flex gap-0 overflow-x-auto">
          {tabs.map((t) => {
            const isActive = tab === t.key;
            return (
              <Link
                key={t.key}
                href={`/network?tab=${t.key}`}
                className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                  isActive
                    ? "border-b-2 border-primary text-primary font-semibold"
                    : "text-muted-foreground hover:text-foreground border-b-2 border-transparent"
                }`}
              >
                {t.label}
                {t.count > 0 && (
                  <span
                    className={`inline-flex items-center justify-center rounded-full text-[10px] font-bold px-1.5 min-w-[18px] h-[18px] ${
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {t.count}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Conteúdo das Tabs */}
      <div>
        {/* ─── Tab: Pedidos ─────────────────────────────────────────────── */}
        {tab === "requests" && (
          <div className="space-y-3">
            {pendingRequests && pendingRequests.length > 0 ? (
              pendingRequests.map((req) => {
                const requester = Array.isArray(req.profiles)
                  ? req.profiles[0]
                  : req.profiles;
                if (!requester) return null;
                return (
                  <div
                    key={req.id}
                    className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-card border border-border shadow-xs"
                  >
                    <Link
                      href={`/profile/${requester.username}`}
                      className="flex items-center gap-3 min-w-0 group"
                    >
                      <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-primary/20 to-secondary/20 border border-primary/20 flex items-center justify-center text-primary font-heading font-bold text-lg shrink-0">
                        {requester.avatar_url ? (
                          <img
                            src={requester.avatar_url}
                            alt={requester.full_name}
                            className="w-full h-full object-cover rounded-xl"
                          />
                        ) : (
                          requester.full_name.charAt(0).toUpperCase()
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors">
                            {requester.full_name}
                          </span>
                          {requester.is_self_declared_woman && (
                            <WomanBadge size="xs" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          @{requester.username}
                          {requester.course_or_area &&
                            ` · ${requester.course_or_area}`}
                        </p>
                      </div>
                    </Link>
                    <div className="shrink-0">
                      <ConnectButton
                        targetUserId={requester.id}
                        connectionStatus="pending_received"
                        connectionId={req.id}
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <EmptyState
                icon={<UserCheck className="w-8 h-8" />}
                message="Nenhum pedido de conexão pendente."
              />
            )}
          </div>
        )}

        {/* ─── Tab: Conexões ────────────────────────────────────────────── */}
        {tab === "connections" && (
          <div className="space-y-3">
            {acceptedConnections && acceptedConnections.length > 0 ? (
              (
                acceptedConnections as unknown as AcceptedConnectionRow[]
              ).map((conn) => {
                // Determina qual é o "outro" lado
                const isRequester = conn.requester_id === currentUser.id;
                const p = normalizeProfile(
                  isRequester
                    ? conn["profiles!connections_addressee_id_fkey"]
                    : conn["profiles!connections_requester_id_fkey"]
                );

                if (!p) return null;
                return (
                  <UserCard
                    key={conn.id}
                    profile={p}
                    badge={<ConnectButton targetUserId={p.id} connectionStatus="accepted" />}
                  />
                );
              })
            ) : (
              <EmptyState
                icon={<Users className="w-8 h-8" />}
                message="Nenhuma conexão ainda. Envie solicitações nos perfis de outras pesquisadoras!"
              />
            )}
          </div>
        )}

        {/* ─── Tab: Seguindo ────────────────────────────────────────────── */}
        {tab === "following" && (
          <div className="space-y-3">
            {followingRows && followingRows.length > 0 ? (
              followingRows.map((row) => {
                const p = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
                if (!p) return null;
                const profile = p as {
                  id: string;
                  username: string;
                  full_name: string;
                  avatar_url: string | null;
                  course_or_area: string | null;
                  is_self_declared_woman: boolean;
                };
                return <UserCard key={row.following_id} profile={profile} />;
              })
            ) : (
              <EmptyState
                icon={<Rss className="w-8 h-8" />}
                message="Você ainda não segue ninguém."
              />
            )}
          </div>
        )}

        {/* ─── Tab: Seguidores ─────────────────────────────────────────── */}
        {tab === "followers" && (
          <div className="space-y-3">
            {followerRows && followerRows.length > 0 ? (
              followerRows.map((row) => {
                const p = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
                if (!p) return null;
                const profile = p as {
                  id: string;
                  username: string;
                  full_name: string;
                  avatar_url: string | null;
                  course_or_area: string | null;
                  is_self_declared_woman: boolean;
                };
                return <UserCard key={row.follower_id} profile={profile} />;
              })
            ) : (
              <EmptyState
                icon={<UserMinus className="w-8 h-8" />}
                message="Nenhum seguidor ainda."
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function UserCard({
  profile,
  badge,
}: {
  profile: {
    id: string;
    username: string;
    full_name: string;
    avatar_url: string | null;
    course_or_area: string | null;
    is_self_declared_woman: boolean;
  };
  badge?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-card border border-border shadow-xs">
      <Link
        href={`/profile/${profile.username}`}
        className="flex items-center gap-3 min-w-0 group"
      >
        <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-primary/20 to-secondary/20 border border-primary/20 flex items-center justify-center text-primary font-heading font-bold text-lg shrink-0">
          {profile.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt={profile.full_name}
              className="w-full h-full object-cover rounded-xl"
            />
          ) : (
            profile.full_name.charAt(0).toUpperCase()
          )}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors">
              {profile.full_name}
            </span>
            {profile.is_self_declared_woman && <WomanBadge size="xs" />}
          </div>
          <p className="text-xs text-muted-foreground truncate">
            @{profile.username}
            {profile.course_or_area && ` · ${profile.course_or_area}`}
          </p>
        </div>
      </Link>
      {badge && <div className="shrink-0">{badge}</div>}
    </div>
  );
}

function EmptyState({
  icon,
  message,
}: {
  icon: React.ReactNode;
  message: string;
}) {
  return (
    <div className="p-10 text-center rounded-2xl bg-card border border-border">
      <div className="text-muted-foreground/40 flex justify-center mb-3">{icon}</div>
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
