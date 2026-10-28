import Link from "next/link";
import { ArrowUpRight, Eye, EyeOff, Lock, Pin, ShieldQuestion, UserRound } from "lucide-react";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { REPORT_TARGET_LABELS, REPORT_STATUS_LABELS, ROLE_LABELS } from "@/lib/admin/params";
import type { ReportTargetPreview, ReportView } from "@/lib/admin/queries";
import { REPORT_REASONS, type ReportReason } from "@/lib/constants";
import { formatDateTime, formatRelativeTime, toIsoString } from "@/lib/utils";
import { ReportAuditTrail } from "./audit-log";
import { ContentActions } from "./content-actions";
import { ReportResolveForm } from "./report-resolve-form";

const REASON_VARIANT: Record<ReportReason, BadgeVariant> = {
  harassment: "danger",
  offensive: "danger",
  misinformation: "warning",
  plagiarism: "warning",
  spam: "neutral",
  other: "neutral",
};

const STATUS_VARIANT = { open: "info", resolved: "success", dismissed: "neutral" } as const;

function Anonymous() {
  return (
    <span className="inline-flex items-center gap-1 font-semibold text-fg">
      <ShieldQuestion aria-hidden="true" className="size-4 text-fg-subtle" />
      Anônima
    </span>
  );
}

function TargetPreview({ target }: { target: ReportTargetPreview }) {
  if (target.kind === "missing") {
    return (
      <p className="text-[0.9375rem] text-fg-muted">
        O conteúdo denunciado ({REPORT_TARGET_LABELS[target.type].toLowerCase()}) já foi removido.
      </p>
    );
  }

  const open = (
    <Link
      href={target.href}
      className="inline-flex items-center gap-1 text-sm font-semibold text-primary underline-offset-4 hover:underline"
    >
      Abrir no site
      <ArrowUpRight aria-hidden="true" className="size-3.5" />
    </Link>
  );

  switch (target.kind) {
    case "thread":
      return (
        <div className="grid gap-1.5">
          <p className="eyebrow text-fg-subtle">Tópico{target.categoryName ? ` · ${target.categoryName}` : ""}</p>
          <p className="font-display text-lg leading-snug font-semibold text-fg">{target.title}</p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-fg-muted">
            <span>Por {target.isAnonymous ? <Anonymous /> : (target.authorName ?? "perfil removido")}</span>
            {target.isPinned && (
              <Badge variant="primary">
                <Pin aria-hidden="true" />
                Fixado
              </Badge>
            )}
            {target.isLocked && (
              <Badge variant="warning">
                <Lock aria-hidden="true" />
                Trancado
              </Badge>
            )}
            {open}
          </div>
        </div>
      );
    case "post":
      return (
        <div className="grid gap-1.5">
          <p className="eyebrow text-fg-subtle">
            Resposta em “{target.threadTitle ?? "tópico removido"}”
          </p>
          <blockquote className="border-l-2 border-border-strong pl-3 text-[0.9375rem] whitespace-pre-line text-fg">
            {target.excerpt}
          </blockquote>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-fg-muted">
            <span>Por {target.isAnonymous ? <Anonymous /> : (target.authorName ?? "perfil removido")}</span>
            {open}
          </div>
        </div>
      );
    case "paper":
      return (
        <div className="grid gap-1.5">
          <p className="eyebrow text-fg-subtle">Paper</p>
          <p className="font-serif text-lg leading-snug font-semibold text-fg">{target.title}</p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-fg-muted">
            {target.authors.length > 0 && <span className="line-clamp-1">{target.authors.join(", ")}</span>}
            {target.isHidden && (
              <Badge variant="warning">
                <EyeOff aria-hidden="true" />
                Oculto da Vitrine
              </Badge>
            )}
            {open}
          </div>
        </div>
      );
    case "paper_comment":
      return (
        <div className="grid gap-1.5">
          <p className="eyebrow text-fg-subtle">Comentário em “{target.paperTitle ?? "paper removido"}”</p>
          <blockquote className="border-l-2 border-border-strong pl-3 text-[0.9375rem] whitespace-pre-line text-fg">
            {target.excerpt}
          </blockquote>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-fg-muted">
            <span>Por {target.authorName ?? "perfil removido"}</span>
            {open}
          </div>
        </div>
      );
    case "profile":
      return (
        <div className="grid gap-1.5">
          <p className="eyebrow text-fg-subtle">Perfil</p>
          <p className="flex items-center gap-2 font-display text-lg leading-snug font-semibold text-fg">
            <UserRound aria-hidden="true" className="size-5 text-fg-subtle" />
            {target.fullName}
          </p>
          {target.headline && <p className="text-[0.9375rem] text-fg-muted">{target.headline}</p>}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-fg-muted">
            <Badge variant="outline">{ROLE_LABELS[target.role]}</Badge>
            {open}
          </div>
        </div>
      );
  }
}

