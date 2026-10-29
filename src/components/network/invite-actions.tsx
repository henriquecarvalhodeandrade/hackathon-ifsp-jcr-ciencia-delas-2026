"use client";

import { useState, useTransition } from "react";
import { Check, Trash2, UserMinus, X } from "lucide-react";
import { Button, ConfirmDialog } from "@/components/ui";
import {
  removeConnectionAction,
  respondConnectionAction,
  type ConnectionResult,
} from "@/lib/network/actions";
import { firstNameOf, NETWORK_CONNECTION_ERROR } from "@/lib/network/presentation";
import { announceNetwork } from "./network-announcer";

/**
 * Ações das listas da /rede (convites e conexões). Cada uma chama a Server Action, que revalida
 * a /rede: a lista se atualiza sozinha. Erros aparecem junto dos botões (ou dentro do diálogo).
 */

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

/** Aceitar / Recusar um convite recebido (também serve para aceitar um que eu recusei). */
export function RespondInviteButtons({
  connectionId,
  personName,
  allowDecline = true,
  focusAfterId,
}: {
  connectionId: string;
  personName?: string | null;
  /** Para convites já recusados, só "Aceitar". */
  allowDecline?: boolean;
  /** Título que recebe o foco quando o cartão sai da lista. */
  focusAfterId?: string;
}) {
  const [running, setRunning] = useState<"accept" | "decline" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function respond(accept: boolean) {
    setError(null);
    setRunning(accept ? "accept" : "decline");
    startTransition(async () => {
      const result = await safely(() => respondConnectionAction(connectionId, accept));
      setRunning(null);
      if (result.ok) announceNetwork(result.message, focusAfterId);
      else setError(result.error);
    });
  }

  return (
    <>
      <Button
        size="sm"
        onClick={() => respond(true)}
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
          size="sm"
          variant="outline"
          onClick={() => respond(false)}
          loading={running === "decline"}
          loadingText="Recusando…"
          disabled={running === "accept"}
        >
          <X aria-hidden="true" />
          Recusar
          <span className="sr-only">{srName("o convite de", personName)}</span>
        </Button>
      )}
      <p aria-live="polite" className="w-full text-sm font-medium text-danger empty:hidden">
        {error ?? ""}
      </p>
    </>
  );
}

/** Cancelar um convite enviado, apagar um convite recusado ou remover uma conexão. */
export function RemoveConnectionButton({
  connectionId,
  personName,
  kind,
  focusAfterId,
}: {
  connectionId: string;
  personName?: string | null;
  kind: "cancel" | "delete-declined" | "connection";
  /** Título que recebe o foco quando o cartão sai da lista. */
  focusAfterId?: string;
}) {
  const name = firstNameOf(personName);
  const copy = {
    cancel: {
      trigger: "Cancelar convite",
      icon: <X aria-hidden="true" />,
      title: "Cancelar o convite?",
      description: `${name || "Ela"} não recebe aviso do cancelamento. Se quiser, você pode convidar de novo depois.`,
      confirm: "Cancelar convite",
      pending: "Cancelando…",
      sr: srName("para", personName),
    },
    "delete-declined": {
      trigger: "Apagar",
      icon: <Trash2 aria-hidden="true" />,
      title: "Apagar este convite?",
      description: `Ele some da sua lista. ${name || "Ela"} não recebe aviso e poderá convidar você de novo.`,
      confirm: "Apagar convite",
      pending: "Apagando…",
      sr: srName("o convite de", personName),
    },
    connection: {
      trigger: "Remover",
      icon: <UserMinus aria-hidden="true" />,
      title: name ? `Remover a conexão com ${name}?` : "Remover esta conexão?",
      description:
        "Ela não recebe aviso. Vocês continuam se seguindo — se quiser, deixe de seguir depois. Para voltar a ser conexões, uma de vocês manda um convite novo.",
      confirm: "Remover conexão",
      pending: "Removendo…",
      sr: srName("a conexão com", personName),
    },
  }[kind];

  return (
    <ConfirmDialog
      trigger={
        <Button size="sm" variant="ghost">
          {copy.icon}
          {copy.trigger}
          {copy.sr && <span className="sr-only">{copy.sr}</span>}
        </Button>
      }
      title={copy.title}
      description={copy.description}
      confirmLabel={copy.confirm}
      pendingLabel={copy.pending}
      cancelLabel="Voltar"
      onConfirm={async () => {
        const result = await safely(() => removeConnectionAction(connectionId));
        if (result.ok) announceNetwork(result.message, focusAfterId);
        return result;
      }}
    />
  );
}
