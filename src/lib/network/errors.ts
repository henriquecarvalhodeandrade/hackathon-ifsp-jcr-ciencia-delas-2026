/**
 * Erros do Postgres/PostgREST da rede (seguir e conectar) → mensagens em pt-BR (puro, testável).
 * Regras de negócio do banco usam SQLSTATE `CDxxx` com texto pronto (docs/18 §2.6); quando a
 * mensagem não vem, usamos o texto daqui. Nunca mostramos a mensagem técnica do Postgres.
 */

export interface DbErrorLike {
  code?: string | null;
  message?: string | null;
}

export type NetworkOperation = "follow" | "unfollow" | "connect" | "respond" | "remove" | "load";

const FALLBACK: Record<NetworkOperation, string> = {
  follow: "Não conseguimos seguir agora. Tente de novo em instantes.",
  unfollow: "Não conseguimos deixar de seguir agora. Tente de novo em instantes.",
  connect: "Não conseguimos enviar o convite agora. Tente de novo em instantes.",
  respond: "Não conseguimos registrar a sua resposta agora. Tente de novo em instantes.",
  remove: "Não conseguimos remover agora. Tente de novo em instantes.",
  load: "Não conseguimos carregar a sua rede agora. Recarregue a página em instantes.",
};

/** Textos das regras da rede (docs/18 §2.6) — usados quando o banco não manda a mensagem. */
export const NETWORK_RULE_MESSAGES: Record<string, string> = {
  CD060: "Não encontramos esta pesquisadora. Confira o link ou procure no diretório.",
  CD061: "Já existe um convite ou uma conexão entre vocês.",
  CD062: "Só quem recebeu o convite pode aceitar ou recusar.",
  CD063: "Você seguiu muitas pessoas na última hora. Respire e tente de novo em alguns minutos.",
  CD064: "Você enviou muitos convites de conexão hoje. Tente de novo amanhã.",
  CD065: "Você não pode seguir nem se conectar com o seu próprio perfil.",
};

export function networkFallback(operation: NetworkOperation): string {
  return FALLBACK[operation];
}

export function friendlyNetworkError(
  error: DbErrorLike | null | undefined,
  operation: NetworkOperation,
): string {
  if (!error) return FALLBACK[operation];
  const code = error.code ?? "";
  const message = (error.message ?? "").trim();

  if (code.startsWith("CD")) {
    if (message) return message;
    return NETWORK_RULE_MESSAGES[code] ?? FALLBACK[operation];
  }

  switch (code) {
    case "23505":
      // Par único (connections_pair_key) ou "já sigo" (PK de follows).
      return operation === "follow"
        ? "Você já segue esta pesquisadora."
        : NETWORK_RULE_MESSAGES.CD061!;
    case "23503":
      return NETWORK_RULE_MESSAGES.CD060!;
    case "23514":
      return operation === "connect"
        ? "O recado pode ter no máximo 300 caracteres."
        : "Alguns dados não passaram na validação. Confira e tente de novo.";
    case "42501":
      return "Você não tem permissão para fazer isso.";
    case "22P02":
      return "Identificador inválido. Recarregue a página e tente de novo.";
    case "PGRST301":
    case "PGRST303":
      return "Sua sessão expirou. Entre de novo para continuar.";
    default:
      return FALLBACK[operation];
  }
}
