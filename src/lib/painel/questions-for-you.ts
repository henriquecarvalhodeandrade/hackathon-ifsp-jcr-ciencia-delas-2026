import { MENTORSHIP_TOPICS, type MentorshipTopic } from "@/lib/constants";
import { inferTopicsFromText, normalizeTerm } from "@/lib/matching/rank";

/**
 * "Perguntas esperando por você" — escolhe, entre os tópicos do fórum ainda sem resposta, os
 * que combinam com a membra. Puro e determinístico (questions-for-you.test.ts).
 *
 * Anonimato: tópicos anônimos chegam sem autoria (`authorId = null`) e são tratados como de
 * qualquer outra pessoa. A única exceção é a PRÓPRIA autoria anônima da membra, que o RLS já
 * entrega só para ela (`ownAnonymousThreadIds`): não faz sentido pedir que ela responda a si mesma.
 * Nada aqui tenta descobrir quem escreveu um tópico anônimo.
 */

export interface QuestionThread {
  id: string;
  title: string;
  body: string;
  tags: readonly string[];
  isAnonymous: boolean;
  /** NULL em tópicos anônimos. */
  authorId: string | null;
  authorName: string | null;
  categoryName: string | null;
  isLocked: boolean;
  replyCount: number;
  createdAt: string;
}

export interface QuestionMember {
  id: string;
  /** Palavras-chave do perfil (como ela escreveu). */
  keywords: readonly string[];
  /** Nomes das áreas de pesquisa do perfil. */
  areaNames: readonly string[];
  /** Slugs de MENTORSHIP_TOPICS marcados no perfil. */
  mentorshipTopics: readonly string[];
  /** Tópicos anônimos escritos por ELA (lidos do próprio registro de autoria). */
  ownAnonymousThreadIds?: readonly string[];
}

export interface RankedQuestion {
  thread: QuestionThread;
  /** Termo que combinou ("estatística"), ou null quando entrou só por ser recente. */
  reason: string | null;
  score: number;
}

export interface RankQuestionsOptions {
  now?: number;
  limit?: number;
  maxAgeDays?: number;
}

export const QUESTIONS_LIMIT = 3;
export const QUESTIONS_MAX_AGE_DAYS = 30;
/** Quantos candidatos o servidor carrega antes de ranquear. */
export const QUESTIONS_CANDIDATES = 40;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Pesos: tag explícita > título > corpo; área e tema de mentoria contam menos. */
const WEIGHT = { tag: 3, title: 2, body: 1, area: 2, topic: 1 } as const;

