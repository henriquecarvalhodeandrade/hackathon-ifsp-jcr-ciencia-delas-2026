"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentProfile, isModerator, type Profile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { friendlyFeedError } from "./errors";
import { listRecentComments } from "./queries";
import type { FeedCommentView } from "./types";
import {
  attachmentColumns,
  createCommentSchema,
  createPostSchema,
  deleteCommentSchema,
  deletePostSchema,
  likeSchema,
  readCommentForm,
  readFormString,
  readPostEditForm,
  readPostForm,
  updateCommentSchema,
  updatePostSchema,
  type CommentFormValues,
  type PostEditValues,
  type PostFormValues,
} from "./schema";

/*
 * Server Actions do feed (docs/18-rede-social.md §2.4). Regras:
 * - toda action confere a sessão e o onboarding (o proxy é só uma checagem otimista);
 * - nunca aceitamos ids de usuária do cliente: autoria vem de auth.uid() (default das colunas);
 * - o RLS é a autorização de verdade; aqui só antecipamos mensagens amigáveis;
 * - contadores (like_count, comment_count) e avisos são dos triggers — o app só lê;
 * - erros CDxxx do banco têm mensagem pt-BR pronta; os demais viram texto no contexto.
 */

type FieldErrors<K extends string> = Partial<Record<K, string[]>>;

export type SimpleActionState = { ok: true; message: string } | { ok: false; error: string } | null;

export type ComposerState =
  | { ok: true; message: string; postId: string; nonce: string }
  | {
      ok: false;
      error: string;
      fieldErrors?: FieldErrors<keyof PostFormValues>;
      values: PostFormValues;
      /** Muda a cada resposta para remontar os campos com `values` (React 19 reseta o form). */
      nonce: string;
    }
  | null;

export type PostEditState =
  | { ok: true; message: string; nonce: string }
  | {
      ok: false;
      error: string;
      fieldErrors?: FieldErrors<keyof PostEditValues>;
      values: PostEditValues;
      nonce: string;
    }
  | null;

export type CommentFormState =
  | { ok: true; message: string; commentId: string; nonce: string }
  | {
      ok: false;
      error: string;
      fieldErrors?: FieldErrors<keyof CommentFormValues>;
      values: CommentFormValues;
      nonce: string;
    }
  | null;

export type CommentEditState =
  | { ok: true; message: string; nonce: string; body: string }
  | {
      ok: false;
      error: string;
      fieldErrors?: FieldErrors<keyof CommentFormValues>;
      values: CommentFormValues;
      nonce: string;
    }
  | null;

export type LikeResult =
  { ok: true; liked: boolean; likeCount: number } | { ok: false; error: string };

const nonce = () => crypto.randomUUID();

const SESSION_ERROR =
  "Sua sessão expirou. Entre novamente para continuar — seu texto continua aqui.";
const ONBOARDING_ERROR = "Complete seu perfil antes de participar do feed.";
const CHECK_FIELDS = "Alguns campos precisam de atenção. Confira as mensagens abaixo.";

type MemberResult = { ok: true; profile: Profile } | { ok: false; error: string };

/** Sessão válida + onboarding concluído. */
async function getMember(): Promise<MemberResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: SESSION_ERROR };
  if (!profile.onboarded_at) return { ok: false, error: ONBOARDING_ERROR };
  return { ok: true, profile };
}

function revalidateFeed() {
  // O feed, as páginas das publicações e as "publicações recentes" do perfil leem os mesmos dados.
  revalidatePath("/feed", "layout");
  revalidatePath("/pesquisadoras/[id]", "page");
}

// ---------------------------------------------------------------------------
// Publicações
// ---------------------------------------------------------------------------

export async function createPostAction(
  _prev: ComposerState,
  formData: FormData,
): Promise<ComposerState> {
  const values = readPostForm(formData);
  const fail = (error: string, fieldErrors?: FieldErrors<keyof PostFormValues>): ComposerState => ({
    ok: false,
    error,
    fieldErrors,
    values,
    nonce: nonce(),
  });

  const parsed = createPostSchema.safeParse(values);
  if (!parsed.success) return fail(CHECK_FIELDS, z.flattenError(parsed.error).fieldErrors);

  const member = await getMember();
  if (!member.ok) return fail(member.error);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("posts")
    .insert({
      kind: parsed.data.kind,
      body: parsed.data.body,
      link_url: parsed.data.linkUrl,
      ...attachmentColumns(parsed.data.attachment),
    })
    .select("id")
    .single();
  if (error || !data) {
    const message = friendlyFeedError(error, "post");
    // CD080 (anexo que não é seu) e 23503 (anexo apagado) apontam para o campo do anexo.
    const onAttachment = error?.code === "CD080" || error?.code === "23503";
    return fail(message, onAttachment ? { attachment: [message] } : undefined);
  }

  revalidateFeed();
  return {
    ok: true,
    message: "Publicado! Sua publicação já está no feed.",
    postId: data.id,
    nonce: nonce(),
  };
}

