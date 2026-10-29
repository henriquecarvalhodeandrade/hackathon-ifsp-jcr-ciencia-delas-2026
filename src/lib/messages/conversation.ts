/**
 * Conversa direta (/mensagens/<id> e o rascunho /mensagens/nova?com=<perfil>): regras de
 * apresentação puras, sem rede nem banco — cobertas por conversation.test.ts. As regras de verdade
 * (quem lê, quem envia, pedido de mensagem, limite anti-spam, proteção do ensino médio) estão no
 * banco (docs/18-rede-social.md §2.5).
 */

/** Tamanho máximo de uma mensagem (igual ao CHECK do banco). */
export const MESSAGE_MAX = 2000;
/** O contador do campo só aparece perto do limite (80%). */
export const MESSAGE_COUNTER_FROM = Math.floor(MESSAGE_MAX * 0.8);
/** Quantas mensagens (as mais recentes) a página carrega. */
export const CONVERSATION_MESSAGE_LIMIT = 300;
/** Atualização periódica da conversa enquanto a aba está visível (sem o Realtime). */
export const CONVERSATION_REFRESH_MS = 5_000;
/** Com o Realtime conectado, a atualização periódica fica só como rede de segurança. */
export const CONVERSATION_REFRESH_SUBSCRIBED_MS = 20_000;
/** Caixa de entrada: atualização periódica (com ou sem Realtime, a lista muda pouco). */
export const INBOX_REFRESH_MS = 30_000;
/** Mensagens seguidas da mesma pessoa com até este intervalo formam um bloco (horário uma vez). */
export const MESSAGE_RUN_GAP_MS = 5 * 60 * 1000;

export type ConversationStatus = "request" | "active" | "declined";

export function conversationHref(conversationId: string): string {
  return `/mensagens/${conversationId}`;
}

/**
 * Começar a conversar com uma pessoa: abre a conversa do par, se já existir, ou um rascunho — a
 * conversa só é criada no banco quando a primeira mensagem é enviada. Só leitura: seguro para
 * `<Link>` (a pré-busca não cria nada).
 */
export function startConversationHref(profileId: string): string {
  return `/mensagens/nova?com=${profileId}`;
}

// ---------------------------------------------------------------------------
// Estado da conversa: pode escrever? Qual aviso aparece?
// ---------------------------------------------------------------------------

export type ConversationBannerKind =
  /** Rascunho (a conversa ainda não existe): a primeira mensagem pode ir como pedido. */
  | "draft"
  /** Eu comecei, ela ainda não é conexão: a primeira mensagem vai como pedido. */
  | "first-request"
  /** Ela começou: aceitar, recusar ou responder (responder também aceita). */
  | "incoming-request"
  /** Eu recusei: aceitar agora ou responder reabre a conversa. */
  | "declined-by-me";

export interface ConversationBanner {
  kind: ConversationBannerKind;
  variant: "info" | "warning";
  title: string;
  body: string;
  /** Botões no aviso: Aceitar e Recusar, só Aceitar, ou nenhum. */
  actions: "respond" | "accept" | null;
}

export interface ConversationState {
  /** O campo de envio está ativo (o banco confere de novo: CD086 — pedido sem resposta ou recusado). */
  canSend: boolean;
  banner: ConversationBanner | null;
  /**
   * Mostra "Lida" nas mensagens enviadas? Só com a conversa aceita: num pedido, o recibo contaria
   * a quem pediu que a outra pessoa viu e não respondeu (ou recusou).
   */
  showReadReceipts: boolean;
  /**
   * Pedido enviado (ou recusado — nunca contamos): o campo continua no lugar, desativado, com
   * `placeholder`, e `note` aparece como linha de sistema no fim da conversa.
   */
  waiting: { placeholder: string; note: string } | null;
  /** Nome do botão de enviar ("Enviar pedido" quando a mensagem vai como pedido). */
  sendLabel: string;
}

function otherOrFallback(otherFirstName: string): string {
  return otherFirstName || "ela";
}

