"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile, getCurrentUser } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { friendlyNetworkError, NETWORK_RULE_MESSAGES } from "./errors";
import { loadRelationship } from "./queries";
import type { RelationshipState } from "./relationship";
import {
  connectionIdSchema,
  profileIdSchema,
  respondConnectionSchema,
  sendConnectionSchema,
} from "./schemas";

/**
 * Server Actions da rede (seguir e conectar), chamadas direto dos botões (sem <form>).
 * Cada uma confere a sessão e o cadastro aqui dentro (o proxy é só otimista), valida com zod e
 * deixa o RLS + triggers do banco garantirem as regras (docs/18 §2.1). A autoria vem sempre da
 * sessão: do cliente chega só o ALVO (a pesquisadora ou o convite).
 */

export type FollowResult = { ok: true; following: boolean } | { ok: false; error: string };

export type ConnectionResult =
  | {
      ok: true;
      /** Estado novo do botão, relido do banco depois da ação. */
      state: RelationshipState;
      connectionId: string | null;
      message: string;
    }
  | { ok: false; error: string };

type Member = { userId: string };

async function getMember(): Promise<Member | { error: string }> {
  if (!isSupabaseConfigured()) {
    return { error: "O Supabase ainda não foi configurado neste ambiente." };
  }
  const user = await getCurrentUser();
  if (!user) return { error: "Sua sessão expirou. Entre de novo para continuar." };
  const profile = await getCurrentProfile();
  if (!profile?.onboarded_at) {
    return { error: "Complete o seu perfil antes de seguir ou se conectar com outras membras." };
  }
  return { userId: user.id };
}

/**
 * Revalida as páginas que mostram a rede. Qualquer `revalidatePath` numa Server Action também
 * re-renderiza a página ATUAL na mesma resposta (node_modules/next/dist/docs/01-app/02-guides/
 * server-actions.md). Por isso seguir e convidar aceitam `{ revalidate: false }`: nas listas da
 * /rede o botão guarda o estado novo sozinho e o cartão fica no lugar — re-renderizar ali tiraria
 * a pessoa das sugestões no meio do clique. A próxima visita (páginas dinâmicas) já vem atualizada.
 */
function revalidateNetwork() {
  revalidatePath("/rede");
  revalidatePath("/pesquisadoras/[id]", "page");
  // O feed "Seguindo" depende de quem eu sigo.
  revalidatePath("/feed");
}

/** Opções das ações chamadas por botões em listas. */
export interface NetworkActionOptions {
  /** false = não re-renderiza a página atual (padrão: true). */
  revalidate?: boolean;
}

function logFailure(scope: string, error: { code?: string; message?: string }) {
  if (error.code?.startsWith("CD")) return;
  console.warn(`[rede] ${scope} — ${error.code ?? ""} ${(error.message ?? "").slice(0, 160)}`);
}

// ---------------------------------------------------------------------------
// Seguir
// ---------------------------------------------------------------------------

export async function followAction(
  profileId: string,
  options: NetworkActionOptions = {},
): Promise<FollowResult> {
  const parsed = profileIdSchema.safeParse(profileId);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };
  const member = await getMember();
  if ("error" in member) return { ok: false, error: member.error };
  if (parsed.data === member.userId) return { ok: false, error: NETWORK_RULE_MESSAGES.CD065! };

  const supabase = await createClient();
  const { error } = await supabase.from("follows").insert({ followee_id: parsed.data });
  // Já seguia (clique repetido, outra aba): o resultado desejado já vale.
  if (error && error.code !== "23505") {
    logFailure("seguir", error);
    return { ok: false, error: friendlyNetworkError(error, "follow") };
  }
  if (options.revalidate !== false) revalidateNetwork();
  return { ok: true, following: true };
}

export async function unfollowAction(
  profileId: string,
  options: NetworkActionOptions = {},
): Promise<FollowResult> {
  const parsed = profileIdSchema.safeParse(profileId);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };
  const member = await getMember();
  if ("error" in member) return { ok: false, error: member.error };

  const supabase = await createClient();
  const { error } = await supabase
    .from("follows")
    .delete()
    .eq("follower_id", member.userId)
    .eq("followee_id", parsed.data);
  if (error) {
    logFailure("deixar de seguir", error);
    return { ok: false, error: friendlyNetworkError(error, "unfollow") };
  }
  if (options.revalidate !== false) revalidateNetwork();
  return { ok: true, following: false };
}

