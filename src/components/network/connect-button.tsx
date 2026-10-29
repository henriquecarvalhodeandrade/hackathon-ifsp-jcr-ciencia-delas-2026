"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { Check, Clock, Quote, Send, UserMinus, UserPlus } from "lucide-react";
import {
  Button,
  Dialog,
  Field,
  FormMessage,
  SubmitButton,
  Textarea,
  toast,
  type ButtonProps,
  type ButtonSize,
} from "@/components/ui";
import {
  addInviteMessageAction,
  removeConnectionAction,
  respondConnectionAction,
  sendConnectionAction,
  type ConnectionResult,
} from "@/lib/network/actions";
import {
  CONNECTION_MESSAGE_MAX,
  firstNameOf,
  NETWORK_CONNECTION_ERROR,
} from "@/lib/network/presentation";
import { connectAcceptsExisting, type RelationshipState } from "@/lib/network/relationship";
import { cn } from "@/lib/utils";
import { ActionMenu } from "./action-menu";
import { PendingInvite, RespondInviteButtons, TOUCH_TARGET } from "./invite-actions";

export interface ConnectButtonProps {
  profileId: string;
  /** Estado visto por quem está logada (src/lib/network/relationship.ts). */
  state: RelationshipState;
  /**
   * Convite/conexão entre as duas. Com `state="none"`, indica um convite que EU recebi e recusei
   * antes: "Conectar" aceita o convite dela em vez de mandar outro.
   */
  connectionId?: string | null;
  /** Nome da pessoa (títulos dos diálogos, avisos e nome acessível dos botões em listas). */
  personName?: string | null;
  size?: Extract<ButtonSize, "sm" | "md">;
  /**
   * Listas (sugestões): "Conectar" envia o convite num toque, sem diálogo; o aviso oferece
   * "Adicionar recado". No perfil (padrão), o diálogo com recado vem antes.
   */
  oneTap?: boolean;
  /**
   * false = convidar não re-renderiza a página (listas da /rede: o cartão fica no lugar com o selo
   * "Convite enviado"). Respostas e remoções sempre atualizam. Padrão: true.
   */
  revalidate?: boolean;
  className?: string;
}

type Current = { state: RelationshipState; connectionId: string | null };
type Size = Extract<ButtonSize, "sm" | "md">;

async function safely(run: () => Promise<ConnectionResult>): Promise<ConnectionResult> {
  try {
    return await run();
  } catch {
    return { ok: false, error: NETWORK_CONNECTION_ERROR };
  }
}

function connectedMessage(name: string) {
  return name
    ? `${name} já tinha convidado você: agora vocês estão conectadas.`
    : "Ela já tinha convidado você: agora vocês estão conectadas.";
}

/**
 * Botão "Conectar" com os estados da conexão (docs/18 §2.1):
 * - **Conectar** → no perfil, diálogo com recado opcional (≤ 300); nas listas, um toque (o aviso
 *   oferece "Adicionar recado"). Se ela já tinha me convidado, conecta na hora;
 * - **Convite enviado** → selo + "Cancelar" (o recusado também aparece assim: a recusa nunca é
 *   contada a quem convidou);
 * - **Convite recebido** → Aceitar / Recusar;
 * - **Conectadas** → menu com "Remover conexão".
 * O resultado aparece num aviso (`toast`) e o foco segue para o controle do novo estado.
 */