export function conversationState({
  status,
  iAmInitiator,
  mySentCount,
  otherFirstName,
}: {
  status: ConversationStatus;
  /** Fui eu que comecei a conversa (`initiator_id`). */
  iAmInitiator: boolean;
  /** Quantas mensagens minhas há na conversa. */
  mySentCount: number;
  otherFirstName: string;
}): ConversationState {
  const other = otherOrFallback(otherFirstName);
  const open = { canSend: true, waiting: null, sendLabel: "Enviar" } as const;
  if (status === "active") return { ...open, banner: null, showReadReceipts: true };

  if (iAmInitiator) {
    // Recusada aparece para quem pediu exatamente como um pedido ainda sem resposta.
    if (status === "request" && mySentCount === 0) {
      return {
        ...open,
        sendLabel: "Enviar pedido",
        showReadReceipts: false,
        banner: {
          kind: "first-request",
          variant: "info",
          title: "Sua primeira mensagem vai como pedido",
          body: `Vocês ainda não são conexões: ${other} recebe um pedido de mensagem e decide se quer conversar. Você manda uma mensagem e espera a resposta.`,
          actions: null,
        },
      };
    }
    return {
      canSend: false,
      banner: null,
      showReadReceipts: false,
      sendLabel: "Enviar",
      waiting: {
        placeholder: `Aguardando a resposta de ${other}`,
        note: `Seu pedido de mensagem foi enviado. Você poderá mandar mais mensagens quando ${other} responder.`,
      },
    };
  }

  if (status === "request") {
    return {
      ...open,
      showReadReceipts: false,
      banner: {
        kind: "incoming-request",
        variant: "info",
        title: `${other} quer conversar com você`,
        body: "Vocês ainda não são conexões. Responder também aceita o pedido; se recusar, ela não fica sabendo.",
        actions: "respond",
      },
    };
  }

  return {
    ...open,
    showReadReceipts: false,
    banner: {
      kind: "declined-by-me",
      variant: "warning",
      title: "Pedido recusado",
      body: "Você recusou este pedido. Aceitar ou responder reabre a conversa.",
      actions: "accept",
    },
  };
}

/**
 * Rascunho (`/mensagens/nova?com=<perfil>`): a conversa ainda não existe e só é criada na primeira
 * mensagem. Não dá para saber de antemão se ela nasce aceita (o vínculo que dispensa o pedido —
 * conexão, mentoria, IC aprovada — é decidido no banco); com conexão aceita, com certeza nasce.
 */
export function draftState({
  otherFirstName,
  connected,
  highSchool,
}: {
  otherFirstName: string;
  /** Conexão aceita entre as duas (aí a conversa nasce aceita). */
  connected: boolean;
  /** A outra pessoa está no ensino médio (só recebe mensagens de quem tem vínculo com ela). */
  highSchool: boolean;
}): ConversationState {
  const other = otherOrFallback(otherFirstName);
  const base = { canSend: true, waiting: null, showReadReceipts: false } as const;
  if (connected) return { ...base, banner: null, sendLabel: "Enviar" };
  if (highSchool) {
    return {
      ...base,
      sendLabel: "Enviar",
      banner: {
        kind: "draft",
        variant: "warning",
        title: "Estudante do ensino médio",
        body: `Para proteger quem tem menos de 18 anos, ${other} só recebe mensagens de quem já tem vínculo com ela na plataforma, como uma conexão. Se ainda não for o seu caso, envie um convite de conexão.`,
        actions: null,
      },
    };
  }
  return {
    ...base,
    sendLabel: "Enviar",
    banner: {
      kind: "draft",
      variant: "info",
      title: "Nova conversa",
      body: `Se vocês ainda não têm vínculo na plataforma (conexão, mentoria ou IC), a sua primeira mensagem chega para ${other} como pedido: você manda uma e espera a resposta.`,
      actions: null,
    },
  };
}

// ---------------------------------------------------------------------------
// Mensagens: lidas e não lidas (a leitura é por conversa, não por mensagem)
// ---------------------------------------------------------------------------

export interface DirectMessageRow {
  id: string;
  sender_id: string;
  body: string;
  created_at: string;
}

export interface DirectMessage {
  id: string;
  body: string;
  created_at: string;
  /** Enviada pela usuária logada. */
  mine: boolean;
  /**
   * Nas minhas: quando a outra pessoa leu (a leitura dela na conversa, se for depois da mensagem).
   * Nas dela: a minha leitura, se cobrir a mensagem. null = ainda não lida.
   */
  read_at: string | null;
}

function time(value: string | null): number {
  if (!value) return Number.NaN;
  return new Date(value).getTime();
}

/**
 * Converte as linhas do banco (em ordem cronológica) para a lista da página. A conversa guarda
 * só "até quando cada uma leu" (`user_a_read_at`/`user_b_read_at`): uma mensagem está lida quando
 * foi criada até esse momento.
 */