// ---------------------------------------------------------------------------
// Conectar
// ---------------------------------------------------------------------------

/** Relê o estado depois de uma ação (o que o banco decidiu é o que vale). */
async function settledState(
  supabase: Awaited<ReturnType<typeof createClient>>,
  myId: string,
  otherId: string,
  message: (state: RelationshipState) => string,
): Promise<ConnectionResult> {
  const rel = await loadRelationship(supabase, myId, otherId);
  return {
    ok: true,
    state: rel.state,
    connectionId: rel.connectionId,
    message: message(rel.state),
  };
}

/**
 * Envia um convite (com recado opcional). Se a outra pessoa já tinha me convidado, o banco aceita
 * o convite dela no lugar de criar outro: o trigger devolve NULL e o PostgREST responde sucesso
 * SEM linha — "sem erro e sem dados" quer dizer "agora estamos conectadas".
 */
export async function sendConnectionAction(
  profileId: string,
  message?: string | null,
  options: NetworkActionOptions = {},
): Promise<ConnectionResult> {
  const parsed = sendConnectionSchema.safeParse({ profile_id: profileId, message });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };
  const member = await getMember();
  if ("error" in member) return { ok: false, error: member.error };
  const otherId = parsed.data.profile_id;
  if (otherId === member.userId) return { ok: false, error: NETWORK_RULE_MESSAGES.CD065! };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("connections")
    .insert({ addressee_id: otherId, message: parsed.data.message })
    .select("id");
  if (error) {
    logFailure("convite", error);
    return { ok: false, error: friendlyNetworkError(error, "connect") };
  }

  if (options.revalidate !== false) revalidateNetwork();
  const autoAccepted = !data || data.length === 0;
  return settledState(supabase, member.userId, otherId, (state) =>
    state === "connected" || autoAccepted
      ? "Ela já tinha convidado você: agora vocês estão conectadas."
      : "Convite enviado. Ela recebe um aviso e pode aceitar ou recusar.",
  );
}

/** Aceita ou recusa um convite recebido (também aceita depois um convite que eu tinha recusado). */
export async function respondConnectionAction(
  connectionId: string,
  accept: boolean,
): Promise<ConnectionResult> {
  const parsed = respondConnectionSchema.safeParse({ connection_id: connectionId, accept });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };
  const member = await getMember();
  if ("error" in member) return { ok: false, error: member.error };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("connections")
    .update({ status: parsed.data.accept ? "accepted" : "declined" })
    .eq("id", parsed.data.connection_id)
    .eq("addressee_id", member.userId)
    .select("requester_id")
    .maybeSingle();
  if (error) {
    logFailure("responder convite", error);
    return { ok: false, error: friendlyNetworkError(error, "respond") };
  }
  if (!data) {
    return {
      ok: false,
      error:
        "Este convite não está mais disponível — talvez ela tenha desistido. Recarregue a página.",
    };
  }

  revalidateNetwork();
  return settledState(supabase, member.userId, data.requester_id, (state) =>
    state === "connected"
      ? "Convite aceito: agora vocês estão conectadas."
      : "Convite recusado. Ela não recebe aviso da recusa.",
  );
}

/**
 * Remove um convite ou uma conexão: desiste de um convite que enviei, remove uma conexão aceita
 * ou apaga um convite recebido que recusei. Quem convidou NUNCA fica sabendo de uma recusa: se o
 * convite "pendente" dela foi recusado, o RLS não deixa apagá-lo (para não refazê-lo) e o
 * resultado é o mesmo de um cancelamento comum.
 */
