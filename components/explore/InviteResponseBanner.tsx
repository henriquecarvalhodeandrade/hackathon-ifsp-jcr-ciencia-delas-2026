"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Check, Loader2, UserPlus, X } from "lucide-react";
import { respondInvite } from "@/lib/actions/projects";

interface InviteResponseBannerProps {
  interestId: string;
  projectName: string;
  inviterName: string;
}

export function InviteResponseBanner({
  interestId,
  projectName,
  inviterName,
}: InviteResponseBannerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = React.useState<string | null>(null);

  const respond = (accept: boolean) => {
    setError(null);
    startTransition(async () => {
      const res = await respondInvite(interestId, accept);
      if (!res.ok) setError(res.error);
      else router.refresh();
    });
  };

  return (
    <div className="p-4 rounded-2xl bg-primary/10 border border-primary/30 space-y-2">
      <div className="flex items-start gap-2.5">
        <UserPlus className="w-5 h-5 text-primary shrink-0 mt-0.5" />
        <div className="text-sm text-foreground">
          <span className="font-semibold">{inviterName}</span> convidou você para
          participar de <span className="font-semibold">{projectName}</span>.
        </div>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="flex items-center gap-2 pl-7">
        <button
          type="button"
          disabled={isPending}
          onClick={() => respond(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs transition-colors disabled:opacity-60"
        >
          {isPending ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Check className="w-3.5 h-3.5" />
          )}
          Aceitar convite
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => respond(false)}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-border bg-card hover:bg-muted font-semibold text-xs transition-colors disabled:opacity-60"
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
  );
}
