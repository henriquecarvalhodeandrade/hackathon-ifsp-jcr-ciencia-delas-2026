/**
 * Formato de retorno das Server Actions da moderação e das notificações
 * (CONTRACT §10), pronto para `useActionState`.
 */
export type ActionResult<TData = undefined> =
  | ({ ok: true; message: string } & (TData extends undefined
      ? { data?: undefined }
      : { data: TData }))
  | { ok: false; error: string; fieldErrors?: Record<string, string[] | undefined> };

/** Estado inicial (`null`) + resultado da última execução. */
export type ActionState<TData = undefined> = ActionResult<TData> | null;

export function actionError(
  error: string,
  fieldErrors?: Record<string, string[] | undefined>,
): {
  ok: false;
  error: string;
  fieldErrors?: Record<string, string[] | undefined>;
} {
  return fieldErrors ? { ok: false, error, fieldErrors } : { ok: false, error };
}

export const SESSION_EXPIRED = "Sua sessão expirou. Entre de novo para continuar.";
export const NOT_ALLOWED = "Você não tem permissão para fazer isso.";
