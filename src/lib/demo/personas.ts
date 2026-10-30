/**
 * Pessoas fictícias do modo demonstração (/demo, docs/14-painel-e-modo-demo.md).
 *
 * Lista FIXA e pura (sem rede, sem banco): o formulário só manda o `slug` e o servidor nunca
 * confia nele — procura aqui e, se não achar, recusa. Contas de administração e de moderação
 * (admin@, moderacao@) NUNCA entram nesta lista: o modo demonstração não dá poderes a ninguém.
 *
 * Os ids e e-mails são os do seed (supabase/seed.sql §2a). O servidor confere que o id existe e
 * que o e-mail bate antes de abrir a sessão.
 */

export const DEMO_EMAIL_DOMAIN = "demo.cienciadelas.dev";

export interface DemoPersona {
  slug: string;
  /** id da conta no seed (auth.users / profiles). */
  id: string;
  email: string;
  name: string;
  /** Primeiro nome, para os botões ("Entrar como Larissa"). */
  firstName: string;
  description: string;
  /** O que a pessoa da plateia vai encontrar ao entrar. */
  highlights: readonly string[];
  /** Para onde ela vai depois de entrar. */
  start: string;
}

const PERSONAS: readonly DemoPersona[] = Object.freeze([
  Object.freeze({
    slug: "larissa",
    id: "d2000000-0000-4000-8000-000000000001",
    email: `larissa@${DEMO_EMAIL_DOMAIN}`,
    name: "Larissa Gomes",
    firstName: "Larissa",
    description: "Graduanda em IC que procura mentora",
    highlights: Object.freeze([
      "Feed, rede e mensagens: curta, comente, siga e converse",
      "Mentoria com a Marina já aceita, com conversa pela plataforma",
      "Candidatura aprovada numa IC e os próximos passos de quem está começando",
    ]),
    start: "/painel",
  }),
  Object.freeze({
    slug: "marina",
    id: "d1000000-0000-4000-8000-000000000001",
    email: `marina@${DEMO_EMAIL_DOMAIN}`,
    name: "Marina Albuquerque",
    firstName: "Marina",
    description: "Professora e mentora com pedidos para responder",
    highlights: Object.freeze([
      "Um pedido de mentoria aguardando resposta",
      "Vaga de IC com candidatura para responder e um pedido de mensagem",
      "Perguntas do fórum que combinam com a pesquisa dela",
    ]),
    start: "/painel",
  }),
  Object.freeze({
    slug: "debora",
    id: "d2000000-0000-4000-8000-000000000005",
    email: `debora@${DEMO_EMAIL_DOMAIN}`,
    name: "Débora Alves",
    firstName: "Débora",
    description: "Mentoranda que concluiu uma mentoria e tem declaração",
    highlights: Object.freeze([
      "Mentoria com a Patrícia concluída, com retorno privado enviado",
      "Declaração de participação com QR code verificável",
      "Conquista no feed com curtidas e comentários da rede",
    ]),
    start: "/mentoria?aba=ativas",
  }),
]);

/** Contas que nunca podem virar persona, mesmo que alguém edite a lista por engano. */
const NEVER_PERSONAS = new Set([`admin@${DEMO_EMAIL_DOMAIN}`, `moderacao@${DEMO_EMAIL_DOMAIN}`]);

export function listPersonas(): readonly DemoPersona[] {
  return PERSONAS.filter((p) => !NEVER_PERSONAS.has(p.email));
}

/** A persona do slug (exato, minúsculas), ou null. Nunca devolve admin/moderação. */
export function getPersona(slug: unknown): DemoPersona | null {
  if (typeof slug !== "string" || slug.length === 0 || slug.length > 40) return null;
  return listPersonas().find((p) => p.slug === slug) ?? null;
}

/** E-mail das contas fictícias do seed (qualquer uma, não só as personas). */
export function isDemoEmail(email: string | null | undefined): boolean {
  if (typeof email !== "string") return false;
  const normalized = email.trim().toLowerCase();
  const at = normalized.lastIndexOf("@");
  return at > 0 && normalized.slice(at + 1) === DEMO_EMAIL_DOMAIN;
}

/** Persona cujo e-mail é este (para o aviso "você está como…"), ou null. */
export function personaByEmail(email: string | null | undefined): DemoPersona | null {
  if (!isDemoEmail(email)) return null;
  const normalized = email!.trim().toLowerCase();
  return listPersonas().find((p) => p.email === normalized) ?? null;
}