export function ConnectButton({
  profileId,
  state,
  connectionId = null,
  personName,
  size = "md",
  oneTap = false,
  revalidate = true,
  className,
}: ConnectButtonProps) {
  const fromProps: Current = { state, connectionId: connectionId ?? null };
  const [current, setCurrent] = useState<Current>(fromProps);
  const [lastProps, setLastProps] = useState<Current>(fromProps);
  const [noteOpen, setNoteOpen] = useState(false);
  const wrapperRef = useRef<HTMLSpanElement>(null);
  // Estado + id: o convite de um toque passa por "enviado sem id" (selo) antes do id chegar.
  const stateKey = `${current.state}:${current.connectionId ?? ""}`;
  const previousKey = useRef(stateKey);

  // Dados novos do servidor (revalidação depois da ação) substituem o estado local.
  if (lastProps.state !== fromProps.state || lastProps.connectionId !== fromProps.connectionId) {
    setLastProps(fromProps);
    setCurrent(fromProps);
  }

  // O controle troca de forma a cada estado: se o foco estava nele (ou se perdeu), segue para o novo.
  useEffect(() => {
    if (previousKey.current === stateKey) return;
    previousKey.current = stateKey;
    const active = document.activeElement;
    if (!active || active === document.body || wrapperRef.current?.contains(active)) {
      wrapperRef.current?.querySelector<HTMLElement>("button:not([disabled])")?.focus();
    }
  }, [stateKey]);

  const name = firstNameOf(personName);

  function apply(result: Extract<ConnectionResult, { ok: true }>) {
    setCurrent({ state: result.state, connectionId: result.connectionId });
  }

  /** Depois de convidar: aviso com "Adicionar recado" (ou "conectadas", se ela já tinha convidado). */
  function invited(result: Extract<ConnectionResult, { ok: true }>, withNote: boolean) {
    apply(result);
    if (result.state === "connected") {
      toast(connectedMessage(name));
      return;
    }
    toast({
      message: name ? `Convite enviado para ${name}.` : "Convite enviado.",
      action:
        withNote && result.connectionId
          ? {
              label: "Adicionar recado",
              onClick: () => {
                // O foco volta para cá (e não para o aviso, que some) quando o diálogo fechar.
                wrapperRef.current?.querySelector<HTMLElement>("button")?.focus();
                setNoteOpen(true);
              },
            }
          : undefined,
    });
  }

  let control: React.ReactNode;
  if (current.state === "connected" && current.connectionId) {
    control = (
      <ConnectedMenu
        connectionId={current.connectionId}
        name={name}
        size={size}
        className={className}
        onDone={apply}
      />
    );
  } else if (current.state === "pending_received" && current.connectionId) {
    control = (
      <RespondInviteButtons
        connectionId={current.connectionId}
        personName={personName}
        size={size}
      />
    );
  } else if (current.state === "pending_sent" && current.connectionId) {
    control = (
      <PendingInvite
        connectionId={current.connectionId}
        profileId={profileId}
        personName={personName}
        size={size}
        onChange={apply}
      />
    );
  } else if (current.state === "pending_sent") {
    // Convite de um toque a caminho (otimista): o selo aparece antes da resposta do servidor.
    control = <SendingChip size={size} />;
  } else if (current.state === "none" && connectAcceptsExisting(current)) {
    control = (
      <AcceptDeclinedButton
        connectionId={current.connectionId!}
        name={name}
        size={size}
        className={className}
        onDone={apply}
      />
    );
  } else if (oneTap) {
    control = (
      <OneTapConnect
        profileId={profileId}
        name={name}
        size={size}
        revalidate={revalidate}
        className={className}
        onSending={() => setCurrent({ state: "pending_sent", connectionId: null })}
        onDone={(result) => {
          if (result.ok) invited(result, true);
          else {
            setCurrent({ state: "none", connectionId: null });
            toast({ message: result.error, tone: "danger" });
          }
        }}
      />
    );
  } else {
    control = (
      <InviteDialog
        profileId={profileId}
        revalidate={revalidate}
        name={name}
        size={size}
        className={className}
        onDone={(result) => invited(result, false)}
      />
    );
  }

  return (
    <span ref={wrapperRef} className="contents">
      {control}
      {current.state === "pending_sent" && current.connectionId && (
        <NoteDialog
          open={noteOpen}
          onOpenChange={setNoteOpen}
          connectionId={current.connectionId}
          name={name}
          revalidate={revalidate}
          onDone={(result) => {
            apply(result);
            toast(
              result.state === "connected"
                ? connectedMessage(name)
                : name
                  ? `Recado enviado para ${name}.`
                  : "Recado enviado.",
            );
          }}
        />
      )}
    </span>
  );
}

function SendingChip({ size }: { size: Size }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-pill bg-surface-2 px-3 font-semibold text-fg-muted [&_svg]:size-4",
        size === "sm" ? "h-8 text-sm" : "h-10 text-[0.9375rem]",
      )}
    >
      <Clock aria-hidden="true" />
      Convite enviado
    </span>
  );
}

// ---------------------------------------------------------------------------
// Conectar num toque (listas)
// ---------------------------------------------------------------------------

