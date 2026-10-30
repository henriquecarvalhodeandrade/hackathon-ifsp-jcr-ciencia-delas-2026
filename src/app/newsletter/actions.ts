"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { getEmailTransportInfo } from "@/lib/email";
import { normalizeEmail } from "@/lib/email/address";
import { isUuid } from "@/lib/newsletter/config";
import { getBigAreas } from "@/lib/newsletter/queries";
import {
  canAcceptSubscriptions,
  confirmSubscription,
  deleteSubscriberByToken,
  subscribe,
  unsubscribeByToken,
} from "@/lib/newsletter/subscriptions";

/**
 * Server Actions públicas da newsletter. Não exigem login: a autorização das ações de
 * confirmação/descadastro é a posse do token (uuid aleatório enviado por e-mail).
 * Tudo é validado no servidor com zod; nenhuma resposta revela se um e-mail já está inscrito.
 */

export type SubscribeValues = { email: string; areas: string[]; consent: boolean; age: boolean };

export type SubscribeFieldErrors = Partial<Record<"email" | "areas" | "consent" | "age", string[]>>;

export type SubscribeState =
  | { ok: true; message: string; devNotice?: string; values: SubscribeValues }
  | { ok: false; error: string; fieldErrors?: SubscribeFieldErrors; values: SubscribeValues }
  | null;

const NEUTRAL_SUCCESS =
  "Pronto! Se este endereço ainda não estiver confirmado, você vai receber em instantes um e-mail com o link de confirmação. Confira também a caixa de spam ou promoções.";

/** Limite por endereço (3 e-mails de confirmação a cada 24 h): neutro, não confirma se o e-mail existe. */
const ADDRESS_LIMIT_MESSAGE =
  "Se este endereço ainda não estiver confirmado, procure o e-mail de confirmação que já enviamos — confira também o spam e a aba de promoções. Para proteger as caixas de entrada, mandamos no máximo 3 e-mails de confirmação por dia para o mesmo endereço.";

/** Teto diário de confirmações atingido (proteção contra abuso). */
const DAILY_LIMIT_MESSAGE =
  "Recebemos muitos pedidos de inscrição hoje e pausamos os e-mails de confirmação até amanhã. Tente de novo daqui a 24 horas — enquanto isso, todas as edições ficam disponíveis aqui no site.";

const subscribeSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, { error: "Digite o seu e-mail." })
    .max(254, { error: "Este e-mail é longo demais." })
    .pipe(z.email({ error: "Digite um e-mail válido, como nome@instituicao.edu.br." })),
  areas: z
    .array(z.string().regex(/^\d{1,4}$/, { error: "Área inválida." }))
    .max(9, { error: "Escolha no máximo 9 áreas." }),
  consent: z.literal("on", {
    error: "Para receber a newsletter, marque a caixa de consentimento.",
  }),
  age: z.literal("on", { error: "A newsletter é para maiores de 18 anos. Confirme a sua idade." }),
});

function devNotice(): string | undefined {
  const info = getEmailTransportInfo();
  if (info.production || info.transport === "resend") return undefined;
  return info.transport === "mailpit"
    ? `Ambiente de desenvolvimento: sem RESEND_API_KEY, o e-mail foi entregue na caixa de testes do Mailpit (${info.devInboxUrl}). O link de confirmação também aparece no console do servidor.`
    : "Ambiente de desenvolvimento: sem RESEND_API_KEY, nenhum e-mail foi enviado — o link de confirmação foi registrado no console do servidor.";
}

