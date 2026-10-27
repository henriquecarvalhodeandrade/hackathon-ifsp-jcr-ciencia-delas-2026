import "server-only";
import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { generateEditionIntro } from "@/lib/ai/tasks";
import type { Enums, Json, Tables } from "@/lib/database.types";
import { getEmailTransport, getEmailTransportInfo, RESEND_BATCH_LIMIT, sendBatch, type EmailMessage, type EmailTransportInfo } from "@/lib/email";
import { getSiteUrl } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { pluralize } from "@/lib/utils";
import { buildBigAreaMap, chunk, claimMarker, planDeliveries, type AudienceSubscriber } from "./audience";
import { collectEditionContent } from "./build-edition";
import { getMaxPerRun } from "./config";
import { fallbackIntro, isEditionEmpty, parseEditionContent } from "./content";
import { absoluteUrl, renderEditionEmail } from "./render";
import { getEditionWeek } from "./week";

/**
 * Serviço da newsletter (CONTRACT §11), usado pelo cron (/api/cron/newsletter) e pelo painel /admin.
 * Tudo roda com o cliente admin (service role) — chame SEMPRE depois de verificar a autorização
 * (CRON_SECRET no cron; requireModerator/admin no painel).
 *
 *   generateWeeklyEdition({ now?, publish?, force? }) → { edition, created, regenerated }
 *   sendEdition(editionId, { dryRun? })             → { sent, skipped, failed, reason?, eligible, remaining, dryRun }
 *   runWeeklyNewsletterJob({ now? })                → gera + publica + envia (idempotente por semana)
 *   getNewsletterOverview()                         → contagens e status do e-mail (para o painel)
 */

export type NewsletterEdition = Tables<"newsletter_editions">;
type EditionStatus = Enums<"edition_status">;

export interface GenerateEditionOptions {
  /** Instante de referência (padrão: agora). Define a semana e a janela de 7 dias. */
  now?: Date;
  /** Publica a edição (status 'published') — fica visível no arquivo público. */
  publish?: boolean;
  /** Recalcula o conteúdo de uma edição já existente da mesma semana (nunca de uma já enviada). */
  force?: boolean;
}

export interface GenerateEditionResult {
  edition: NewsletterEdition;
  /** true quando a edição da semana não existia e foi criada agora. */
  created: boolean;
  /** true quando `force` recalculou o conteúdo de uma edição existente. */
  regenerated: boolean;
}

export interface SendEditionOptions {
  /** Só calcula quantas pessoas receberiam agora; não envia nem grava nada. */
  dryRun?: boolean;
}

export interface SendEditionResult {
  /** E-mails enviados nesta execução (no dryRun: quantos SERIAM enviados agora). */
  sent: number;
  /** Já tinham recebido, estão fora das áreas escolhidas ou têm envio em andamento. */
  skipped: number;
  failed: number;
  reason?: string;
  /** Elegíveis ainda não atendidas antes desta execução. */
  eligible: number;
  /** Elegíveis que ficaram para a próxima execução (teto por execução ou falhas). */
  remaining: number;
  dryRun: boolean;
}

export interface WeeklyJobResult {
  slug: string;
  editionId: string;
  created: boolean;
  published: boolean;
  status: EditionStatus;
  send: SendEditionResult | null;
  reason?: string;
}

export interface NewsletterOverview {
  email: EmailTransportInfo;
  maxPerRun: number;
  subscribers: { active: number; pending: number; unsubscribed: number };
}

const EDITION_COLUMNS =
  "id, slug, title, summary, content, status, period_start, period_end, published_at, sent_at, recipients_count, created_at, updated_at";

function toJson(value: object): NonNullable<Json> {
  return JSON.parse(JSON.stringify(value)) as NonNullable<Json>;
}

function safeRevalidate(...paths: string[]) {
  for (const path of paths) {
    try {
      revalidatePath(path);
    } catch {
      // Fora de uma requisição (scripts/testes) não há cache para invalidar.
    }
  }
}

