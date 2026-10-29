/**
 * Erros do Postgres/PostgREST → mensagens amigáveis em pt-BR (pura, testável).
 * Regras de negócio do banco usam SQLSTATE `CDxxx` e já trazem o texto pronto para a interface
 * (CD070–CD076, docs/18-rede-social.md §2.6); os demais códigos viram mensagens no contexto da ação.
 */

export interface DbErrorLike {
  code?: string | null;
  message?: string | null;
  details?: string | null;
}

export type OpportunityOperation =
  "save" | "status" | "delete" | "apply" | "withdraw" | "respond" | "load";

const FALLBACK: Record<OpportunityOperation, string> = {
  save: "Não conseguimos salvar a vaga agora. Verifique sua conexão e tente de novo — seu texto continua aqui.",
  status: "Não conseguimos mudar a situação da vaga agora. Tente de novo em instantes.",
  delete: "Não conseguimos excluir a vaga agora. Tente de novo em instantes.",
  apply:
    "Não conseguimos enviar sua candidatura agora. Tente de novo em instantes — sua carta continua aqui.",
  withdraw: "Não conseguimos registrar sua desistência agora. Tente de novo em instantes.",
  respond: "Não conseguimos registrar sua resposta agora. Tente de novo em instantes.",
  load: "Não conseguimos carregar as vagas agora. Atualize a página em instantes.",
};

/** Mesmo texto do CD073 — a unicidade (opportunity_id, applicant_id) pode chegar como 23505. */
export const ALREADY_APPLIED = "Você já se candidatou a esta vaga.";

export function fallbackMessage(operation: OpportunityOperation): string {
  return FALLBACK[operation];
}

export function friendlyOpportunityError(
  error: DbErrorLike | null | undefined,
  operation: OpportunityOperation,
): string {
  if (!error) return FALLBACK[operation];
  const code = error.code ?? "";
  const message = (error.message ?? "").trim();

  if (code.startsWith("CD") && message) return message;

  switch (code) {
    case "23505":
      return operation === "apply" ? ALREADY_APPLIED : "Esse registro já existe.";
    case "23503":
      return operation === "save"
        ? "A área escolhida não foi encontrada. Escolha outra e tente de novo."
        : "Esta vaga não está mais disponível.";
    case "23514":
    case "22001":
    case "22007":
    case "22008":
      if (operation === "apply") {
        return "Confira a carta: ela precisa ter entre 30 e 2.000 caracteres.";
      }
      if (operation === "respond")
        return "Confira o recado: ele pode ter no máximo 1.000 caracteres.";
      return "Algum campo está fora do formato esperado. Revise os dados e tente de novo.";
    case "42501":
      if (operation === "save") return "Você só pode editar vagas que você mesma publicou.";
      if (operation === "respond") return "Só a dona da vaga responde às candidaturas.";
      return "Você não tem permissão para fazer isso.";
    case "PGRST116":
      return "Não encontramos esta vaga. Ela pode ter sido removida.";
    case "PGRST301":
    case "PGRST303":
      return "Sua sessão expirou. Entre de novo na sua conta para continuar.";
    default:
      return FALLBACK[operation];
  }
}
