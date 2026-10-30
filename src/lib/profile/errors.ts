/**
 * Tradução de erros do Supabase (Auth e Postgres) para mensagens em pt-BR, acolhedoras e
 * seguras para mostrar na interface. Nunca repassamos mensagens técnicas em inglês.
 * Módulo puro (testado em errors.test.ts).
 */

export interface AuthErrorLike {
  code?: string | null;
  message?: string | null;
  status?: number | null;
}

export interface DbErrorLike {
  code?: string | null;
  message?: string | null;
}

export const GENERIC_AUTH_ERROR =
  "Não conseguimos falar com o servidor de login agora. Verifique sua conexão e tente de novo em instantes.";

export const RATE_LIMIT_EMAIL_ERROR =
  "Já enviamos vários e-mails em pouco tempo. Aguarde alguns minutos antes de pedir outro — e confira também a caixa de spam.";

export const RATE_LIMIT_REQUEST_ERROR =
  "Muitas tentativas seguidas. Respire um pouco e tente de novo daqui a alguns minutos.";

const AUTH_MESSAGES: Record<string, string> = {
  invalid_credentials: "E-mail ou senha incorretos. Confira e tente de novo.",
  email_not_confirmed:
    "Seu e-mail ainda não foi confirmado. Abra o link que enviamos no cadastro (veja também o spam) ou peça um novo abaixo.",
  over_email_send_rate_limit: RATE_LIMIT_EMAIL_ERROR,
  over_request_rate_limit: RATE_LIMIT_REQUEST_ERROR,
  weak_password:
    "Essa senha é fácil de adivinhar. Use pelo menos 8 caracteres — uma frase curta que só você conhece funciona bem.",
  same_password: "A nova senha precisa ser diferente da senha atual.",
  user_already_exists: "Já existe uma conta com este e-mail. Que tal entrar ou recuperar a senha?",
  email_exists: "Já existe uma conta com este e-mail. Que tal entrar ou recuperar a senha?",
  otp_expired: "Este link expirou ou já foi usado. Peça um novo para continuar.",
  flow_state_expired: "O tempo para concluir o acesso acabou. Comece de novo, por favor.",
  flow_state_not_found: "Não encontramos este pedido de acesso. Comece de novo, por favor.",
  bad_code_verifier: "Abra o link no mesmo navegador em que você pediu o acesso.",
  email_address_invalid: "Esse endereço de e-mail não parece válido. Confira se digitou certinho.",
  email_address_not_authorized: "Não conseguimos enviar e-mails para esse endereço neste ambiente.",
  signup_disabled: "Novos cadastros estão temporariamente fechados.",
  email_provider_disabled: "O acesso por e-mail está desativado neste ambiente.",
  provider_disabled: "Esse método de acesso não está habilitado.",
  user_banned: "Esta conta está suspensa. Se acha que é um engano, fale com a moderação.",
  session_not_found: "Sua sessão terminou. Entre de novo para continuar.",
  reauthentication_needed: "Por segurança, entre de novo antes de trocar a senha.",
  captcha_failed:
    "Não conseguimos verificar que você é uma pessoa. Recarregue a página e tente de novo.",
  request_timeout: GENERIC_AUTH_ERROR,
  validation_failed: "Alguns dados não passaram na validação. Confira os campos e tente de novo.",
};

/** Mensagem amigável para um erro do Supabase Auth. */
export function authErrorMessage(error: AuthErrorLike | null | undefined): string {
  if (!error) return GENERIC_AUTH_ERROR;
  const code = error.code ?? "";
  if (code && AUTH_MESSAGES[code]) return AUTH_MESSAGES[code]!;

  // Versões antigas do GoTrue não mandam `code`: caímos para a mensagem.
  const message = (error.message ?? "").toLowerCase();
  if (message.includes("invalid login credentials")) return AUTH_MESSAGES.invalid_credentials!;
  if (message.includes("email not confirmed")) return AUTH_MESSAGES.email_not_confirmed!;
  if (message.includes("rate limit") || error.status === 429) {
    return message.includes("email") ? RATE_LIMIT_EMAIL_ERROR : RATE_LIMIT_REQUEST_ERROR;
  }
  if (message.includes("expired")) return AUTH_MESSAGES.otp_expired!;
  if (message.includes("should be different")) return AUTH_MESSAGES.same_password!;
  if (message.includes("password") && message.includes("weak")) return AUTH_MESSAGES.weak_password!;
  return GENERIC_AUTH_ERROR;
}

/** Erros que indicam "esse e-mail não tem conta" — tratados como sucesso para evitar enumeração. */
export function isUnknownAccountError(error: AuthErrorLike | null | undefined): boolean {
  if (!error) return false;
  const code = error.code ?? "";
  if (code === "otp_disabled" || code === "user_not_found") return true;
  const message = (error.message ?? "").toLowerCase();
  return message.includes("signups not allowed") || message.includes("user not found");
}

export function isEmailNotConfirmedError(error: AuthErrorLike | null | undefined): boolean {
  if (!error) return false;
  return (
    error.code === "email_not_confirmed" ||
    (error.message ?? "").toLowerCase().includes("email not confirmed")
  );
}

export function isRateLimitError(error: AuthErrorLike | null | undefined): boolean {
  if (!error) return false;
  return (
    error.status === 429 ||
    error.code === "over_email_send_rate_limit" ||
    error.code === "over_request_rate_limit" ||
    (error.message ?? "").toLowerCase().includes("rate limit")
  );
}

export const GENERIC_SAVE_ERROR =
  "Não conseguimos salvar agora. Verifique sua conexão e tente de novo — o que você escreveu continua aqui.";

/**
 * Mensagem amigável para um erro do Postgres/PostgREST.
 * Códigos `CD***` são regras de negócio do banco e já vêm com mensagem em pt-BR (docs/03 §8).
 */
export function dbErrorMessage(
  error: DbErrorLike | null | undefined,
  fallback = GENERIC_SAVE_ERROR,
): string {
  if (!error) return fallback;
  const code = error.code ?? "";
  if (code.startsWith("CD") && error.message) return error.message;
  switch (code) {
    case "23514":
      return "Algum campo está num formato que não aceitamos. Revise os dados e tente de novo.";
    case "23503":
      return "Uma das opções escolhidas não existe mais. Recarregue a página e tente de novo.";
    case "23505":
      return "Esse registro já existe.";
    case "42501":
      return "Você não tem permissão para fazer isso. Entre de novo e tente outra vez.";
    case "22P02":
      return "Recebemos um valor inválido. Recarregue a página e tente de novo.";
    case "PGRST301":
    case "PGRST303":
      return "Sua sessão expirou. Entre de novo para continuar.";
    default:
      return fallback;
  }
}