export function toDirectMessages(
  rows: readonly DirectMessageRow[],
  {
    userId,
    myReadAt,
    otherReadAt,
  }: { userId: string; myReadAt: string | null; otherReadAt: string | null },
): DirectMessage[] {
  const mine = time(myReadAt);
  const theirs = time(otherReadAt);
  return rows.map((row) => {
    const isMine = row.sender_id === userId;
    const readAt = isMine ? otherReadAt : myReadAt;
    const readTime = isMine ? theirs : mine;
    const read = readAt !== null && time(row.created_at) <= readTime;
    return {
      id: row.id,
      body: row.body,
      created_at: row.created_at,
      mine: isMine,
      read_at: read ? readAt : null,
    };
  });
}

/** Mensagem não lida mais recente da outra pessoa (dispara a marcação de leitura), ou null. */
export function latestUnreadFromOther(messages: readonly DirectMessage[]): DirectMessage | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i]!;
    if (!message.mine && message.read_at === null) return message;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Blocos de mensagens seguidas (horário e recibo uma vez por bloco)
// ---------------------------------------------------------------------------

export interface MessageRun<T> {
  /** Id da primeira mensagem do bloco. */
  key: string;
  mine: boolean;
  items: T[];
}

/**
 * Junta mensagens seguidas (já em ordem cronológica, do mesmo dia) da mesma pessoa, com no máximo
 * `gapMs` entre uma e outra, num bloco: a interface mostra o horário e o recibo só na última.
 */
export function groupRuns<T extends { id: string; mine: boolean; created_at: string }>(
  items: readonly T[],
  gapMs: number = MESSAGE_RUN_GAP_MS,
): MessageRun<T>[] {
  const runs: MessageRun<T>[] = [];
  let lastTime = Number.NaN;
  for (const item of items) {
    const at = new Date(item.created_at).getTime();
    const run = runs.at(-1);
    if (run && run.mine === item.mine && at - lastTime <= gapMs) {
      run.items.push(item);
    } else {
      runs.push({ key: item.id, mine: item.mine, items: [item] });
    }
    lastTime = at;
  }
  return runs;
}

// ---------------------------------------------------------------------------
// Envio otimista: a mensagem aparece na hora e some quando a do servidor chega
// ---------------------------------------------------------------------------

export interface PendingMessage {
  /** Id provisório (só no navegador). */
  tempId: string;
  body: string;
  /** Horário local do envio (só para ordenar; o do servidor vale). */
  created_at: string;
  /** Id da última mensagem que já estava na tela quando ela foi enviada (ou null). */
  afterId: string | null;
}

/**
 * Tira da lista as mensagens provisórias que o servidor já devolveu: para cada uma (em ordem),
 * procura uma mensagem minha com o mesmo texto DEPOIS da última que estava na tela no envio —
 * casando uma a uma, para "ok" mandado duas vezes continuar aparecendo duas vezes. A comparação
 * ignora espaços nas pontas (o banco apara o texto).
 */
export function unconfirmedPending(
  pending: readonly PendingMessage[],
  messages: readonly Pick<DirectMessage, "id" | "body" | "mine">[],
): PendingMessage[] {
  const used = new Set<string>();
  const indexById = new Map(messages.map((m, i) => [m.id, i]));
  return pending.filter((item) => {
    const start = item.afterId === null ? 0 : (indexById.get(item.afterId) ?? -1) + 1;
    const body = item.body.trim();
    for (let i = start; i < messages.length; i++) {
      const message = messages[i]!;
      if (message.mine && !used.has(message.id) && message.body.trim() === body) {
        used.add(message.id);
        return false;
      }
    }
    return true;
  });
}

// ---------------------------------------------------------------------------
// Sugestões para começar (conversa vazia)
// ---------------------------------------------------------------------------

export interface ConversationStarter {
  /** Texto curto do botão. */
  label: string;
  /** Mensagem que vai para o campo (a pessoa edita antes de enviar). */
  text: string;
}

export function conversationStarters(otherFirstName: string): ConversationStarter[] {
  const hello = otherFirstName ? `Olá, ${otherFirstName}!` : "Olá!";
  return [
    {
      label: "Apresentar-se",
      text: `${hello} Vi o seu perfil na Artemis e adoraria trocar uma ideia sobre a sua pesquisa. Conto um pouco sobre mim: `,
    },
    {
      label: "Perguntar sobre a pesquisa",
      text: `${hello} Fiquei curiosa sobre o seu trabalho. Você pode me contar um pouco de como chegou nesse tema?`,
    },
    {
      label: "Propor uma parceria",
      text: `${hello} Acho que as nossas pesquisas conversam. Topa marcar uma conversa rápida para pensarmos em algo juntas?`,
    },
  ];
}
