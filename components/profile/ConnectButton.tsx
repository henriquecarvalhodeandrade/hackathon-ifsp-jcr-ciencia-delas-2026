"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Link2, Clock, CheckCircle, Loader2, UserCheck, X } from "lucide-react";
import {
  sendConnectionRequest,
  respondConnectionRequest,
} from "@/lib/actions/connections";

type ConnectionStatus = "none" | "pending_sent" | "pending_received" | "accepted";

interface ConnectButtonProps {
  targetUserId: string;
  connectionStatus: ConnectionStatus;
  connectionId?: string; // necessário para responder solicitação
}

export function ConnectButton({
  targetUserId,
  connectionStatus,
  connectionId,
}: ConnectButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  if (connectionStatus === "accepted") {
    return (
      <button
        type="button"
        disabled
        className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl border border-border text-muted-foreground font-semibold text-xs cursor-default opacity-80"
      >
        <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
        Conectados
      </button>
    );
  }

  if (connectionStatus === "pending_sent") {
    return (
      <button
        type="button"
        disabled
        className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl border border-border text-muted-foreground font-semibold text-xs cursor-default opacity-80"
      >
        <Clock className="w-3.5 h-3.5" />
        Aguardando
      </button>
    );
  }

  if (connectionStatus === "pending_received" && connectionId) {
    return (
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              await respondConnectionRequest(connectionId, true);
            router.refresh();
            })
          }
          className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isPending ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <UserCheck className="w-3.5 h-3.5" />
          )}
          Aceitar
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              await respondConnectionRequest(connectionId, false);
            router.refresh();
            })
          }
          className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-border hover:bg-muted font-semibold text-xs transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isPending ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <X className="w-3.5 h-3.5" />
          )}
          Recusar
        </button>
      </div>
    );
  }

  // status === "none"
  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          await sendConnectionRequest(targetUserId);
          router.refresh();
        })
      }
      className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl border border-border hover:bg-muted font-semibold text-xs transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
    >
      {isPending ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <Link2 className="w-3.5 h-3.5" />
      )}
      Conectar
    </button>
  );
}
