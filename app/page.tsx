import Link from "next/link";
import { Sparkles, ArrowRight, Compass, Users, HeartHandshake, BookOpen } from "lucide-react";
import { WomanBadge } from "@/components/common/WomanBadge";
import { ThemeToggle } from "@/components/common/ThemeToggle";

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      {/* Top Header / Brand Bar */}
      <header className="border-b border-border/80 sticky top-0 z-50 bg-background/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary to-secondary flex items-center justify-center text-white font-heading font-black text-xl shadow-md">
              Á
            </div>
            <div>
              <span className="font-heading font-bold text-xl tracking-tight text-foreground">
                Ártemis
              </span>
              <span className="hidden sm:inline-block ml-2 text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                SNCT 2026 • Ciência Delas
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link
              href="/login"
              className="text-sm font-medium px-4 py-2 rounded-lg hover:bg-muted transition-colors"
            >
              Entrar
            </Link>
            <Link
              href="/signup"
              className="text-sm font-medium px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm transition-all"
            >
              Criar Conta
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 max-w-6xl mx-auto px-4 py-16 sm:py-24 flex flex-col items-center text-center">
        <div className="inline-flex items-center gap-2 mb-6">
          <WomanBadge size="md" />
          <span className="text-xs text-muted-foreground font-medium">
            Rede de Apoio & Oportunidades em STEM
          </span>
        </div>

        <h1 className="font-heading font-extrabold text-4xl sm:text-6xl max-w-4xl tracking-tight text-foreground leading-[1.15]">
          Onde meninas e mulheres{" "}
          <span className="bg-gradient-to-r from-primary via-fuchsia-500 to-secondary bg-clip-text text-transparent">
            lideram a ciência
          </span>{" "}
          e transformam o futuro.
        </h1>

        <p className="mt-6 text-lg sm:text-xl text-muted-foreground max-w-2xl font-sans">
          Combata a evasão acadêmica feminina. Conecte-se com cientistas renomadas, descubra vagas de Iniciação Científica e divulgue suas descobertas.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
          <Link
            href="/signup"
            className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-lg shadow-primary/20 transition-all hover:scale-[1.02]"
          >
            Começar Agora
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl border border-border hover:bg-muted/60 font-semibold transition-colors"
          >
            Já tenho cadastro
          </Link>
        </div>

        {/* Feature Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-20 w-full text-left">
          <div className="p-6 rounded-2xl bg-card border border-border shadow-xs hover:border-primary/40 transition-colors">
            <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-4">
              <Compass className="w-6 h-6" />
            </div>
            <h3 className="font-heading font-semibold text-lg text-foreground mb-2">
              Match de Iniciação Científica
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Encontre bolsas e laboratórios de pesquisa com vagas abertas. Candidaturas diretas e transparentes para estudantes.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-card border border-border shadow-xs hover:border-secondary/40 transition-colors">
            <div className="w-12 h-12 rounded-xl bg-secondary/10 text-secondary flex items-center justify-center mb-4">
              <Sparkles className="w-6 h-6" />
            </div>
            <h3 className="font-heading font-semibold text-lg text-foreground mb-2">
              Protagonismo & Selo Ártemis
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Autodeclaração feminina com emblema visual e prioridade algorítmica para dar voz e visibilidade a quem constrói a ciência.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-card border border-border shadow-xs hover:border-primary/40 transition-colors">
            <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-4">
              <HeartHandshake className="w-6 h-6" />
            </div>
            <h3 className="font-heading font-semibold text-lg text-foreground mb-2">
              Conexões Seguras Anti-Assédio
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Comunicação em tempo real protegida com aprovação prévia de mensagens para que pesquisadoras trabalhem em paz.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/80 py-8 text-center text-xs text-muted-foreground">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© 2026 Ártemis — Desenvolvido para o Hackathon SNCT "Ciência Delas".</p>
          <div className="flex gap-4">
            <Link href="/conduta" className="hover:text-foreground transition-colors">
              Código de Conduta
            </Link>
            <span>•</span>
            <span className="text-primary font-medium">Mulheres em STEM</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
