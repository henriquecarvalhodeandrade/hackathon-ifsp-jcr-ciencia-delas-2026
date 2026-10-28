"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const PostContentSchema = z.object({
  content: z
    .string()
    .min(1, "O post deve ter no mínimo 1 caractere")
    .max(500, "O post não pode ter mais de 500 caracteres"),
});

export type PostActionResponse =
  | { ok: true; post: { id: string; content: string; created_at: string } }
  | { ok: true; liked: boolean; likesCount: number }
  | { ok: false; error: string };

export async function createPost(
  formData: FormData
): Promise<PostActionResponse> {
  const rawContent = formData.get("content");

  const parsed = PostContentSchema.safeParse({
    content: typeof rawContent === "string" ? rawContent.trim() : "",
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message || "Conteúdo inválido",
    };
  }

  const content = parsed.data.content;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Usuário não autenticado" };
  }

  const { data, error } = await supabase
    .from("posts")
    .insert({
      author_id: user.id,
      content,
    })
    .select("id, content, created_at")
    .single();

  if (error) {
    console.error("Erro ao criar post:", error);
    return { ok: false, error: "Erro ao salvar post no banco" };
  }

  revalidatePath("/feed", "layout");
  return { ok: true, post: data };
}

export async function toggleLike(
  formData: FormData
): Promise<PostActionResponse> {
  const postId = formData.get("postId");

  if (!postId || typeof postId !== "string") {
    return { ok: false, error: "ID do post inválido" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Usuário não autenticado" };
  }

  // Verifica se o like já existe
  const { data: existingLike, error: checkError } = await supabase
    .from("post_likes")
    .select("post_id")
    .eq("post_id", postId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (checkError) {
    console.error("Erro ao verificar like existente:", checkError);
    return { ok: false, error: "Erro ao processar like" };
  }

  if (existingLike) {
    // Remove o like (diferente)
    const { error: deleteError } = await supabase
      .from("post_likes")
      .delete()
      .eq("post_id", postId)
      .eq("user_id", user.id);

    if (deleteError) {
      console.error("Erro ao remover like:", deleteError);
      return { ok: false, error: "Erro ao remover like" };
    }

    // Conta likes restantes
    const { count, error: countError } = await supabase
      .from("post_likes")
      .select("*", { count: "exact", head: true })
      .eq("post_id", postId);

    if (countError) {
      console.error("Erro ao contar likes:", countError);
      return { ok: true, liked: false, likesCount: 0 };
    }

    return {
      ok: true,
      liked: false,
      likesCount: count || 0,
    };
  } else {
    // Adiciona like
    const { error: insertError } = await supabase
      .from("post_likes")
      .insert({
        post_id: postId,
        user_id: user.id,
      });

    if (insertError) {
      console.error("Erro ao adicionar like:", insertError);
      return { ok: false, error: "Erro ao adicionar like" };
    }

    // Conta likes
    const { count, error: countError } = await supabase
      .from("post_likes")
      .select("*", { count: "exact", head: true })
      .eq("post_id", postId);

    if (countError) {
      console.error("Erro ao contar likes:", countError);
      return { ok: true, liked: true, likesCount: 0 };
    }

    return {
      ok: true,
      liked: true,
      likesCount: count || 0,
    };
  }
}

export type LoadPostsResponse =
  | { ok: true; posts: Array<{
      id: string;
      content: string;
      created_at: string;
      author: {
        id: string;
        username: string;
        full_name: string;
        avatar_url: string | null;
        is_self_declared_woman: boolean;
      };
      likesCount: number;
      userHasLiked: boolean;
    }> }
  | { ok: false; error: string };

export async function loadPosts(): Promise<LoadPostsResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Usuário não autenticado" };
  }

  // Busca posts + likes do usuário em paralelo (2 roundtrips → 1)
  const [postsResult, likesResult] = await Promise.all([
    supabase
      .from("posts")
      .select(`
        id,
        content,
        created_at,
        profiles!posts_author_id_fkey (
          id,
          username,
          full_name,
          avatar_url,
          is_self_declared_woman
        ),
        post_likes (
          user_id
        )
      `)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("post_likes")
      .select("post_id")
      .eq("user_id", user.id)
      .limit(100),
  ]);

  const { data: posts, error: postsError } = postsResult;

  if (postsError) {
    console.error("Erro ao carregar posts:", postsError);
    return { ok: false, error: "Erro ao carregar posts" };
  }

  // Quais posts o usuário logado já curtiu
  const userHasLikedSet = new Set<string>();
  const { data: likes, error: likesError } = likesResult;

  if (likesError) {
    console.error("Erro ao carregar likes do usuário:", likesError);
  } else {
    likes?.forEach((l) => userHasLikedSet.add(l.post_id));
  }

  const enrichedPosts = (posts || []).map((post) => {
    const author = post.profiles ? post.profiles : null;
    const likesCount = Array.isArray(post.post_likes) ? post.post_likes.length : 0;
    const userHasLiked = userHasLikedSet.has(post.id);

    return {
      id: post.id,
      content: post.content,
      created_at: post.created_at,
      author: {
        id: author?.id || "",
        username: author?.username || "",
        full_name: author?.full_name || "",
        avatar_url: author?.avatar_url || null,
        is_self_declared_woman: author?.is_self_declared_woman || false,
      },
      likesCount,
      userHasLiked,
    };
  });

  return { ok: true, posts: enrichedPosts };
}