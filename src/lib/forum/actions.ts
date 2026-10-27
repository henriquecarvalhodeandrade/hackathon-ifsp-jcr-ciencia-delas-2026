"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentProfile, isModerator, type Profile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { friendlyDbError } from "./errors";
import {
  createPostSchema,
  createThreadSchema,
  idPairSchema,
  readFormString,
  readPostForm,
  readThreadForm,
  reactionSchema,
  updatePostSchema,
  updateThreadSchema,
  type PostFormValues,
  type ReactionKindValue,
  type ThreadFormValues,
} from "./schema";

/*
 * Server Actions do fórum. Regras:
 * - toda action confere a sessão e o onboarding (o proxy é só uma checagem otimista);
 * - nunca aceitamos ids de usuária do cliente: autoria vem de auth.uid() (default das colunas);
 * - o RLS é a autorização de verdade; aqui só antecipamos mensagens amigáveis;
 * - erros CDxxx do banco têm mensagem pt-BR pronta; os demais viram texto genérico.
 */

type FieldErrors<K extends string> = Partial<Record<K, string[]>>;

export type SimpleActionState = { ok: true; message: string } | { ok: false; error: string } | null;

export type ThreadFormState = {
  ok: false;
  error: string;
  fieldErrors?: FieldErrors<keyof ThreadFormValues>;
  values: ThreadFormValues;
  /** Muda a cada resposta para remontar os campos com `values` (React 19 reseta o form). */
  nonce: string;
} | null;

export type PostFormState =
  | { ok: true; message: string; postId: string; nonce: string }
  | {
      ok: false;
      error: string;
      fieldErrors?: FieldErrors<keyof PostFormValues>;
      values: PostFormValues;
      nonce: string;
    }
  | null;

export type PostEditState =
  | { ok: true; message: string; nonce: string }
  | {
      ok: false;
      error: string;
      fieldErrors?: FieldErrors<"body">;
      values: { body: string };
      nonce: string;
    }
  | null;

export type ReactionResult = { ok: true } | { ok: false; error: string };

const nonce = () => crypto.randomUUID();

const SESSION_ERROR =
  "Sua sessão expirou. Entre novamente para continuar — seu texto continua aqui.";
const ONBOARDING_ERROR = "Complete seu perfil antes de participar do fórum.";

type MemberResult = { ok: true; profile: Profile } | { ok: false; error: string };

/** Sessão válida + onboarding concluído. */
async function getMember(): Promise<MemberResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: SESSION_ERROR };
  if (!profile.onboarded_at) return { ok: false, error: ONBOARDING_ERROR };
  return { ok: true, profile };
}

function revalidateForum() {
  // Todas as páginas do fórum (lista, categorias, tópicos) dependem dos mesmos dados.
  revalidatePath("/forum", "layout");
}

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** A usuária é dona do tópico (com nome ou pela autoria anônima registrada)? */
async function ownsThread(
  supabase: Supabase,
  thread: { id: string; author_id: string | null; is_anonymous: boolean },
  viewerId: string,
): Promise<boolean> {
  if (thread.author_id === viewerId) return true;
  if (!thread.is_anonymous) return false;
  const { data } = await supabase
    .from("forum_anonymous_authorship")
    .select("id")
    .eq("user_id", viewerId)
    .eq("thread_id", thread.id)
    .maybeSingle();
  return Boolean(data);
}

// ---------------------------------------------------------------------------
// Tópicos
// ---------------------------------------------------------------------------

