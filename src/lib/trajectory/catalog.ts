/**
 * Afinidade de trajetória — catálogo FECHADO de marcas opcionais e autodeclaradas
 * (docs/17-afinidade-de-trajetoria.md). Módulo puro, usado no servidor e no cliente.
 *
 * Regras que valem em toda a plataforma:
 *  - opcional: ninguém é obrigada a marcar nada, e não marcar nunca conta como "perfil incompleto";
 *  - só membras veem (o banco não dá SELECT de `profiles` para visitantes);
 *  - nunca vai para a IA (pseudonymize.ts) nem para páginas públicas, Boletim, OG ou ranking;
 *  - sem dados sensíveis do art. 11 da LGPD (raça/etnia, saúde/deficiência, religião,
 *    orientação sexual, identidade de gênero) nem renda — ver TRAJECTORY_EXCLUDED.
 *
 * A lista de slugs se repete no CHECK `profiles_trajectory_tags_catalog` e na função
 * `private.profiles_normalize_trajectory` (migration 20261028190200_trajectory_affinity.sql);
 * catalog.test.ts confere que os três estão iguais.
 */

export interface TrajectoryMark {
  slug: string;
  /** Rótulo do formulário, em primeira pessoa. */
  label: string;
  /** Rótulo curto (chips do perfil, do diretório e do cartão de sugestão). */
  chip: string;
  /** Frase sobre duas mulheres que compartilham a marca (motivo do matching). */
  shared: string;
}

export const TRAJECTORY_MARKS = [
  {
    slug: "primeira-geracao",
    label: "Fui a primeira da família na universidade",
    chip: "Primeira da família na universidade",
    shared: "as duas foram as primeiras da família na universidade",
  },
  {
    slug: "escola-publica",
    label: "Estudei em escola pública",
    chip: "Escola pública",
    shared: "as duas estudaram em escola pública",
  },
  {
    slug: "ensino-tecnico",
    label: "Vim do ensino técnico",
    chip: "Ensino técnico",
    shared: "as duas vieram do ensino técnico",
  },
  {
    slug: "mae-cuidadora",
    label: "Sou mãe ou cuidadora",
    chip: "Mãe ou cuidadora",
    shared: "as duas conciliam (ou conciliaram) pesquisa e cuidado",
  },
  {
    slug: "trabalha-e-estuda",
    label: "Trabalho ou trabalhei enquanto estudava",
    chip: "Trabalha e estuda",
    shared: "as duas conciliaram trabalho e estudo",
  },
  {
    slug: "retorno-aos-estudos",
    label: "Voltei a estudar depois de uma pausa",
    chip: "Voltou a estudar",
    shared: "as duas voltaram a estudar depois de uma pausa",
  },
  {
    slug: "mudanca-de-area",
    label: "Mudei de área ao longo do caminho",
    chip: "Mudou de área",
    shared: "as duas mudaram de área no caminho",
  },
  {
    slug: "fora-das-capitais",
    label: "Estudo ou pesquiso fora das capitais",
    chip: "Fora das capitais",
    shared: "as duas estudam ou pesquisam fora das capitais",
  },
] as const satisfies readonly TrajectoryMark[];

export type TrajectorySlug = (typeof TRAJECTORY_MARKS)[number]["slug"];

export const TRAJECTORY_SLUGS: readonly TrajectorySlug[] = TRAJECTORY_MARKS.map((m) => m.slug);

/** Máximo de marcas por perfil (= tamanho do catálogo; o banco confere o mesmo limite). */
export const TRAJECTORY_MAX = TRAJECTORY_MARKS.length;

/**
 * Categorias deixadas de fora DE PROPÓSITO: dados sensíveis do art. 11 da LGPD ou
 * estigmatizantes. Não entram no catálogo nem em versões futuras sem uma nova análise.
 */
export const TRAJECTORY_EXCLUDED = [
  "raça ou etnia",
  "deficiência ou saúde",
  "religião",
  "orientação sexual",
  "identidade de gênero",
  "renda",
] as const;

/** Texto de ajuda do formulário (onboarding e /perfil). */
export const TRAJECTORY_HELP =
  "Opcional. Ajuda a encontrar mentoras que passaram por caminhos parecidos com o seu. Só membras da Artemis veem, e você pode tirar quando quiser. Não pedimos dados sensíveis como raça, religião ou saúde.";

const BY_SLUG: ReadonlyMap<string, TrajectoryMark> = new Map(
  TRAJECTORY_MARKS.map((mark) => [mark.slug, mark]),
);
const ORDER: ReadonlyMap<string, number> = new Map(TRAJECTORY_SLUGS.map((slug, i) => [slug, i]));

