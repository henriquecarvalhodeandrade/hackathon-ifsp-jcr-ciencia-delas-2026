"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Check, AlertCircle, Sparkles } from "lucide-react";
import { updateProfile } from "@/lib/actions/profile";
import { WomanBadge } from "@/components/common/WomanBadge";
import type { Database } from "@/lib/types/database";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

interface EditProfileFormProps {
  profile: Profile;
}

export function EditProfileForm({ profile }: EditProfileFormProps) {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);
  const [success, setSuccess] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [isWoman, setIsWoman] = React.useState(profile.is_self_declared_woman);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    formData.set("isSelfDeclaredWoman", isWoman ? "true" : "false");

    try {
      const res = await updateProfile(formData);
      if (!res.ok) {
        setError(res.error);
      } else {
        setSuccess(true);
        router.refresh();
        setTimeout(() => setSuccess(false), 3000);
      }
    } catch {
      setError("Erro ao atualizar perfil.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-start gap-2.5">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-sm flex items-start gap-2.5">
          <Check className="w-5 h-5 shrink-0 mt-0.5" />
          <span>Perfil atualizado com sucesso!</span>
        </div>
      )}

      <div>
        <label
          htmlFor="fullName"
          className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5"
        >
          Nome Completo
        </label>
        <input
          id="fullName"
          name="fullName"
          type="text"
          defaultValue={profile.full_name}
          required
          className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all"
        />
      </div>

      <div>
        <label
          htmlFor="courseOrArea"
          className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5"
        >
          Curso / Área de Atuação
        </label>
        <input
          id="courseOrArea"
          name="courseOrArea"
          type="text"
          defaultValue={profile.course_or_area || ""}
          required
          className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all"
        />
      </div>

      <div>
        <label
          htmlFor="bio"
          className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5"
        >
          Biografia / Apresentação
        </label>
        <textarea
          id="bio"
          name="bio"
          rows={4}
          defaultValue={profile.bio || ""}
          placeholder="Fale um pouco sobre seus interesses de pesquisa, projetos ou aspirações acadêmicas..."
          maxLength={300}
          className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all resize-none"
        />
        <span className="text-[11px] text-muted-foreground block text-right mt-1">
          Máximo 300 caracteres
        </span>
      </div>

      {/* Autodeclaração Feminina */}
      <div className="p-4 rounded-2xl bg-card border border-border space-y-3">
        <label className="flex items-start gap-3 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={isWoman}
            onChange={(e) => setIsWoman(e.target.checked)}
            className="mt-1 w-4 h-4 rounded text-primary focus:ring-primary border-input"
          />
          <div>
            <span className="font-heading font-semibold text-sm text-foreground block">
              Sou mulher (cis / trans)
            </span>
            <span className="text-xs text-muted-foreground block mt-0.5 leading-relaxed">
              Exibe o Emblema Ártemis em seu perfil, posts e projetos.
            </span>
          </div>
        </label>

        {isWoman && (
          <div className="pt-2 border-t border-border/60 flex items-center justify-between text-xs">
            <span className="text-muted-foreground font-medium flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              Emblema Ativo:
            </span>
            <WomanBadge size="sm" />
          </div>
        )}
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-sm shadow-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Salvando...
          </>
        ) : (
          "Salvar Alterações"
        )}
      </button>
    </form>
  );
}
