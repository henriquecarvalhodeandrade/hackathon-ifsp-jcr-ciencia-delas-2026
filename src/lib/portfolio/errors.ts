/**
 * Erros do Postgres/PostgREST do portfólio → mensagens em pt-BR (puro, testável).
 * `CD066` (portfólio cheio) e `CD067` (muitos itens na hora) já vêm com texto pronto do banco.
 */

export interface DbErrorLike {
  code?: string | null;
  message?: string | null;
}

export type PortfolioErrorContext = "save" | "delete" | "pin" | "load";

const GENERIC: Record<PortfolioErrorContext, string> = {
  save: "Não conseguimos salvar o item agora. Verifique sua conexão e tente de novo — seu texto continua aqui.",
  delete: "Não conseguimos apagar o item agora. Tente de novo em instantes.",
  pin: "Não conseguimos mudar o destaque agora. Tente de novo em instantes.",
  load: "Não conseguimos carregar o portfólio agora. Recarregue a página em instantes.",
};

const RULES: Record<string, string> = {
  CD066: "Seu portfólio chegou a 50 itens. Apague ou junte alguns para adicionar outro.",
  CD067: "Você adicionou muitos itens na última hora. Respire e tente de novo em alguns minutos.",
};

export function portfolioFallback(context: PortfolioErrorContext): string {
  return GENERIC[context];
}

export function friendlyPortfolioError(
  error: DbErrorLike | null | undefined,
  context: PortfolioErrorContext,
): string {
  if (!error) return GENERIC[context];
  const code = error.code ?? "";
  const message = (error.message ?? "").trim();

  if (code.startsWith("CD")) return message || RULES[code] || GENERIC[context];

  switch (code) {
    case "23514":
    case "22001":
      return "Algum campo está fora do formato esperado. Revise os dados e tente de novo.";
    case "22P02":
      return "Algum valor não está no formato esperado (tipo, ano ou link). Revise e tente de novo.";
    case "42501":
      return "Você só pode mudar itens do seu próprio portfólio.";
    case "PGRST116":
      return "Não encontramos este item. Ele pode ter sido apagado.";
    case "PGRST301":
    case "PGRST303":
      return "Sua sessão expirou. Entre de novo para continuar.";
    default:
      return GENERIC[context];
  }
}
