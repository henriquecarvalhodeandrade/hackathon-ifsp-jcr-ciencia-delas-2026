"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { Check, Clock, MailOpen, Quote, Send, UserMinus, UserPlus, X } from "lucide-react";
import {
  Button,
  Dialog,
  Field,
  FormMessage,
  SubmitButton,
  Textarea,
  type ButtonProps,
  type ButtonSize,
} from "@/components/ui";
import {
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

export interface ConnectButtonProps {
  profileId: string;
  /** Estado visto por quem está logada (src/lib/network/relationship.ts). */
  state: RelationshipState;
  /**
   * Convite/conexão entre as duas. Com `state="none"`, indica um convite que EU recebi e recusei
   * antes: "Conectar" aceita o convite dela em vez de mandar outro.
   */
  connectionId?: string | null;
  /** Nome da pessoa (títulos dos diálogos e nome acessível dos botões em listas). */
  personName?: string | null;
  /** Recado do convite recebido, mostrado ao responder. */
  inviteMessage?: string | null;
  size?: Extract<ButtonSize, "sm" | "md">;
  /**
   * false = enviar o convite não re-renderiza a página (listas da /rede: o cartão fica no lugar com
   * "Convite enviado"). Respostas e remoções sempre atualizam. Padrão: true.
   */
  revalidate?: boolean;
  className?: string;
}

type Current = { state: RelationshipState; connectionId: string | null };

/**
 * Botão "Conectar" com os quatro estados da conexão (docs/18 §2.1):
 * - **Conectar** → diálogo com recado opcional (≤ 300); se ela já tinha me convidado, conecta na hora;
 * - **Convite enviado** → cancelar (o convite recusado também aparece assim: a recusa nunca é contada);
 * - **Responder convite** → Aceitar / Recusar;
 * - **Conectadas** → menu com "Remover conexão".
 * Cada ação relê o estado no servidor; o resultado é anunciado numa região `aria-live` e o foco
 * vai para o botão novo.
 */
export function ConnectButton({
  profileId,
  state,
  connectionId = null,
  personName,
  inviteMessage = null,
  size = "md",
  revalidate = true,
  className,
}: ConnectButtonProps) {
  const fromProps: Current = { state, connectionId: connectionId ?? null };
  const [current, setCurrent] = useState<Current>(fromProps);
  const [lastProps, setLastProps] = useState<Current>(fromProps);
  const [announcement, setAnnouncement] = useState("");
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const previousState = useRef(current.state);

  // Dados novos do servidor (revalidação depois da ação) substituem o estado local.
  if (lastProps.state !== fromProps.state || lastProps.connectionId !== fromProps.connectionId) {
    setLastProps(fromProps);
    setCurrent(fromProps);
  }

  // O botão troca de forma a cada estado: se o foco estava nele (ou se perdeu), segue para o novo.
  useEffect(() => {
    if (previousState.current === current.state) return;
    previousState.current = current.state;
    const active = document.activeElement;
    if (!active || active === document.body || wrapperRef.current?.contains(active)) {
      wrapperRef.current?.querySelector<HTMLElement>("button")?.focus();
    }
  }, [current.state]);

  const name = firstNameOf(personName);
  const her = name || "ela";

  function apply(result: ConnectionResult) {
    if (!result.ok) return;
    setCurrent({ state: result.state, connectionId: result.connectionId });
    setAnnouncement(result.message);
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
      <RespondDialog
        connectionId={current.connectionId}
        name={name}
        message={inviteMessage}
        size={size}
        className={className}
        onDone={apply}
      />
    );
  } else if (current.state === "pending_sent" && current.connectionId) {
    control = (
      <ConfirmActionDialog
        title="Cancelar o convite?"
        description={`${name ? `${name} não` : "Ela não"} recebe aviso do cancelamento. Se quiser, você pode convidar de novo depois.`}
        trigger={
          <Button variant="outline" size={size} className={className}>
            <Clock aria-hidden="true" />
            Convite enviado
            <span className="sr-only">{name ? ` para ${name}` : ""}: cancelar convite</span>
          </Button>
        }
        actions={[
          {
            label: "Cancelar convite",
            pendingLabel: "Cancelando…",
            variant: "danger",
            run: () => removeConnectionAction(current.connectionId!),
          },
        ]}
        cancelLabel="Voltar"
        onDone={apply}
      />
    );
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
  } else {
    control = (
      <InviteDialog
        profileId={profileId}
        revalidate={revalidate}
        name={name}
        her={her}
        size={size}
        className={className}
        onDone={apply}
      />
    );
  }

  return (
    <span ref={wrapperRef} className="contents">
      {control}
      <span aria-live="polite" className="sr-only">
        {announcement}
      </span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Conectar (com recado opcional)
// ---------------------------------------------------------------------------

type InviteFormState = { error: string; message: string; nonce: number } | null;

function InviteDialog({
  profileId,
  revalidate,
  name,
  her,
  size,
  className,
  onDone,
}: {
  profileId: string;
  revalidate: boolean;
  name: string;
  her: string;
  size: Extract<ButtonSize, "sm" | "md">;
  className?: string;
  onDone: (result: ConnectionResult) => void;
}) {
  const [open, setOpen] = useState(false);
  // Erro de uma abertura anterior não reaparece quando o diálogo abre de novo.
  const [staleState, setStaleState] = useState<InviteFormState>(null);
  const [formState, formAction] = useActionState<InviteFormState, FormData>(
    async (_prev, formData) => {
      const message =
        typeof formData.get("message") === "string" ? String(formData.get("message")) : "";
      let result: ConnectionResult;
      try {
        result = await sendConnectionAction(profileId, message, { revalidate });
      } catch {
        result = { ok: false, error: NETWORK_CONNECTION_ERROR };
      }
      if (!result.ok) return { error: result.error, message, nonce: Date.now() };
      setOpen(false);
      // Depois de fechar (o foco volta ao botão), troca o botão pelo do novo estado.
      requestAnimationFrame(() => onDone(result));
      return null;
    },
    null,
  );
  const visibleState = formState !== staleState ? formState : null;

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (value) setStaleState(formState);
        setOpen(value);
      }}
      size="md"
      title={name ? `Conectar com ${name}` : "Enviar convite de conexão"}
      description={`Se ${her} aceitar, vocês viram conexões e passam a se seguir: as publicações de uma aparecem no feed da outra.`}
      formProps={{ action: formAction, noValidate: true }}
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
      <div className="grid gap-3">
        <FormMessage tone="error">{visibleState?.error}</FormMessage>
        <Field
          label="Recado"
          optional
          hint="Conte de onde vocês se conhecem ou por que você quer se conectar."
        >
          <Textarea
            key={visibleState?.nonce ?? "novo"}
            name="message"
            rows={4}
            maxLength={CONNECTION_MESSAGE_MAX}
            showCount
            defaultValue={visibleState?.message ?? ""}
            data-autofocus
          />
        </Field>
      </div>
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
  size: Extract<ButtonSize, "sm" | "md">;
  className?: string;
  onDone: (result: ConnectionResult) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    setError(null);
    startTransition(async () => {
      let result: ConnectionResult;
      try {
        result = await respondConnectionAction(connectionId, true);
      } catch {
        result = { ok: false, error: NETWORK_CONNECTION_ERROR };
      }
      if (result.ok) onDone(result);
      else setError(result.error);
    });
  }

  return (
    <span className="relative inline-flex">
      <Button
        size={size}
        className={className}
        onClick={handleClick}
        loading={isPending}
        loadingText="Conectando…"
      >
        <UserPlus aria-hidden="true" />
        Conectar
        {name && <span className="sr-only"> com {name}</span>}
      </Button>
      <span aria-live="polite" className="sr-only">
        {error ?? ""}
      </span>
      {error && (
        <span
          aria-hidden="true"
          className="absolute top-full left-0 z-20 mt-1 w-60 rounded-control border border-danger/30 bg-danger-soft px-3 py-2 text-xs font-medium text-danger-soft-fg shadow-overlay"
        >
          {error}
        </span>
      )}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Responder convite (Aceitar / Recusar)
// ---------------------------------------------------------------------------

function RespondDialog({
  connectionId,
  name,
  message,
  size,
  className,
  onDone,
}: {
  connectionId: string;
  name: string;
  message: string | null;
  size: Extract<ButtonSize, "sm" | "md">;
  className?: string;
  onDone: (result: ConnectionResult) => void;
}) {
  return (
    <ConfirmActionDialog
      title={name ? `Convite de ${name}` : "Convite de conexão"}
      description="Aceitando, vocês viram conexões e passam a se seguir. Se recusar, ela não recebe aviso — e você pode aceitar depois."
      trigger={
        <Button size={size} className={className}>
          <MailOpen aria-hidden="true" />
          Responder convite
          {name && <span className="sr-only"> de {name}</span>}
        </Button>
      }
      actions={[
        {
          label: "Recusar",
          pendingLabel: "Recusando…",
          variant: "outline",
          icon: <X aria-hidden="true" />,
          run: () => respondConnectionAction(connectionId, false),
        },
        {
          label: "Aceitar convite",
          pendingLabel: "Aceitando…",
          variant: "primary",
          icon: <Check aria-hidden="true" />,
          run: () => respondConnectionAction(connectionId, true),
        },
      ]}
      cancelLabel={null}
      onDone={onDone}
    >
      {message ? (
        <InviteQuote label={name ? `Recado de ${name}` : "Recado"}>{message}</InviteQuote>
      ) : (
        <p className="text-[0.9375rem] text-fg-muted">
          {name || "Ela"} não deixou recado. Dê uma olhada no perfil antes de responder.
        </p>
      )}
    </ConfirmActionDialog>
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
  size: Extract<ButtonSize, "sm" | "md">;
  className?: string;
  onDone: (result: ConnectionResult) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  return (
    <>
      <ActionMenu
        size={size}
        variant="outline"
        className={cn(
          "border-secondary/40 bg-secondary-soft text-secondary-soft-fg hover:border-secondary hover:bg-secondary-soft",
          className,
        )}
        srSuffix={name ? ` com ${name}: opções da conexão` : ": opções da conexão"}
        items={[
          {
            label: "Remover conexão",
            icon: <UserMinus aria-hidden="true" />,
            tone: "danger",
            onSelect: () => setConfirming(true),
          },
        ]}
      >
        <Check aria-hidden="true" />
        Conectadas
      </ActionMenu>
      <ConfirmActionDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={name ? `Remover a conexão com ${name}?` : "Remover esta conexão?"}
        description="Ela não recebe aviso. Vocês continuam se seguindo — se quiser, deixe de seguir depois. Para voltar a ser conexões, uma de vocês manda um convite novo."
        actions={[
          {
            label: "Remover conexão",
            pendingLabel: "Removendo…",
            variant: "danger",
            run: () => removeConnectionAction(connectionId),
          },
        ]}
        cancelLabel="Voltar"
        onDone={onDone}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Diálogo de confirmação com uma ou mais ações assíncronas
// ---------------------------------------------------------------------------

interface ConfirmAction {
  label: string;
  pendingLabel: string;
  variant: ButtonProps["variant"];
  icon?: React.ReactNode;
  run: () => Promise<ConnectionResult>;
}

/**
 * Como o `ConfirmDialog`, mas com várias ações (Aceitar / Recusar) que chamam Server Actions
 * direto e pode ser aberto por fora (`open`). Erro `{ ok: false }` aparece dentro do diálogo, que
 * continua aberto; no sucesso ele fecha (o foco volta ao gatilho) e só então o botão troca.
 */
function ConfirmActionDialog({
  title,
  description,
  trigger,
  open: openProp,
  onOpenChange,
  actions,
  cancelLabel,
  onDone,
  children,
}: {
  title: string;
  description: string;
  trigger?: React.ReactElement;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  actions: readonly ConfirmAction[];
  /** Botão "Voltar" (null = sem botão; o diálogo fecha pelo X e com Esc). */
  cancelLabel: string | null;
  onDone: (result: ConnectionResult) => void;
  children?: React.ReactNode;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = openProp ?? internalOpen;
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function setOpen(value: boolean) {
    if (value) setError(null);
    if (openProp === undefined) setInternalOpen(value);
    onOpenChange?.(value);
  }

  function handle(action: ConfirmAction) {
    setError(null);
    setRunning(action.label);
    startTransition(async () => {
      let result: ConnectionResult;
      try {
        result = await action.run();
      } catch {
        result = { ok: false, error: NETWORK_CONNECTION_ERROR };
      }
      setRunning(null);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOpen(false);
      requestAnimationFrame(() => onDone(result));
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      size="sm"
      title={title}
      description={description}
      trigger={trigger}
      footer={
        <>
          {cancelLabel && (
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={running !== null}>
              {cancelLabel}
            </Button>
          )}
          {actions.map((action) => (
            <Button
              key={action.label}
              variant={action.variant}
              onClick={() => handle(action)}
              loading={running === action.label}
              loadingText={action.pendingLabel}
              disabled={running !== null && running !== action.label}
            >
              {action.icon}
              {action.label}
            </Button>
          ))}
        </>
      }
    >
      <div className="grid gap-3">
        {children}
        <FormMessage tone="error">{error}</FormMessage>
      </div>
    </Dialog>
  );
}