function OneTapConnect({
  profileId,
  name,
  size,
  revalidate,
  className,
  onSending,
  onDone,
}: {
  profileId: string;
  name: string;
  size: Size;
  revalidate: boolean;
  className?: string;
  onSending: () => void;
  onDone: (result: ConnectionResult) => void;
}) {
  const [, startTransition] = useTransition();
  return (
    <Button
      size={size}
      className={cn(size === "sm" && TOUCH_TARGET, className)}
      onClick={() => {
        onSending();
        startTransition(async () => {
          const result = await safely(() => sendConnectionAction(profileId, null, { revalidate }));
          onDone(result);
        });
      }}
    >
      <UserPlus aria-hidden="true" />
      Conectar
      {name && <span className="sr-only"> com {name}</span>}
    </Button>
  );
}

// ---------------------------------------------------------------------------
// Conectar (com recado opcional) — perfil
// ---------------------------------------------------------------------------

type NoteFormState = { error: string; message: string; nonce: number } | null;

/** Campo do recado, com o texto de volta depois de um erro. */
function NoteField({ state }: { state: NoteFormState }) {
  return (
    <div className="grid gap-3">
      <FormMessage tone="error">{state?.error}</FormMessage>
      <Field
        label="Recado"
        optional
        hint="Conte de onde vocês se conhecem ou por que você quer se conectar."
      >
        <Textarea
          key={state?.nonce ?? "novo"}
          name="message"
          rows={4}
          maxLength={CONNECTION_MESSAGE_MAX}
          showCount
          defaultValue={state?.message ?? ""}
          data-autofocus
        />
      </Field>
    </div>
  );
}

/** useActionState de um diálogo de recado: devolve o erro (com o texto) ou fecha no sucesso. */
function useNoteForm(
  send: (message: string) => Promise<ConnectionResult>,
  onSuccess: (result: Extract<ConnectionResult, { ok: true }>) => void,
) {
  const [stale, setStale] = useState<NoteFormState>(null);
  const [state, action] = useActionState<NoteFormState, FormData>(async (_prev, formData) => {
    const raw = formData.get("message");
    const message = typeof raw === "string" ? raw : "";
    const result = await safely(() => send(message));
    if (!result.ok) return { error: result.error, message, nonce: Date.now() };
    // Depois de fechar (o foco volta ao botão), troca o botão pelo do novo estado.
    requestAnimationFrame(() => onSuccess(result));
    return null;
  }, null);
  // Erro de uma abertura anterior não reaparece quando o diálogo abre de novo.
  return { state: state !== stale ? state : null, action, markStale: () => setStale(state) };
}

function InviteDialog({
  profileId,
  revalidate,
  name,
  size,
  className,
  onDone,
}: {
  profileId: string;
  revalidate: boolean;
  name: string;
  size: Size;
  className?: string;
  onDone: (result: Extract<ConnectionResult, { ok: true }>) => void;
}) {
  const [open, setOpen] = useState(false);
  const form = useNoteForm(async (message) => {
    const result = await sendConnectionAction(profileId, message, { revalidate });
    if (result.ok) setOpen(false);
    return result;
  }, onDone);

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (value) form.markStale();
        setOpen(value);
      }}
      size="md"
      title={name ? `Conectar com ${name}` : "Enviar convite de conexão"}
      description={`Se ${name || "ela"} aceitar, vocês viram conexões e passam a se seguir: as publicações de uma aparecem no feed da outra.`}
      formProps={{ action: form.action, noValidate: true }}
      trigger={
        <Button size={size} className={className}>
          <UserPlus aria-hidden="true" />
          Conectar
          {name && <span className="sr-only"> com {name}</span>}
        </Button>
      }
      footer={
        <>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <SubmitButton pendingText="Enviando…">
            <Send aria-hidden="true" />
            Enviar convite
          </SubmitButton>
        </>
      }
    >
      <NoteField state={form.state} />
    </Dialog>
  );
}

