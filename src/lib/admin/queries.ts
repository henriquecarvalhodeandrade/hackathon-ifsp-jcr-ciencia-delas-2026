import "server-only";
import type { Enums, Tables } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/server";
import { truncate } from "@/lib/utils";
import { isAuditAction, isAuditTargetType, type AuditAction, type AuditTargetType } from "./audit";
import type { ReportStatus, ReportTarget, UserRole } from "./params";

/**
 * Consultas do painel /admin. Tudo passa pelo cliente com a sessão (RLS):
 * só moderadoras/admins enxergam todas as denúncias e conteúdos ocultos.
 * Os números da newsletter (inscritas, transporte de e-mail) vêm de
 * `getNewsletterOverview()` em src/lib/newsletter/service.ts.
 */

// ---------------------------------------------------------------------------
// Denúncias
// ---------------------------------------------------------------------------

export type ReportTargetPreview =
  | {
      kind: "thread";
      id: string;
      title: string;
      categoryName: string | null;
      isAnonymous: boolean;
      isLocked: boolean;
      isPinned: boolean;
      authorName: string | null;
      href: string;
    }
  | {
      kind: "post";
      id: string;
      threadId: string;
      threadTitle: string | null;
      excerpt: string;
      isAnonymous: boolean;
      authorName: string | null;
      href: string;
    }
  | { kind: "paper"; id: string; title: string; authors: string[]; isHidden: boolean; href: string }
  | {
      kind: "paper_comment";
      id: string;
      paperId: string;
      paperTitle: string | null;
      excerpt: string;
      authorName: string | null;
      href: string;
    }
  | {
      kind: "profile";
      id: string;
      fullName: string;
      headline: string | null;
      role: UserRole;
      href: string;
    }
  | { kind: "missing"; type: ReportTarget };

export interface ReportView {
  id: string;
  targetType: ReportTarget;
  targetId: string;
  reason: Enums<"report_reason">;
  details: string | null;
  status: ReportStatus;
  /** Nota visível para quem denunciou (vai no aviso de denúncia concluída). */
  resolutionNote: string | null;
  /** Registro de auditoria ligado a esta denúncia (mais antigo primeiro). */
  audit: AuditEntry[];
  createdAt: string;
  resolvedAt: string | null;
  reporter: { id: string; name: string } | null;
  resolver: { id: string; name: string } | null;
  target: ReportTargetPreview;
}

export interface ReportsPage {
  reports: ReportView[];
  counts: Record<ReportStatus, number>;
  total: number;
  totalPages: number;
  /** Página realmente exibida (uma página além do fim cai na última). */
  page: number;
  error: boolean;
}

/** PostgREST responde PGRST103 quando o `range` começa depois do fim (ex.: ?pagina=99). */
const RANGE_NOT_SATISFIABLE = "PGRST103";

function lastPage(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize));
}

type NamedProfile = { full_name: string } | null;

function nameOf(profile: NamedProfile | NamedProfile[] | undefined): string | null {
  const p = Array.isArray(profile) ? profile[0] : profile;
  const name = p?.full_name?.trim();
  return name ? name : null;
}

const EXCERPT = 280;

