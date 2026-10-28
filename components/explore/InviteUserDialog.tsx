"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { AlertCircle, Check, Loader2, Search, UserPlus, X } from "lucide-react";
import { inviteUser, searchUsers, type SearchUserResult } from "@/lib/actions/projects";
import { WomanBadge } from "@/components/common/WomanBadge";

interface InviteUserDialogProps {
  projectId: string;
}

export function InviteUserDialog({ projectId }: InviteUserDialogProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<SearchUserResult[]>([]);
  const [searching, setSearching] = React.useState(false);
  const [invitedIds, setInvitedIds] = React.useState<string[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Busca com debounce
  React.useEffect(() => {
    if (!open || query.trim().length < 2) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(async () => {
      const found = await searchUsers(query);
      if (!cancelled) {
        setResults(found);
        setSearching(false);
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, open]);

  const sendInvite = (targetUserId: string) => {
    setError(null);
    startTransition(async () => {
      const res = await inviteUser(projectId, targetUserId);
      if (!res.ok) setError(res.error);
      else {
        setInvitedIds((prev) => [...prev, targetUserId]);
        router.refresh();
      }
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-border hover:bg-muted font-semibold text-sm text-foreground transition-colors"
      >
        <UserPlus className="w-4 h-4" />
        Convidar usuário
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Convidar usuário para o projeto"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />

          {/* Modal */}
          <div className="relative w-full max-w-md rounded-2xl bg-card border border-border shadow-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-heading font-bold text-foreground">
                Convidar para o projeto
              </h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Fechar"
                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoFocus
                placeholder="Buscar por @username ou nome..."
                aria-label="Buscar usuários"
                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all placeholder:text-muted-foreground/60"
              />
            </div>

            {error && (
              <p className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                {error}
              </p>
            )}

            <div className="max-h-72 overflow-y-auto space-y-2">
              {searching ? (
                <div className="flex items-center justify-center py-6 text-muted-foreground">
                  <Loader2 className="w-5 h-5 animate-spin" />
                </div>
              ) : results.length > 0 ? (
                results.map((u) => {
                  const invited = invitedIds.includes(u.id);
                  return (
                    <div
                      key={u.id}
                      className="flex items-center justify-between gap-3 p-3 rounded-xl border border-border bg-background"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-primary/15 text-primary flex items-center justify-center font-heading font-bold text-xs shrink-0">
                          {u.avatar_url ? (
                            <img
                              src={u.avatar_url}
                              alt={u.full_name}
                              className="w-full h-full object-cover rounded-full"
                            />
                          ) : (
                            u.full_name.charAt(0).toUpperCase()
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-semibold text-foreground truncate">
                              {u.full_name}
                            </span>
                            {u.is_self_declared_woman && (
                              <WomanBadge size="xs" showLabel={false} />
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground">
                            @{u.username}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={isPending || invited}
                        onClick={() => sendInvite(u.id)}
                        className={`shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-xl font-semibold text-xs transition-colors disabled:cursor-not-allowed ${
                          invited
                            ? "border border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : "bg-primary hover:bg-primary/90 text-primary-foreground disabled:opacity-60"
                        }`}
                      >
                        {invited ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            Convidado
                          </>
                        ) : isPending ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <>
                            <UserPlus className="w-3.5 h-3.5" />
                            Convidar
                          </>
                        )}
                      </button>
                    </div>
                  );
                })
              ) : query.trim().length >= 2 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Nenhum usuário encontrado.
                </p>
              ) : (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Digite ao menos 2 letras para buscar.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
