/**
 * Tradução de erros do Postgres/PostgREST do feed para mensagens em pt-BR (pura, testável).
 * Regras de negócio do banco usam SQLSTATE `CDxxx` com texto pronto para a interface
 * (CD080 anexo que não é seu, CD081/CD082 anti-spam, CD083 publicação não encontrada —
 * docs/18 §2.6); os demais códigos viram mensagens genéricas no contexto da operação.
 */

export type DbErrorLike = { code?: string | null; message?: string | null } | null | undefined;

export type FeedOperation =
  "post" | "edit" | "delete" | "like" | "comment" | "comment-edit" | "comment-delete";

const FALLBACK: Record<FeedOperation, string> = {
  post: "Não conseguimos publicar agora. Tente de novo em instantes — seu texto continua aqui.",
  edit: "Não conseguimos salvar as alterações. Tente de novo — seu texto continua aqui.",
  delete: "Não conseguimos apagar a publicação. Tente de novo em instantes.",
  like: "Não conseguimos registrar a curtida. Tente de novo em instantes.",
  comment:
    "Não conseguimos enviar o comentário. Tente de novo em instantes — seu texto continua aqui.",
  "comment-edit": "Não conseguimos salvar o comentário. Tente de novo — seu texto continua aqui.",
  "comment-delete": "Não conseguimos apagar o comentário. Tente de novo em instantes.",
};

export function feedFallbackMessage(operation: FeedOperation): string {
  return FALLBACK[operation];
}

const PERMISSION: Partial<Record<FeedOperation, string>> = {
  edit: "Só a autora pode editar esta publicação.",
  delete: "Só a autora pode apagar esta publicação.",
  "comment-edit": "Só a autora pode editar este comentário.",
  "comment-delete": "Você não pode apagar este comentário.",
};

const CHECK: Partial<Record<FeedOperation, string>> = {
  post: "Confira o texto (até 3.000 caracteres) e o link (precisa começar com https://).",
  edit: "Confira o texto (até 3.000 caracteres) e o link (precisa começar com https://).",
  comment: "O comentário precisa ter entre 1 e 1.500 caracteres.",
  "comment-edit": "O comentário precisa ter entre 1 e 1.500 caracteres.",
};

/** true quando o erro é uma regra de negócio do banco com mensagem pronta. */
export function isBusinessRuleError(error: DbErrorLike): boolean {
  return Boolean(error?.code?.startsWith("CD") && error.message?.trim());
}

export function friendlyFeedError(error: DbErrorLike, operation: FeedOperation): string {
  if (!error) return FALLBACK[operation];
  if (isBusinessRuleError(error)) return error.message!.trim();

  switch (error.code ?? "") {
    case "23505":
      return operation === "like" ? "Você já curtiu esta publicação." : "Isso já foi registrado.";
    case "23514":
      return (
        CHECK[operation] ?? "Algum campo está fora do formato esperado. Revise e tente de novo."
      );
    case "23503":
      return operation === "post"
        ? "O anexo escolhido não existe mais. Escolha outro ou publique sem anexo."
        : "Esta publicação não existe mais — ela pode ter sido apagada.";
    case "22001":
      return "Um dos textos passou do tamanho máximo permitido.";
    case "22P02":
      return "Identificador inválido. Recarregue a página e tente de novo.";
    case "42501":
      return PERMISSION[operation] ?? "Você não tem permissão para fazer isso.";
    case "PGRST116":
      return "Não encontramos esse conteúdo. Ele pode ter sido apagado.";
    case "PGRST301":
    case "PGRST303":
      return "Sua sessão expirou. Entre de novo para continuar.";
    default:
      return FALLBACK[operation];
  }
}