export function isTrajectorySlug(value: unknown): value is TrajectorySlug {
  return typeof value === "string" && BY_SLUG.has(value);
}

export function trajectoryMark(slug: string): TrajectoryMark | null {
  return BY_SLUG.get(slug) ?? null;
}

/**
 * Só marcas do catálogo, sem repetição, na ordem do catálogo. Valores desconhecidos (ex.: uma
 * marca removida numa versão futura) são ignorados — quem exibe nunca quebra por causa deles.
 */
export function normalizeTrajectoryTags(
  values: readonly (string | null | undefined)[] | null | undefined,
): TrajectorySlug[] {
  const seen = new Set<TrajectorySlug>();
  for (const value of values ?? []) {
    if (isTrajectorySlug(value)) seen.add(value);
  }
  return [...seen].sort((a, b) => ORDER.get(a)! - ORDER.get(b)!);
}

/** Marcas que as duas declararam, na ordem do catálogo. Vazio se alguma não declarou nada. */
export function sharedTrajectory(
  a: readonly (string | null | undefined)[] | null | undefined,
  b: readonly (string | null | undefined)[] | null | undefined,
): TrajectorySlug[] {
  const other = new Set(normalizeTrajectoryTags(b));
  if (other.size === 0) return [];
  return normalizeTrajectoryTags(a).filter((slug) => other.has(slug));
}

export function trajectoryChipLabels(slugs: readonly string[]): string[] {
  return normalizeTrajectoryTags(slugs).map((slug) => BY_SLUG.get(slug)!.chip);
}

const SHARED_SUBJECT = "as duas ";

/**
 * "Vocês têm em comum: as duas foram as primeiras da família na universidade e estudaram em
 * escola pública." Usa até `max` marcas (padrão 2); o sujeito "as duas" aparece uma vez só.
 * Devolve null quando não há marca em comum.
 */
export function sharedTrajectorySentence(slugs: readonly string[], max = 2): string | null {
  const phrases = normalizeTrajectoryTags(slugs)
    .slice(0, Math.max(1, max))
    .map((slug) => BY_SLUG.get(slug)!.shared);
  if (phrases.length === 0) return null;
  const predicates = phrases.map((p) =>
    p.startsWith(SHARED_SUBJECT) ? p.slice(SHARED_SUBJECT.length) : p,
  );
  const joined =
    predicates.length === 1
      ? predicates[0]
      : `${predicates.slice(0, -1).join(", ")} e ${predicates[predicates.length - 1]}`;
  return `Vocês têm em comum: ${SHARED_SUBJECT}${joined}.`;
}

/** Frase "Vocês têm em comum: as duas …." dentro de um motivo (as frases do catálogo não têm ponto). */
const SENTENCE_RE = /\s*Vocês têm em comum: as duas [^.]*\./g;

function tidy(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/**
 * Tira do texto a frase de trajetória. Usado antes de copiar um motivo para um registro que
 * dura mais que as marcas (ex.: o pedido de mentoria) — tirar uma marca vale para tudo.
 */
export function withoutTrajectorySentence(text: string): string {
  if (!text.match(SENTENCE_RE)) return text;
  return tidy(text.replace(SENTENCE_RE, " "));
}

/**
 * Atualiza a frase de trajetória de um motivo SALVO com as marcas em comum de agora: troca pela
 * frase atual ou tira, se não há mais nada em comum. Sem frase no texto, devolve igual.
 */
export function refreshTrajectorySentence(text: string, sharedSlugs: readonly string[]): string {
  if (!text.match(SENTENCE_RE)) return text;
  const current = sharedTrajectorySentence(sharedSlugs, 2);
  let replaced = false;
  const out = text.replace(SENTENCE_RE, () => {
    if (replaced || !current) return " ";
    replaced = true;
    return ` ${current}`;
  });
  return tidy(out);
}

/** Opções do formulário (rótulos em primeira pessoa). */
export const TRAJECTORY_OPTIONS: ReadonlyArray<{ value: TrajectorySlug; label: string }> =
  TRAJECTORY_MARKS.map((mark) => ({ value: mark.slug, label: mark.label }));

/** Opções do filtro do diretório (rótulos curtos). */
export const TRAJECTORY_FILTER_OPTIONS: ReadonlyArray<{ value: TrajectorySlug; label: string }> =
  TRAJECTORY_MARKS.map((mark) => ({ value: mark.slug, label: mark.chip }));
