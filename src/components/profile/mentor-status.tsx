import { HeartHandshake } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { pluralize } from "@/lib/utils";

export interface MentorStatusProps {
  isMentor: boolean;
  available: boolean;
  /** Vagas abertas (null = desconhecido ou sem vagas). */
  openSlots: number | null;
  size?: "sm" | "md";
}

/** Texto do selo de mentora conforme disponibilidade e vagas. */
export function mentorStatusLabel({ available, openSlots }: Pick<MentorStatusProps, "available" | "openSlots">): string {
  if (!available) return "Mentora · pausada";
  if (openSlots && openSlots > 0) return `Mentora · ${pluralize(openSlots, "vaga")}`;
  return "Mentora · sem vagas agora";
}

/** Selo "Mentora" com vagas abertas (verde quando há vaga). */
export function MentorStatus({ isMentor, available, openSlots, size = "sm" }: MentorStatusProps) {
  if (!isMentor) return null;
  const hasSlots = available && (openSlots ?? 0) > 0;
  return (
    <Badge variant={hasSlots ? "secondary" : "neutral"} size={size}>
      <HeartHandshake aria-hidden="true" />
      {mentorStatusLabel({ available, openSlots })}
    </Badge>
  );
}
