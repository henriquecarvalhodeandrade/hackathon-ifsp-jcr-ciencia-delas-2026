"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const SignUpSchema = z.object({
  fullName: z.string().min(2, "Nome completo deve ter pelo menos 2 caracteres"),
  username: z
    .string()
    .min(3, "Nome de usuário deve ter pelo menos 3 caracteres")
    .max(30, "Máximo de 30 caracteres")
    .regex(
      /^[a-zA-Z0-9_]+$/,
      "Apenas letras, números e sublinhados (_) são permitidos"
    ),
  email: z.string().email("E-mail inválido"),
  password: z.string().min(6, "A senha deve ter pelo menos 6 caracteres"),
  accountType: z.enum(["student", "scientist"], {
    required_error: "Selecione o tipo de conta",
  }),
  courseOrArea: z.string().min(2, "Informe seu curso ou área de atuação"),
  isSelfDeclaredWoman: z.boolean(),
  conductAccepted: z.literal(true, {
    errorMap: () => ({
      message: "Você precisa aceitar o Código de Conduta para participar",
    }),
  }),
});

const SignInSchema = z.object({
  email: z.string().email("E-mail inválido"),
  password: z.string().min(1, "Informe sua senha"),
});

export type ActionResponse =
  | { ok: true; error?: never }
  | { ok: false; error: string };

export async function signUp(
  formData: FormData
): Promise<ActionResponse> {
  const rawData = {
    fullName: formData.get("fullName"),
    username: formData.get("username"),
    email: formData.get("email"),
    password: formData.get("password"),
    accountType: formData.get("accountType"),
    courseOrArea: formData.get("courseOrArea"),
    isSelfDeclaredWoman: formData.get("isSelfDeclaredWoman") === "true",
    conductAccepted: formData.get("conductAccepted") === "true",
  };

  const parsed = SignUpSchema.safeParse(rawData);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message || "Dados inválidos",
    };
  }

  const supabase = await createClient();
  const normalizedUsername = parsed.data.username.trim().toLowerCase();

  // 1. Garantir que o nome de usuário seja único antes de chamar auth.signUp
  const { data: existingUser, error: checkError } = await supabase
    .from("profiles")
    .select("username")
    .eq("username", normalizedUsername)
    .maybeSingle();

  if (existingUser) {
    return {
      ok: false,
      error: `O nome de usuário @${normalizedUsername} já está em uso. Por favor, escolha outro.`,
    };
  }

  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: parsed.data.email.trim(),
    password: parsed.data.password,
    options: {
      data: {
        username: normalizedUsername,
        full_name: parsed.data.fullName.trim(),
        account_type: parsed.data.accountType,
        course_or_area: parsed.data.courseOrArea.trim(),
        is_self_declared_woman: parsed.data.isSelfDeclaredWoman,
      },
    },
  });

  if (authError) {
    if (authError.message.includes("Database error saving new user")) {
      return {
        ok: false,
        error:
          "Erro ao salvar dados no banco. Verifique se o script SQL foi executado no SQL Editor do Supabase ou se este e-mail/username já foram cadastrados.",
      };
    }
    return { ok: false, error: authError.message };
  }

  // Fallback caso a trigger do Postgres demore ou não esteja ativa ainda:
  // Garante que a linha de profile exista imediatamente
  if (authData.user) {
    const { error: profileError } = await supabase.from("profiles").upsert(
      {
        id: authData.user.id,
        email: parsed.data.email.trim(),
        username: normalizedUsername,
        full_name: parsed.data.fullName,
        account_type: parsed.data.accountType,
        course_or_area: parsed.data.courseOrArea,
        is_self_declared_woman: parsed.data.isSelfDeclaredWoman,
        conduct_accepted_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );

    if (profileError) {
      console.error("Erro ao persistir perfil de fallback:", profileError);
    }
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function signIn(
  formData: FormData
): Promise<ActionResponse> {
  const rawData = {
    email: formData.get("email"),
    password: formData.get("password"),
  };

  const parsed = SignInSchema.safeParse(rawData);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message || "Dados inválidos",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    return { ok: false, error: "E-mail ou senha incorretos." };
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
