import type { Enums } from "@/lib/database.types";

/** Leitura segura dos searchParams do painel /admin (valores inválidos caem no padrão). */

export type AdminTab = "denuncias" | "newsletter" | "membros";
export type ReportStatus = Enums<"report_status">;
export type UserRole = Enums<"user_role">;
export type ReportTarget = Enums<"report_target">;

type Param = string | string[] | undefined;

function first(value: Param): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function parseAdminTab(value: Param, { canSeeNewsletter }: { canSeeNewsletter: boolean }): AdminTab {
  const v = first(value);
  if (v === "membros") return "membros";
  if (v === "newsletter" && canSeeNewsletter) return "newsletter";
  return "denuncias";
}

export const REPORT_STATUS_SLUGS: Record<ReportStatus, string> = {
  open: "abertas",
  resolved: "resolvidas",
  dismissed: "arquivadas",
};

export function parseReportStatus(value: Param): ReportStatus {
  const v = first(value);
  const match = (Object.entries(REPORT_STATUS_SLUGS) as [ReportStatus, string][]).find(([, slug]) => slug === v);
  return match?.[0] ?? "open";
}

export function parseRoleFilter(value: Param): UserRole | null {
  const v = first(value);
  return v === "member" || v === "moderator" || v === "admin" ? v : null;
}

export function parsePage(value: Param, max = 10_000): number {
  const n = Number.parseInt(first(value) ?? "", 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, max);
}

/** Busca textual: corta espaços, limita o tamanho e remove caracteres que quebram o filtro `or` do PostgREST. */
export function parseSearch(value: Param, maxLength = 80): string {
  return (first(value) ?? "")
    .replace(/[%_,()*\\"]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

export const REPORT_STATUS_LABELS: Record<ReportStatus, string> = {
  open: "Aberta",
  resolved: "Resolvida",
  dismissed: "Arquivada",
};

export const REPORT_TARGET_LABELS: Record<ReportTarget, string> = {
  thread: "Tópico do fórum",
  post: "Resposta no fórum",
  paper: "Paper da Vitrine",
  paper_comment: "Comentário em paper",
  profile: "Perfil",
};

export const ROLE_LABELS: Record<UserRole, string> = {
  member: "Membra",
  moderator: "Moderadora",
  admin: "Administradora",
};
