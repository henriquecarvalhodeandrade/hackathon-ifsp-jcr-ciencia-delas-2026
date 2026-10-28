/**
 * Erros do reconhecimento em pt-BR (puro, testado). As regras de negócio do banco usam SQLSTATE
 * CD030–CD037 (e CD013) e já trazem o texto pronto; o resto vira mensagem amigável genérica.
 */

export interface PostgrestLikeError {
  code?: string | null;
  message?: string | null;
}

export type RecognitionOperation =
  | "feedback"
  | "feedback-delete"
  | "declaration-request"
  | "declaration-consent"
  | "declaration-revoke";

const FALLBACK: Record<RecognitionOperation, string> = {
  feedback:
    "Não conseguimos enviar o seu retorno agora. Tente de novo em instantes — suas respostas continuam aqui.",
  "feedback-delete": "Não conseguimos apagar o seu retorno agora. Tente de novo em instantes.",
  "declaration-request": "Não conseguimos pedir a declaração agora. Tente de novo em instantes.",
  "declaration-consent":
    "Não conseguimos registrar a sua autorização agora. Tente de novo em instantes.",
  "declaration-revoke": "Não conseguimos revogar a declaração agora. Tente de novo em instantes.",
};

export function fallbackMessage(operation: RecognitionOperation): string {
  return FALLBACK[operation];
}

export function friendlyRecognitionError(
  error: PostgrestLikeError | null | undefined,
  operation: RecognitionOperation,
): string {
  const code = error?.code ?? "";
  const message = (error?.message ?? "").trim();

  if (code.startsWith("CD") && message) return message;

  switch (code) {
    case "23505":
      return operation === "feedback"
        ? "Você já contou como foi esta mentoria. Obrigada!"
        : "Já existe uma declaração para esta mentoria.";
    case "23514":
      return operation === "feedback"
        ? "Confira as respostas: a nota vai de 1 a 5 e o comentário tem no máximo 500 caracteres."
        : "Alguns dados não passaram na validação. Confira e tente de novo.";
    case "42501":
      return "Você não tem permissão para fazer isso. Recarregue a página.";
    case "PGRST301":
    case "PGRST303":
      return "Sua sessão expirou. Entre de novo para continuar.";
    default:
      return FALLBACK[operation];
  }
}
