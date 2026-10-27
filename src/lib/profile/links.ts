/**
 * Normalização e validação dos links do perfil (Lattes, ORCID, LinkedIn, site pessoal).
 * O banco exige `http(s)://` (evita `javascript:`); aqui aceitamos o que as pessoas
 * costumam colar ("lattes.cnpq.br/123", "orcid.org/0000-...") e devolvemos o formato canônico.
 * Módulo puro (testado em links.test.ts).
 */

export type ProfileLinkKind = "lattes" | "linkedin" | "website";

export const PROFILE_URL_MAX_LENGTH = 300;

export type NormalizeResult = { ok: true; value: string } | { ok: false; error: string };

const KIND_RULES: Record<ProfileLinkKind, { hosts?: readonly string[]; hostError?: string }> = {
  lattes: {
    hosts: ["cnpq.br"],
    hostError: "Use o endereço do seu currículo Lattes (começa com lattes.cnpq.br/).",
  },
  linkedin: {
    hosts: ["linkedin.com"],
    hostError: "Use o endereço do seu perfil no LinkedIn (linkedin.com/in/...).",
  },
  website: {},
};

function hostMatches(hostname: string, allowed: readonly string[]): boolean {
  return allowed.some((host) => hostname === host || hostname.endsWith(`.${host}`));
}

/**
 * Normaliza um link digitado pela usuária.
 *   "lattes.cnpq.br/123"  → "https://lattes.cnpq.br/123"
 *   "javascript:alert(1)" → erro
 */
export function normalizeProfileUrl(input: string, kind: ProfileLinkKind): NormalizeResult {
  const raw = input.trim();
  if (!raw) return { ok: false, error: "Informe o endereço." };
  if (/\s/.test(raw)) return { ok: false, error: "O endereço não pode ter espaços." };

  const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(raw);
  if (hasScheme && !/^https?:\/\//i.test(raw)) {
    return { ok: false, error: "Use um endereço que comece com https://." };
  }
  const candidate = hasScheme ? raw : `https://${raw.replace(/^\/+/, "")}`;

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return {
      ok: false,
      error: "Esse endereço não parece válido. Confira se copiou o link inteiro.",
    };
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return { ok: false, error: "Use um endereço que comece com https://." };
  }
  if (!url.hostname.includes(".") || url.username || url.password) {
    return {
      ok: false,
      error: "Esse endereço não parece válido. Confira se copiou o link inteiro.",
    };
  }

  const rule = KIND_RULES[kind];
  if (rule.hosts && !hostMatches(url.hostname.toLowerCase(), rule.hosts)) {
    return { ok: false, error: rule.hostError ?? "Endereço inválido." };
  }

  const value = url.href;
  if (value.length > PROFILE_URL_MAX_LENGTH) {
    return { ok: false, error: `Use um endereço com até ${PROFILE_URL_MAX_LENGTH} caracteres.` };
  }
  return { ok: true, value };
}

/** Dígito verificador do ORCID iD (ISO 7064 MOD 11-2). */
export function orcidCheckDigit(first15Digits: string): string {
  let total = 0;
  for (const char of first15Digits) total = (total + Number(char)) * 2;
  const result = (12 - (total % 11)) % 11;
  return result === 10 ? "X" : String(result);
}

/**
 * Aceita "0000-0002-1825-0097", "https://orcid.org/0000-0002-1825-0097" ou os 16 dígitos
 * colados, confere o dígito verificador e devolve o iD com hífens.
 */
export function normalizeOrcid(input: string): NormalizeResult {
  const raw = input.trim();
  if (!raw) return { ok: false, error: "Informe o ORCID iD." };
  const withoutPrefix = raw.replace(/^https?:\/\//i, "").replace(/^(www\.)?orcid\.org\//i, "");
  const compact = withoutPrefix.replace(/[\s-]/g, "").toUpperCase();
  if (!/^\d{15}[\dX]$/.test(compact)) {
    return { ok: false, error: "O ORCID iD tem 16 dígitos no formato 0000-0000-0000-0000." };
  }
  if (orcidCheckDigit(compact.slice(0, 15)) !== compact[15]) {
    return {
      ok: false,
      error: "Esse ORCID iD não confere (o último dígito não bate). Copie de orcid.org.",
    };
  }
  return { ok: true, value: compact.match(/.{4}/g)!.join("-") };
}

/** Endereço público de um ORCID iD salvo (aceita também valores antigos com URL). */
export function orcidUrl(orcid: string): string {
  const id = orcid.replace(/^https?:\/\//i, "").replace(/^(www\.)?orcid\.org\//i, "");
  return `https://orcid.org/${id}`;
}

/** Rótulo curto para exibir um link (sem protocolo nem "www."). */
export function displayUrl(href: string, max = 40): string {
  const clean = href
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/\/$/, "");
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}
