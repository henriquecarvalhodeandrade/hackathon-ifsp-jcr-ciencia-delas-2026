import { DELIVERY_CLAIM_PREFIX, DELIVERY_CLAIM_TTL_MS } from "./constants";

/**
 * Quem recebe cada edição (puro, testável).
 *
 * - Inscritas sem áreas (area_ids vazio) recebem todas as edições.
 * - Inscritas com áreas recebem a edição quando pelo menos um paper em destaque é de uma dessas
 *   áreas. Tudo é comparado pela GRANDE área do CNPq (uma subárea conta como a grande área dela).
 * - Ninguém recebe a mesma edição duas vezes: entregas com sent_at preenchido são puladas; uma
 *   entrega "em andamento" recente também (outra execução está cuidando dela).
 * - Teto por execução (maxPerRun): o restante fica para a próxima execução.
 */

export interface AudienceSubscriber {
  id: string;
  email: string;
  area_ids: number[];
  unsubscribe_token: string;
}

export interface AudienceDelivery {
  subscriber_id: string;
  sent_at: string | null;
  error: string | null;
}

export interface AreaRef {
  id: number;
  name: string;
  big_area: string;
}

/** Mapa área → id da grande área (a linha em que name = big_area). */
export function buildBigAreaMap(areas: readonly AreaRef[]): Map<number, number> {
  const bigByName = new Map<string, number>();
  for (const area of areas) {
    if (area.name === area.big_area) bigByName.set(area.big_area, area.id);
  }
  const map = new Map<number, number>();
  for (const area of areas) {
    const big = bigByName.get(area.big_area);
    if (big !== undefined) map.set(area.id, big);
  }
  return map;
}

export function toBigAreas(ids: readonly number[], bigAreaMap: Map<number, number>): Set<number> {
  const out = new Set<number>();
  for (const id of ids) out.add(bigAreaMap.get(id) ?? id);
  return out;
}

export function wantsEdition(
  subscriberBigAreas: Set<number>,
  editionBigAreas: Set<number>,
): boolean {
  if (subscriberBigAreas.size === 0) return true;
  for (const id of subscriberBigAreas) if (editionBigAreas.has(id)) return true;
  return false;
}

export function claimMarker(now: Date): string {
  return `${DELIVERY_CLAIM_PREFIX}${now.toISOString()}`;
}

/** Entrega reivindicada por outra execução há menos de DELIVERY_CLAIM_TTL_MS. */
export function isClaimActive(error: string | null, now: Date): boolean {
  if (!error?.startsWith(DELIVERY_CLAIM_PREFIX)) return false;
  const at = Date.parse(error.slice(DELIVERY_CLAIM_PREFIX.length));
  if (Number.isNaN(at)) return false;
  return now.getTime() - at < DELIVERY_CLAIM_TTL_MS;
}

export interface DeliveryPlan<S extends AudienceSubscriber = AudienceSubscriber> {
  /** Quem recebe NESTA execução (já respeitando o teto). */
  toSend: S[];
  /** Destas, quais já têm linha em newsletter_deliveries (falha anterior ou envio interrompido). */
  retryIds: Set<string>;
  /** Elegíveis ainda não atendidas (antes do teto). */
  eligible: number;
  /** Elegíveis que ficaram para a próxima execução por causa do teto. */
  remaining: number;
  alreadySent: number;
  inProgress: number;
  outsideAreas: number;
}

export function planDeliveries<S extends AudienceSubscriber>(input: {
  subscribers: readonly S[];
  deliveries: readonly AudienceDelivery[];
  editionAreaIds: readonly number[];
  bigAreaMap: Map<number, number>;
  maxPerRun: number;
  now?: Date;
}): DeliveryPlan<S> {
  const now = input.now ?? new Date();
  const byId = new Map(input.deliveries.map((d) => [d.subscriber_id, d]));
  const editionBig = toBigAreas(input.editionAreaIds, input.bigAreaMap);

  const pending: S[] = [];
  const retryIds = new Set<string>();
  let alreadySent = 0;
  let inProgress = 0;
  let outsideAreas = 0;

  for (const subscriber of input.subscribers) {
    const delivery = byId.get(subscriber.id);
    if (delivery?.sent_at) {
      alreadySent += 1;
      continue;
    }
    if (delivery && isClaimActive(delivery.error, now)) {
      inProgress += 1;
      continue;
    }
    if (!wantsEdition(toBigAreas(subscriber.area_ids ?? [], input.bigAreaMap), editionBig)) {
      outsideAreas += 1;
      continue;
    }
    if (delivery) retryIds.add(subscriber.id);
    pending.push(subscriber);
  }

  const cap = Math.max(0, Math.floor(input.maxPerRun));
  const toSend = pending.slice(0, cap);
  return {
    toSend,
    retryIds: new Set(toSend.filter((s) => retryIds.has(s.id)).map((s) => s.id)),
    eligible: pending.length,
    remaining: pending.length - toSend.length,
    alreadySent,
    inProgress,
    outsideAreas,
  };
}

export function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
