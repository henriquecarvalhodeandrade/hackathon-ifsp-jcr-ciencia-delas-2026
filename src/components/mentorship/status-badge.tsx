import { Ban, CircleCheck, CircleX, HeartHandshake, Hourglass } from "lucide-react";
import { Badge } from "@/components/ui";
import type { MentorshipStatus } from "@/lib/constants";
import { statusLabel, statusTone } from "@/lib/mentorship/presentation";

const ICONS: Record<MentorshipStatus, typeof Hourglass> = {
  pending: Hourglass,
  accepted: HeartHandshake,
  declined: CircleX,
  cancelled: Ban,
  completed: CircleCheck,
};

/** Selo de status do pedido (ícone + texto: nunca só cor). */
export function MentorshipStatusBadge({ status, className }: { status: MentorshipStatus; className?: string }) {
  const Icon = ICONS[status] ?? Hourglass;
  return (
    <Badge variant={statusTone(status)} size="md" className={className}>
      <Icon aria-hidden="true" />
      {statusLabel(status)}
    </Badge>
  );
}