export async function updatePostAction(
  _prev: PostEditState,
  formData: FormData,
): Promise<PostEditState> {
  const values = readPostEditForm(formData);
  const fail = (error: string, fieldErrors?: FieldErrors<keyof PostEditValues>): PostEditState => ({
    ok: false,
    error,
    fieldErrors,
    values,
    nonce: nonce(),
  });

  const parsed = updatePostSchema.safeParse({
    ...values,
    postId: readFormString(formData, "postId"),
  });
  if (!parsed.success) {
    const { postId, ...fieldErrors } = z.flattenError(parsed.error).fieldErrors;
    return fail(
      postId ? "Não encontramos essa publicação. Recarregue a página." : CHECK_FIELDS,
      fieldErrors,
    );
  }

  const member = await getMember();
  if (!member.ok) return fail(member.error);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("posts")
    .update({ kind: parsed.data.kind, body: parsed.data.body, link_url: parsed.data.linkUrl })
    .eq("id", parsed.data.postId)
    .eq("author_id", member.profile.id)
    .select("id")
    .maybeSingle();
  if (error) return fail(friendlyFeedError(error, "edit"));
  if (!data) return fail("Você não pode editar esta publicação — ou ela não existe mais.");

  revalidateFeed();
  return { ok: true, message: "Publicação atualizada.", nonce: nonce() };
}

export async function deletePostAction(
  _prev: SimpleActionState,
  formData: FormData,
): Promise<SimpleActionState> {
  const parsed = deletePostSchema.safeParse({
    postId: readFormString(formData, "postId"),
    from: readFormString(formData, "from"),
  });
  if (!parsed.success) return { ok: false, error: "Não encontramos essa publicação." };

  const member = await getMember();
  if (!member.ok) return { ok: false, error: member.error };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("posts")
    .delete()
    .eq("id", parsed.data.postId)
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: friendlyFeedError(error, "delete") };
  if (!data)
    return { ok: false, error: "Você não pode apagar esta publicação — ou ela já foi apagada." };

  revalidateFeed();
  // Na página da publicação não há mais o que mostrar: volta para o feed.
  if (parsed.data.from === "detalhe") redirect("/feed");
  return { ok: true, message: "Publicação apagada." };
}

/**
 * Curte/descurte. Idempotente: `liked` é o estado desejado (a UI é otimista e cliques
 * repetidos ou fora de ordem não invertem o resultado). Devolve o total atualizado pelo trigger.
 * NÃO revalida: o botão já confirma com o total devolvido, e revalidar baixaria o feed inteiro
 * (~160 KB) a cada curtida. As páginas são dinâmicas: a próxima visita já lê o número novo.
 */
export async function toggleLikeAction(postId: string, liked: boolean): Promise<LikeResult> {
  const parsed = likeSchema.safeParse({ postId, liked });
  if (!parsed.success) return { ok: false, error: "Não encontramos essa publicação." };

  const member = await getMember();
  if (!member.ok) return { ok: false, error: member.error };

  const supabase = await createClient();
  if (parsed.data.liked) {
    const { error } = await supabase.from("post_likes").insert({ post_id: parsed.data.postId });
    // 23505 = já curtiu (outra aba, clique duplo): o estado desejado já vale.
    if (error && error.code !== "23505")
      return { ok: false, error: friendlyFeedError(error, "like") };
  } else {
    const { error } = await supabase
      .from("post_likes")
      .delete()
      .eq("post_id", parsed.data.postId)
      .eq("user_id", member.profile.id);
    if (error) return { ok: false, error: friendlyFeedError(error, "like") };
  }

  const { data } = await supabase
    .from("posts")
    .select("like_count")
    .eq("id", parsed.data.postId)
    .maybeSingle();
  if (!data) return { ok: false, error: "Esta publicação não existe mais." };

  return { ok: true, liked: parsed.data.liked, likeCount: data.like_count };
}

// ---------------------------------------------------------------------------
// Comentários
// ---------------------------------------------------------------------------

