"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  GraduationCap,
  Microscope,
  Sparkles,
  ShieldCheck,
  AlertCircle,
  Loader2,
  Check,
} from "lucide-react";
import { signUp } from "@/lib/actions/auth";
import { WomanBadge } from "@/components/common/WomanBadge";

export function SignupForm() {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Estados do formulário para interatividade ao vivo
  const [accountType, setAccountType] = React.useState<"student" | "scientist">(
    "student"
  );
  const [isWoman, setIsWoman] = React.useState(true);
  const [conductAccepted, setConductAccepted] = React.useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!conductAccepted) {
      setError("Você precisa aceitar o Código de Conduta para participar.");
      return;
    }

    setLoading(true);
    const formData = new FormData(e.currentTarget);
    formData.set("accountType", accountType);
    formData.set("isSelfDeclaredWoman", isWoman ? "true" : "false");
    formData.set("conductAccepted", conductAccepted ? "true" : "false");

    try {
      const res = await signUp(formData);
      if (!res.ok) {
        setError(res.error);
        setLoading(false);
      } else {
        router.push("/feed");
        router.refresh();
      }
    } catch {
      setError("Ocorreu um erro ao criar sua conta. Tente novamente.");
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

      {/* Seleção do Tipo de Conta */}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
          Como você quer participar?
        </label>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setAccountType("student")}
            className={`p-4 rounded-xl border text-left transition-all relative flex flex-col justify-between ${
              accountType === "student"
                ? "border-primary bg-primary/5 ring-2 ring-primary/20 text-foreground"
                : "border-border bg-card hover:bg-muted/40 text-muted-foreground"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <GraduationCap
                className={`w-6 h-6 ${
                  accountType === "student" ? "text-primary" : "text-muted-foreground"
                }`}
              />
              {accountType === "student" && (
                <div className="w-4 h-4 rounded-full bg-primary text-white flex items-center justify-center">
                  <Check className="w-2.5 h-2.5" />
                </div>
              )}
            </div>
            <div>
              <span className="font-heading font-bold text-sm block text-foreground">
                Estudante
              </span>
              <span className="text-xs text-muted-foreground">
                Buscando Iniciação Científica e mentoria.
              </span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setAccountType("scientist")}
            className={`p-4 rounded-xl border text-left transition-all relative flex flex-col justify-between ${
              accountType === "scientist"
                ? "border-primary bg-primary/5 ring-2 ring-primary/20 text-foreground"
                : "border-border bg-card hover:bg-muted/40 text-muted-foreground"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <Microscope
                className={`w-6 h-6 ${
                  accountType === "scientist" ? "text-primary" : "text-muted-foreground"
                }`}
              />
              {accountType === "scientist" && (
                <div className="w-4 h-4 rounded-full bg-primary text-white flex items-center justify-center">
                  <Check className="w-2.5 h-2.5" />
                </div>
              )}
            </div>
            <div>
              <span className="font-heading font-bold text-sm block text-foreground">
                Cientista
              </span>
              <span className="text-xs text-muted-foreground">
                Orientando alunas e publicando projetos.
              </span>
            </div>
          </button>
        </div>
      </div>

      {/* Dados Pessoais */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            required
            placeholder="Ex: Dra. Jaqueline Costa"
            className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all placeholder:text-muted-foreground/60"
          />
        </div>

        <div>
          <label
            htmlFor="username"
            className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5"
          >
            Nome de Usuário (@)
          </label>
          <div className="relative">
            <span className="absolute left-3.5 top-2.5 text-muted-foreground text-sm font-medium">
              @
            </span>
            <input
              id="username"
              name="username"
              type="text"
              required
              placeholder="marielle_silva"
              className="w-full pl-8 pr-3.5 py-2.5 rounded-xl border border-input bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all placeholder:text-muted-foreground/60"
            />
          </div>
        </div>
      </div>

      <div>
        <label
          htmlFor="courseOrArea"
          className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5"
        >
          {accountType === "student" ? "Curso / Instituição" : "Área de Pesquisa"}
        </label>
        <input
          id="courseOrArea"
          name="courseOrArea"
          type="text"
          required
          placeholder={
            accountType === "student"
              ? "Ex: Ciência da Computação - IFSP"
              : "Ex: Inteligência Artificial & Bioinformática"
          }
          className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all placeholder:text-muted-foreground/60"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label
            htmlFor="email"
            className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5"
          >
            E-mail
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            placeholder="nome@exemplo.com"
            className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all placeholder:text-muted-foreground/60"
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5"
          >
            Senha
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            placeholder="Mínimo 6 caracteres"
            className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all placeholder:text-muted-foreground/60"
          />
        </div>
      </div>

      {/* Autodeclaração Feminina & Emblema WomanBadge */}
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
              Destaque seu protagonismo na ciência. Ao marcar, você receberá o selo oficial em seu perfil e posts.
            </span>
          </div>
        </label>

        {isWoman && (
          <div className="pt-2 border-t border-border/60 flex items-center justify-between text-xs">
            <span className="text-muted-foreground font-medium flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              Preview no seu perfil:
            </span>
            <WomanBadge size="sm" />
          </div>
        )}
      </div>

      {/* Aceite do Código de Conduta */}
      <div className="p-4 rounded-2xl bg-muted/30 border border-border">
        <label className="flex items-start gap-3 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={conductAccepted}
            onChange={(e) => setConductAccepted(e.target.checked)}
            className="mt-1 w-4 h-4 rounded text-primary focus:ring-primary border-input"
          />
          <div className="text-xs text-muted-foreground leading-relaxed">
            <span className="font-medium text-foreground">
              Li e concordo com o{" "}
              <Link
                href="/conduta"
                target="_blank"
                className="text-primary hover:underline font-semibold"
              >
                Código de Conduta da comunidade Ártemis
              </Link>
            </span>
            . Comprometo-me com um ambiente seguro, ético e livre de assédio para todas as pesquisadoras.
          </div>
        </label>
      </div>

      {/* Botão de Envio */}
      <button
        type="submit"
        disabled={loading}
        className="w-full py-3.5 px-4 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-sm shadow-md shadow-primary/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.01]"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Criando conta...
          </>
        ) : (
          "Criar Conta na Ártemis"
        )}
      </button>

      <p className="text-center text-xs text-muted-foreground">
        Já possui uma conta?{" "}
        <Link
          href="/login"
          className="text-primary hover:underline font-semibold"
        >
          Entrar aqui
        </Link>
      </p>
    </form>
  );
}
