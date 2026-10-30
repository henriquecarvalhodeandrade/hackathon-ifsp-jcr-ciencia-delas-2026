/**
 * "Seus próximos passos" do /painel — regras PURAS (sem rede nem banco), cobertas por
 * next-steps.test.ts. Os dados chegam prontos de src/lib/painel/queries.ts.
 *
 * Princípios: um caminho claro por vez, nada de culpa nem de sequência ("streak"), e nunca
 * cobrar campos pessoais opcionais (pronomes, cidade, trajetória...). Só entram aqui as ações
 * que destravam a rede para ela: ser encontrada, pedir/oferecer ajuda e conversar.
 */

export type NextStepTrack = "mentee" | "explorer" | "mentor";

export type NextStepId =
  | "perfil"
  | "apresente-se"
  | "encontre-mentoras"
  | "envie-pedido"
  | "primeira-mensagem"
  | "vitrine"
  | "pesquisadoras"
  | "conte-como-ajuda"
  | "disponibilidade"
  | "responda-pedidos"
  | "ajude-forum"
  | "divulgue-paper";

export interface NextStep {
  id: NextStepId;
  title: string;
  description: string;
  /** Destino do passo. `null` = ainda não dá para agir (passo travado, sem botão). */
  href: string | null;
  /** Rótulo do botão quando este é o passo da vez. */
  cta: string;
  done: boolean;
}

export interface NextStepsInput {
  isMentor: boolean;
  seeksMentorship: boolean;
  headline: string | null;
  areaCount: number;
  keywordCount: number;
  mentoringOffer: string | null;
  mentorshipTopicCount: number;
  mentorAvailable: boolean;
  mentorCapacity: number;
  /** Tem um tópico COM NOME na categoria "apresente-se". */
  hasIntroThread: boolean;
  /** Linhas em mentor_suggestions (ela já viu sugestões de mentoras). */
  suggestionCount: number;
  /** Pedidos de mentoria enviados por ela, em qualquer status. */
  requestsAsMentee: number;
  /** Mentoria ATIVA (aceita) em que ela é a mentoranda — a conversa mais recente. */
  activeMenteeRequestId: string | null;
  /** Primeiro nome da mentora dessa mentoria ativa (para a descrição do passo). */
  activeMentorFirstName?: string | null;
  /** Mensagens que ela já enviou em conversas de mentoria. */
  sentMessageCount: number;
  /** Pedidos recebidos aguardando a resposta dela. */
  pendingReceivedCount: number;
  /** Respondeu a algum tópico do fórum nos últimos 30 dias (com nome ou anônima). */
  repliedRecently: boolean;
  /** Papers que ela enviou à Vitrine. */
  submittedPaperCount: number;
  /** Papers que ela destacou (votou) na Vitrine. */
  votedPaperCount: number;
}

export interface NextStepsResult {
  track: NextStepTrack;
  steps: NextStep[];
  doneCount: number;
  /** Índice do primeiro passo pendente (o "agora"), ou -1 se está tudo feito. */
  currentIndex: number;
  allDone: boolean;
}

/** Mínimo para o perfil ser encontrado (mesmos critérios usados no matching de mentoria). */
export const PROFILE_MIN_KEYWORDS = 3;
export const PROFILE_MIN_AREAS = 1;

export const ALL_DONE_MESSAGE = "Tudo em dia por aqui. Obrigada por fazer a rede andar.";
export const LOCKED_MESSAGE_STEP = "Depois que uma mentora aceitar, a conversa aparece aqui.";

function hasText(value: string | null | undefined): boolean {
  return Boolean(value && value.trim());
}

function joinPt(parts: readonly string[]): string {
  if (parts.length <= 1) return parts.join("");
  return `${parts.slice(0, -1).join(", ")} e ${parts[parts.length - 1]}`;
}

/** O que falta no perfil, em linguagem neutra (só o mínimo, nunca campos opcionais). */
export function missingProfileParts(input: NextStepsInput): string[] {
  const missing: string[] = [];
  if (!hasText(input.headline)) missing.push("uma frase de apresentação");
  if (input.areaCount < PROFILE_MIN_AREAS) missing.push("sua área de pesquisa");
  const keywordsLeft = Math.max(0, PROFILE_MIN_KEYWORDS - input.keywordCount);
  if (keywordsLeft === 1) missing.push("mais 1 palavra-chave");
  else if (keywordsLeft > 1) missing.push(`mais ${keywordsLeft} palavras-chave`);
  return missing;
}

function profileStep(input: NextStepsInput): NextStep {
  const missing = missingProfileParts(input);
  return {
    id: "perfil",
    cta: "Completar perfil",
    title: "Complete seu perfil",
    description:
      missing.length === 0
        ? "Frase de apresentação, área e palavras-chave prontas: é assim que mentoras e colegas te encontram."
        : `Falta pouco: ${joinPt(missing)}. É assim que mentoras e colegas te encontram.`,
    href: "/perfil#pesquisa",
    done: missing.length === 0,
  };
}

function introStep(input: NextStepsInput): NextStep {
  return {
    id: "apresente-se",
    cta: "Escrever apresentação",
    title: "Apresente-se no fórum",
    description: input.hasIntroThread
      ? "Você já contou quem é para a comunidade."
      : "Conte quem você é e o que pesquisa no espaço Apresente-se. A comunidade costuma responder rápido.",
    href: "/forum/novo?categoria=apresente-se",
    done: input.hasIntroThread,
  };
}

