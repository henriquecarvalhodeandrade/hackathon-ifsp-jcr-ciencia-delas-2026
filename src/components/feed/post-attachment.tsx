import { ArrowUpRight, Briefcase, ExternalLink, FolderOpen } from "lucide-react";
import { Badge, CardLink } from "@/components/ui";
import { portfolioKindLabel } from "@/lib/feed/presentation";
import type { AttachmentView } from "@/lib/feed/types";
import { opportunityKindLabel } from "@/lib/opportunities/labels";
import { cn } from "@/lib/utils";

const boxClass =
  "relative flex items-start gap-3 rounded-card border border-border bg-surface-2 p-3.5 sm:p-4";

const iconClass =
  "inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-surface text-primary ring-1 ring-border [&_svg]:size-[1.125rem]";

const eyebrowClass = "text-xs font-bold tracking-wide text-fg-subtle uppercase";

/**
 * Anexo da publicação: um item do portfólio da autora (link externo, se houver) ou uma vaga
 * que ela publicou (leva a /ics/<id>; o cartão inteiro é clicável).
 */
export function PostAttachment({
  attachment,
  className,
}: {
  attachment: AttachmentView;
  className?: string;
}) {
  if (attachment.type === "opportunity") {
    const meta = [
      attachment.areaName,
      attachment.hasScholarship
        ? attachment.scholarshipInfo
          ? `Com bolsa · ${attachment.scholarshipInfo}`
          : "Com bolsa"
        : "Sem bolsa",
    ].filter(Boolean);
    return (
      <div
        className={cn(
          boxClass,
          "transition-colors hover:border-border-strong hover:bg-surface",
          className,
        )}
      >
        <span aria-hidden="true" className={iconClass}>
          <Briefcase />
        </span>
        <div className="grid min-w-0 flex-1 gap-1">
          <p className={eyebrowClass}>
            <span className="sr-only">Oportunidade anexada: </span>
            {opportunityKindLabel(attachment.kind)}
          </p>
          <p className="leading-snug font-semibold text-pretty text-fg">
            {/* Link "esticado": o cartão inteiro leva à vaga (o anel de foco fica na área toda). */}
            <CardLink
              href={`/ics/${attachment.id}`}
              className="underline-offset-4 hover:text-primary hover:underline"
            >
              {attachment.title}
            </CardLink>
          </p>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-fg-muted">
            <span>{meta.join(" · ")}</span>
            {!attachment.isOpen && <Badge variant="neutral">Encerrada</Badge>}
          </p>
        </div>
        <ArrowUpRight aria-hidden="true" className="mt-1 size-4 shrink-0 text-fg-subtle" />
      </div>
    );
  }

  const meta = [attachment.venue, attachment.year ? String(attachment.year) : null].filter(Boolean);
  return (
    <div className={cn(boxClass, className)}>
      <span aria-hidden="true" className={iconClass}>
        <FolderOpen />
      </span>
      <div className="grid min-w-0 flex-1 gap-1">
        <p className={eyebrowClass}>
          <span className="sr-only">Do portfólio: </span>
          {portfolioKindLabel(attachment.kind)}
        </p>
        <p className="leading-snug font-semibold text-pretty break-words text-fg">
          {attachment.title}
        </p>
        {meta.length > 0 && <p className="text-sm text-fg-muted">{meta.join(" · ")}</p>}
        {attachment.url && (
          <a
            href={attachment.url}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="inline-flex w-fit items-center gap-1.5 rounded-control text-sm font-semibold text-primary underline-offset-4 hover:underline"
          >
            <ExternalLink aria-hidden="true" className="size-4" />
            Acessar
            <span className="sr-only"> {attachment.title} (abre em nova aba)</span>
          </a>
        )}
      </div>
    </div>
  );
}

/** Link externo da publicação (só http/https — já filtrado no modelo de tela). */
export function PostLink({ link }: { link: { href: string; host: string } }) {
  return (
    <a
      href={link.href}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className="inline-flex max-w-full items-center gap-1.5 rounded-control text-sm font-semibold text-primary underline-offset-4 hover:underline"
    >
      <ExternalLink aria-hidden="true" className="size-4 shrink-0" />
      <span className="truncate">{link.host}</span>
      <span className="sr-only"> (link externo, abre em nova aba)</span>
    </a>
  );
}
