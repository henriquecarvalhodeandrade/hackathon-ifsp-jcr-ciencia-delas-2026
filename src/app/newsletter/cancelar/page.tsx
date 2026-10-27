import type { Metadata } from "next";
import { Alert, ButtonLink, Card, Container, PageHeader } from "@/components/ui";
import { UnsubscribeForms } from "@/components/newsletter/token-forms";
import { lookupUnsubscribeToken, type UnsubscribeLookup } from "@/lib/newsletter/subscriptions";

export const metadata: Metadata = {
  title: "Cancelar inscrição",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

type SearchParams = {
  token?: string | string[];
  excluido?: string | string[];
  erro?: string | string[];
};

const first = (value: string | string[] | undefined) =>
  (Array.isArray(value) ? value[0] : value)?.trim() ?? "";

/**
 * Descadastro. O GET NUNCA descadastra (antivírus e pré-visualizações abrem links de e-mail):
 * a pessoa clica no botão (POST via Server Action). O "one-click" dos provedores usa
 * POST /api/newsletter/unsubscribe (RFC 8058).
 */
export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const token = first(params.token);

  if (first(params.excluido) === "1") {
    return (
      <Container size="narrow" className="pb-16">
        <PageHeader
          eyebrow="Boletim Delas"
          title="Seus dados foram excluídos"
          description="Apagamos o seu e-mail, as áreas de interesse, o registro do consentimento e o histórico de envios."
        />
        <Card padding="lg" className="grid gap-4">
          <p className="text-fg-muted">
            Obrigada por ter acompanhado o boletim. As edições continuam abertas no site para quando
            quiser ler.
          </p>
          <div className="flex flex-wrap gap-3">
            <ButtonLink href="/newsletter">Ver as edições</ButtonLink>
            <ButtonLink href="/" variant="outline">
              Ir para o início
            </ButtonLink>
          </div>
        </Card>
      </Container>
    );
  }

  const deleteError = first(params.erro);

  let lookup: UnsubscribeLookup | { state: "error" } = { state: "invalid" };
  if (token) {
    try {
      lookup = await lookupUnsubscribeToken(token);
    } catch (error) {
      console.error("[newsletter] falha ao abrir o link de descadastro", error);
      lookup = { state: "error" };
    }
  }

  const title =
    lookup.state === "unsubscribed"
      ? "Inscrição cancelada"
      : lookup.state === "active" || lookup.state === "pending"
        ? "Cancelar inscrição"
        : lookup.state === "error"
          ? "Não foi possível abrir este link"
          : "Link de descadastro inválido";

  const description =
    lookup.state === "active" || lookup.state === "pending"
      ? `Você deixará de receber o Boletim Delas em ${lookup.maskedEmail}.`
      : lookup.state === "unsubscribed"
        ? `O endereço ${lookup.maskedEmail} não recebe mais o Boletim Delas.`
        : lookup.state === "error"
          ? "Algo deu errado do nosso lado."
          : "Não encontramos uma inscrição para este link — talvez os dados já tenham sido excluídos.";

  return (
    <Container size="narrow" className="pb-16">
      <PageHeader eyebrow="Boletim Delas" title={title} description={description} />
      <Card padding="lg" className="grid gap-5">
        {deleteError && (
          <Alert variant="danger" title="Não conseguimos excluir os dados">
            {deleteError === "invalid"
              ? "O link não é válido ou os dados já foram excluídos."
              : "Algo deu errado do nosso lado. Tente de novo em alguns minutos."}
          </Alert>
        )}

        {(lookup.state === "active" ||
          lookup.state === "pending" ||
          lookup.state === "unsubscribed") && (
          <UnsubscribeForms token={token} alreadyUnsubscribed={lookup.state === "unsubscribed"} />
        )}

        {lookup.state === "invalid" && (
          <>
            <p className="text-fg-muted">
              Use o link &ldquo;Cancelar inscrição&rdquo; que aparece no rodapé de qualquer edição
              do boletim. Se precisar de ajuda, fale com a equipe pela página Sobre.
            </p>
            <div className="flex flex-wrap gap-3">
              <ButtonLink href="/newsletter">Ir para a newsletter</ButtonLink>
              <ButtonLink href="/sobre" variant="outline">
                Falar com a equipe
              </ButtonLink>
            </div>
          </>
        )}

        {lookup.state === "error" && (
          <Alert variant="danger" title="Tente de novo em alguns minutos">
            Não conseguimos verificar este link agora. Ele continua valendo.
          </Alert>
        )}
      </Card>
    </Container>
  );
}
