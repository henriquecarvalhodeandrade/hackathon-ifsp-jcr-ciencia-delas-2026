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
export function avatarObjectPath(
  userId: string,
  mimeType: AvatarMimeType,
  now = Date.now(),
): string {
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

/** Origens de fotos do login social aceitas para exibição (Google). */
const SOCIAL_AVATAR_ORIGINS: readonly string[] = ["https://lh3.googleusercontent.com"];

/**
 * `src` que pode ir para o <img> do avatar, ou null (mostra as iniciais).
 *
 * Só aceita o bucket público de avatares DESTE projeto Supabase e a foto do Google. A coluna
 * `profiles.avatar_url` aceita qualquer http(s) pela API (PATCH direto em /rest/v1/profiles ou
 * metadados do cadastro), e um endereço de terceiros seria carregado no navegador de cada
 * pessoa que vê o avatar — inclusive da autora de um tópico anônimo que abre o próprio tópico —
 * entregando IP e horário de leitura a quem controla o servidor (auditoria de segurança).
 */
export function displayableAvatarSrc(
  src: string | null | undefined,
  supabaseUrl: string | null | undefined,
): string | null {
  if (typeof src !== "string" || !src.trim()) return null;
  const value = src.trim();
  // Arquivo estático do próprio site (ex.: "/brand/avatar-exemplo.svg" no guia vivo). O banco só
  // aceita http(s) em avatar_url, então isto nunca vem de uma usuária.
  if (/^\/(?![/\\])[^\s\\]*$/.test(value)) return value;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.username || url.password) return null;

  if (supabaseUrl) {
    try {
      const base = new URL(`${supabaseUrl.replace(/\/+$/, "")}/`);
      const prefix = new URL(`storage/v1/object/public/${AVATAR_BUCKET}/`, base).href;
      if (url.href.startsWith(prefix) && url.href.length > prefix.length) return url.href;
    } catch {
      // NEXT_PUBLIC_SUPABASE_URL inválida: nenhum avatar do Storage é exibido.
    }
  }
  if (url.protocol === "https:" && SOCIAL_AVATAR_ORIGINS.includes(url.origin)) return url.href;
  return null;
}

/** Mensagem de erro (pt-BR) para um arquivo escolhido, ou null se ele pode seguir. */
export function avatarFileProblem(file: { type: string; size: number }): string | null {
  if (!isAvatarMimeType(file.type)) return "Use uma imagem PNG, JPG ou WebP.";
  if (file.size > AVATAR_MAX_SOURCE_BYTES)
    return "Essa imagem é grande demais. Escolha uma de até 15 MB.";
  return null;
}
