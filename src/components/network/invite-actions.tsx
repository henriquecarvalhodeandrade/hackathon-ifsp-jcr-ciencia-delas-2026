"use client";

import { useState, useTransition } from "react";
import { Check, Clock, Trash2, UserMinus, X } from "lucide-react";
import { Button, ConfirmDialog, toast, type ButtonSize } from "@/components/ui";
import {
  removeConnectionAction,
  respondConnectionAction,
  sendConnectionAction,
  type ConnectionResult,
} from "@/lib/network/actions";
import { firstNameOf, NETWORK_CONNECTION_ERROR } from "@/lib/network/presentation";
import { cn } from "@/lib/utils";
import { handOffFocus } from "./network-announcer";
import { useOptimisticList } from "./optimistic-list";

/**
 * Ações sobre convites e conexões (listas da /rede e o aviso de convite do perfil). Dentro de uma
 * <OptimisticList>, o cartão some na hora e volta se a ação falhar. O resultado aparece num aviso
 * (`toast`); recusar oferece "Desfazer" (que aceita o convite: um convite recusado não volta a
 * ficar pendente). O foco segue para `focusAfterId` quando o botão some.
 */

/** Alvos de toque de 44 px em telas de toque (rodapés de cartão). */
export const TOUCH_TARGET = "pointer-coarse:h-11 pointer-coarse:px-4";

async function safely(run: () => Promise<ConnectionResult>): Promise<ConnectionResult> {
  try {
    return await run();
  } catch {
    return { ok: false, error: NETWORK_CONNECTION_ERROR };
  }
}

/** Sufixo só para leitor de tela: "Aceitar" vira "Aceitar o convite de Marina" nas listas. */
function srName(prefix: string, personName: string | null | undefined): string {
  const name = firstNameOf(personName);
  return name ? ` ${prefix} ${name}` : "";
}

function failed(result: ConnectionResult): result is { ok: false; error: string } {
  if (result.ok) return false;
  toast({ message: result.error, tone: "danger" });
  return true;
}

/**
 * Roda uma ação de lista: dentro de <OptimisticList>, esconde o item na hora; fora dela (perfil),
 * marca o botão como ocupado. `onResult` mostra o aviso e passa o foco.
 */
function useListAction() {
  const list = useOptimisticList();
  const [running, setRunning] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function run(
    itemId: string,
    key: string,
    task: () => Promise<ConnectionResult>,
    onResult: (result: ConnectionResult) => void,
  ) {
    const wrapped = async () => {
      const result = await safely(task);
      onResult(result);
      return result.ok;
    };
    if (list) {
      list.run(itemId, wrapped);
      return;
    }
    setRunning(key);
    startTransition(async () => {
      await wrapped();
      setRunning(null);
    });
  }

  return { run, running };
}

/** Aceitar depois (do aviso "Desfazer" ou de um convite recusado antes). */
async function acceptLater(connectionId: string, name: string, focusAfterId?: string) {
  const result = await safely(() => respondConnectionAction(connectionId, true));
  if (failed(result)) return;
  toast({ message: name ? `Agora você e ${name} estão conectadas.` : result.message });
  handOffFocus(focusAfterId);
}

/** Aceitar / Recusar um convite recebido (também serve para aceitar um que eu recusei). */
export function RespondInviteButtons({
  connectionId,
  personName,
  allowDecline = true,
  focusAfterId,
  focusPrimary = false,
  size = "sm",
}: {
  connectionId: string;
  personName?: string | null;
  /** Para convites já recusados, só "Aceitar". */
  allowDecline?: boolean;
  /** Elemento que recebe o foco quando os botões somem. */
  focusAfterId?: string;
  /** Espera o botão principal (`[data-primary]`) aparecer em `focusAfterId` (perfil). */
  focusPrimary?: boolean;
  size?: Extract<ButtonSize, "sm" | "md">;
}) {
  const { run, running } = useListAction();
  const name = firstNameOf(personName);
  const focusAfter = () => handOffFocus(focusAfterId, { waitForPrimary: focusPrimary });

  function accept() {
    run(
      connectionId,
      "accept",
      () => respondConnectionAction(connectionId, true),
      (result) => {
        if (failed(result)) return;
        toast({ message: name ? `Agora você e ${name} estão conectadas.` : result.message });
        focusAfter();
      },
    );
  }

  function decline() {
    run(
      connectionId,
      "decline",
      () => respondConnectionAction(connectionId, false),
      (result) => {
        if (failed(result)) return;
        toast({
          message: name
            ? `Convite de ${name} recusado. Ela não recebe aviso.`
            : "Convite recusado. Ela não recebe aviso.",
          tone: "info",
          action: { label: "Desfazer", onClick: () => acceptLater(connectionId, name) },
        });
        focusAfter();
      },
    );
  }

  return (
    <>
      <Button
        size={size}
        className={size === "sm" ? TOUCH_TARGET : undefined}
        onClick={accept}
        loading={running === "accept"}
        loadingText="Aceitando…"
        disabled={running === "decline"}
      >
        <Check aria-hidden="true" />
        Aceitar
        <span className="sr-only">{srName("o convite de", personName)}</span>
      </Button>
      {allowDecline && (
        <Button
          size={size}
          variant="outline"
          className={size === "sm" ? TOUCH_TARGET : undefined}
          onClick={decline}
          loading={running === "decline"}
          loadingText="Recusando…"
          disabled={running === "accept"}
        >
          <X aria-hidden="true" />
          Recusar
          <span className="sr-only">{srName("o convite de", personName)}</span>
        </Button>
      )}
    </>
  );
}

