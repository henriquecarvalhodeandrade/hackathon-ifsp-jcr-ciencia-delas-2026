import Link from "next/link";
import { ScrollText } from "lucide-react";
import { Badge, EmptyState, Pagination } from "@/components/ui";
import {
  AUDIT_ACTION_LABELS,
  AUDIT_TARGET_LABELS,
  auditTargetHref,
  SENSITIVE_AUDIT_ACTIONS,
} from "@/lib/admin/audit";
import type { AuditEntry, AuditPage } from "@/lib/admin/queries";
import { cn, formatDateTime, toIsoString } from "@/lib/utils";

/** Uma linha do registro: "<quem> <ação> · data", alvo e motivo. */
function AuditItem({ entry, showTarget }: { entry: AuditEntry; showTarget: boolean }) {
  const href = showTarget ? auditTargetHref(entry.targetType, entry.targetId) : null;
  const sensitive = SENSITIVE_AUDIT_ACTIONS.has(entry.action);
  return (
    <li className="grid gap-1 border-l-2 border-border-strong py-0.5 pl-3">
      <p className="text-sm text-fg">
        <span className="font-semibold">{entry.actorName ?? "Conta removida ou tarefa do sistema"}</span>{" "}
        {AUDIT_ACTION_LABELS[entry.action]}
        {sensitive && (
          <Badge variant="warning" className="ml-2 align-middle">
            Sensível
          </Badge>
        )}
      </p>
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-fg-subtle">
        <time dateTime={toIsoString(entry.createdAt)}>{formatDateTime(entry.createdAt)}</time>
        {showTarget && entry.targetType && (
          <>
            <span aria-hidden="true">·</span>
            {href ? (
              <Link href={href} className="font-semibold text-primary underline-offset-4 hover:underline">
                {AUDIT_TARGET_LABELS[entry.targetType]}
              </Link>
            ) : (
              <span>{AUDIT_TARGET_LABELS[entry.targetType]}</span>
            )}
          </>
        )}
        {showTarget && entry.reportId && (
          <>
            <span aria-hidden="true">·</span>
            <span>ligada a uma denúncia</span>
          </>
        )}
      </p>
      {entry.reason && <p className="text-sm whitespace-pre-line text-fg-muted">Motivo: {entry.reason}</p>}
    </li>
  );
}

/** Histórico de uma denúncia no cartão (só moderação vê o painel). */
export function ReportAuditTrail({ entries, className }: { entries: AuditEntry[]; className?: string }) {
  if (entries.length === 0) return null;
  return (
    <div className={cn("grid gap-2", className)}>
      <p className="flex items-center gap-1.5 text-xs font-bold tracking-wide text-fg-subtle uppercase">
        <ScrollText aria-hidden="true" className="size-3.5" />
        Registro da moderação · interno
      </p>
      <ol className="grid gap-2">
        {entries.map((entry) => (
          <AuditItem key={entry.id} entry={entry} showTarget={false} />
        ))}
      </ol>
    </div>
  );
}

/** Aba "Registro": tudo o que a moderação fez, mais recente primeiro. */
export function AuditLogPanel({ data }: { data: AuditPage }) {
  if (data.error) {
    return (
      <EmptyState
        icon={<ScrollText />}
        title="Não conseguimos carregar o registro"
        description="Recarregue a página em instantes. Se continuar, confira os logs do servidor."
      />
    );
  }
  if (data.entries.length === 0) {
    return (
      <EmptyState
        icon={<ScrollText />}
        title="Nenhuma ação registrada ainda"
        description="Revelações de autoria, exclusões, ocultações, trocas de papel e denúncias concluídas aparecem aqui."
      />
    );
  }
  return (
    <div className="grid gap-5">
      <ol className="grid gap-3 rounded-card border border-border bg-surface p-4 shadow-card sm:p-5" aria-label="Ações da moderação">
        {data.entries.map((entry) => (
          <AuditItem key={entry.id} entry={entry} showTarget />
        ))}
      </ol>
      <Pagination page={data.page} totalPages={data.totalPages} basePath="/admin" searchParams={{ aba: "registro" }} />
    </div>
  );
}
