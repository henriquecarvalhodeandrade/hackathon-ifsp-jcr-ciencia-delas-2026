import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, UserCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { EditProfileForm } from "@/components/profile/EditProfileForm";

export default async function SettingsProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) {
    redirect("/feed");
  }

  return (
    <div className="max-w-2xl mx-auto py-4">
      <div className="mb-6">
        <Link
          href={`/profile/${profile.username}`}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar ao meu perfil
        </Link>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <UserCircle className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-heading font-bold text-2xl text-foreground">
              Configurações do Perfil
            </h1>
            <p className="text-xs text-muted-foreground">
              Atualize suas informações acadêmicas e de representatividade
            </p>
          </div>
        </div>
      </div>

      <div className="p-6 rounded-2xl bg-card border border-border shadow-xs">
        <EditProfileForm profile={profile} />
      </div>
    </div>
  );
}
