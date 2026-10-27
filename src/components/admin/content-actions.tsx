"use client";

import { Eye, EyeOff, Lock, LockOpen, Pin, PinOff, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { SubmitButton } from "@/components/ui/submit-button";
import { deleteReportedContent, moderateThreadAction, setPaperVisibility } from "@/lib/admin/actions";
import type { ReportTargetPreview } from "@/lib/admin/queries";
import { ActionForm, runInConfirmDialog } from "./action-form";
import { RevealAuthorDialog } from "./reveal-author-dialog";

type DeletableKind = "thread" | "post" | "paper" | "paper_comment";

const DELETE_COPY: Record<DeletableKind, { trigger: string; title: string; description: string }> = {
  thread: {
    trigger: "Excluir tópico",
    title: "Excluir este tópico?",
    description:
      "O tópico e todas as respostas serão apagados de vez. As denúncias abertas sobre eles serão encerradas.",
  },
  post: {
    trigger: "Excluir resposta",
    title: "Excluir esta resposta?",
    description: "A resposta será apagada de vez. As denúncias abertas sobre ela serão encerradas.",
  },
  paper: {
    trigger: "Excluir paper",
    title: "Excluir este paper da Vitrine?",
    description:
      "O paper, seus destaques e comentários serão apagados de vez, e as denúncias abertas sobre eles, encerradas. Se a dúvida for passageira, prefira ocultar.",
  },
  paper_comment: {
    trigger: "Excluir comentário",
    title: "Excluir este comentário?",
    description: "O comentário será apagado de vez. As denúncias abertas sobre ele serão encerradas.",
  },
};

function DeleteButton({ kind, id }: { kind: DeletableKind; id: string }) {
  const copy = DELETE_COPY[kind];
  return (
    <ConfirmDialog
      trigger={
        <Button variant="ghost" size="sm" className="text-danger hover:bg-danger-soft hover:text-danger-soft-fg">
          <Trash2 aria-hidden="true" />
          {copy.trigger}
        </Button>
      }
      title={copy.title}
      description={copy.description}
      confirmLabel="Sim, excluir"
      pendingLabel="Excluindo…"
      hiddenFields={{ targetType: kind, targetId: id }}
      action={(formData) => runInConfirmDialog(deleteReportedContent, formData)}
    />
  );
}

/** Ações da moderação sobre o conteúdo denunciado, conforme o tipo do alvo. */
export function ContentActions({
  target,
  reportId,
  isAdmin,
}: {
  target: ReportTargetPreview;
  reportId: string;
  isAdmin: boolean;
}) {
  if (target.kind === "missing" || target.kind === "profile") return null;

  return (
    <div className="flex flex-wrap items-start gap-2">
      {target.kind === "thread" && (
        <>
          <ActionForm
            action={moderateThreadAction}
            hiddenFields={{ threadId: target.id, op: target.isPinned ? "unpin" : "pin" }}
          >
            <SubmitButton variant="outline" size="sm" pendingText={target.isPinned ? "Desafixando…" : "Fixando…"}>
              {target.isPinned ? <PinOff aria-hidden="true" /> : <Pin aria-hidden="true" />}
              {target.isPinned ? "Desafixar" : "Fixar"}
            </SubmitButton>
          </ActionForm>
          <ActionForm
            action={moderateThreadAction}
            hiddenFields={{ threadId: target.id, op: target.isLocked ? "unlock" : "lock" }}
          >
            <SubmitButton variant="outline" size="sm" pendingText={target.isLocked ? "Destrancando…" : "Trancando…"}>
              {target.isLocked ? <LockOpen aria-hidden="true" /> : <Lock aria-hidden="true" />}
              {target.isLocked ? "Destrancar" : "Trancar respostas"}
            </SubmitButton>
          </ActionForm>
        </>
      )}

      {target.kind === "paper" && (
        <ActionForm action={setPaperVisibility} hiddenFields={{ paperId: target.id, hidden: String(!target.isHidden) }}>
          <SubmitButton variant="outline" size="sm" pendingText={target.isHidden ? "Reexibindo…" : "Ocultando…"}>
            {target.isHidden ? <Eye aria-hidden="true" /> : <EyeOff aria-hidden="true" />}
            {target.isHidden ? "Reexibir na Vitrine" : "Ocultar da Vitrine"}
          </SubmitButton>
        </ActionForm>
      )}

      {isAdmin && (target.kind === "thread" || target.kind === "post") && target.isAnonymous && (
        <RevealAuthorDialog reportId={reportId} targetType={target.kind} targetId={target.id} />
      )}

      <DeleteButton kind={target.kind} id={target.id} />
    </div>
  );
}
