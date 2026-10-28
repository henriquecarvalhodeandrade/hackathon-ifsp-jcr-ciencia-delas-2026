"use client";

import { useState, useTransition } from "react";
import { UserCheck, UserPlus, Loader2 } from "lucide-react";
import { followUser, unfollowUser } from "@/lib/actions/connections";

interface FollowButtonProps {
  targetUserId: string;
  targetUsername: string;
  initialIsFollowing: boolean;
}

export function FollowButton({
  targetUserId,
  targetUsername,
  initialIsFollowing,
}: FollowButtonProps) {
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing);
  const [isPending, startTransition] = useTransition();

  const handleClick = () => {
    startTransition(async () => {
      if (isFollowing) {
        const result = await unfollowUser(targetUserId);
        if (result.ok) setIsFollowing(false);
      } else {
        const result = await followUser(targetUserId);
        if (result.ok) setIsFollowing(true);
      }
    });
  };

  if (isFollowing) {
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        title={`Deixar de seguir @${targetUsername}`}
        className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl border border-border hover:border-destructive hover:text-destructive hover:bg-destructive/5 font-semibold text-xs transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {isPending ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <UserCheck className="w-3.5 h-3.5" />
        )}
        Seguindo
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
    >
      {isPending ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <UserPlus className="w-3.5 h-3.5" />
      )}
      Seguir
    </button>
  );
}
