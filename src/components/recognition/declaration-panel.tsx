import { Clock3, FileCheck2, FileText, Hourglass, ShieldOff } from "lucide-react";
import { Badge, ButtonLink } from "@/components/ui";
import type { ReturnTo } from "@/lib/recognition/schemas";
import type { DeclarationView } from "@/lib/recognition/state";
import { formatDate, toIsoString } from "@/lib/utils";
import {
  DeclarationConsentForm,
  DeclarationRequestForm,
  RevokeDeclarationDialog,
} from "./declaration-forms";

export function declarationHref(declarationId: string): string {
  return `/mentoria/declaracao/${declarationId}`;
}

function When({ date }: { date: string }) {
  return (
    <time dateTime={toIsoString(date)} className="whitespace-nowrap">
      {formatDate(date, { day: "numeric", month: "long", year: "numeric" })}
    </time>
  );
}

/**
 * Declaração de participação de UMA mentoria concluída, em cada estado: nenhuma (pedir),
 * pedida pela outra (autorizar e emitir), esperando a outra, emitida (código, ver, revogar) e
 * revogada/cancelada (pedir uma nova). Usado no cartão de /mentoria?aba=ativas e em
 * /mentoria/concluida/[id] (`returnTo` diz para onde a ação volta).
 */
export function DeclarationPanel({
  requestId,
  otherFirstName,
  declaration,
  returnTo,
}: {
  requestId: string;
  otherFirstName: string;
  declaration: DeclarationView | null;
  returnTo: ReturnTo;
}) {
  if (!declaration) {
    return (
      <div className="grid gap-3">
        <p className="text-sm text-fg-muted">
          Um registro verificável da mentoria de vocês, com QR code, para citar no currículo ou em
          relatórios. Só fica público depois que vocês duas autorizarem.
        </p>
        <DeclarationRequestForm
          requestId={requestId}
          otherFirstName={otherFirstName}
          returnTo={returnTo}
        />
      </div>
    );
  }

  switch (declaration.status) {
    case "awaiting-me":
      return (
        <div className="grid gap-3">
          <p className="flex items-start gap-2 text-sm font-medium text-fg">
            <Hourglass aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
            <span>
              {otherFirstName} pediu a declaração desta mentoria. Autorize seu nome para emiti-la.
            </span>
          </p>
          <DeclarationConsentForm
            requestId={requestId}
            declarationId={declaration.id}
            otherFirstName={otherFirstName}
            returnTo={returnTo}
          />
          <div>
            <RevokeDeclarationDialog
              requestId={requestId}
              declarationId={declaration.id}
              otherFirstName={otherFirstName}
              returnTo={returnTo}
              mode="decline"
            />
          </div>
        </div>
      );

    case "awaiting-other":
      return (
        <div className="grid gap-3">
          <p className="flex items-start gap-2 text-sm text-fg">
            <Clock3 aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
            <span>
              <strong className="font-semibold">
                Aguardando a autorização de {otherFirstName}
              </strong>
              . A sua já está registrada; nenhum nome aparece em público antes disso.
            </span>
          </p>
          <div>
            <RevokeDeclarationDialog
              requestId={requestId}
              declarationId={declaration.id}
              otherFirstName={otherFirstName}
              returnTo={returnTo}
              mode="cancel"
            />
          </div>
        </div>
      );

    case "issued":
      return (
        <div className="grid gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="success" size="md">
              <FileCheck2 aria-hidden="true" />
              Emitida
            </Badge>
            {declaration.issuedAt && (
              <span className="text-sm text-fg-muted">
                em <When date={declaration.issuedAt} />
              </span>
            )}
          </div>
          <p className="grid gap-0.5">
            <span className="text-xs font-bold tracking-wide text-fg-subtle uppercase">
              Código de verificação
            </span>
            <span className="font-mono text-base font-semibold tracking-wide break-all text-fg">
              {declaration.code}
            </span>
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <ButtonLink href={declarationHref(declaration.id)} size="sm">
              <FileText aria-hidden="true" />
              Ver declaração
            </ButtonLink>
            <RevokeDeclarationDialog
              requestId={requestId}
              declarationId={declaration.id}
              otherFirstName={otherFirstName}
              returnTo={returnTo}
              mode="revoke"
            />
          </div>
        </div>
      );

    case "revoked":
    case "cancelled": {
      const by = declaration.revokedByMe ? "por você" : `por ${otherFirstName}`;
      return (
        <div className="grid gap-3">
          <p className="flex items-start gap-2 text-sm text-fg">
            <ShieldOff aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-fg-subtle" />
            <span>
              {declaration.status === "revoked" ? "Revogada" : "Pedido cancelado"}
              {declaration.revokedAt && (
                <>
                  {" "}
                  em <When date={declaration.revokedAt} />
                </>
              )}{" "}
              {by}.
              {declaration.revokeReason && (
                <span className="mt-1 block text-fg-muted">Motivo: {declaration.revokeReason}</span>
              )}
            </span>
          </p>
          <DeclarationRequestForm
            requestId={requestId}
            otherFirstName={otherFirstName}
            returnTo={returnTo}
            label="Pedir uma nova"
          />
        </div>
      );
    }
  }
}
