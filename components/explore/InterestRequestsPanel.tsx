"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Check, Clock, Inbox, Loader2, X } from "lucide-react";
import { respondInterest } from "@/lib/actions/projects";
import { WomanBadge } from "@/components/common/WomanBadge";
import type { ExploreProfile } from "@/lib/types/explore";

export interface PendingRequestItem {
  id: string;
  message: string | null;
  created_at: string;
  profile: ExploreProfile;
}

interface InterestRequestsPanelProps {
  requests: PendingRequestItem[];
  acceptedCount: number;
  slots: number;
}

export function InterestRequestsPanel({
  requests,
  acceptedCount,
  slots,
}: InterestRequestsPanelProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = React.useState<string | null>(null);

  const respond = (interestId: string, accept: boolean) => {
    setError(null);
    startTransition(async () => {
      const res = await respondInterest(interestId, accept);
      if (!res.ok) setError(res.error);
      else router.refresh();
    });
  };

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-heading font-bold text-foreground flex items-center gap-2">
          <Inbox className="w-4 h-4 text-primary" />
          Pedidos de interesse
        </h2>
        <span className="text-xs font-semibold text-muted-foreground">
          {acceptedCount}/{slots} vagas preenchidas
        </span>
      </div>

      {error && (
        <p className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm">
          {error}
        </p>
      )}

      {requests.length > 0 ? (
        <div className="space-y-3">
          {requests.map((req) => (
            <div
              key={req.id}
              className="p-4 rounded-2xl bg-card border border-border shadow-xs space-y-2.5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-primary/15 text-primary flex items-center justify-center font-heading font-bold text-xs shrink-0">
                    {req.profile.avatar_url ? (
                      <img
                        src={req.profile.avatar_url}
                        alt={req.profile.full_name}
                        className="w-full h-full object-cover rounded-full"
                      />
                    ) : (
                      req.profile.full_name.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-semibold text-foreground truncate">
                        {req.profile.full_name}
                      </span>
                      {req.profile.is_self_declared_woman && (
                        <WomanBadge size="xs" showLabel={false} />
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      @{req.profile.username}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => respond(req.id, true)}
                    aria-label="Aceitar pedido"
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs transition-colors disabled:opacity-60"
                  >
                    {isPending ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Check className="w-3.5 h-3.5" />
                    )}
                    Aceitar
                  </button>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => respond(req.id, false)}
                    aria-label="Recusar pedido"
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-border hover:bg-muted font-semibold text-xs transition-colors disabled:opacity-60"
                  >
                    {isPending ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <X className="w-3.5 h-3.5" />
                    )}
                    Recusar
                  </button>
                </div>
              </div>

              {req.message && (
                <p className="text-sm text-muted-foreground bg-muted rounded-xl p-3 border border-border/60">
                  “{req.message}”
                </p>
              )}

              <p className="text-[11px] text-muted-foreground">
                {new Date(req.created_at).toLocaleString("pt-BR")}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-8 text-center rounded-2xl bg-card border border-border">
          <Clock className="w-6 h-6 text-muted-foreground/50 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">
            Nenhum pedido de interesse pendente.
          </p>
        </div>
      )}
    </section>
  );
}
