"use client";

import { useState, useTransition } from "react";
import { Send, Sparkles } from "lucide-react";
import { createPost } from "@/lib/actions/posts";
import { cn } from "@/lib/utils";

interface PostComposerProps {
  user: {
    id: string;
    username: string;
    full_name: string;
    avatar_url: string | null;
    is_self_declared_woman: boolean;
  };
}

export function PostComposer({ user }: PostComposerProps) {
  const [content, setContent] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);

  const handleSubmit = (formData: FormData) => {
    setError(null);
    setSuccess(false);

    startTransition(async () => {
      const result = await createPost(formData);

      if (result.ok) {
        setContent("");
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
        // TODO: Atualizar o feed localmente via Server Component
      } else {
        setError(result.error || "Erro ao criar post");
      }
    });
  };

  return (
    <div className="rounded-2xl bg-card border border-border p-5 shadow-xs transition-all duration-200">
      <div className="flex items-center gap-4 mb-4">
        <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-primary/20 to-secondary/20 border-2 border-primary/30 flex items-center justify-center text-primary font-heading font-bold text-lg shrink-0">
          {user.avatar_url ? (
            <img
              src={user.avatar_url}
              alt={user.full_name}
              className="w-full h-full object-cover rounded-full"
            />
          ) : (
            user.full_name.charAt(0).toUpperCase()
          )}
        </div>
        <div className="flex-1">
          <h3 className="font-heading font-semibold text-sm text-foreground">
            @{user.username}
          </h3>
          <p className="text-xs text-muted-foreground">
            Compartilhe suas ideias com a comunidade
          </p>
        </div>
      </div>

      <form action={handleSubmit} className="space-y-4">
        <div className="relative">
          <textarea
            name="content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Crie seu post... (máximo 500 caracteres)"
            className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all"
            rows={3}
            maxLength={500}
            disabled={isPending}
          />
          <div className="absolute bottom-2 right-2 text-xs text-muted-foreground">
            {content.length}/500
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {success && (
          <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800">
            <p className="text-sm text-emerald-600 dark:text-emerald-400">
              Post criado com sucesso! 🚀
            </p>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary/60" />
            <span className="text-xs text-muted-foreground">
              Garanta seu espaço na ciência delas
            </span>
          </div>
          <button
            type="submit"
            disabled={isPending || !content.trim()}
            className={cn(
              "inline-flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-sm transition-all",
              isPending || !content.trim()
                ? "bg-muted text-muted-foreground cursor-not-allowed"
                : "bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs hover:shadow-md"
            )}
          >
            {isPending ? "Publicando..." : "Publicar"}
            <Send className={cn("w-4 h-4", isPending ? "animate-pulse" : "")} />
          </button>
        </div>
      </form>
    </div>
  );
}