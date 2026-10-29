import {
  Award,
  BookOpenCheck,
  FileText,
  FolderKanban,
  GraduationCap,
  ImageIcon,
  Presentation,
  Shapes,
  type LucideIcon,
} from "lucide-react";
import { isPortfolioKind, type PortfolioKind } from "@/lib/portfolio/presentation";

const ICONS: Record<PortfolioKind, LucideIcon> = {
  article: FileText,
  project: FolderKanban,
  presentation: Presentation,
  poster: ImageIcon,
  thesis: GraduationCap,
  award: Award,
  course: BookOpenCheck,
  other: Shapes,
};

/** Ícone do tipo de item do portfólio (decorativo: o rótulo vem sempre ao lado). */
export function PortfolioKindIcon({ kind, className }: { kind: string; className?: string }) {
  const Icon = ICONS[isPortfolioKind(kind) ? kind : "other"];
  return <Icon aria-hidden="true" className={className} />;
}