export async function createThread(
  _prev: ThreadFormState,
  formData: FormData,
): Promise<ThreadFormState> {
  const values = readThreadForm(formData);
  const fail = (
    error: string,
    fieldErrors?: FieldErrors<keyof ThreadFormValues>,
  ): ThreadFormState => ({
    ok: false,
    error,
    fieldErrors,
    values,
    nonce: nonce(),
  });

  const parsed = createThreadSchema.safeParse(values);
  if (!parsed.success) {
    return fail(
      "Alguns campos precisam de atenção. Confira as mensagens abaixo.",
      z.flattenError(parsed.error).fieldErrors,
    );
  }

  const member = await getMember();
  if (!member.ok) return fail(member.error);

  const supabase = await createClient();
  const { data: category } = await supabase
    .from("forum_categories")
    .select("id, slug, allow_anonymous")
    .eq("id", parsed.data.categoryId)
    .maybeSingle();
  if (!category)
    return fail("Escolha uma categoria válida.", { categoryId: ["Escolha uma categoria válida."] });
  if (parsed.data.anonymous && !category.allow_anonymous) {
    const message = "Esta categoria não aceita publicações anônimas.";
    return fail(message, { anonymous: [message] });
  }

  const { data, error } = await supabase
    .from("forum_threads")
    .insert({
      category_id: category.id,
      title: parsed.data.title,
      body: parsed.data.body,
      tags: parsed.data.tags,
      is_anonymous: parsed.data.anonymous,
    })
    .select("id")
    .single();
  if (error || !data) {
    return fail(
      friendlyDbError(
        error,
        "Não conseguimos publicar seu tópico agora. Tente de novo — seu texto continua aqui.",
      ),
    );
  }

  revalidateForum();
  redirect(`/forum/t/${data.id}`);
}

export async function updateThread(
  _prev: ThreadFormState,
  formData: FormData,
): Promise<ThreadFormState> {
  const values = readThreadForm(formData);
  const threadId = readFormString(formData, "threadId");
  const fail = (
    error: string,
    fieldErrors?: FieldErrors<keyof ThreadFormValues>,
  ): ThreadFormState => ({
    ok: false,
    error,
    fieldErrors,
    values,
    nonce: nonce(),
  });

  const parsed = updateThreadSchema.safeParse({ ...values, threadId });
  if (!parsed.success) {
    return fail(
      "Alguns campos precisam de atenção. Confira as mensagens abaixo.",
      z.flattenError(parsed.error).fieldErrors,
    );
  }

  const member = await getMember();
  if (!member.ok) return fail(member.error);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("forum_threads")
    .update({ title: parsed.data.title, body: parsed.data.body, tags: parsed.data.tags })
    .eq("id", parsed.data.threadId)
    .select("id")
    .maybeSingle();
  if (error)
    return fail(
      friendlyDbError(
        error,
        "Não conseguimos salvar as alterações. Tente de novo — seu texto continua aqui.",
      ),
    );
  if (!data) return fail("Você não pode editar este tópico — ou ele não existe mais.");

  revalidateForum();
  redirect(`/forum/t/${data.id}`);
}

export async function deleteThread(
  _prev: SimpleActionState,
  formData: FormData,
): Promise<SimpleActionState> {
  const parsed = z.guid().safeParse(readFormString(formData, "threadId"));
  if (!parsed.success) return { ok: false, error: "Não encontramos esse tópico." };

  const member = await getMember();
  if (!member.ok) return { ok: false, error: member.error };

  const supabase = await createClient();
  const { data: thread } = await supabase
    .from("forum_threads")
    .select("id, category:forum_categories!forum_threads_category_id_fkey(slug)")
    .eq("id", parsed.data)
    .maybeSingle();
  if (!thread) return { ok: false, error: "Este tópico não existe mais." };

  const { data, error } = await supabase
    .from("forum_threads")
    .delete()
    .eq("id", thread.id)
    .select("id")
    .maybeSingle();
  if (error)
    return {
      ok: false,
      error: friendlyDbError(error, "Não conseguimos excluir o tópico. Tente de novo."),
    };
  if (!data) return { ok: false, error: "Você não pode excluir este tópico." };

  revalidateForum();
  redirect(thread.category?.slug ? `/forum/c/${thread.category.slug}` : "/forum");
}

// ---------------------------------------------------------------------------
// Respostas
// ---------------------------------------------------------------------------

