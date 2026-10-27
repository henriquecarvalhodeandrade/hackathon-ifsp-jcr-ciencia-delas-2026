/**
 * Destinos de redirecionamento seguros (?next=...).
 *
 * Só aceitamos caminhos RELATIVOS do próprio site. Tudo que poderia levar a outro domínio
 * (`//evil.com`, `/\evil.com`, `https://...`, `javascript:`) ou criar laços com as rotas de
 * autenticação cai no destino padrão. Módulo puro — usado em Server Actions, Route Handlers
 * e páginas.
 */

const PLACEHOLDER_ORIGIN = "http://ciencia-delas.invalid";

/** Rotas que não fazem sentido como destino final (geram laço ou saem da sessão). */
const BLOCKED_PREFIXES = ["/auth", "/entrar", "/cadastro", "/recuperar-senha", "/api"] as const;

function hasBlockedPrefix(pathname: string): boolean {
  return BLOCKED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

/**
 * Devolve `raw` se for um caminho interno seguro; senão `fallback`.
 *
 *   safeNextPath("/forum/t/123?x=1") → "/forum/t/123?x=1"
 *   safeNextPath("//evil.com")       → fallback
 *   safeNextPath("https://evil.com") → fallback
 */
export function safeNextPath(raw: unknown, fallback = "/forum"): string {
  if (typeof raw !== "string") return fallback;
  const value = raw.trim();
  if (!value || value.length > 512) return fallback;
  if (!value.startsWith("/") || value.startsWith("//")) return fallback;
  // Barras invertidas e caracteres de controle/espaço: navegadores "corrigem" para URLs externas.
  if (/[\\\s\u0000-\u001f\u007f]/.test(value)) return fallback;

  let url: URL;
  try {
    url = new URL(value, PLACEHOLDER_ORIGIN);
  } catch {
    return fallback;
  }
  if (url.origin !== PLACEHOLDER_ORIGIN) return fallback;
  if (hasBlockedPrefix(url.pathname)) return fallback;
  return `${url.pathname}${url.search}${url.hash}`;
}

/** Monta `/rota?next=<destino>` só quando há um destino diferente do padrão. */
export function withNext(path: string, next: string | null | undefined, defaultNext?: string): string {
  if (!next || next === defaultNext) return path;
  const safe = safeNextPath(next, "");
  if (!safe) return path;
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}next=${encodeURIComponent(safe)}`;
}

/** Nome do cookie que guarda o destino pedido antes de um link mágico/cadastro por e-mail. */
export const AUTH_NEXT_COOKIE = "cd_auth_next";
