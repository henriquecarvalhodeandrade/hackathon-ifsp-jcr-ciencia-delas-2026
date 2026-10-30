/**
 * Validação (zod) das Server Actions da rede. Mensagens em pt-BR, iguais às da interface.
 * Ids de usuárias vêm só como ALVO (quem seguir/convidar): a autoria vem sempre da sessão.
 */
import { z } from "zod";
import { CONNECTION_MESSAGE_MAX } from "./presentation";

const id = (message: string) => z.guid({ error: message });

export const profileIdSchema = id(
  "Não encontramos esta pesquisadora. Recarregue a página e tente de novo.",
);

export const connectionIdSchema = id(
  "Não encontramos este convite. Recarregue a página e tente de novo.",
);

/** Recado opcional: o navegador manda CRLF; vira LF antes de contar (igual ao contador do campo). */
export const connectionMessageSchema = z.preprocess(
  (value) => (typeof value === "string" ? value.replace(/\r\n?/g, "\n") : (value ?? "")),
  z
    .string({ error: "O recado precisa ser um texto." })
    .trim()
    .max(CONNECTION_MESSAGE_MAX, { error: "Use no máximo 300 caracteres no recado." })
    .transform((text) => (text ? text : null)),
);

export const sendConnectionSchema = z.object({
  profile_id: profileIdSchema,
  message: connectionMessageSchema,
});
export type SendConnectionInput = z.infer<typeof sendConnectionSchema>;

export const respondConnectionSchema = z.object({
  connection_id: connectionIdSchema,
  accept: z.boolean({ error: "Escolha aceitar ou recusar o convite." }),
});
export type RespondConnectionInput = z.infer<typeof respondConnectionSchema>;