function menteeSteps(input: NextStepsInput): NextStep[] {
  const sentRequest = input.requestsAsMentee > 0;
  const messaged = input.sentMessageCount > 0;
  const canMessage = input.activeMenteeRequestId !== null;
  return [
    profileStep(input),
    introStep(input),
    {
      id: "encontre-mentoras",
      cta: "Ver sugestões",
      title: "Encontre mentoras",
      description:
        "Veja sugestões de mentoras que combinam com a sua pesquisa, com o motivo de cada uma.",
      href: "/mentoria?aba=sugestoes",
      // Quem já pediu mentoria obviamente já encontrou mentoras.
      done: input.suggestionCount > 0 || sentRequest,
    },
    {
      id: "envie-pedido",
      cta: "Escolher mentora",
      title: "Envie um pedido",
      description: "Escolha uma mentora e conte, em poucas linhas, no que ela pode te ajudar.",
      href: "/mentoria?aba=sugestoes",
      done: sentRequest,
    },
    {
      id: "primeira-mensagem",
      cta: "Abrir conversa",
      title: "Mande a primeira mensagem",
      description:
        messaged || canMessage
          ? `Combine com ${input.activeMentorFirstName?.trim() || "sua mentora"} o primeiro encontro pela conversa da mentoria.`
          : LOCKED_MESSAGE_STEP,
      href: canMessage ? `/mentoria/conversa/${input.activeMenteeRequestId}` : null,
      done: messaged,
    },
  ];
}

function explorerSteps(input: NextStepsInput): NextStep[] {
  return [
    profileStep(input),
    introStep(input),
    {
      id: "vitrine",
      cta: "Ir para a Vitrine",
      title: "Explore a Vitrine",
      description: "Leia resumos de papers de pesquisadoras e destaque os que te inspiram.",
      href: "/papers",
      done: input.votedPaperCount > 0 || input.submittedPaperCount > 0,
    },
    {
      id: "pesquisadoras",
      cta: "Ver pesquisadoras",
      title: "Encontre pesquisadoras da sua área",
      description: "Veja quem pesquisa temas próximos aos seus e puxe conversa no fórum.",
      href: "/pesquisadoras",
      done: input.repliedRecently,
    },
  ];
}

function mentorSteps(input: NextStepsInput): NextStep[] {
  const pending = input.pendingReceivedCount;
  return [
    {
      id: "conte-como-ajuda",
      cta: "Escrever oferta",
      title: "Conte como pode ajudar",
      description:
        "Escreva no perfil o que você oferece e marque pelo menos um tema de mentoria: é o que aparece para quem procura.",
      href: "/perfil#mentoria",
      done: hasText(input.mentoringOffer) && input.mentorshipTopicCount >= 1,
    },
    {
      id: "disponibilidade",
      cta: "Ajustar disponibilidade",
      title: "Abra sua disponibilidade",
      description:
        "Com pelo menos uma vaga e os pedidos abertos, você aparece nas sugestões de quem está começando.",
      // Os pedidos abrem e fecham em /mentoria; o número de vagas fica no perfil. O botão leva ao
      // lugar do que falta (pedidos fechados primeiro).
      href:
        !input.mentorAvailable || input.mentorCapacity >= 1
          ? "/mentoria?aba=recebidas"
          : "/perfil#mentoria",
      done: input.mentorAvailable && input.mentorCapacity >= 1,
    },
    {
      id: "responda-pedidos",
      cta: "Ver pedidos",
      title: "Responda aos pedidos",
      description:
        pending === 0
          ? "Nenhum pedido esperando por você agora."
          : pending === 1
            ? "Uma pesquisadora está esperando sua resposta. Aceitar ou recusar com carinho já ajuda."
            : `${pending} pesquisadoras estão esperando sua resposta. Aceitar ou recusar com carinho já ajuda.`,
      href: "/mentoria?aba=recebidas",
      done: pending === 0,
    },
    {
      id: "ajude-forum",
      cta: "Ver o fórum",
      title: "Ajude no fórum",
      description: "Responda a uma dúvida da comunidade: em 5 minutos você ajuda uma iniciante.",
      href: "/forum",
      done: input.repliedRecently,
    },
    {
      id: "divulgue-paper",
      cta: "Enviar paper",
      title: "Divulgue um paper",
      description:
        "Compartilhe um trabalho seu ou de outra pesquisadora na Vitrine Delas, com um resumo acessível.",
      href: "/papers/novo",
      done: input.submittedPaperCount > 0,
    },
  ];
}

/** Trilha da membra: mentora tem prioridade; quem não busca mentoria explora a rede. */
export function stepTrack(
  input: Pick<NextStepsInput, "isMentor" | "seeksMentorship">,
): NextStepTrack {
  if (input.isMentor) return "mentor";
  return input.seeksMentorship ? "mentee" : "explorer";
}

export function computeNextSteps(input: NextStepsInput): NextStepsResult {
  const track = stepTrack(input);
  const steps =
    track === "mentor"
      ? mentorSteps(input)
      : track === "mentee"
        ? menteeSteps(input)
        : explorerSteps(input);
  const doneCount = steps.filter((s) => s.done).length;
  const currentIndex = steps.findIndex((s) => !s.done);
  return { track, steps, doneCount, currentIndex, allDone: currentIndex === -1 };
}