function revalidateEdition(slug: string) {
  safeRevalidate("/newsletter", `/newsletter/${slug}`, "/admin");
}

// -----------------------------------------------------------------------------
// Geração
// -----------------------------------------------------------------------------

/** Gera (ou reaproveita) a edição da semana de `now`. Idempotente pelo slug "AAAA-sNN". */
export async function generateWeeklyEdition(options: GenerateEditionOptions = {}): Promise<GenerateEditionResult> {
  const { now = new Date(), publish = false, force = false } = options;
  const admin = createAdminClient();
  const week = getEditionWeek(now);

  const { data: existing, error: findError } = await admin
    .from("newsletter_editions")
    .select(EDITION_COLUMNS)
    .eq("slug", week.slug)
    .maybeSingle();
  if (findError) throw new Error(`Não foi possível consultar as edições: ${findError.message}`);

  if (existing && (!force || existing.status === "sent")) {
    if (publish && existing.status === "draft") {
      const edition = await setEditionStatus(existing.id, "published");
      revalidateEdition(edition.slug);
      return { edition, created: false, regenerated: false };
    }
    return { edition: existing, created: false, regenerated: false };
  }

  const content = await collectEditionContent(admin, { start: week.windowStart, end: week.windowEnd });
  const summary = (await generateEditionIntro(content)) ?? fallbackIntro(content);

  const fields = {
    title: week.title,
    summary,
    content: toJson(content),
    period_start: week.periodStart,
    period_end: week.periodEnd,
  };

  if (existing) {
    const status: EditionStatus = publish && existing.status === "draft" ? "published" : existing.status;
    const { data, error } = await admin
      .from("newsletter_editions")
      .update({ ...fields, status })
      .eq("id", existing.id)
      .neq("status", "sent")
      .select(EDITION_COLUMNS)
      .single();
    if (error) throw new Error(`Não foi possível atualizar a edição ${week.slug}: ${error.message}`);
    revalidateEdition(data.slug);
    return { edition: data, created: false, regenerated: true };
  }

  const { data, error } = await admin
    .from("newsletter_editions")
    .insert({ slug: week.slug, ...fields, status: publish ? "published" : "draft" })
    .select(EDITION_COLUMNS)
    .single();

  if (error) {
    // Duas execuções ao mesmo tempo (o cron da Vercel pode duplicar): a outra venceu.
    if (error.code === "23505") {
      const { data: winner } = await admin
        .from("newsletter_editions")
        .select(EDITION_COLUMNS)
        .eq("slug", week.slug)
        .single();
      if (winner) return { edition: winner, created: false, regenerated: false };
    }
    throw new Error(`Não foi possível criar a edição ${week.slug}: ${error.message}`);
  }

  if (data.status !== "draft") revalidateEdition(data.slug);
  return { edition: data, created: true, regenerated: false };
}

async function setEditionStatus(id: string, status: EditionStatus): Promise<NewsletterEdition> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("newsletter_editions")
    .update({ status })
    .eq("id", id)
    .select(EDITION_COLUMNS)
    .single();
  if (error) throw new Error(`Não foi possível atualizar a edição: ${error.message}`);
  return data;
}

/** Publica uma edição em rascunho (aparece no arquivo público). */
export async function publishEdition(editionId: string): Promise<NewsletterEdition> {
  const edition = await setEditionStatus(editionId, "published");
  revalidateEdition(edition.slug);
  return edition;
}

// -----------------------------------------------------------------------------
// Envio
// -----------------------------------------------------------------------------

type PageResult<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>;

async function fetchAll<T>(page: (from: number, to: number) => PageResult<T>, pageSize = 1000): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; from < 200_000; from += pageSize) {
    const { data, error } = await page(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
  }
  return out;
}

function batchKey(editionId: string, subscriberIds: string[]): string {
  const digest = createHash("sha256").update([...subscriberIds].sort().join(",")).digest("hex").slice(0, 24);
  return `newsletter-${editionId}-${digest}`;
}

