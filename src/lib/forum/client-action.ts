import { unstable_rethrow } from "next/navigation";

/** Falha de rede/servidor numa ação sem texto digitado (fixar, excluir, marcar solução…). */
export const CONNECTION_ERROR =
  "Não conseguimos falar com o servidor. Confira sua conexão e tente de novo.";

/** Mesma falha num formulário com texto: os campos são remontados com o que foi enviado. */
export const CONNECTION_ERROR_KEEP_TEXT =
  "Não conseguimos falar com o servidor. Confira sua conexão e tente de novo — seu texto continua aqui.";

/** Chave nova para remontar os campos (sem crypto.randomUUID, que não existe fora de HTTPS). */
export function freshNonce(): string {
  return `falha-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Envolve uma Server Action usada com `useActionState` (no cliente). Se a chamada falhar
 * (rede caiu, erro inesperado no servidor), devolve `onFailure(...)` em vez de deixar o erro
 * subir para o error boundary — que trocaria a página inteira e apagaria o texto digitado.
 * `redirect()`/`notFound()` da action continuam funcionando (`unstable_rethrow`).
 */
export function withConnectionFallback<State, Payload>(
  action: (prev: State, payload: Payload) => Promise<State>,
  onFailure: (payload: Payload) => State,
): (prev: State, payload: Payload) => Promise<State> {
  return async (prev, payload) => {
    try {
      return await action(prev, payload);
    } catch (error) {
      unstable_rethrow(error);
      return onFailure(payload);
    }
  };
}
