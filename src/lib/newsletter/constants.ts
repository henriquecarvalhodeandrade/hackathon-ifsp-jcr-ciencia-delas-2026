/**
 * Constantes do Boletim Delas (newsletter semanal). Sem dependências de servidor.
 */

export const NEWSLETTER_NAME = "Boletim Delas";

/** Texto EXATO do consentimento exibido ao lado da caixa (desmarcada) e gravado em consent_text. */
export const NEWSLETTER_CONSENT_TEXT =
  "Quero receber o Boletim Delas, a newsletter semanal da Ciência Delas, no e-mail informado. " +
  "Sei que posso cancelar quando quiser pelo link presente em todos os e-mails e que meus dados " +
  "são tratados conforme a Política de Privacidade.";

/** Confirmação de idade (os destaques podem citar temas como assédio e saúde mental). */
export const NEWSLETTER_AGE_TEXT = "Tenho 18 anos ou mais.";

/** Versão do texto — muda quando o texto mudar, para sabermos com o que cada pessoa concordou. */
export const NEWSLETTER_CONSENT_VERSION = "2026-10";

/** Valor gravado em newsletter_subscribers.consent_text. */
export function buildConsentRecord(): string {
  return `${NEWSLETTER_CONSENT_TEXT} ${NEWSLETTER_AGE_TEXT} (versão ${NEWSLETTER_CONSENT_VERSION})`;
}

/** Links de confirmação valem por 7 dias a partir do pedido de inscrição. */
export const CONFIRM_TOKEN_TTL_DAYS = 7;

/** Intervalo mínimo entre dois e-mails de confirmação para o mesmo endereço (anti-abuso). */
export const CONFIRMATION_RESEND_COOLDOWN_MS = 2 * 60 * 1000;

/** Teto padrão por execução: o plano gratuito do Resend permite 100 e-mails/dia (sobram ~10 para confirmações). */
export const DEFAULT_MAX_PER_RUN = 90;

/** Uma reivindicação de envio "em andamento" vence depois deste tempo (para retomar envios interrompidos). */
export const DELIVERY_CLAIM_TTL_MS = 15 * 60 * 1000;

/** Marcador gravado em newsletter_deliveries.error enquanto o envio está em andamento. */
export const DELIVERY_CLAIM_PREFIX = "em_andamento:";

/** Itens por seção da edição. */
export const EDITION_LIMITS = { papers: 5, threads: 4, mentors: 4 } as const;

/** Edições por página no arquivo público. */
export const ARCHIVE_PAGE_SIZE = 12;

/** Slugs de edição: "2026-s44". */
export const EDITION_SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