/**
 * Convite enviado e ainda sem resposta: o MESMO padrão nas sugestões, no perfil e em Convites —
 * selo de estado + ação secundária "Cancelar". Cancelar é direto e oferece "Desfazer".
 */
export function PendingInvite({
  connectionId,
  profileId,
  personName,
  size = "sm",
  focusAfterId,
  onChange,
}: {
  connectionId: string;
  profileId: string;
  personName?: string | null;
  size?: Extract<ButtonSize, "sm" | "md">;
  focusAfterId?: string;
  /** Fora de listas (botão Conectar), o dono troca o estado com o resultado. */
  onChange?: (result: Extract<ConnectionResult, { ok: true }>) => void;
}) {
  const { run, running } = useListAction();
  const name = firstNameOf(personName);

  function cancel() {
    run(
      connectionId,
      "cancel",
      () => removeConnectionAction(connectionId),
      (result) => {
        if (failed(result)) return;
        onChange?.(result);
        toast({
          message: name ? `Convite para ${name} cancelado.` : "Convite cancelado.",
          tone: "info",
          action: {
            label: "Desfazer",
            onClick: async () => {
              const again = await safely(() =>
                sendConnectionAction(profileId, null, { revalidate: !onChange }),
              );
              if (failed(again)) return;
              if (again.ok) onChange?.(again);
              toast(name ? `Convite enviado de novo para ${name}.` : "Convite enviado de novo.");
            },
          },
        });
        handOffFocus(focusAfterId);
      },
    );
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-pill bg-surface-2 px-3 font-semibold text-fg-muted [&_svg]:size-4",
          size === "sm" ? "h-8 text-sm" : "h-10 text-[0.9375rem]",
        )}
      >
        <Clock aria-hidden="true" />
        Convite enviado
      </span>
      <Button
        size={size}
        variant="ghost"
        className={size === "sm" ? TOUCH_TARGET : undefined}
        onClick={cancel}
        loading={running === "cancel"}
        loadingText="Cancelando…"
      >
        Cancelar
        <span className="sr-only">{srName("o convite para", personName)}</span>
      </Button>
    </span>
  );
}

/** Apagar um convite recusado ou remover uma conexão (com confirmação: não dá para desfazer). */
export function RemoveConnectionButton({
  connectionId,
  personName,
  kind,
  focusAfterId,
}: {
  connectionId: string;
  personName?: string | null;
  kind: "delete-declined" | "connection";
  /** Elemento que recebe o foco quando o cartão sai da lista. */
  focusAfterId?: string;
}) {
  const { run } = useListAction();
  const name = firstNameOf(personName);
  const copy = {
    "delete-declined": {
      trigger: "Apagar",
      icon: <Trash2 aria-hidden="true" />,
      title: "Apagar este convite?",
      description: `Ele some da sua lista. ${name || "Ela"} não recebe aviso e poderá convidar você de novo.`,
      confirm: "Apagar convite",
      done: "Convite apagado.",
      sr: srName("o convite de", personName),
    },
    connection: {
      trigger: "Remover",
      icon: <UserMinus aria-hidden="true" />,
      title: name ? `Remover a conexão com ${name}?` : "Remover esta conexão?",
      description:
        "Ela não recebe aviso. Vocês continuam se seguindo — se quiser, deixe de seguir depois. Para voltar a ser conexões, uma de vocês manda um convite novo.",
      confirm: "Remover conexão",
      done: name ? `Conexão com ${name} removida.` : "Conexão removida.",
      sr: srName("a conexão com", personName),
    },
  }[kind];

  return (
    <ConfirmDialog
      trigger={
        <Button size="sm" variant="ghost" className={TOUCH_TARGET}>
          {copy.icon}
          {copy.trigger}
          {copy.sr && <span className="sr-only">{copy.sr}</span>}
        </Button>
      }
      title={copy.title}
      description={copy.description}
      confirmLabel={copy.confirm}
      pendingLabel="Aguarde…"
      cancelLabel="Voltar"
      // Fecha na hora: o cartão some (otimista) e volta, com um aviso, se a ação falhar.
      onConfirm={() =>
        run(
          connectionId,
          kind,
          () => removeConnectionAction(connectionId),
          (result) => {
            if (failed(result)) return;
            toast({ message: copy.done, tone: "info" });
            handOffFocus(focusAfterId);
          },
        )
      }
    />
  );
}
