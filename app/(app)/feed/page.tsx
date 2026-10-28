import { redirect } from "next/navigation";
import Link from "next/link";
import { Sparkles, Compass } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { WomanBadge } from "@/components/common/WomanBadge";
import { PostComposer } from "@/components/feed/PostComposer";
import { PostCard } from "@/components/feed/PostCard";
import { loadPosts } from "@/lib/actions/posts";

export default async function FeedPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Perfil do usuário + posts em paralelo (2 roundtrips → 1)
  const [{ data: profile }, postsResult] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    loadPosts(),
  ]);

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

      {/* Composer de Posts */}
      {profile && (
        <PostComposer
          user={{
            id: profile.id,
            username: profile.username,
            full_name: profile.full_name,
            avatar_url: profile.avatar_url,
            is_self_declared_woman: profile.is_self_declared_woman,
          }}
        />
      )}

      {/* Feed List */}
      <div className="space-y-4">
        <h2 className="font-heading font-bold text-lg text-foreground">
          Feed da Comunidade Científica
        </h2>

        {postsResult.ok && postsResult.posts.length > 0 ? (
          <div className="space-y-4">
            {postsResult.posts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        ) : (
          <div className="p-12 text-center rounded-2xl bg-card border border-border">
            <Sparkles className="w-8 h-8 text-primary mx-auto mb-3" />
            <p className="font-heading font-semibold text-foreground mb-1">
              O feed está pronto para as primeiras publicações!
            </p>
            <p className="text-xs text-muted-foreground">
              Seja a primeira a compartilhar suas ideias com a comunidade.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}