/**
 * Constantes de domínio compartilhadas entre UI, validação e matching.
 * Os valores (chaves) são gravados no banco; os rótulos são exibidos na interface.
 */

export const SITE = {
  /** Nome da plataforma (feminino: "a Artemis", "na Artemis", "à Artemis"). */
  name: "Artemis",
  /**
   * Tema do hackathon — nome secundário, nunca o principal: use só como assinatura
   * ("Artemis — uma rede Ciência Delas"), no eyebrow do hero e nos créditos do hackathon.
   */
  theme: "Ciência Delas",
  tagline: "Rede de apoio, mentoria e visibilidade para mulheres na ciência",
  description:
    "Fórum e rede que conecta pesquisadoras iniciantes a mentoras experientes, dá visibilidade a papers de mulheres e reúne uma comunidade de apoio. Projeto do Hackathon IFSP Jacareí 2026, tema Ciência Delas.",
  locale: "pt-BR",
  timeZone: "America/Sao_Paulo",
  repoUrl: "https://github.com/henriquecarvalhodeandrade/hackathon-ifsp-jcr-ciencia-delas-2026",
} as const;

export type CareerStage =
  | "high_school"
  | "undergraduate"
  | "masters"
  | "phd"
  | "postdoc"
  | "researcher"
  | "professor"
  | "industry";

/** Estágio da carreira → rótulo e senioridade (usada no matching de mentoria). */
export const CAREER_STAGES: Record<CareerStage, { label: string; seniority: number }> = {
  high_school: { label: "Ensino médio/técnico", seniority: 0 },
  undergraduate: { label: "Graduação", seniority: 1 },
  masters: { label: "Mestrado", seniority: 2 },
  phd: { label: "Doutorado", seniority: 3 },
  postdoc: { label: "Pós-doutorado", seniority: 4 },
  researcher: { label: "Pesquisadora", seniority: 5 },
  professor: { label: "Docente", seniority: 5 },
  industry: { label: "Indústria/mercado", seniority: 4 },
};

export const CAREER_STAGE_OPTIONS = Object.entries(CAREER_STAGES).map(([value, v]) => ({
  value: value as CareerStage,
  label: v.label,
}));

export const MENTORSHIP_TOPICS = {
  "carreira-academica": "Carreira acadêmica",
  "bolsas-editais": "Bolsas e editais",
  "escrita-cientifica": "Escrita e publicação científica",
  "pos-graduacao": "Ingresso na pós-graduação",
  internacionalizacao: "Intercâmbio e carreira internacional",
  "maternidade-ciencia": "Maternidade e ciência",
  lideranca: "Liderança e gestão de equipes",
  "industria-inovacao": "Carreira na indústria e inovação",
  empreendedorismo: "Empreendedorismo científico",
  "saude-mental": "Saúde mental e equilíbrio",
  "divulgacao-cientifica": "Divulgação científica",
  "programacao-dados": "Programação e análise de dados",
  metodologia: "Metodologia de pesquisa",
  oratoria: "Apresentações e oratória",
  networking: "Networking e eventos",
} as const;

export type MentorshipTopic = keyof typeof MENTORSHIP_TOPICS;

export const MENTORSHIP_TOPIC_OPTIONS = Object.entries(MENTORSHIP_TOPICS).map(([value, label]) => ({
  value: value as MentorshipTopic,
  label,
}));

export type MeetingFormat = "online" | "in_person" | "hybrid";

export const MEETING_FORMATS: Record<MeetingFormat, string> = {
  online: "On-line",
  in_person: "Presencial",
  hybrid: "Híbrido",
};

export const LANGUAGES = {
  pt: "Português",
  en: "Inglês",
  es: "Espanhol",
  fr: "Francês",
  libras: "Libras",
} as const;

export const BR_STATES = {
  AC: "Acre",
  AL: "Alagoas",
  AP: "Amapá",
  AM: "Amazonas",
  BA: "Bahia",
  CE: "Ceará",
  DF: "Distrito Federal",
  ES: "Espírito Santo",
  GO: "Goiás",
  MA: "Maranhão",
  MT: "Mato Grosso",
  MS: "Mato Grosso do Sul",
  MG: "Minas Gerais",
  PA: "Pará",
  PB: "Paraíba",
  PR: "Paraná",
  PE: "Pernambuco",
  PI: "Piauí",
  RJ: "Rio de Janeiro",
  RN: "Rio Grande do Norte",
  RS: "Rio Grande do Sul",
  RO: "Rondônia",
  RR: "Roraima",
  SC: "Santa Catarina",
  SP: "São Paulo",
  SE: "Sergipe",
  TO: "Tocantins",
} as const;

export type BrState = keyof typeof BR_STATES;

export type ReactionKind = "support" | "useful" | "celebrate";

/** Reações do fórum: ícones do lucide-react (sem emoji na UI). */
export const REACTION_KINDS: Record<ReactionKind, { label: string; icon: string }> = {
  support: { label: "Apoio", icon: "heart-handshake" },
  useful: { label: "Útil", icon: "lightbulb" },
  celebrate: { label: "Parabéns", icon: "party-popper" },
};

export type ReportReason =
  "harassment" | "spam" | "misinformation" | "offensive" | "plagiarism" | "other";

export const REPORT_REASONS: Record<ReportReason, string> = {
  harassment: "Assédio ou intimidação",
  spam: "Spam ou propaganda",
  misinformation: "Desinformação",
  offensive: "Conteúdo ofensivo ou discriminatório",
  plagiarism: "Plágio ou violação de direitos autorais",
  other: "Outro motivo",
};

export type PaperRelation = "author" | "coauthor" | "advisor" | "reader";

export const PAPER_RELATIONS: Record<PaperRelation, string> = {
  author: "Sou a autora principal",
  coauthor: "Sou coautora",
  advisor: "Sou orientadora/supervisora do trabalho",
  reader: "Estou indicando o trabalho de outra pesquisadora",
};

export type RankingPeriod = "week" | "month" | "year" | "all" | "hot";

export const RANKING_PERIODS: Record<RankingPeriod, string> = {
  hot: "Em alta",
  week: "Semana",
  month: "Mês",
  year: "Ano",
  all: "Todos os tempos",
};

export type MentorshipStatus = "pending" | "accepted" | "declined" | "cancelled" | "completed";

export const MENTORSHIP_STATUS: Record<MentorshipStatus, string> = {
  pending: "Aguardando resposta",
  accepted: "Mentoria ativa",
  declined: "Recusada",
  cancelled: "Cancelada",
  completed: "Concluída",
};

/** Rotas que exigem sessão (o proxy redireciona para /entrar?next=...). */
export const PROTECTED_PREFIXES = [
  "/onboarding",
  "/perfil",
  "/pesquisadoras",
  "/forum",
  "/mentoria",
  "/papers/novo",
  "/notificacoes",
  "/admin",
] as const;

/** Rotas de autenticação: quem já está logada é mandada para a home da comunidade. */
export const AUTH_ROUTES = ["/entrar", "/cadastro"] as const;