async function loadTargets(
  supabase: Awaited<ReturnType<typeof createClient>>,
  rows: Array<{ target_type: ReportTarget; target_id: string }>,
): Promise<Map<string, ReportTargetPreview>> {
  const ids = (type: ReportTarget) => [
    ...new Set(rows.filter((r) => r.target_type === type).map((r) => r.target_id)),
  ];
  const map = new Map<string, ReportTargetPreview>();
  const key = (type: ReportTarget, id: string) => `${type}:${id}`;

  const threadIds = ids("thread");
  const postIds = ids("post");
  const paperIds = ids("paper");
  const commentIds = ids("paper_comment");
  const profileIds = ids("profile");

  const [threads, posts, papers, comments, profiles] = await Promise.all([
    threadIds.length
      ? supabase
          .from("forum_threads")
          .select(
            "id, title, is_anonymous, is_locked, is_pinned, author:profiles(full_name), category:forum_categories(name)",
          )
          .in("id", threadIds)
      : null,
    postIds.length
      ? supabase
          .from("forum_posts")
          .select(
            "id, thread_id, body, is_anonymous, author:profiles(full_name), thread:forum_threads!forum_posts_thread_id_fkey(id, title)",
          )
          .in("id", postIds)
      : null,
    paperIds.length
      ? supabase.from("papers").select("id, title, authors, is_hidden").in("id", paperIds)
      : null,
    commentIds.length
      ? supabase
          .from("paper_comments")
          .select("id, paper_id, body, author:profiles(full_name), paper:papers(id, title)")
          .in("id", commentIds)
      : null,
    profileIds.length
      ? supabase.from("profiles").select("id, full_name, headline, role").in("id", profileIds)
      : null,
  ]);

  for (const t of threads?.data ?? []) {
    const category = Array.isArray(t.category) ? t.category[0] : t.category;
    map.set(key("thread", t.id), {
      kind: "thread",
      id: t.id,
      title: t.title,
      categoryName: category?.name ?? null,
      isAnonymous: t.is_anonymous,
      isLocked: t.is_locked,
      isPinned: t.is_pinned,
      authorName: t.is_anonymous ? null : nameOf(t.author),
      href: `/forum/t/${t.id}`,
    });
  }
  for (const p of posts?.data ?? []) {
    const thread = Array.isArray(p.thread) ? p.thread[0] : p.thread;
    map.set(key("post", p.id), {
      kind: "post",
      id: p.id,
      threadId: p.thread_id,
      threadTitle: thread?.title ?? null,
      excerpt: truncate(p.body.replace(/\s+/g, " ").trim(), EXCERPT),
      isAnonymous: p.is_anonymous,
      authorName: p.is_anonymous ? null : nameOf(p.author),
      href: `/forum/t/${p.thread_id}#post-${p.id}`,
    });
  }
  for (const p of papers?.data ?? []) {
    map.set(key("paper", p.id), {
      kind: "paper",
      id: p.id,
      title: p.title,
      authors: p.authors ?? [],
      isHidden: p.is_hidden,
      href: `/papers/${p.id}`,
    });
  }
  for (const c of comments?.data ?? []) {
    const paper = Array.isArray(c.paper) ? c.paper[0] : c.paper;
    map.set(key("paper_comment", c.id), {
      kind: "paper_comment",
      id: c.id,
      paperId: c.paper_id,
      paperTitle: paper?.title ?? null,
      excerpt: truncate(c.body.replace(/\s+/g, " ").trim(), EXCERPT),
      authorName: nameOf(c.author),
      href: `/papers/${c.paper_id}#comentarios`,
    });
  }
  for (const p of profiles?.data ?? []) {
    map.set(key("profile", p.id), {
      kind: "profile",
      id: p.id,
      fullName: p.full_name?.trim() || "Pesquisadora sem nome",
      headline: p.headline,
      role: p.role,
      href: `/pesquisadoras/${p.id}`,
    });
  }

  for (const result of [threads, posts, papers, comments, profiles]) {
    if (result?.error)
      console.error("[admin] falha ao carregar alvo de denúncia", result.error.code);
  }
  return map;
}

export const REPORTS_PAGE_SIZE = 15;

