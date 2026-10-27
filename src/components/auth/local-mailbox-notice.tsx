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
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="font-semibold underline underline-offset-2"
      >
        {url.replace(/^https?:\/\//, "")}
        <span className="sr-only"> (abre em nova aba)</span>
      </a>
      . O link do e-mail usa o <code className="font-mono text-sm">site_url</code> de{" "}
      <code className="font-mono text-sm">supabase/config.toml</code> (porta 3000) — se o app
      estiver em outra porta, troque-a no link.
    </Alert>
  );
}
