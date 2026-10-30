/**
 * Tradução de erros do Postgres/PostgREST das mensagens diretas para pt-BR (pura, testável).
 * As regras de negócio do banco (CD060, CD065, CD084–CD089 — docs/18-rede-social.md §2.6) já
 * trazem texto pronto para a interface e passam direto; os demais códigos viram mensagens
 * amigáveis — nunca mostramos o texto técnico (em inglês) do Postgres.
 */

export interface PostgrestLikeError {
  code?: string | null;
  message?: string | null;
}

export type MessagesOperation = "start" | "send" | "respond" | "read" | "load";

const FALLBACK: Record<MessagesOperation, string> = {
  start: "Não conseguimos abrir a conversa agora. Tente de novo em instantes.",
  send: "Não conseguimos enviar a sua mensagem agora. Tente de novo em instantes — o texto continua aqui.",
  respond: "Não conseguimos registrar a sua resposta agora. Tente de novo em instantes.",
  read: "Não conseguimos marcar as mensagens como lidas agora.",
  load: "Não conseguimos carregar as suas mensagens agora. Tente de novo em instantes.",
};

export const SESSION_EXPIRED = "Sua sessão expirou. Entre de novo para continuar.";

export function fallbackMessage(operation: MessagesOperation): string {
  return FALLBACK[operation];
}

export function friendlyMessagesError(
  error: PostgrestLikeError | null | undefined,
  operation: MessagesOperation,
): string {
  const code = error?.code ?? "";
  const message = (error?.message ?? "").trim();

  // Regras de negócio do banco: mensagem em pt-BR pensada para a interface.
  if (code.startsWith("CD") && message) return message;

  switch (code) {
    case "23514":
      if (operation === "send") return "A mensagem precisa ter entre 1 e 2.000 caracteres.";
      return "Alguns dados não passaram na validação. Confira e tente de novo.";
    case "42501":
      if (operation === "send") {
        return "Esta conversa não está aberta para novas mensagens. Recarregue a página.";
      }
      return "Você não tem permissão para fazer isso.";
    case "22P02":
    case "23503":
    case "PGRST116":
      return operation === "start"
        ? "Não encontramos esta pesquisadora. Confira o link ou procure no diretório."
        : "Não encontramos esta conversa. Recarregue a página e tente de novo.";
    case "PGRST301":
    case "PGRST303":
      return SESSION_EXPIRED;
    default:
      return FALLBACK[operation];
  }
}