export async function listReports(
  status: ReportStatus,
  requestedPage: number,
): Promise<ReportsPage> {
  const supabase = await createClient();

  const countFor = (s: ReportStatus) =>
    supabase.from("reports").select("id", { count: "exact", head: true }).eq("status", s);

  const pageQuery = (page: number) => {
    const from = (page - 1) * REPORTS_PAGE_SIZE;
    return (
      supabase
        .from("reports")
        .select(
          "id, target_type, target_id, reason, details, status, resolution_note, created_at, resolved_at, reporter:profiles!reports_reporter_id_fkey(id, full_name), resolver:profiles!reports_resolved_by_fkey(id, full_name)",
          { count: "exact" },
        )
        .eq("status", status)
        // Fila aberta: as mais antigas primeiro. Histórico: as resolvidas mais recentemente primeiro.
        .order(status === "open" ? "created_at" : "resolved_at", {
          ascending: status === "open",
          nullsFirst: false,
        })
        .range(from, from + REPORTS_PAGE_SIZE - 1)
    );
  };

  let page = requestedPage;
  const [firstList, open, resolved, dismissed] = await Promise.all([
    pageQuery(page),
    countFor("open"),
    countFor("resolved"),
    countFor("dismissed"),
  ]);
  let list = firstList;

  const counts = {
    open: open.count ?? 0,
    resolved: resolved.count ?? 0,
    dismissed: dismissed.count ?? 0,
  };
  // Página além do fim (ex.: a última denúncia da página 2 acabou de ser resolvida): mostra a última.
  if (list.error?.code === RANGE_NOT_SATISFIABLE) {
    page = lastPage(counts[status], REPORTS_PAGE_SIZE);
    list = await pageQuery(page);
  }
  if (list.error) {
    console.error("[admin] falha ao listar denúncias", list.error.code);
    return { reports: [], counts, total: 0, totalPages: 0, page, error: true };
  }

  const rows = list.data ?? [];
  const [targets, audit] = await Promise.all([
    loadTargets(supabase, rows),
    loadAuditForReports(
      supabase,
      rows.map((r) => r.id),
    ),
  ]);
  const reports: ReportView[] = rows.map((r) => {
    const reporter = Array.isArray(r.reporter) ? r.reporter[0] : r.reporter;
    const resolver = Array.isArray(r.resolver) ? r.resolver[0] : r.resolver;
    return {
      id: r.id,
      targetType: r.target_type,
      targetId: r.target_id,
      reason: r.reason,
      details: r.details,
      status: r.status,
      resolutionNote: r.resolution_note,
      audit: audit.get(r.id) ?? [],
      createdAt: r.created_at,
      resolvedAt: r.resolved_at,
      reporter: reporter ? { id: reporter.id, name: reporter.full_name?.trim() || "Membra" } : null,
      resolver: resolver
        ? { id: resolver.id, name: resolver.full_name?.trim() || "Moderação" }
        : null,
      target: targets.get(`${r.target_type}:${r.target_id}`) ?? {
        kind: "missing",
        type: r.target_type,
      },
    };
  });

  const total = list.count ?? reports.length;
  return {
    reports,
    counts,
    total,
    totalPages: lastPage(total, REPORTS_PAGE_SIZE),
    page,
    error: false,
  };
}

// ---------------------------------------------------------------------------
// Registro de auditoria (moderation_audit_log — RLS: só moderação lê)
// ---------------------------------------------------------------------------

export interface AuditEntry {
  id: number;
  action: AuditAction;
  actorName: string | null;
  actorId: string | null;
  targetType: AuditTargetType | null;
  targetId: string | null;
  reportId: string | null;
  reason: string | null;
  createdAt: string;
}

const AUDIT_COLUMNS =
  "id, action, actor_id, target_type, target_id, report_id, reason, created_at, actor:profiles!moderation_audit_log_actor_id_fkey(full_name)";

type AuditRow = {
  id: number;
  action: string;
  actor_id: string | null;
  target_type: string | null;
  target_id: string | null;
  report_id: string | null;
  reason: string | null;
  created_at: string;
  actor: NamedProfile | NamedProfile[];
};

function toAuditEntry(row: AuditRow): AuditEntry | null {
  if (!isAuditAction(row.action)) return null;
  return {
    id: row.id,
    action: row.action,
    actorId: row.actor_id,
    actorName: row.actor_id ? (nameOf(row.actor) ?? "Moderação") : null,
    targetType: isAuditTargetType(row.target_type) ? row.target_type : null,
    targetId: row.target_id,
    reportId: row.report_id,
    reason: row.reason,
    createdAt: row.created_at,
  };
}

async function loadAuditForReports(
  supabase: Awaited<ReturnType<typeof createClient>>,
  reportIds: readonly string[],
): Promise<Map<string, AuditEntry[]>> {
  const map = new Map<string, AuditEntry[]>();
  if (reportIds.length === 0) return map;
  const { data, error } = await supabase
    .from("moderation_audit_log")
    .select(AUDIT_COLUMNS)
    .in("report_id", [...reportIds])
    .order("created_at", { ascending: true })
    .order("id", { ascending: true })
    .limit(500);
  if (error) {
    console.error("[admin] falha ao carregar a auditoria das denúncias", error.code);
    return map;
  }
  for (const row of (data ?? []) as AuditRow[]) {
    const entry = toAuditEntry(row);
    if (!entry?.reportId) continue;
    const list = map.get(entry.reportId) ?? [];
    list.push(entry);
    map.set(entry.reportId, list);
  }
  return map;
}

export interface AuditPage {
  entries: AuditEntry[];
  total: number;
  totalPages: number;
  page: number;
  error: boolean;
}

export const AUDIT_PAGE_SIZE = 30;