export async function createPost(_prev: PostFormState, formData: FormData): Promise<PostFormState> {
  const values = readPostForm(formData);
  const threadId = readFormString(formData, "threadId");
  const fail = (error: string, fieldErrors?: FieldErrors<keyof PostFormValues>): PostFormState => ({
    ok: false,
    error,
    fieldErrors,
    values,
    nonce: nonce(),
  });

  const parsed = createPostSchema.safeParse({ ...values, threadId });
  if (!parsed.success) {
    const fieldErrors = z.flattenError(parsed.error).fieldErrors;
    return fail(
      fieldErrors.threadId
        ? "Não encontramos este tópico."
        : "Confira sua resposta antes de publicar.",
      { body: fieldErrors.body, anonymous: fieldErrors.anonymous },
    );
  }

  const member = await getMember();
  if (!member.ok) return fail(member.error);

  const supabase = await createClient();
  const { data: thread } = await supabase
    .from("forum_threads")
    .select(
      "id, is_locked, category:forum_categories!forum_threads_category_id_fkey(allow_anonymous)",
    )
    .eq("id", parsed.data.threadId)
    .maybeSingle();
  if (!thread) return fail("Este tópico não existe mais.");
  if (thread.is_locked && !isModerator(member.profile)) {
    return fail("Este tópico está trancado e não aceita novas respostas.");
  }
  if (parsed.data.anonymous && !thread.category?.allow_anonymous) {
    const message = "Esta categoria não aceita respostas anônimas.";
    return fail(message, { anonymous: [message] });
  }

  const { data, error } = await supabase
    .from("forum_posts")
    .insert({ thread_id: thread.id, body: parsed.data.body, is_anonymous: parsed.data.anonymous })
    .select("id")
    .single();
  if (error || !data) {
    return fail(
      friendlyDbError(
        error,
        "Não conseguimos publicar sua resposta. Tente de novo — seu texto continua aqui.",
      ),
    );
  }

  revalidateForum();
  return {
    ok: true,
    message: "Resposta publicada. Obrigada por contribuir!",
    postId: data.id,
    nonce: nonce(),
  };
}

export async function updatePost(_prev: PostEditState, formData: FormData): Promise<PostEditState> {
  const values = { body: readFormString(formData, "body") };
  const fail = (error: string, fieldErrors?: FieldErrors<"body">): PostEditState => ({
    ok: false,
    error,
    fieldErrors,
    values,
    nonce: nonce(),
  });

  const parsed = updatePostSchema.safeParse({
    ...values,
    postId: readFormString(formData, "postId"),
    threadId: readFormString(formData, "threadId"),
  });
  if (!parsed.success) {
    const fieldErrors = z.flattenError(parsed.error).fieldErrors;
    return fail(
      fieldErrors.body ? "Confira o texto da resposta." : "Não encontramos esta resposta.",
      {
        body: fieldErrors.body,
      },
    );
  }

  const member = await getMember();
  if (!member.ok) return fail(member.error);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("forum_posts")
    .update({ body: parsed.data.body })
    .eq("id", parsed.data.postId)
    .eq("thread_id", parsed.data.threadId)
    .select("id")
    .maybeSingle();
  if (error)
    return fail(
      friendlyDbError(
        error,
        "Não conseguimos salvar a resposta. Tente de novo — seu texto continua aqui.",
      ),
    );
  if (!data) return fail("Você não pode editar esta resposta — ou ela não existe mais.");

  revalidateForum();
  return { ok: true, message: "Resposta atualizada.", nonce: nonce() };
}

export async function deletePost(
  _prev: SimpleActionState,
  formData: FormData,
): Promise<SimpleActionState> {
  const parsed = idPairSchema.safeParse({
    threadId: readFormString(formData, "threadId"),
    postId: readFormString(formData, "postId"),
  });
  if (!parsed.success) return { ok: false, error: "Não encontramos esta resposta." };

  const member = await getMember();
  if (!member.ok) return { ok: false, error: member.error };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("forum_posts")
    .delete()
    .eq("id", parsed.data.postId)
    .eq("thread_id", parsed.data.threadId)
    .select("id")
    .maybeSingle();
  if (error)
    return {
      ok: false,
      error: friendlyDbError(error, "Não conseguimos excluir a resposta. Tente de novo."),
    };
  if (!data)
    return { ok: false, error: "Você não pode excluir esta resposta — ou ela já foi removida." };

  revalidateForum();
  return { ok: true, message: "Resposta excluída." };
}

// ---------------------------------------------------------------------------
// Reações, solução e moderação
// ---------------------------------------------------------------------------

/**
 * Liga/desliga uma reação. Idempotente: `active` diz o estado desejado (a UI é otimista
 * e cliques repetidos não invertem o resultado).
 */