export async function createCommentAction(
  _prev: CommentFormState,
  formData: FormData,
): Promise<CommentFormState> {
  const values = readCommentForm(formData);
  const fail = (error: string, fieldErrors?: FieldErrors<"body">): CommentFormState => ({
    ok: false,
    error,
    fieldErrors,
    values,
    nonce: nonce(),
  });

  const parsed = createCommentSchema.safeParse({
    ...values,
    postId: readFormString(formData, "postId"),
  });
  if (!parsed.success) {
    const { postId, body } = z.flattenError(parsed.error).fieldErrors;
    return fail(postId ? "Não encontramos essa publicação. Recarregue a página." : CHECK_FIELDS, {
      body,
    });
  }

  const member = await getMember();
  if (!member.ok) return fail(member.error);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("post_comments")
    .insert({ post_id: parsed.data.postId, body: parsed.data.body })
    .select("id")
    .single();
  if (error || !data) return fail(friendlyFeedError(error, "comment"));

  revalidateFeed();
  return { ok: true, message: "Comentário publicado.", commentId: data.id, nonce: nonce() };
}

export async function updateCommentAction(
  _prev: CommentEditState,
  formData: FormData,
): Promise<CommentEditState> {
  const values = readCommentForm(formData);
  const fail = (error: string, fieldErrors?: FieldErrors<"body">): CommentEditState => ({
    ok: false,
    error,
    fieldErrors,
    values,
    nonce: nonce(),
  });

  const parsed = updateCommentSchema.safeParse({
    ...values,
    commentId: readFormString(formData, "commentId"),
    postId: readFormString(formData, "postId"),
  });
  if (!parsed.success) {
    const { body, ...ids } = z.flattenError(parsed.error).fieldErrors;
    return fail(
      Object.keys(ids).length > 0
        ? "Não encontramos esse comentário. Recarregue a página."
        : CHECK_FIELDS,
      { body },
    );
  }

  const member = await getMember();
  if (!member.ok) return fail(member.error);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("post_comments")
    .update({ body: parsed.data.body })
    .eq("id", parsed.data.commentId)
    .eq("post_id", parsed.data.postId)
    .eq("author_id", member.profile.id)
    .select("id")
    .maybeSingle();
  if (error) return fail(friendlyFeedError(error, "comment-edit"));
  if (!data) return fail("Você não pode editar este comentário — ou ele não existe mais.");

  revalidateFeed();
  return { ok: true, message: "Comentário atualizado.", nonce: nonce(), body: parsed.data.body };
}

/** Apaga um comentário: a autora dele ou a autora da publicação (o RLS confere). */
export async function deleteCommentAction(
  _prev: SimpleActionState,
  formData: FormData,
): Promise<SimpleActionState> {
  const parsed = deleteCommentSchema.safeParse({
    commentId: readFormString(formData, "commentId"),
    postId: readFormString(formData, "postId"),
  });
  if (!parsed.success) return { ok: false, error: "Não encontramos esse comentário." };

  const member = await getMember();
  if (!member.ok) return { ok: false, error: member.error };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("post_comments")
    .delete()
    .eq("id", parsed.data.commentId)
    .eq("post_id", parsed.data.postId)
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: friendlyFeedError(error, "comment-delete") };
  if (!data)
    return { ok: false, error: "Você não pode apagar este comentário — ou ele já foi apagado." };

  revalidateFeed();
  return { ok: true, message: "Comentário apagado." };
}

export type RecentCommentsResult =
  { ok: true; comments: FeedCommentView[] } | { ok: false; error: string };

/**
 * Os últimos comentários de uma publicação (mais antigos primeiro), para o painel de comentários
 * dentro do cartão. Lido só quando a pessoa abre o painel — o feed não carrega comentários.
 */
export async function loadRecentCommentsAction(
  postId: string,
  limit = 2,
): Promise<RecentCommentsResult> {
  const parsed = z.guid().safeParse(postId);
  if (!parsed.success) return { ok: false, error: "Não encontramos essa publicação." };

  const member = await getMember();
  if (!member.ok) return { ok: false, error: member.error };

  try {
    const comments = await listRecentComments(parsed.data, {
      viewerId: member.profile.id,
      viewerIsModerator: isModerator(member.profile),
      limit: Math.min(Math.max(1, Math.trunc(limit) || 2), 10),
    });
    return { ok: true, comments };
  } catch {
    return { ok: false, error: "Não conseguimos carregar os comentários agora." };
  }
}
