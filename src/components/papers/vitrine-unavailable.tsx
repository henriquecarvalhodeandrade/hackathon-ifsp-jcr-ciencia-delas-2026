import { DatabaseZap } from "lucide-react";
import { EmptyState } from "@/components/ui";

/** Estado amigável quando o Supabase não está configurado (ambiente sem .env.local). */
export function VitrineUnavailable() {
  return (
    <EmptyState
      icon={<DatabaseZap />}
      title="A Vitrine ainda não está conectada ao banco"
      description="Configure as variáveis do Supabase (veja docs/07-setup-e-deploy.md) para ver os papers e o ranking."
    />
  );
}
