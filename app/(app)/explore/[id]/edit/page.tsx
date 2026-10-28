import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Pencil } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ProjectForm } from "@/components/explore/ProjectForm";
import type { CreateProjectInput } from "@/lib/actions/projects";

interface EditProjectPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditProjectPage({ params }: EditProjectPageProps) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: project } = await supabase
    .from("projects")
    .select("id, creator_id, title, description, area, tags, slots, is_open")
    .eq("id", id)
    .maybeSingle();

  if (!project) notFound();
  if (project.creator_id !== user.id) redirect(`/explore/${id}`);

  const initialValues: CreateProjectInput = {
    title: project.title,
    description: project.description,
    area: project.area,
    tags: project.tags,
    slots: project.slots,
    is_open: project.is_open,
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="space-y-2">
        <Link
          href={`/explore/${id}`}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-primary transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para o projeto
        </Link>
        <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-foreground flex items-center gap-2">
          <Pencil className="w-6 h-6 text-primary" />
          Editar projeto de IC
        </h1>
      </div>

      <ProjectForm projectId={id} initialValues={initialValues} />
    </div>
  );
}
