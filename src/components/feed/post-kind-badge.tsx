import { BookOpen, CalendarDays, FlaskConical, PenLine, Trophy } from "lucide-react";
import { Badge } from "@/components/ui";
import { postKindLabel, postKindTone } from "@/lib/feed/presentation";
import type { PostKind } from "@/lib/feed/schema";

/** Ícone de cada tipo (selo, linha de metadados e chips do compositor). */
export const KIND_ICONS: Record<PostKind, typeof PenLine> = {
  update: PenLine,
  project: FlaskConical,
  achievement: Trophy,
  publication: BookOpen,
  event: CalendarDays,
};

/** Selo do tipo da publicação (ícone + texto: a cor nunca informa sozinha). */
export function PostKindBadge({ kind, className }: { kind: PostKind; className?: string }) {
  const Icon = KIND_ICONS[kind] ?? PenLine;
  return (
    <Badge variant={postKindTone(kind)} className={className}>
      <Icon aria-hidden="true" />
      {postKindLabel(kind)}
    </Badge>
  );
}