export async function toggleReaction(input: {
  threadId: string;
  postId?: string | null;
  kind: ReactionKindValue;
  active: boolean;
}): Promise<ReactionResult> {
  const parsed = reactionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Não conseguimos registrar a reação." };

  const member = await getMember();
  if (!member.ok) return { ok: false, error: member.error };

  const { threadId, postId, kind, active } = parsed.data;
  const supabase = await createClient();

  if (active) {
    const { error } = await supabase
      .from("forum_reactions")
      .insert(postId ? { post_id: postId, kind } : { thread_id: threadId, kind });
    // 23505 = já reagiu (outra aba, clique duplo): o estado desejado já vale.
    if (error && error.code !== "23505") {
      return {
        ok: false,
        error: friendlyDbError(error, "Não conseguimos registrar a reação. Tente de novo."),
      };
    }
  } else {
    let query = supabase
      .from("forum_reactions")
      .delete()
      .eq("user_id", member.profile.id)
      .eq("kind", kind);
    query = postId ? query.eq("post_id", postId) : query.eq("thread_id", threadId);
    const { error } = await query;
    if (error)
      return {
        ok: false,
        error: friendlyDbError(error, "Não conseguimos remover a reação. Tente de novo."),
      };
  }

  revalidateForum();
  return { ok: true };
}

/** Marca (postId) ou desmarca (postId vazio) a resposta que resolveu o tópico. */
export async function setSolution(
  _prev: SimpleActionState,
  formData: FormData,
): Promise<SimpleActionState> {
  const threadId = z.guid().safeParse(readFormString(formData, "threadId"));
  const rawPostId = readFormString(formData, "postId");
  const postId = rawPostId ? z.guid().safeParse(rawPostId) : null;
  if (!threadId.success || (postId && !postId.success))
    return { ok: false, error: "Não encontramos esta resposta." };

  const member = await getMember();
  if (!member.ok) return { ok: false, error: member.error };

  const supabase = await createClient();
  const { data: thread } = await supabase
    .from("forum_threads")
    .select("id, author_id, is_anonymous")
    .eq("id", threadId.data)
    .maybeSingle();
  if (!thread) return { ok: false, error: "Este tópico não existe mais." };
  if (!isModerator(member.profile) && !(await ownsThread(supabase, thread, member.profile.id))) {
    return { ok: false, error: "Só quem abriu o tópico pode escolher a solução." };
  }

  const solutionId = postId?.success ? postId.data : null;
  const { data, error } = await supabase
    .from("forum_threads")
    .update({ solution_post_id: solutionId })
    .eq("id", thread.id)
    .select("id")
    .maybeSingle();
  if (error)
    return {
      ok: false,
      error: friendlyDbError(error, "Não conseguimos atualizar a solução. Tente de novo."),
    };
  if (!data) return { ok: false, error: "Você não pode alterar este tópico." };

  revalidateForum();
  return {
    ok: true,
    message: solutionId
      ? "Resposta marcada como solução. A autora foi avisada."
      : "Solução desmarcada.",
  };
}

const MODERATION_ACTIONS = {
  pin: { args: { p_pinned: true }, message: "Tópico fixado no topo." },
  unpin: { args: { p_pinned: false }, message: "Tópico não está mais fixado." },
  lock: { args: { p_locked: true }, message: "Tópico trancado: novas respostas estão bloqueadas." },
  unlock: { args: { p_locked: false }, message: "Tópico destrancado." },
} as const;

/** Moderação: fixar/desafixar e trancar/destrancar (RPC moderate_thread). */
export async function moderateThread(
  _prev: SimpleActionState,
  formData: FormData,
): Promise<SimpleActionState> {
  const threadId = z.guid().safeParse(readFormString(formData, "threadId"));
  const op = z.enum(["pin", "unpin", "lock", "unlock"]).safeParse(readFormString(formData, "op"));
  if (!threadId.success || !op.success) return { ok: false, error: "Ação de moderação inválida." };

  const member = await getMember();
  if (!member.ok) return { ok: false, error: member.error };
  if (!isModerator(member.profile))
    return { ok: false, error: "Apenas a moderação pode fixar ou trancar tópicos." };

  const supabase = await createClient();
  const action = MODERATION_ACTIONS[op.data];
  const { error } = await supabase.rpc("moderate_thread", {
    p_thread_id: threadId.data,
    ...action.args,
  });
  if (error)
    return {
      ok: false,
      error: friendlyDbError(error, "Não conseguimos aplicar a moderação. Tente de novo."),
    };

  revalidateForum();
  return { ok: true, message: action.message };
}
