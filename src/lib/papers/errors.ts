/**
 * Erros do Postgres/PostgREST → mensagens amigáveis em pt-BR.
 * Códigos `CD***` já vêm com mensagem em pt-BR do banco (docs/03-banco-de-dados.md §8).
 */

export interface DbErrorLike {
  code?: string | null;
  message?: string | null;
  details?: string | null;
}

export type PaperErrorContext = "save" | "vote" | "comment" | "delete" | "load";

const GENERIC: Record<PaperErrorContext, string> = {
  save: "Não conseguimos salvar o paper agora. Verifique sua conexão e tente de novo — seu texto continua aqui.",
  vote: "Não conseguimos registrar seu destaque agora. Tente de novo em instantes.",
  comment:
    "Não conseguimos publicar seu comentário agora. Tente de novo — seu texto continua aqui.",
  delete: "Não conseguimos excluir agora. Tente de novo em instantes.",
  load: "Não conseguimos carregar os papers agora. Atualize a página em instantes.",
};

export function friendlyDbError(
  error: DbErrorLike | null | undefined,
  context: PaperErrorContext,
): string {
  if (!error) return GENERIC[context];
  const code = error.code ?? "";
  const haystack = `${error.message ?? ""} ${error.details ?? ""}`;

  if (code.startsWith("CD") && error.message) return error.message;

  switch (code) {
    case "23505":
      if (/doi/i.test(haystack))
        return "Este DOI já está na Vitrine. Procure o paper pela busca para destacá-lo.";
      if (context === "vote") return "Você já destacou este paper.";
      return "Esse registro já existe.";
    case "23503":
      return context === "save"
        ? "A área escolhida não foi encontrada. Escolha outra e tente de novo."
        : "Este paper não está mais disponível.";
    case "23514":
    case "22001":
      return "Algum campo está fora do formato esperado. Revise os dados e tente de novo.";
    case "42501":
    case "PGRST301":
      return "Você não tem permissão para fazer isso. Entre na sua conta e tente de novo.";
    case "PGRST116":
      return "Não encontramos este paper. Ele pode ter sido removido.";
    default:
      return GENERIC[context];
  }
}
