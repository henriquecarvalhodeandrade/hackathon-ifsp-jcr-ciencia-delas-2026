import { ArrowDown } from "lucide-react";
import { MessageButton } from "@/components/messages/message-button";
import type { Application } from "@/lib/opportunities/types";
import { cn, truncate } from "@/lib/utils";
import { applicantStatusShort } from "./my-application";
import { ApplicationStatusBadge } from "./status-badges";
import { TimeAgo } from "./time-ago";

export interface ApplicationStripProps {
  application: Application;
  ownerId: string;
  /** Primeiro nome de quem publicou a vaga. */
  ownerName: string;
  /** Âncora da seção completa da candidatura ("Ver detalhes"). */
  detailsHref?: string;
  className?: string;
}

/**
 * Faixa compacta logo abaixo do título da vaga: o status da candidatura, uma linha (o recado da
 * dona, se houver) e a ação principal — "Enviar mensagem" quando aprovada. Assim quem volta à vaga
 * vê o andamento na primeira tela, sem rolar até o fim (a seção completa continua lá embaixo).
 */
export function ApplicationStrip({
  application,
  ownerId,
  ownerName,
  detailsHref = "#candidatar",
  className,
}: ApplicationStripProps) {
  const { status } = application;
  const note = application.owner_note;
  return (
    <section
      aria-labelledby="faixa-candidatura"
      className={cn(
        "grid gap-3 rounded-card border p-4 sm:flex sm:items-center sm:gap-5 sm:p-5",
        status === "accepted"
          ? "border-success/30 bg-success-soft"
          : status === "declined" || status === "withdrawn"
            ? "border-border bg-surface-2"
            : "border-border bg-surface shadow-card",
        className,
      )}
    >
      <h2 id="faixa-candidatura" className="sr-only">
        Sua candidatura
      </h2>
      <div className="grid min-w-0 flex-1 gap-1.5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <ApplicationStatusBadge status={status} srPrefix="Sua candidatura:" />
          <TimeAgo date={application.created_at} prefix="Você se candidatou" />
        </div>
        <p className="line-clamp-2 text-[0.9375rem] break-words text-fg">
          {note ? (
            <>
              <span className="font-semibold">Recado de {ownerName}:</span> “{truncate(note, 140)}”
            </>
          ) : (
            applicantStatusShort(status, ownerName)
          )}
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2">
        {status === "accepted" && (
          <MessageButton profileId={ownerId} label="Enviar mensagem" size="sm" />
        )}
        <a
          href={detailsHref}
          className="inline-flex items-center gap-1 rounded-control text-sm font-semibold text-fg underline underline-offset-2 hover:text-primary"
        >
          Ver detalhes
          <ArrowDown aria-hidden="true" className="size-4" />
        </a>
      </div>
    </section>
  );
}
