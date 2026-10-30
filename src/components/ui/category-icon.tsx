import { createElement } from "react";
import {
  Baby,
  BadgeDollarSign,
  CalendarHeart,
  FlaskConical,
  GraduationCap,
  HandHeart,
  HeartPulse,
  MessagesSquare,
  ShieldPlus,
  type LucideIcon,
  type LucideProps,
} from "lucide-react";

/**
 * Ícones das categorias do fórum: o banco guarda o nome lucide em kebab-case
 * (forum_categories.icon). "shield-heart" não existe no lucide-react 1.x → ShieldPlus.
 * Nome desconhecido ou vazio → MessagesSquare (o ícone do fórum).
 */
export const CATEGORY_ICONS: Readonly<Record<string, LucideIcon>> = {
  "hand-heart": HandHeart,
  "graduation-cap": GraduationCap,
  "badge-dollar-sign": BadgeDollarSign,
  "flask-conical": FlaskConical,
  baby: Baby,
  "shield-heart": ShieldPlus,
  "shield-plus": ShieldPlus,
  "heart-pulse": HeartPulse,
  "calendar-heart": CalendarHeart,
  "messages-square": MessagesSquare,
};

export function getCategoryIcon(name: string | null | undefined): LucideIcon {
  return (name && CATEGORY_ICONS[name]) || MessagesSquare;
}

export interface CategoryIconProps extends Omit<LucideProps, "name"> {
  /** Valor de forum_categories.icon, ex.: "graduation-cap". */
  name: string | null | undefined;
}

/** Ícone (decorativo) da categoria do fórum — sempre ao lado do nome da categoria. */
export function CategoryIcon({ name, ...props }: CategoryIconProps) {
  return createElement(getCategoryIcon(name), { "aria-hidden": true, ...props });
}