export async function subscribeToNewsletter(
  _prev: SubscribeState,
  formData: FormData,
): Promise<SubscribeState> {
  const values: SubscribeValues = {
    email: String(formData.get("email") ?? "").trim(),
    areas: formData.getAll("areas").map(String),
    consent: formData.get("consent") === "on",
    age: formData.get("age") === "on",
  };

  // Campo-armadilha: invisível para pessoas, robôs costumam preencher. Responde igual e não grava nada.
  if (String(formData.get("website") ?? "").trim()) {
    return { ok: true, message: NEUTRAL_SUCCESS, values };
  }

  if (!canAcceptSubscriptions()) {
    return {
      ok: false,
      error:
        "As inscrições por e-mail ainda não estão abertas. Enquanto isso, acompanhe as edições aqui no site.",
      values,
    };
  }

  const parsed = subscribeSchema.safeParse({
    ...values,
    consent: formData.get("consent") ?? undefined,
    age: formData.get("age") ?? undefined,
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: "Alguns campos precisam de atenção. Confira as mensagens abaixo.",
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
      values,
    };
  }

  const bigAreas = new Set((await getBigAreas()).map((a) => a.id));
  const areaIds = [...new Set(parsed.data.areas.map(Number))];
  if (areaIds.some((id) => !bigAreas.has(id))) {
    return {
      ok: false,
      error: "Alguns campos precisam de atenção. Confira as mensagens abaixo.",
      fieldErrors: { areas: ["Escolha áreas da lista."] },
      values,
    };
  }

  // Liga a inscrição ao perfil só quando é o e-mail da própria conta (nunca confia em ids do cliente).
  const user = await getCurrentUser();
  const email = normalizeEmail(parsed.data.email);
  const profileId = user?.email && normalizeEmail(user.email) === email ? user.id : null;

  const result = await subscribe({ email, areaIds, profileId });
  if (!result.ok) return { ok: false, error: result.error, values };
  if (result.outcome === "daily_limit") return { ok: false, error: DAILY_LIMIT_MESSAGE, values };
  if (result.outcome === "address_limit")
    return { ok: true, message: ADDRESS_LIMIT_MESSAGE, values };

  revalidatePath("/newsletter");
  return { ok: true, message: NEUTRAL_SUCCESS, devNotice: devNotice(), values };
}

export type TokenActionState = { ok: true; message: string } | { ok: false; error: string } | null;

const GENERIC_ERROR = "Algo deu errado do nosso lado. Tente de novo em alguns minutos.";

export async function confirmNewsletterSubscription(
  _prev: TokenActionState,
  formData: FormData,
): Promise<TokenActionState> {
  const token = String(formData.get("token") ?? "").trim();
  if (!isUuid(token))
    return { ok: false, error: "Este link de confirmação não é válido. Inscreva-se de novo." };
  try {
    const outcome = await confirmSubscription(token);
    if (outcome === "confirmed" || outcome === "already_active") {
      // Sem revalidatePath: as páginas da newsletter são dinâmicas (nada em cache) e revalidar
      // re-renderizaria esta página, trocando o painel de sucesso (aria-live) pelo estado do servidor.
      return {
        ok: true,
        message:
          outcome === "confirmed"
            ? "Inscrição confirmada! O próximo Boletim Delas chega na segunda-feira."
            : "Esta inscrição já estava confirmada. Até segunda-feira!",
      };
    }
    if (outcome === "expired") {
      return {
        ok: false,
        error: "Este link expirou. Inscreva-se de novo para receber um link novo.",
      };
    }
    return {
      ok: false,
      error: "Não encontramos esta inscrição. O link pode ter sido substituído por um mais novo.",
    };
  } catch (error) {
    console.error("[newsletter] confirmação falhou", error);
    return { ok: false, error: GENERIC_ERROR };
  }
}

export async function unsubscribeFromNewsletter(
  _prev: TokenActionState,
  formData: FormData,
): Promise<TokenActionState> {
  const token = String(formData.get("token") ?? "").trim();
  if (!isUuid(token)) return { ok: false, error: "Este link de descadastro não é válido." };
  try {
    const outcome = await unsubscribeByToken(token);
    if (outcome === "invalid") {
      return {
        ok: false,
        error: "Não encontramos esta inscrição. Talvez os dados já tenham sido excluídos.",
      };
    }
    return {
      ok: true,
      message:
        outcome === "unsubscribed"
          ? "Pronto, você não vai mais receber o Boletim Delas. Sentiremos sua falta!"
          : "Esta inscrição já estava cancelada — você não recebe mais o Boletim Delas.",
    };
  } catch (error) {
    console.error("[newsletter] descadastro falhou", error);
    return { ok: false, error: GENERIC_ERROR };
  }
}

/** Exclusão definitiva (LGPD). Usado pelo ConfirmDialog — termina sempre com redirect. */
export async function deleteNewsletterData(formData: FormData): Promise<void> {
  const token = String(formData.get("token") ?? "").trim();
  let outcome: "deleted" | "invalid" | "error" = "invalid";
  if (isUuid(token)) {
    try {
      outcome = await deleteSubscriberByToken(token);
    } catch (error) {
      console.error("[newsletter] exclusão falhou", error);
      outcome = "error";
    }
  }
  if (outcome === "deleted") revalidatePath("/newsletter");
  // Em falha, mantém o token na URL para a pessoa poder tentar de novo na mesma página.
  const retry = outcome === "error" ? `token=${encodeURIComponent(token)}&` : "";
  // redirect() lança de propósito: fica fora do try/catch.
  redirect(
    outcome === "deleted"
      ? "/newsletter/cancelar?excluido=1"
      : `/newsletter/cancelar?${retry}erro=${outcome}`,
  );
}