/** Uma denúncia na fila da moderação: motivo, relato, prévia do alvo e ações. */
export function ReportCard({ report, isAdmin, now }: { report: ReportView; isAdmin: boolean; now: Date }) {
  const titleId = `denuncia-${report.id}`;
  return (
    <Card as="article" aria-labelledby={titleId} className="grid gap-4 p-5 sm:p-6">
      <header className="grid gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={REASON_VARIANT[report.reason]} size="md">
            {REPORT_REASONS[report.reason]}
          </Badge>
          <Badge variant="outline" size="md">
            {REPORT_TARGET_LABELS[report.targetType]}
          </Badge>
          {report.status !== "open" && (
            <Badge variant={STATUS_VARIANT[report.status]} size="md">
              {REPORT_STATUS_LABELS[report.status]}
            </Badge>
          )}
        </div>
        <h3 id={titleId} className="text-sm text-fg-muted">
          Denunciada{" "}
          <time dateTime={toIsoString(report.createdAt)} title={formatDateTime(report.createdAt)}>
            {formatRelativeTime(report.createdAt, now)}
          </time>{" "}
          por <span className="font-semibold text-fg">{report.reporter?.name ?? "conta removida"}</span>
        </h3>
      </header>

      {report.details && (
        <div className="rounded-control bg-surface-2 p-3.5">
          <p className="mb-1 text-xs font-bold tracking-wide text-fg-subtle uppercase">Relato da denunciante</p>
          <p className="text-[0.9375rem] whitespace-pre-line text-fg">{report.details}</p>
        </div>
      )}

      <div className="rounded-control border border-border p-4">
        <TargetPreview target={report.target} />
      </div>

      {report.status === "open" && <ContentActions target={report.target} reportId={report.id} isAdmin={isAdmin} />}

      {report.status !== "open" && (report.resolver || report.resolvedAt) && (
        <p className="text-sm text-fg-muted">
          {report.status === "resolved" ? "Resolvida" : "Arquivada"}
          {report.resolver ? (
            <>
              {" "}
              por <span className="font-semibold text-fg">{report.resolver.name}</span>
            </>
          ) : null}
          {report.resolvedAt ? (
            <>
              {" "}
              em <time dateTime={toIsoString(report.resolvedAt)}>{formatDateTime(report.resolvedAt)}</time>
            </>
          ) : null}
          .
        </p>
      )}

      {report.resolutionNote && (
        <div className="grid gap-1">
          <p className="flex flex-wrap items-center gap-2 text-xs font-bold tracking-wide text-fg-subtle uppercase">
            Nota para quem denunciou
            <Badge variant="info">
              <Eye aria-hidden="true" />
              Visível para quem denunciou
            </Badge>
          </p>
          <p className="text-sm whitespace-pre-line text-fg-muted">{report.resolutionNote}</p>
        </div>
      )}

      <ReportAuditTrail entries={report.audit} />

      <div className="border-t border-border pt-4">
        <ReportResolveForm reportId={report.id} status={report.status} />
      </div>
    </Card>
  );
}
