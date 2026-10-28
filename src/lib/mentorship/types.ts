/** Estados devolvidos pelas Server Actions da mentoria (formato do useActionState). */

export type ActionState<V extends Record<string, string> = Record<string, string>> =
  | { ok: true; message: string; values?: V }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]>; values?: V }
  | null;

export type FindMentorsState =
  | { ok: true; count: number; source: "ai" | "heuristic"; warnings: string[] }
  | { ok: false; error: string }
  | null;

export type RequestValues = { mentor_id: string; message: string };

export type RespondValues = { response_message: string };

export type MessageValues = { body: string };

/**
 * Envio de mensagem na conversa. `nonce` muda a cada resposta: remonta o campo (com o texto de
 * volta, se deu erro) e avisa o cliente de que houve um envio novo.
 */
export type MessageState =
  | { ok: true; message: string; nonce: string }
  | {
      ok: false;
      error: string;
      fieldErrors?: Record<string, string[]>;
      values: MessageValues;
      nonce: string;
    }
  | null;

export type MarkReadResult = { ok: true; marked: number } | { ok: false; error: string };