export async function removeConnectionAction(connectionId: string): Promise<ConnectionResult> {
  const parsed = connectionIdSchema.safeParse(connectionId);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };
  const member = await getMember();
  if ("error" in member) return { ok: false, error: member.error };

  const supabase = await createClient();
  const { data: row, error: readError } = await supabase
    .from("connections")
    .select("id, requester_id, addressee_id, status")
    .eq("id", parsed.data)
    .maybeSingle();
  if (readError) {
    logFailure("ler conexão", readError);
    return { ok: false, error: friendlyNetworkError(readError, "remove") };
  }
  const mine = row && (row.requester_id === member.userId || row.addressee_id === member.userId);
  if (!row || !mine) {
    // Já não existe (a outra pessoa removeu, ou foi removida em outra aba): nada a fazer.
    revalidateNetwork();
    return {
      ok: true,
      state: "none",
      connectionId: null,
      message: "Pronto: removido da sua rede.",
    };
  }

  const { data: deleted, error } = await supabase
    .from("connections")
    .delete()
    .eq("id", row.id)
    .select("id");
  if (error) {
    logFailure("remover conexão", error);
    return { ok: false, error: friendlyNetworkError(error, "remove") };
  }

  const otherId = row.requester_id === member.userId ? row.addressee_id : row.requester_id;
  const wasConnected = row.status === "accepted";
  const sentByMe = row.requester_id === member.userId;
  if ((deleted ?? []).length === 0 && sentByMe && row.status === "declined") {
    // Convite meu que foi recusado: o RLS não deixa quem convidou apagá-lo (para não refazê-lo)
    // e a interface não pode contar a recusa. Respondemos como um cancelamento comum; a linha
    // continua no banco e o convite volta a aparecer como "enviado" na próxima visita.
    return { ok: true, state: "none", connectionId: null, message: "Convite cancelado." };
  }

  revalidateNetwork();
  return settledState(supabase, member.userId, otherId, () =>
    wasConnected
      ? "Conexão removida. Ela não recebe aviso."
      : sentByMe
        ? "Convite cancelado."
        : "Convite apagado.",
  );
}

/**
 * "Adicionar recado" a um convite já enviado (o convite de um toque das listas). Quem convidou
 * não pode editar o convite (só o status muda, e só por quem recebeu), então o convite pendente
 * é refeito com o recado: apaga e envia de novo. O aviso de convite da outra pessoa é trocado pelo
 * novo (o do antigo some junto com ele). Se o convite não estiver mais pendente para mim, nada muda.
 */
export async function addInviteMessageAction(
  connectionId: string,
  message: string,
  options: NetworkActionOptions = {},
): Promise<ConnectionResult> {
  const id = connectionIdSchema.safeParse(connectionId);
  if (!id.success) return { ok: false, error: id.error.issues[0]!.message };
  const member = await getMember();
  if ("error" in member) return { ok: false, error: member.error };

  const supabase = await createClient();
  const { data: row, error: readError } = await supabase
    .from("connections")
    .select("id, requester_id, addressee_id, status, message")
    .eq("id", id.data)
    .eq("requester_id", member.userId)
    .maybeSingle();
  if (readError) {
    logFailure("ler convite", readError);
    return { ok: false, error: friendlyNetworkError(readError, "connect") };
  }
  const parsed = sendConnectionSchema.safeParse({ profile_id: row?.addressee_id, message });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };
  if (!parsed.data.message) return { ok: false, error: "Escreva o recado antes de enviar." };

  // Só um convite MEU e ainda pendente pode ser refeito (o recusado continua como está, sem
  // contar a recusa: a mensagem abaixo vale para os dois casos).
  const unchanged = {
    ok: false as const,
    error: "Não conseguimos adicionar o recado agora. O convite continua enviado.",
  };
  if (!row || row.status !== "pending") return unchanged;

  const { data: deleted, error: deleteError } = await supabase
    .from("connections")
    .delete()
    .eq("id", row.id)
    .eq("status", "pending")
    .select("id");
  if (deleteError) {
    logFailure("refazer convite (apagar)", deleteError);
    return { ok: false, error: friendlyNetworkError(deleteError, "connect") };
  }
  if ((deleted ?? []).length === 0) return unchanged;

  const { error } = await supabase
    .from("connections")
    .insert({ addressee_id: row.addressee_id, message: parsed.data.message });
  if (error) {
    logFailure("refazer convite (enviar)", error);
    return { ok: false, error: friendlyNetworkError(error, "connect") };
  }
  if (options.revalidate !== false) revalidateNetwork();
  return settledState(supabase, member.userId, row.addressee_id, (state) =>
    state === "connected"
      ? "Ela já tinha convidado você: agora vocês estão conectadas."
      : "Recado enviado com o convite.",
  );
}
