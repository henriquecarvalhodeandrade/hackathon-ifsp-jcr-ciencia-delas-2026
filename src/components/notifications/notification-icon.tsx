import {
  BookOpenText,
  CircleCheckBig,
  HeartHandshake,
  MailCheck,
  MessageSquareReply,
  ShieldCheck,
} from "lucide-react";
import type { NotificationType } from "@/lib/notifications/meta";
import { cn } from "@/lib/utils";

const ICONS: Record<NotificationType, { Icon: typeof HeartHandshake; tone: string }> = {
  mentorship_request: { Icon: HeartHandshake, tone: "bg-primary-soft text-primary-soft-fg" },
  mentorship_response: { Icon: MailCheck, tone: "bg-primary-soft text-primary-soft-fg" },
  thread_reply: { Icon: MessageSquareReply, tone: "bg-secondary-soft text-secondary-soft-fg" },
  solution_marked: { Icon: CircleCheckBig, tone: "bg-success-soft text-success-soft-fg" },
  paper_comment: { Icon: BookOpenText, tone: "bg-accent-soft text-accent-soft-fg" },
  report_resolved: { Icon: ShieldCheck, tone: "bg-info-soft text-info-soft-fg" },
};

/** Ícone do tipo de notificação (decorativo — o tipo também aparece em texto). */
export function NotificationIcon({ type, className }: { type: NotificationType; className?: string }) {
  const { Icon, tone } = ICONS[type] ?? ICONS.thread_reply;
  return (
    <span
      aria-hidden="true"
      className={cn("inline-flex size-10 shrink-0 items-center justify-center rounded-full [&_svg]:size-5", tone, className)}
    >
      <Icon />
    </span>
  );
}