function containsTerm(haystack: string, term: string): boolean {
  if (!term || !haystack) return false;
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|[^a-z0-9])${escaped}(?:$|[^a-z0-9])`).test(haystack);
}

/** Tag × palavra-chave: iguais, ou uma contém a outra como palavra (termos de 4+ letras). */
function tagMatches(tag: string, keyword: string): boolean {
  if (!tag || !keyword) return false;
  if (tag === keyword) return true;
  if (Math.min(tag.length, keyword.length) < 4) return false;
  return containsTerm(tag, keyword) || containsTerm(keyword, tag);
}

/** Tópicos que ainda podem receber a primeira resposta dela. */
export function isOpenQuestionFor(
  thread: QuestionThread,
  member: Pick<QuestionMember, "id" | "ownAnonymousThreadIds">,
  now: number,
  maxAgeDays = QUESTIONS_MAX_AGE_DAYS,
): boolean {
  if (thread.replyCount !== 0 || thread.isLocked) return false;
  if (thread.authorId !== null && thread.authorId === member.id) return false;
  if (member.ownAnonymousThreadIds?.includes(thread.id)) return false;
  const created = Date.parse(thread.createdAt);
  if (!Number.isFinite(created)) return false;
  return now - created <= maxAgeDays * DAY_MS;
}

interface Match {
  score: number;
  reason: string | null;
  bestWeight: number;
}

function scoreThread(thread: QuestionThread, member: QuestionMember): Match {
  const tags = thread.tags.map((t) => ({ raw: t, norm: normalizeTerm(t) }));
  const title = normalizeTerm(thread.title);
  const body = normalizeTerm(thread.body);
  const match: Match = { score: 0, reason: null, bestWeight: 0 };

  const credit = (weight: number, label: string) => {
    match.score += weight;
    if (weight > match.bestWeight) {
      match.bestWeight = weight;
      match.reason = label;
    }
  };

  const seenKeywords = new Set<string>();
  for (const raw of member.keywords) {
    const keyword = normalizeTerm(raw);
    if (!keyword || seenKeywords.has(keyword)) continue;
    seenKeywords.add(keyword);
    const tag = tags.find((t) => tagMatches(t.norm, keyword));
    if (tag) {
      // A tag do tópico vem com a grafia de quem perguntou ("estatística").
      credit(WEIGHT.tag, tag.raw);
      continue;
    }
    // Termos de uma letra ("r") só valem como tag exata: no texto, dariam falso positivo.
    if (keyword.length < 2) continue;
    if (containsTerm(title, keyword)) credit(WEIGHT.title, raw.trim());
    else if (containsTerm(body, keyword)) credit(WEIGHT.body, raw.trim());
  }

  const fullText = `${title} ${body} ${tags.map((t) => t.norm).join(" ")}`;
  for (const area of member.areaNames) {
    const term = normalizeTerm(area);
    if (term.length >= 3 && containsTerm(fullText, term)) credit(WEIGHT.area, area);
  }

  const wanted = new Set(member.mentorshipTopics);
  if (wanted.size > 0) {
    const inferred = inferTopicsFromText(
      `${thread.title}\n${thread.body}\n${thread.tags.join(", ")}`,
    );
    for (const slug of inferred) {
      if (!wanted.has(slug)) continue;
      const label = MENTORSHIP_TOPICS[slug as MentorshipTopic] ?? slug;
      credit(WEIGHT.topic, lowerFirst(label));
    }
  }

  return match;
}

/** "Ingresso na pós-graduação" → "ingresso na pós-graduação" (lê melhor depois de "Fala de:"). */
function lowerFirst(label: string): string {
  return label ? label.charAt(0).toLocaleLowerCase("pt-BR") + label.slice(1) : label;
}

function byRecency(a: QuestionThread, b: QuestionThread): number {
  const diff = Date.parse(b.createdAt) - Date.parse(a.createdAt);
  return diff !== 0 ? diff : a.id.localeCompare(b.id);
}

/**
 * Até `limit` perguntas para a membra: primeiro as que combinam (mais pontos, depois as mais
 * recentes), completadas pelas mais recentes sem resposta (`reason = null`).
 */
export function rankQuestionsForMember(
  threads: readonly QuestionThread[],
  member: QuestionMember,
  options: RankQuestionsOptions = {},
): RankedQuestion[] {
  const now = options.now ?? Date.now();
  const limit = Math.max(0, options.limit ?? QUESTIONS_LIMIT);
  const maxAgeDays = options.maxAgeDays ?? QUESTIONS_MAX_AGE_DAYS;

  const seen = new Set<string>();
  const open = threads.filter((t) => {
    if (seen.has(t.id)) return false;
    seen.add(t.id);
    return isOpenQuestionFor(t, member, now, maxAgeDays);
  });

  const scored = open.map((thread) => ({ thread, ...scoreThread(thread, member) }));
  const matched = scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || byRecency(a.thread, b.thread))
    .map(({ thread, reason, score }) => ({ thread, reason, score }));

  if (matched.length >= limit) return matched.slice(0, limit);

  const recent = scored
    .filter((s) => s.score === 0)
    .sort((a, b) => byRecency(a.thread, b.thread))
    .map(({ thread }) => ({ thread, reason: null, score: 0 }));

  return [...matched, ...recent].slice(0, limit);
}
