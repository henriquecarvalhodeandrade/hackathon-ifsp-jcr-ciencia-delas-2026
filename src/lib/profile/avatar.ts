/**
 * Regras do avatar (bucket público `avatars`, caminho `<uid>/avatar-<timestamp>.<ext>`).
 * Módulo puro: usado no navegador (antes do upload) e no servidor (para validar a URL
 * recebida pela Server Action). Testado em avatar.test.ts.
 */

export const AVATAR_BUCKET = "avatars";
/** Limite do bucket (o arquivo ENVIADO precisa caber nele). */
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
/** Fotos maiores que isso nem tentamos redimensionar no navegador. */
export const AVATAR_MAX_SOURCE_BYTES = 15 * 1024 * 1024;
/** Lado do quadrado gerado no navegador (px). */
export const AVATAR_SIZE = 512;

export const AVATAR_MIME_TYPES = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
} as const;

export type AvatarMimeType = keyof typeof AVATAR_MIME_TYPES;

export function isAvatarMimeType(type: string): type is AvatarMimeType {
  return type in AVATAR_MIME_TYPES;
}

/** Caminho do objeto no bucket. */
export function avatarObjectPath(userId: string, mimeType: AvatarMimeType, now = Date.now()): string {
  return `${userId}/avatar-${now}.${AVATAR_MIME_TYPES[mimeType]}`;
}

const FILE_NAME = /^avatar-\d{10,16}\.(png|jpg|jpeg|webp)$/;

/** Prefixo público dos avatares de uma usuária neste projeto Supabase. */
export function avatarPublicPrefix(supabaseUrl: string, userId: string): string {
  return `${supabaseUrl.replace(/\/+$/, "")}/storage/v1/object/public/${AVATAR_BUCKET}/${userId}/`;
}

/**
 * Nome do arquivo se `url` for um avatar público DESTA usuária neste projeto; senão null.
 * Impede que a action grave links arbitrários (ou de outra pessoa) em profiles.avatar_url.
 */
export function ownAvatarFileName(url: string, supabaseUrl: string, userId: string): string | null {
  const prefix = avatarPublicPrefix(supabaseUrl, userId);
  if (!url.startsWith(prefix)) return null;
  const rest = url.slice(prefix.length);
  return FILE_NAME.test(rest) ? rest : null;
}

/** Mensagem de erro (pt-BR) para um arquivo escolhido, ou null se ele pode seguir. */
export function avatarFileProblem(file: { type: string; size: number }): string | null {
  if (!isAvatarMimeType(file.type)) return "Use uma imagem PNG, JPG ou WebP.";
  if (file.size > AVATAR_MAX_SOURCE_BYTES) return "Essa imagem é grande demais. Escolha uma de até 15 MB.";
  return null;
}
