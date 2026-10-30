/**
 * Tradução de erros do Supabase/PostgREST para mensagens amigáveis em pt-BR.
 *
 * Erros de regra de negócio do banco usam SQLSTATE `CDxxx` com mensagens em pt-BR
 * prontas para a interface (docs/03-banco-de-dados.md §8). Os demais códigos viram
 * textos genéricos — nunca mostramos a mensagem técnica (em inglês) do Postgres.
 */

export type DbErrorLike = { code?: string | null; message?: string | null } | null | undefined;

const GENERIC_BY_CODE: Record<string, string> = {
  "42501": "Você não tem permissão para fazer isso.",
  "23505": "Isso já foi registrado antes.",
  "23514": "Algum campo está fora do formato esperado. Revise o texto e tente de novo.",
  "23503": "Não encontramos o conteúdo relacionado — ele pode ter sido apagado.",
  "23502": "Faltou preencher um campo obrigatório.",
  "22P02": "Identificador inválido.",
  "22001": "Um dos textos passou do tamanho máximo permitido.",
  PGRST116: "Não encontramos esse conteúdo.",
  PGRST301: "Sua sessão expirou. Entre novamente na sua conta.",
  PGRST303: "Sua sessão expirou. Entre novamente na sua conta.",
};

/** true quando o erro é uma regra de negócio do banco com mensagem pronta (CD001…CD015). */
export function isBusinessRuleError(error: DbErrorLike): boolean {
  return Boolean(error?.code?.startsWith("CD") && error.message);
}

/**
 * Mensagem para mostrar à usuária. `fallback` é usado quando o código não é conhecido
 * (ex.: falha de rede) — escreva-o no contexto da ação ("Não conseguimos publicar…").
 */
export function friendlyDbError(error: DbErrorLike, fallback: string): string {
  if (!error) return fallback;
  if (isBusinessRuleError(error)) return error.message!.trim();
  const code = error.code ?? "";
  return GENERIC_BY_CODE[code] ?? fallback;
}
