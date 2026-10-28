"use client";

import { useState, useTransition } from "react";
import { Heart, HeartOff, ArrowUpRight, MessageSquare, Bookmark } from "lucide-react";
import { cn } from "@/lib/utils";
import { toggleLike } from "@/lib/actions/posts";
import { WomanBadge } from "@/components/common/WomanBadge";

interface PostCardProps {
  post: {
    id: string;
    content: string;
    created_at: string;
    author: {
      id: string;
      username: string;
      full_name: string;
      avatar_url: string | null;
      is_self_declared_woman: boolean;
    };
    likesCount: number;
    userHasLiked: boolean;
  };
}

export function PostCard({ post }: PostCardProps) {
  const [likesCount, setLikesCount] = useState(post.likesCount);
  const [userHasLiked, setUserHasLiked] = useState(post.userHasLiked);
  const [isPending, startTransition] = useTransition();

  const handleLike = (formData: FormData) => {
    startTransition(async () => {
      const result = await toggleLike(formData);

      if (result.ok && "liked" in result) {
        setLikesCount(result.likesCount);
        setUserHasLiked(result.liked);
      }
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <form action={handleLike} className="p-5 rounded-2xl bg-card border border-border shadow-xs hover:border-primary/20 transition-all">
      <div className="flex items-center justify-between mb-3">
        <a
          href={`/profile/${post.author.username}`}
          className="flex items-center gap-2.5 group"
        >
          <div className="w-9 h-9 rounded-full bg-primary/15 text-primary flex items-center justify-center font-heading font-bold text-xs">
            {post.author.avatar_url ? (
              <img
                src={post.author.avatar_url}
                alt={post.author.full_name}
                className="w-full h-full object-cover rounded-full"
              />
            ) : (
              post.author.full_name.charAt(0).toUpperCase()
            )}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors">
                {post.author.full_name}
              </span>
              {post.author.is_self_declared_woman && (
                <WomanBadge size="xs" showLabel={true} />
              )}
            </div>
            <span className="text-[11px] text-muted-foreground">
              @{post.author.username} • {post.author.avatar_url ? "" : "Cientista"}
            </span>
          </div>
        </a>
        <span className="text-[11px] text-muted-foreground">
          {formatDate(post.created_at)}
        </span>
      </div>
      <p className="text-sm text-foreground/95 leading-relaxed whitespace-pre-wrap">
        {post.content}
      </p>

      {/* Ações do post */}
      <div className="mt-4 flex items-center justify-between pt-3 border-t border-border/60">
        <div className="flex items-center gap-4">
          <button
            type="submit"
            name="postId"
            value={post.id}
            disabled={isPending}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all",
              userHasLiked
                ? "bg-primary/10 text-primary hover:bg-primary/20"
                : "text-muted-foreground hover:text-primary hover:bg-primary/5"
            )}
            aria-label={userHasLiked ? "Descurtir" : "Curtir"}
          >
            {userHasLiked ? (
              <Heart className={cn("w-4 h-4 fill-current", isPending && "animate-pulse")} />
            ) : (
              <HeartOff className="w-4 h-4" />
            )}
            <span className="text-sm tabular-nums">{likesCount}</span>
          </button>

          <button
            type="button"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-muted-foreground hover:text-primary hover:bg-primary/5 transition-all"
            aria-label="Comentar"
          >
            <MessageSquare className="w-4 h-4" />
            <span>Comentar</span>
          </button>

          <button
            type="button"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-muted-foreground hover:text-primary hover:bg-primary/5 transition-all"
            aria-label="Compartilhar"
          >
            <ArrowUpRight className="w-4 h-4" />
            <span>Compartilhar</span>
          </button>

          <button
            type="button"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-muted-foreground hover:text-primary hover:bg-primary/5 transition-all"
            aria-label="Salvar"
          >
            <Bookmark className="w-4 h-4" />
            <span>Salvar</span>
          </button>
        </div>
      </div>
    </form>
  );
}