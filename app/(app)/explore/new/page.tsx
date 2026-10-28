import Link from "next/link";
import { ArrowLeft, GraduationCap, Plus } from "lucide-react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProjectForm } from "@/components/explore/ProjectForm";

export default async function NewProjectPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("account_type")
    .eq("id", user.id)
    .single();

  const isScientist = profile?.account_type === "scientist";

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-foreground flex items-center gap-2">
          <Plus className="w-6 h-6 text-primary" />
          {isScientist ? "Novo projeto de Iniciação Científica" : "Publicar projeto de IC"}
        </h1>
        {isScientist && (
          <p className="text-sm text-muted-foreground mt-1">
            Descreva o projeto, a área e o número de vagas. Você poderá aceitar ou
            recusar os pedidos de interesse depois.
          </p>
        )}
      </div>

      {isScientist ? (
        <ProjectForm />
      ) : (
        <div className="p-10 text-center rounded-2xl bg-card border border-border space-y-3">
          <GraduationCap className="w-8 h-8 text-primary mx-auto" />
          <p className="font-heading font-semibold text-foreground">
            Somente contas Cientista podem publicar projetos de IC
          </p>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Sua conta está cadastrada como Estudante. Você ainda pode explorar os
            projetos, solicitar interesse e acompanhar as vagas abertas.
          </p>
          <Link
            href="/explore"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-border text-sm font-semibold text-foreground hover:bg-muted transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar para Explorar
          </Link>
        </div>
      )}
    </div>
  );
}