/** Registro completo, mais recente primeiro (aba "Registro" do painel). */
export async function listAuditLog(requestedPage: number): Promise<AuditPage> {
  const supabase = await createClient();
  const pageQuery = (page: number) => {
    const from = (page - 1) * AUDIT_PAGE_SIZE;
    return supabase
      .from("moderation_audit_log")
      .select(AUDIT_COLUMNS, { count: "exact" })
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(from, from + AUDIT_PAGE_SIZE - 1);
  };

  let page = requestedPage;
  let list = await pageQuery(page);
  if (list.error?.code === RANGE_NOT_SATISFIABLE) {
    const { count } = await supabase
      .from("moderation_audit_log")
      .select("id", { count: "exact", head: true });
    page = lastPage(count ?? 0, AUDIT_PAGE_SIZE);
    list = await pageQuery(page);
  }
  if (list.error) {
    console.error("[admin] falha ao listar o registro de auditoria", list.error.code);
    return { entries: [], total: 0, totalPages: 0, page, error: true };
  }
  const entries = ((list.data ?? []) as AuditRow[]).flatMap((row) => {
    const entry = toAuditEntry(row);
    return entry ? [entry] : [];
  });
  const total = list.count ?? entries.length;
  return { entries, total, totalPages: lastPage(total, AUDIT_PAGE_SIZE), page, error: false };
}

// ---------------------------------------------------------------------------
// Membros
// ---------------------------------------------------------------------------

export type MemberRow = Pick<
  Tables<"profiles">,
  | "id"
  | "full_name"
  | "avatar_url"
  | "role"
  | "institution"
  | "career_stage"
  | "is_mentor"
  | "onboarded_at"
  | "created_at"
>;

export interface MembersPage {
  members: MemberRow[];
  total: number;
  totalPages: number;
  /** Página realmente exibida (uma página além do fim cai na última). */
  page: number;
  roleCounts: Record<UserRole, number>;
  error: boolean;
}

export const MEMBERS_PAGE_SIZE = 25;

export async function listMembers({
  q,
  role,
  page: requestedPage,
}: {
  q: string;
  role: UserRole | null;
  page: number;
}): Promise<MembersPage> {
  const supabase = await createClient();

  const pageQuery = (page: number, head = false) => {
    let query = supabase
      .from("profiles")
      .select(
        "id, full_name, avatar_url, role, institution, career_stage, is_mentor, onboarded_at, created_at",
        {
          count: "exact",
          head,
        },
      )
      .order("created_at", { ascending: false });
    if (!head) {
      const from = (page - 1) * MEMBERS_PAGE_SIZE;
      query = query.range(from, from + MEMBERS_PAGE_SIZE - 1);
    }
    if (role) query = query.eq("role", role);
    if (q) query = query.or(`full_name.ilike.%${q}%,institution.ilike.%${q}%`);
    return query;
  };

  const countRole = (r: UserRole) =>
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", r);

  let page = requestedPage;
  const [firstList, members, moderators, admins] = await Promise.all([
    pageQuery(page),
    countRole("member"),
    countRole("moderator"),
    countRole("admin"),
  ]);
  let list = firstList;
  const roleCounts = {
    member: members.count ?? 0,
    moderator: moderators.count ?? 0,
    admin: admins.count ?? 0,
  };
  if (list.error?.code === RANGE_NOT_SATISFIABLE) {
    const { count } = await pageQuery(1, true);
    page = lastPage(count ?? 0, MEMBERS_PAGE_SIZE);
    list = await pageQuery(page);
  }
  if (list.error) {
    console.error("[admin] falha ao listar membras", list.error.code);
    return { members: [], total: 0, totalPages: 0, page, roleCounts, error: true };
  }
  const total = list.count ?? 0;
  return {
    members: list.data ?? [],
    total,
    totalPages: lastPage(total, MEMBERS_PAGE_SIZE),
    page,
    roleCounts,
    error: false,
  };
}

// ---------------------------------------------------------------------------
// Newsletter (somente admins)
// ---------------------------------------------------------------------------

export type EditionRow = Pick<
  Tables<"newsletter_editions">,
  | "id"
  | "slug"
  | "title"
  | "status"
  | "period_start"
  | "period_end"
  | "published_at"
  | "sent_at"
  | "recipients_count"
  | "created_at"
>;

export interface EditionsList {
  editions: EditionRow[];
  error: boolean;
}

/** Edições para o painel (RLS: admins leem todas, inclusive rascunhos). */
export async function listEditionsForAdmin(): Promise<EditionsList> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("newsletter_editions")
    .select(
      "id, slug, title, status, period_start, period_end, published_at, sent_at, recipients_count, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) console.error("[admin] falha ao listar edições", error.code);
  return { editions: data ?? [], error: Boolean(error) };
}
