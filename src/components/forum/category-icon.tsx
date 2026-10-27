import { createElement } from "react";
import {
  Baby,
  BadgeDollarSign,
  BookOpen,
  CalendarHeart,
  FlaskConical,
  GraduationCap,
  HandHeart,
  HeartHandshake,
  HeartPulse,
  Lightbulb,
  MessagesSquare,
  ShieldPlus,
  Sparkles,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Ícones das categorias do fórum. O banco guarda o nome do ícone do lucide em
 * kebab-case (forum_categories.icon); aqui ficam os que usamos, num mapa estático
 * (importar o pacote inteiro dinamicamente pesaria o bundle).
 * `shield-heart` não existe no lucide 1.x → ShieldPlus.
 */
const CATEGORY_ICONS: Record<string, LucideIcon> = {
  "hand-heart": HandHeart,
  "graduation-cap": GraduationCap,
  "badge-dollar-sign": BadgeDollarSign,
  "flask-conical": FlaskConical,
  baby: Baby,
  "shield-heart": ShieldPlus,
  "shield-plus": ShieldPlus,
  "heart-pulse": HeartPulse,
  "calendar-heart": CalendarHeart,
  "heart-handshake": HeartHandshake,
  "messages-square": MessagesSquare,
  "book-open": BookOpen,
  lightbulb: Lightbulb,
  sparkles: Sparkles,
  users: Users,
};

/** Componente do lucide para o nome salvo no banco (padrão: MessagesSquare). */
export function categoryIconFor(name: string | null | undefined): LucideIcon {
  return (name && CATEGORY_ICONS[name]) || MessagesSquare;
}

export function CategoryIcon({ icon, className }: { icon: string | null | undefined; className?: string }) {
  // createElement: o ícone vem de um mapa estático (não é um componente criado no render).
  return createElement(categoryIconFor(icon), { "aria-hidden": true, className: cn("size-5", className) });
}
