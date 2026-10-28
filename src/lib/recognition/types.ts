/** Estados devolvidos pelas Server Actions do reconhecimento (formato do useActionState). */

/** O que a pessoa tinha preenchido no retorno (volta para o formulário quando dá erro). */
export interface FeedbackValues {
  helpfulness: string;
  outcomes: string[];
  would_recommend: string;
  note: string;
}

export type FeedbackState = {
  ok: false;
  error: string;
  fieldErrors?: Record<string, string[]>;
  values: FeedbackValues;
} | null;

/** Ações curtas (pedir, autorizar, revogar, apagar): só erro — o sucesso redireciona. */
export type RecognitionActionState = {
  ok: false;
  error: string;
  fieldErrors?: Record<string, string[]>;
} | null;
