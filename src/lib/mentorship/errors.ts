/**
 * Tradução de erros do Postgres/PostgREST para mensagens em pt-BR (pura, testável).
 * Erros de regra de negócio do banco usam SQLSTATE `CDxxx` e já trazem texto pronto
 * (docs/03-banco-de-dados.md §8); os demais viram mensagens amigáveis genéricas.
 */

export interface PostgrestLikeError {
  code?: string | null;
  message?: string | null;
}

export type MentorshipOperation =
  | "request"
  | "cancel"
  | "respond"
  | "complete"
  | "availability"
  | "consent"
  | "generic";

const FALLBACK: Record<MentorshipOperation, string> = {
  request: "Não conseguimos enviar o seu pedido agora. Tente de novo em instantes — sua mensagem continua aqui.",
  cancel: "Não conseguimos cancelar agora. Tente de novo em instantes.",
  respond: "Não conseguimos registrar a sua resposta agora. Tente de novo em instantes.",
  complete: "Não conseguimos concluir a mentoria agora. Tente de novo em instantes.",
  availability: "Não conseguimos atualizar a sua disponibilidade agora. Tente de novo em instantes.",
  consent: "Não conseguimos salvar a sua autorização agora. Tente de novo em instantes.",
  generic: "Algo não saiu como esperado. Tente de novo em instantes.",
};

export function fallbackMessage(operation: MentorshipOperation): string {
  return FALLBACK[operation];
}

export function friendlyMentorshipError(
  error: PostgrestLikeError | null | undefined,
  operation: MentorshipOperation = "generic",
): string {
  const code = error?.code ?? "";
  const message = (error?.message ?? "").trim();

  // Regras de negócio do banco: mensagem em pt-BR pensada para a interface.
  if (code.startsWith("CD") && message) return message;

  switch (code) {
    case "23505":
      return operation === "request"
        ? "Você já tem um pedido em aberto ou uma mentoria ativa com esta mentora."
        : "Esse registro já existe.";
    case "23514":
      return operation === "request"
        ? "Confira a mensagem: ela precisa ter entre 20 e 1.500 caracteres."
        : "Alguns dados não passaram na validação. Confira e tente de novo.";
    case "42501":
      return operation === "request"
        ? "Esta mentora não está recebendo pedidos no momento."
        : "Você não tem permissão para fazer isso.";
    case "PGRST301":
    case "PGRST303":
      return "Sua sessão expirou. Entre de novo para continuar.";
    default:
      return FALLBACK[operation];
  }
}
