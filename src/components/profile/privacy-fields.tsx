import Link from "next/link";
import { Sparkles } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { AI_CONSENT_TEXT, AI_CONSENT_TITLE, AI_MATCHING_EXPLAINER } from "@/lib/profile/consent";
import type { SectionFieldsProps } from "./about-fields";

/** Seção 4 — Privacidade e IA: explicação + consentimento opcional (texto de docs/04 §6.4). */
export function PrivacyFields({ values }: SectionFieldsProps) {
  return (
    <div className="grid gap-5">
      <div className="grid gap-3 rounded-card bg-surface-2 p-4 sm:p-5">
        <p className="flex items-center gap-2 font-display font-semibold text-fg">
          <Sparkles aria-hidden="true" className="size-4 text-primary" />
          Como a IA ajuda na mentoria
        </p>
        <ul className="grid list-disc gap-1.5 pl-5 text-sm text-fg-muted marker:text-primary">
          {AI_MATCHING_EXPLAINER.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>

      <div className="rounded-card border border-border-strong p-4 sm:p-5">
        <Checkbox
          name="ai_consent"
          defaultChecked={values.ai_consent}
          label={AI_CONSENT_TITLE}
          description={AI_CONSENT_TEXT}
        />
      </div>

      <p className="text-sm text-fg-muted">
        Sem essa autorização, nenhum dado seu é enviado a serviços de IA. Você continua usando o
        fórum, a vitrine e o diretório de pesquisadoras normalmente — e pode pedir mentoria
        diretamente a quem quiser. Saiba mais em{" "}
        <Link
          href="/privacidade"
          className="font-semibold text-primary underline underline-offset-2"
        >
          Privacidade
        </Link>
        .
      </p>

      <Alert variant="info" title="Tem menos de 18 anos?">
        Não marque a caixa acima. Todo o restante da plataforma funciona normalmente para você.
      </Alert>
    </div>
  );
}
