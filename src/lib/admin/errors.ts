/**
 * Tradução de erros do Supabase/Postgres para mensagens amigáveis em pt-BR.
 * Códigos `CD…` (regras de negócio, docs/03 §8) já trazem a mensagem em pt-BR
 * pronta para a interface; os demais viram textos genéricos — nunca mostramos
 * a mensagem crua do Postgres (pode estar em inglês ou expor detalhes internos).
 */

export interface DbErrorLike {
  code?: string | null;
  message?: string | null;
}

export const GENERIC_ERROR = "Não conseguimos concluir a ação. Tente de novo em instantes.";

export function friendlyDbError(error: DbErrorLike | null | undefined, fallback: string = GENERIC_ERROR): string {
  if (!error) return fallback;
  const code = error.code ?? "";
  const message = error.message?.trim();
  if (code.startsWith("CD") && message) return message;
  switch (code) {
    case "42501":
      return "Você não tem permissão para fazer isso.";
    case "23505":
      return "Isso já tinha sido registrado antes.";
    case "23503":
      return "Este conteúdo está ligado a outro registro e não pode ser alterado assim.";
    case "23514":
      return "Algum dado está fora do formato aceito. Revise e tente de novo.";
    case "22P02":
      return "Identificador inválido. Recarregue a página e tente de novo.";
    case "PGRST116":
      return "Não encontramos esse registro. Ele pode ter sido removido.";
    default:
      return fallback;
  }
}
