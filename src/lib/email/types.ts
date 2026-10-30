/**
 * Tipos compartilhados da camada de e-mail (Resend em produção, Mailpit no desenvolvimento local).
 */

/** Um e-mail para UMA destinatária (a newsletter é personalizada: cada uma tem seu link de descadastro). */
export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Cabeçalhos extras, ex.: List-Unsubscribe (RFC 8058). */
  headers?: Record<string, string>;
  /** Etiquetas do provedor (Resend aceita só letras ASCII, números, "_" e "-"). */
  tags?: Array<{ name: string; value: string }>;
  replyTo?: string;
}

export type EmailProvider = "resend" | "mailpit";

/** Transporte em uso: Resend (produção), Mailpit (dev local) ou nenhum (só registra no console). */
export type EmailTransport = EmailProvider | "none";

export interface EmailFailure {
  ok: false;
  skipped?: false;
  error: string;
  /** Status HTTP do provedor, quando houver. */
  status?: number;
}

export interface EmailSkipped {
  ok: false;
  skipped: true;
  reason: string;
}

export type SendEmailResult =
  | { ok: true; skipped?: false; provider: EmailProvider; id: string | null }
  | EmailSkipped
  | EmailFailure;

export type SendBatchResult =
  | { ok: true; skipped?: false; provider: EmailProvider; ids: Array<string | null> }
  | EmailSkipped
  | EmailFailure;

export interface SendOptions {
  /**
   * Chave de idempotência (Resend guarda por 24h): reenviar a mesma requisição com a mesma
   * chave não duplica o e-mail. Sempre passe uma em envios que podem ser repetidos (cron).
   */
  idempotencyKey?: string;
}
