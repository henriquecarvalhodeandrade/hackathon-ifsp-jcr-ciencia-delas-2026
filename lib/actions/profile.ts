"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const UpdateProfileSchema = z.object({
  fullName: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  bio: z.string().max(300, "Bio pode ter no máximo 300 caracteres").optional(),
  courseOrArea: z.string().min(2, "Informe seu curso ou área"),
  isSelfDeclaredWoman: z.boolean(),
});

export type ProfileActionResponse =
  | { ok: true; error?: never }
  | { ok: false; error: string };

export async function updateProfile(
  formData: FormData
): Promise<ProfileActionResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Não autenticado." };
  }

  const rawData = {
    fullName: formData.get("fullName"),
    bio: formData.get("bio") || "",
    courseOrArea: formData.get("courseOrArea"),
    isSelfDeclaredWoman: formData.get("isSelfDeclaredWoman") === "true",
  };

  const parsed = UpdateProfileSchema.safeParse(rawData);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message || "Dados inválidos.",
    };
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: parsed.data.fullName,
      bio: parsed.data.bio,
      course_or_area: parsed.data.courseOrArea,
      is_self_declared_woman: parsed.data.isSelfDeclaredWoman,
    })
    .eq("id", user.id);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/", "layout");
  return { ok: true };
}