function result(partial: Partial<SendEditionResult> & Pick<SendEditionResult, "reason">): SendEditionResult {
  return { sent: 0, skipped: 0, failed: 0, eligible: 0, remaining: 0, dryRun: false, ...partial };
}

/**
 * Envia uma edição publicada para as inscritas ativas. Nunca envia duas vezes para a mesma pessoa
 * (registro em newsletter_deliveries), respeita as áreas escolhidas e o teto NEWSLETTER_MAX_PER_RUN;
 * o que sobrar vai na próxima chamada. Quando todas foram atendidas, a edição vira 'sent'.
 */
export async function sendEdition(editionId: string, options: SendEditionOptions = {}): Promise<SendEditionResult> {
  const dryRun = Boolean(options.dryRun);
  const admin = createAdminClient();

  const { data: edition, error: editionError } = await admin
    .from("newsletter_editions")
    .select(EDITION_COLUMNS)
    .eq("id", editionId)
    .maybeSingle();
  if (editionError) throw new Error(`Não foi possível carregar a edição: ${editionError.message}`);
  if (!edition) return result({ reason: "Edição não encontrada.", dryRun });
  if (edition.status === "draft") {
    return result({ reason: "Publique a edição antes de enviar.", dryRun });
  }

  const transport = getEmailTransport();
  const content = parseEditionContent(edition.content);
  const maxPerRun = getMaxPerRun();

  const [subscribers, deliveries, areasResult] = await Promise.all([
    fetchAll<AudienceSubscriber>((from, to) =>
      admin
        .from("newsletter_subscribers")
        .select("id, email, area_ids, unsubscribe_token")
        .eq("status", "active")
        .order("id")
        .range(from, to),
    ),
    fetchAll<{ subscriber_id: string; sent_at: string | null; error: string | null }>((from, to) =>
      admin
        .from("newsletter_deliveries")
        .select("subscriber_id, sent_at, error")
        .eq("edition_id", edition.id)
        .order("subscriber_id")
        .range(from, to),
    ),
    admin.from("research_areas").select("id, name, big_area"),
  ]);
  if (areasResult.error) throw new Error(`Não foi possível carregar as áreas: ${areasResult.error.message}`);

  // Áreas da edição = áreas dos papers em destaque (edições antigas não guardam area_id no content).
  const editionAreaIds = content.papers.flatMap((p) => (typeof p.area_id === "number" ? [p.area_id] : []));
  const missing = content.papers.filter((p) => p.area_id === undefined).map((p) => p.id);
  if (missing.length) {
    const { data } = await admin.from("papers").select("id, area_id").in("id", missing);
    for (const p of data ?? []) if (p.area_id !== null) editionAreaIds.push(p.area_id);
  }

  const now = new Date();
  const plan = planDeliveries({
    subscribers,
    deliveries,
    editionAreaIds,
    bigAreaMap: buildBigAreaMap(areasResult.data ?? []),
    maxPerRun,
    now,
  });
  const skipped = plan.alreadySent + plan.outsideAreas + plan.inProgress;

  if (dryRun) {
    const parts = [
      `Simulação: ${pluralize(plan.toSend.length, "e-mail seria enviado", "e-mails seriam enviados")} agora`,
      plan.remaining
        ? `${pluralize(plan.remaining, "ficaria", "ficariam")} para a próxima execução (limite de ${maxPerRun} por execução)`
        : null,
      transport === "none" ? "atenção: nenhum serviço de e-mail está configurado (RESEND_API_KEY)" : null,
    ].filter(Boolean);
    return {
      sent: plan.toSend.length,
      skipped,
      failed: 0,
      eligible: plan.eligible,
      remaining: plan.remaining,
      dryRun: true,
      reason: `${parts.join("; ")}. Nada foi enviado.`,
    };
  }

  if (plan.toSend.length === 0) {
    const finalStatus = await finalizeEdition(edition, plan.remaining === 0 && plan.inProgress === 0);
    return result({
      skipped,
      eligible: plan.eligible,
      remaining: plan.remaining,
      reason:
        plan.inProgress > 0
          ? "Há um envio em andamento para esta edição. Tente de novo em alguns minutos."
          : `Nenhuma inscrita pendente para esta edição${finalStatus === "sent" ? " — envio concluído" : ""}.`,
    });
  }

  if (transport === "none") {
    return result({
      skipped,
      eligible: plan.eligible,
      remaining: plan.eligible,
      reason: "Nenhum serviço de e-mail configurado: defina RESEND_API_KEY (veja docs/08-newsletter.md).",
    });
  }

  // 1) Reivindica as entregas (a chave primária impede que outra execução pegue as mesmas).
  const marker = claimMarker(now);
  const fresh = plan.toSend.filter((s) => !plan.retryIds.has(s.id));
  const claimed = new Set<string>();
  if (fresh.length) {
    const { data, error } = await admin
      .from("newsletter_deliveries")
      .upsert(
        fresh.map((s) => ({ edition_id: edition.id, subscriber_id: s.id, error: marker, sent_at: null })),
        { onConflict: "edition_id,subscriber_id", ignoreDuplicates: true },
      )
      .select("subscriber_id");
    if (error) throw new Error(`Não foi possível registrar as entregas: ${error.message}`);
    data?.forEach((d) => claimed.add(d.subscriber_id));
  }
  if (plan.retryIds.size) {
    const { data, error } = await admin
      .from("newsletter_deliveries")
      .update({ error: marker })
      .eq("edition_id", edition.id)
      .in("subscriber_id", [...plan.retryIds])
      .is("sent_at", null)
      .select("subscriber_id");
    if (error) throw new Error(`Não foi possível retomar as entregas: ${error.message}`);
    data?.forEach((d) => claimed.add(d.subscriber_id));
  }
  const recipients = plan.toSend.filter((s) => claimed.has(s.id));

  // 2) Monta e envia em lotes (≤ 100 no Resend), com chave de idempotência por lote.
  const siteUrl = getSiteUrl();
  const forRender = {
    slug: edition.slug,
    title: edition.title,
    summary: edition.summary,
    period_start: edition.period_start,
    period_end: edition.period_end,
    content,
  };

  let sent = 0;
  let failed = 0;
  let firstError: string | null = null;

  for (const group of chunk(recipients, RESEND_BATCH_LIMIT)) {
    const messages: EmailMessage[] = group.map((subscriber) => {
      const token = encodeURIComponent(subscriber.unsubscribe_token);
      const unsubscribeUrl = absoluteUrl(siteUrl, `/newsletter/cancelar?token=${token}`);
      const oneClickUrl = absoluteUrl(siteUrl, `/api/newsletter/unsubscribe?token=${token}`);
      const email = renderEditionEmail(forRender, { siteUrl, unsubscribeUrl, recipientEmail: subscriber.email });
      return {
        to: subscriber.email,
        subject: email.subject,
        html: email.html,
        text: email.text,
        headers: {
          "List-Unsubscribe": `<${oneClickUrl}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
        tags: [
          { name: "category", value: "newsletter" },
          { name: "edition", value: edition.slug },
        ],
      };
    });

    const response = await sendBatch(messages, {
      idempotencyKey: batchKey(
        edition.id,
        group.map((s) => s.id),
      ),
    });
    const sentAt = new Date().toISOString();

    if (response.ok) {
      const { error } = await admin.from("newsletter_deliveries").upsert(
        group.map((s, i) => ({
          edition_id: edition.id,
          subscriber_id: s.id,
          sent_at: sentAt,
          provider_message_id: response.ids[i] ?? null,
          error: null,
        })),
        { onConflict: "edition_id,subscriber_id" },
      );
      if (error) console.error(`[newsletter] envio feito, mas o registro falhou: ${error.message}`);
      sent += group.length;
    } else {
      const message = (response.skipped ? response.reason : response.error).slice(0, 500);
      firstError ??= message;
      failed += group.length;
      await admin.from("newsletter_deliveries").upsert(
        group.map((s) => ({ edition_id: edition.id, subscriber_id: s.id, sent_at: null, error: message })),
        { onConflict: "edition_id,subscriber_id" },
      );
    }
  }

  const lost = plan.toSend.length - recipients.length; // reivindicadas por outra execução no meio do caminho
  const remaining = plan.remaining + failed;
  const finalStatus = await finalizeEdition(edition, remaining === 0 && lost === 0 && plan.inProgress === 0);

  const reasons = [
    failed ? `${pluralize(failed, "envio falhou", "envios falharam")}: ${firstError}` : null,
    plan.remaining
      ? `Limite de ${maxPerRun} e-mails por execução: ${pluralize(plan.remaining, "inscrita fica", "inscritas ficam")} para a próxima.`
      : null,
    lost ? `${pluralize(lost, "entrega estava", "entregas estavam")} em andamento em outra execução.` : null,
    finalStatus === "sent" ? "Envio concluído." : null,
  ].filter(Boolean);

  return {
    sent,
    skipped: skipped + lost,
    failed,
    eligible: plan.eligible,
    remaining,
    dryRun: false,
    reason: reasons.length ? reasons.join(" ") : undefined,
  };
}

/** Atualiza recipients_count e marca 'sent' quando ninguém mais está pendente. */
async function finalizeEdition(edition: NewsletterEdition, complete: boolean): Promise<EditionStatus> {
  const admin = createAdminClient();
  const { count } = await admin
    .from("newsletter_deliveries")
    .select("subscriber_id", { count: "exact", head: true })
    .eq("edition_id", edition.id)
    .not("sent_at", "is", null);
  const recipients = count ?? edition.recipients_count;
  // Só vira 'sent' se alguém de fato recebeu (evita "enviada" para uma lista vazia).
  const status: EditionStatus = complete && recipients > 0 ? "sent" : edition.status;
  if (status !== edition.status || recipients !== edition.recipients_count) {
    const { error } = await admin
      .from("newsletter_editions")
      .update({ status, recipients_count: recipients })
      .eq("id", edition.id);
    if (error) console.error(`[newsletter] não foi possível atualizar a edição: ${error.message}`);
    else revalidateEdition(edition.slug);
  }
  return status;
}

// -----------------------------------------------------------------------------
// Job semanal
// -----------------------------------------------------------------------------

/** Gera + publica + envia a edição da semana. Pode rodar várias vezes sem duplicar nada. */
export async function runWeeklyNewsletterJob(options: { now?: Date } = {}): Promise<WeeklyJobResult> {
  const { edition, created } = await generateWeeklyEdition({ now: options.now, publish: false });
  let current = edition;

  if (current.status === "draft") {
    if (isEditionEmpty(parseEditionContent(current.content))) {
      return {
        slug: current.slug,
        editionId: current.id,
        created,
        published: false,
        status: current.status,
        send: null,
        reason: "Semana sem novidades: a edição ficou como rascunho e nada foi enviado.",
      };
    }
    current = await publishEdition(current.id);
  }

  const send = await sendEdition(current.id);
  const { data: latest } = await createAdminClient()
    .from("newsletter_editions")
    .select("status")
    .eq("id", current.id)
    .maybeSingle();

  return {
    slug: current.slug,
    editionId: current.id,
    created,
    published: true,
    status: latest?.status ?? current.status,
    send,
    reason: send.reason,
  };
}

// -----------------------------------------------------------------------------
// Painel
// -----------------------------------------------------------------------------

/** Números e configuração para o painel de administração (sem dados pessoais). */
export async function getNewsletterOverview(): Promise<NewsletterOverview> {
  const admin = createAdminClient();
  const countBy = (status: Enums<"subscriber_status">) =>
    admin.from("newsletter_subscribers").select("id", { count: "exact", head: true }).eq("status", status);
  const [active, pending, unsubscribed] = await Promise.all([countBy("active"), countBy("pending"), countBy("unsubscribed")]);
  return {
    email: getEmailTransportInfo(),
    maxPerRun: getMaxPerRun(),
    subscribers: {
      active: active.count ?? 0,
      pending: pending.count ?? 0,
      unsubscribed: unsubscribed.count ?? 0,
    },
  };
}
