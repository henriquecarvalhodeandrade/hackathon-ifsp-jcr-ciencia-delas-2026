import { HeartHandshake, Lightbulb, PartyPopper, type LucideIcon } from "lucide-react";
import { REACTION_KINDS } from "@/lib/constants";
import type { ReactionKindValue } from "@/lib/forum/schema";

/** Reações do fórum: ordem de exibição, rótulo (constants) e ícone do lucide. */
export const REACTIONS: ReadonlyArray<{ kind: ReactionKindValue; label: string; Icon: LucideIcon }> = [
  { kind: "support", label: REACTION_KINDS.support.label, Icon: HeartHandshake },
  { kind: "useful", label: REACTION_KINDS.useful.label, Icon: Lightbulb },
  { kind: "celebrate", label: REACTION_KINDS.celebrate.label, Icon: PartyPopper },
];
