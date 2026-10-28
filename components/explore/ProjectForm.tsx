"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2, Plus, Save } from "lucide-react";
import { createProject, updateProject, type CreateProjectInput } from "@/lib/actions/projects";

interface ProjectFormProps {
  /** Se presente, o formulário entra em modo edição (update em vez de insert). */
  projectId?: string;
  initialValues?: CreateProjectInput;
}

export function ProjectForm({ projectId, initialValues }: ProjectFormProps) {
  const router = useRouter();
  const isEdit = Boolean(projectId);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [tagsValue, setTagsValue] = React.useState(
    initialValues?.tags.join(", ") ?? ""
  );

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const rawSlots = formData.get("slots");

    const input: CreateProjectInput = {
      title: String(formData.get("title") ?? ""),
      description: String(formData.get("description") ?? ""),
      area: String(formData.get("area") ?? ""),
      tags: String(formData.get("tags") ?? "")
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      slots: Number(rawSlots ?? 3),
      is_open: formData.get("is_open") === "on",
    };

    try {
      const res =
        projectId && initialValues !== undefined
          ? await updateProject(projectId, input)
          : await createProject(input);
      if (!res.ok) {
        setError(res.error);
        setLoading(false);
      } else if (res.id) {
        router.push(`/explore/${res.id}`);
        router.refresh();
      }
    } catch {
      setError(
        isEdit
          ? "Ocorreu um erro ao salvar as alterações. Tente novamente."
          : "Ocorreu um erro ao criar o projeto. Tente novamente."
      );
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-start gap-2.5">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div>
        <label
          htmlFor="title"
          className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5"
        >
          Título do projeto
        </label>
        <input
          id="title"
          name="title"
          type="text"
          required
          minLength={5}
          maxLength={140}
          placeholder="Ex.: Mitigação de vieses algorítmicos em modelos de linguagem"
          defaultValue={initialValues?.title}
          className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all placeholder:text-muted-foreground/60"
        />
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label
            htmlFor="area"
            className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5"
          >
            Área de atuação
          </label>
          <input
            id="area"
            name="area"
            type="text"
            required
            minLength={2}
            maxLength={80}
            placeholder="Ex.: Inteligência Artificial"
            defaultValue={initialValues?.area}
            className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all placeholder:text-muted-foreground/60"
          />
        </div>
        <div>
          <label
            htmlFor="slots"
            className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5"
          >
            Vagas disponíveis
          </label>
          <input
            id="slots"
            name="slots"
            type="number"
            required
            min={1}
            max={20}
            defaultValue={initialValues?.slots ?? 3}
            className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all"
          />
        </div>
      </div>

      <div>
        <label
          htmlFor="description"
          className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5"
        >
          Descrição
        </label>
        <textarea
          id="description"
          name="description"
          required
          minLength={20}
          maxLength={3000}
          rows={6}
          placeholder="Conte o objetivo do projeto, metodologia, o que a pessoa participante fará e os requisitos..."
          defaultValue={initialValues?.description}
          className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all resize-y placeholder:text-muted-foreground/60"
        />
      </div>

      <div>
        <label
          htmlFor="tags"
          className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5"
        >
          Tags <span className="normal-case font-normal">(separadas por vírgula)</span>
        </label>
        <input
          id="tags"
          name="tags"
          type="text"
          value={tagsValue}
          onChange={(e) => setTagsValue(e.target.value)}
          maxLength={300}
          placeholder="Python, NLP, Ética em IA"
          className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all placeholder:text-muted-foreground/60"
        />
      </div>

      <label className="inline-flex items-start gap-2.5 cursor-pointer select-none">
        <input
          type="checkbox"
          name="is_open"
          defaultChecked={initialValues?.is_open ?? true}
          className="w-4 h-4 mt-0.5 rounded border-border accent-[#7C3AED] cursor-pointer"
        />
        <span className="text-sm text-muted-foreground">
          Aceitar novos pedidos de interesse
          <span className="block text-xs text-muted-foreground/70">
            Desmarque para encerrar as inscrições.
          </span>
        </span>
      </label>

      <button
        type="submit"
        disabled={loading}
        className="w-full py-3.5 px-4 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-sm shadow-md shadow-primary/20 flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            {isEdit ? "Salvando..." : "Publicando..."}
          </>
        ) : isEdit ? (
          <>
            <Save className="w-4 h-4" />
            Salvar alterações
          </>
        ) : (
          <>
            <Plus className="w-4 h-4" />
            Publicar projeto
          </>
        )}
      </button>
    </form>
  );
}