/** "Adicionar recado" a um convite já enviado (aberto pelo aviso do convite de um toque). */
function NoteDialog({
  open,
  onOpenChange,
  connectionId,
  name,
  revalidate,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connectionId: string;
  name: string;
  revalidate: boolean;
  onDone: (result: Extract<ConnectionResult, { ok: true }>) => void;
}) {
  const form = useNoteForm(async (message) => {
    const result = await addInviteMessageAction(connectionId, message, { revalidate });
    if (result.ok) onOpenChange(false);
    return result;
  }, onDone);
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (value) form.markStale();
        onOpenChange(value);
      }}
      size="md"
      title={name ? `Recado para ${name}` : "Adicionar recado"}
      description="O convite é reenviado com o recado — ela recebe um único aviso."
      formProps={{ action: form.action, noValidate: true }}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Agora não
          </Button>
          <SubmitButton pendingText="Enviando…">
            <Send aria-hidden="true" />
            Enviar recado
          </SubmitButton>
        </>
      }
    >
      <NoteField state={form.state} />
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// "Conectar" de um convite recebido que eu tinha recusado: aceita o convite dela.
// ---------------------------------------------------------------------------

function AcceptDeclinedButton({
  connectionId,
  name,
  size,
  className,
  onDone,
}: {
  connectionId: string;
  name: string;
  size: Size;
  className?: string;
  onDone: (result: Extract<ConnectionResult, { ok: true }>) => void;
}) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = await safely(() => respondConnectionAction(connectionId, true));
      if (!result.ok) {
        toast({ message: result.error, tone: "danger" });
        return;
      }
      onDone(result);
      toast(name ? `Agora você e ${name} estão conectadas.` : result.message);
    });
  }

  return (
    <Button
      size={size}
      className={cn(size === "sm" && TOUCH_TARGET, className)}
      onClick={handleClick}
      loading={isPending}
      loadingText="Conectando…"
    >
      <UserPlus aria-hidden="true" />
      Conectar
      {name && <span className="sr-only"> com {name}</span>}
    </Button>
  );
}

/** Recado do convite, citado. */
export function InviteQuote({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <figure className="grid gap-1.5 rounded-control bg-surface-2 p-3.5">
      <figcaption className="flex items-center gap-1.5 text-xs font-bold tracking-wide text-fg-subtle uppercase">
        <Quote aria-hidden="true" className="size-3.5" />
        {label}
      </figcaption>
      <blockquote className="text-[0.9375rem] break-words whitespace-pre-line text-fg">
        {children}
      </blockquote>
    </figure>
  );
}

// ---------------------------------------------------------------------------
// Conectadas → menu "Remover conexão"
// ---------------------------------------------------------------------------

function ConnectedMenu({
  connectionId,
  name,
  size,
  className,
  onDone,
}: {
  connectionId: string;
  name: string;
  size: Size;
  className?: string;
  onDone: (result: Extract<ConnectionResult, { ok: true }>) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function remove() {
    setError(null);
    startTransition(async () => {
      const result = await safely(() => removeConnectionAction(connectionId));
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setConfirming(false);
      requestAnimationFrame(() => onDone(result));
      toast({
        message: name ? `Conexão com ${name} removida.` : "Conexão removida.",
        tone: "info",
      });
    });
  }

  return (
    <>
      <ActionMenu
        size={size}
        variant="outline"
        className={cn(size === "sm" && TOUCH_TARGET, className)}
        srSuffix={name ? ` com ${name}: opções da conexão` : ": opções da conexão"}
        items={[
          {
            label: "Remover conexão",
            icon: <UserMinus aria-hidden="true" />,
            tone: "danger",
            onSelect: () => {
              setError(null);
              setConfirming(true);
            },
          },
        ]}
      >
        <Check aria-hidden="true" />
        Conectadas
      </ActionMenu>
      <Dialog
        open={confirming}
        onOpenChange={setConfirming}
        size="sm"
        title={name ? `Remover a conexão com ${name}?` : "Remover esta conexão?"}
        description="Ela não recebe aviso. Vocês continuam se seguindo — se quiser, deixe de seguir depois. Para voltar a ser conexões, uma de vocês manda um convite novo."
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirming(false)} disabled={isPending}>
              Voltar
            </Button>
            <Button
              variant={"danger" satisfies ButtonProps["variant"]}
              onClick={remove}
              loading={isPending}
              loadingText="Removendo…"
            >
              Remover conexão
            </Button>
          </>
        }
      >
        <FormMessage tone="error">{error}</FormMessage>
      </Dialog>
    </>
  );
}
