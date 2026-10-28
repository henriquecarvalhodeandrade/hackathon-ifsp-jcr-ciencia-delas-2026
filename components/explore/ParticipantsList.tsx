import Link from "next/link";
import { Crown, Users } from "lucide-react";
import { WomanBadge } from "@/components/common/WomanBadge";
import { RemoveParticipantButton } from "@/components/explore/RemoveParticipantButton";
import type { ExploreProfile } from "@/lib/types/explore";

export interface ParticipantEntry {
  profile: ExploreProfile;
  interestId: string;
}

interface ParticipantsListProps {
  creator: ExploreProfile | null;
  participants: ParticipantEntry[];
  acceptedCount: number;
  slots: number;
  /** true quando o usuário atual é a pessoa criadora do projeto */
  canManage: boolean;
}

function ParticipantRow({
  profile,
  suffix,
}: {
  profile: ExploreProfile;
  suffix?: React.ReactNode;
}) {
  return (
    <Link
      href={`/profile/${profile.username}`}
      className="flex items-center justify-between gap-3 p-3 rounded-xl border border-border bg-background hover:border-primary/30 transition-colors"
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-9 h-9 rounded-full bg-primary/15 text-primary flex items-center justify-center font-heading font-bold text-xs shrink-0">
          {profile.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt={profile.full_name}
              className="w-full h-full object-cover rounded-full"
            />
          ) : (
            profile.full_name.charAt(0).toUpperCase()
          )}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-semibold text-foreground truncate">
              {profile.full_name}
            </span>
            {profile.is_self_declared_woman && <WomanBadge size="xs" showLabel={false} />}
          </div>
          <span className="text-xs text-muted-foreground">@{profile.username}</span>
        </div>
      </div>
      {suffix}
    </Link>
  );
}

export function ParticipantsList({
  creator,
  participants,
  acceptedCount,
  slots,
  canManage,
}: ParticipantsListProps) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-heading font-bold text-foreground flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" />
          Participantes
        </h2>
        <span className="text-xs font-semibold text-muted-foreground">
          {acceptedCount}/{slots} vagas
        </span>
      </div>

      <div className="space-y-2">
        {creator && (
          <ParticipantRow
            profile={creator}
            suffix={
              <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-secondary/10 text-secondary border border-secondary/20">
                <Crown className="w-3 h-3" />
                CRIADORA(O)
              </span>
            }
          />
        )}

        {participants.map((entry) => (
          <ParticipantRow
            key={entry.interestId}
            profile={entry.profile}
            suffix={
              canManage ? (
                <RemoveParticipantButton interestId={entry.interestId} />
              ) : (
                <span className="shrink-0 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                  Participante
                </span>
              )
            }
          />
        ))}
      </div>

      {participants.length === 0 && (
        <p className="p-4 text-center text-sm text-muted-foreground rounded-xl bg-card border border-border">
          Nenhuma pessoa participante aceita ainda.
        </p>
      )}
    </section>
  );
}
