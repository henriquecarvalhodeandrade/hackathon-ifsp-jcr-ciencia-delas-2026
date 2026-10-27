import { Inbox } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { localMailboxUrl } from "@/lib/profile/auth-config";

/**
 * Aviso só para desenvolvimento local: com o Supabase em Docker, os e-mails de
 * autenticação não saem da máquina — ficam no Mailpit.
 */
export function LocalMailboxNotice() {
  const url = localMailboxUrl();
  if (!url) return null;
  return (
    <Alert variant="info" icon={<Inbox aria-hidden="true" />} title="Ambiente de desenvolvimento">
      Os e-mails de acesso ficam no Mailpit:{" "}
      <a href={url} target="_blank" rel="noreferrer" className="font-semibold underline underline-offset-2">
        {url.replace(/^https?:\/\//, "")}
        <span className="sr-only"> (abre em nova aba)</span>
      </a>
      . O link do e-mail aponta para o endereço do <code className="font-mono text-sm">NEXT_PUBLIC_SITE_URL</code>.
    </Alert>
  );
}
