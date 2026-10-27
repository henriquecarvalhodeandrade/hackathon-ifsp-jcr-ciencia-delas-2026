import type { Metadata } from "next";
import { Alert, ButtonLink, Card, Container, PageHeader } from "@/components/ui";
import { ConfirmSubscriptionForm } from "@/components/newsletter/token-forms";
import { CONFIRM_TOKEN_TTL_DAYS } from "@/lib/newsletter/constants";
import { lookupConfirmToken, type ConfirmLookup } from "@/lib/newsletter/subscriptions";
import { formatDate, pluralize } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Confirmar inscrição",
  // A página recebe um token na URL: fora dos buscadores e sem vazar o endereço por Referer.
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

type Lookup = ConfirmLookup | { state: "error" };

const COPY: Record<Lookup["state"], { title: string; description: string }> = {
  pending: {
    title: "Confirme sua inscrição",
    description: "Falta só um clique para receber o Boletim Delas toda segunda-feira.",
  },
  active: { title: "Inscrição confirmada", description: "Você já está na lista do Boletim Delas." },
  expired: {
    title: "Este link expirou",
    description: `Por segurança, os links de confirmação valem por ${pluralize(CONFIRM_TOKEN_TTL_DAYS, "dia")}.`,
  },
  unsubscribed: {
    title: "Esta inscrição foi cancelada",
    description: "O endereço deste link pediu para não receber mais o Boletim Delas.",
  },
  invalid: {
    title: "Link de confirmação inválido",
    description: "Não encontramos uma inscrição para este link.",
  },
  error: { title: "Não foi possível abrir este link", description: "Algo deu errado do nosso lado." },
};

export default async function ConfirmSubscriptionPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const raw = (await searchParams).token;
  const token = (Array.isArray(raw) ? raw[0] : raw)?.trim() ?? "";

  let lookup: Lookup;
  try {
    lookup = await lookupConfirmToken(token);
  } catch (error) {
    console.error("[newsletter] falha ao abrir o link de confirmação", error);
    lookup = { state: "error" };
  }
  const copy = COPY[lookup.state];

  return (
    <Container size="narrow" className="pb-16">
      <PageHeader eyebrow="Boletim Delas" title={copy.title} description={copy.description} />
      <Card padding="lg" className="grid gap-5">
        {lookup.state === "pending" && (
          <>
            <p className="text-fg">
              Vamos enviar o boletim para <strong className="font-semibold">{lookup.maskedEmail}</strong>. Confirme
              abaixo — pedimos este clique para ter certeza de que foi você quem se inscreveu.
            </p>
            <ConfirmSubscriptionForm token={token} />
          </>
        )}

        {lookup.state === "active" && (
          <>
            <Alert variant="success" title="Tudo certo por aqui">
              O Boletim Delas chega em <strong>{lookup.maskedEmail}</strong> toda segunda-feira
              {lookup.confirmedAt ? ` (inscrição confirmada em ${formatDate(lookup.confirmedAt)})` : ""}.
            </Alert>
            <div className="flex flex-wrap gap-3">
              <ButtonLink href="/newsletter">Ver edições anteriores</ButtonLink>
              <ButtonLink href="/papers" variant="outline">
                Explorar a Vitrine
              </ButtonLink>
            </div>
          </>
        )}

        {(lookup.state === "expired" || lookup.state === "unsubscribed" || lookup.state === "invalid") && (
          <>
            <p className="text-fg-muted">
              {lookup.state === "invalid"
                ? "Confira se você abriu o link completo do e-mail mais recente. Se pediu a inscrição mais de uma vez, vale o último e-mail."
                : "Se quiser receber o boletim, é só se inscrever de novo: enviamos um link novo na hora."}
            </p>
            <div>
              <ButtonLink href="/newsletter#assinar">Inscrever-me de novo</ButtonLink>
            </div>
          </>
        )}

        {lookup.state === "error" && (
          <Alert variant="danger" title="Tente de novo em alguns minutos">
            Não conseguimos verificar este link agora. Seu link continua valendo.
          </Alert>
        )}
      </Card>
    </Container>
  );
}
