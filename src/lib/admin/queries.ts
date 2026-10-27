import "server-only";
import type { Enums, Tables } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/server";
import { truncate } from "@/lib/utils";
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
  | { kind: "profile"; id: string; fullName: string; headline: string | null; role: UserRole; href: string }
  | { kind: "missing"; type: ReportTarget };

export interface ReportView {
  id: string;
  targetType: ReportTarget;
  targetId: string;
  reason: Enums<"report_reason">;
  details: string | null;
  status: ReportStatus;
  resolutionNote: string | null;
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
  error: boolean;
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
  const ids = (type: ReportTarget) => [...new Set(rows.filter((r) => r.target_type === type).map((r) => r.target_id))];
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
          .select("id, title, is_anonymous, is_locked, is_pinned, author:profiles(full_name), category:forum_categories(name)")
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
    paperIds.length ? supabase.from("papers").select("id, title, authors, is_hidden").in("id", paperIds) : null,
    commentIds.length
      ? supabase
          .from("paper_comments")
          .select("id, paper_id, body, author:profiles(full_name), paper:papers(id, title)")
          .in("id", commentIds)
      : null,
    profileIds.length ? supabase.from("profiles").select("id, full_name, headline, role").in("id", profileIds) : null,
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
    if (result?.error) console.error("[admin] falha ao carregar alvo de denúncia", result.error.code);
  }
  return map;
}

export const REPORTS_PAGE_SIZE = 15;

export async function listReports(status: ReportStatus, page: number): Promise<ReportsPage> {
  const supabase = await createClient();
  const from = (page - 1) * REPORTS_PAGE_SIZE;

  const countFor = (s: ReportStatus) =>
    supabase.from("reports").select("id", { count: "exact", head: true }).eq("status", s);

  const [list, open, resolved, dismissed] = await Promise.all([
    supabase
      .from("reports")
      .select(
        "id, target_type, target_id, reason, details, status, resolution_note, created_at, resolved_at, reporter:profiles!reports_reporter_id_fkey(id, full_name), resolver:profiles!reports_resolved_by_fkey(id, full_name)",
        { count: "exact" },
      )
      .eq("status", status)
      // Fila aberta: as mais antigas primeiro. Histórico: as resolvidas mais recentemente primeiro.
      .order(status === "open" ? "created_at" : "resolved_at", { ascending: status === "open", nullsFirst: false })
      .range(from, from + REPORTS_PAGE_SIZE - 1),
    countFor("open"),
    countFor("resolved"),
    countFor("dismissed"),
  ]);

  const counts = { open: open.count ?? 0, resolved: resolved.count ?? 0, dismissed: dismissed.count ?? 0 };
  if (list.error) {
    console.error("[admin] falha ao listar denúncias", list.error.code);
    return { reports: [], counts, total: 0, totalPages: 0, error: true };
  }

  const rows = list.data ?? [];
  const targets = await loadTargets(supabase, rows);
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
      createdAt: r.created_at,
      resolvedAt: r.resolved_at,
      reporter: reporter ? { id: reporter.id, name: reporter.full_name?.trim() || "Membra" } : null,
      resolver: resolver ? { id: resolver.id, name: resolver.full_name?.trim() || "Moderação" } : null,
      target: targets.get(`${r.target_type}:${r.target_id}`) ?? { kind: "missing", type: r.target_type },
    };
  });

  const total = list.count ?? reports.length;
  return { reports, counts, total, totalPages: Math.max(1, Math.ceil(total / REPORTS_PAGE_SIZE)), error: false };
}

// ---------------------------------------------------------------------------
// Membros
// ---------------------------------------------------------------------------

export type MemberRow = Pick<
  Tables<"profiles">,
  "id" | "full_name" | "avatar_url" | "role" | "institution" | "career_stage" | "is_mentor" | "onboarded_at" | "created_at"
>;

export interface MembersPage {
  members: MemberRow[];
  total: number;
  totalPages: number;
  roleCounts: Record<UserRole, number>;
  error: boolean;
}

export const MEMBERS_PAGE_SIZE = 25;

export async function listMembers({
  q,
  role,
  page,
}: {
  q: string;
  role: UserRole | null;
  page: number;
}): Promise<MembersPage> {
  const supabase = await createClient();
  const from = (page - 1) * MEMBERS_PAGE_SIZE;

  let query = supabase
    .from("profiles")
    .select("id, full_name, avatar_url, role, institution, career_stage, is_mentor, onboarded_at, created_at", {
      count: "exact",
    })
    .order("created_at", { ascending: false })
    .range(from, from + MEMBERS_PAGE_SIZE - 1);
  if (role) query = query.eq("role", role);
  if (q) query = query.or(`full_name.ilike.%${q}%,institution.ilike.%${q}%`);

  const countRole = (r: UserRole) =>
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", r);

  const [list, members, moderators, admins] = await Promise.all([
    query,
    countRole("member"),
    countRole("moderator"),
    countRole("admin"),
  ]);
  const roleCounts = { member: members.count ?? 0, moderator: moderators.count ?? 0, admin: admins.count ?? 0 };
  if (list.error) {
    console.error("[admin] falha ao listar membras", list.error.code);
    return { members: [], total: 0, totalPages: 0, roleCounts, error: true };
  }
  const total = list.count ?? 0;
  return {
    members: list.data ?? [],
    total,
    totalPages: Math.max(1, Math.ceil(total / MEMBERS_PAGE_SIZE)),
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
    .select("id, slug, title, status, period_start, period_end, published_at, sent_at, recipients_count, created_at")
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) console.error("[admin] falha ao listar edições", error.code);
  return { editions: data ?? [], error: Boolean(error) };
}
