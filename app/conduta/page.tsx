import Link from "next/link";
import { ShieldCheck, ArrowLeft, Heart, CheckCircle2 } from "lucide-react";
import { ThemeToggle } from "@/components/common/ThemeToggle";

export default function CondutaPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border/80 sticky top-0 z-50 bg-background/80 backdrop-blur-md">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar ao Início
          </Link>
          <div className="flex items-center gap-3">
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-4xl mx-auto px-4 py-12">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-4">
          <ShieldCheck className="w-4 h-4" />
          Trust & Safety
        </div>

        <h1 className="font-heading font-extrabold text-3xl sm:text-4xl text-foreground tracking-tight mb-4">
          Código de Conduta da Comunidade Ártemis
        </h1>
        <p className="text-muted-foreground leading-relaxed mb-8">
          A plataforma Ártemis é um ambiente social e científico dedicado a promover o respeito, a segurança e a visibilidade de mulheres e meninas nas áreas de exatas, computação e ciências exatas e naturais (STEM).
        </p>

        <div className="space-y-6">
          <section className="p-6 rounded-2xl bg-card border border-border">
            <h2 className="font-heading font-bold text-xl text-foreground mb-3 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              1. Respeito Inegociável e Anti-Assédio
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Não toleramos nenhuma forma de assédio, comentários depreciativos sobre gênero, identidade sexual, raça ou capacidade técnica. Mensagens invasivas ou comportamentos inadequados resultarão na suspensão imediata da conta.
            </p>
          </section>

          <section className="p-6 rounded-2xl bg-card border border-border">
            <h2 className="font-heading font-bold text-xl text-foreground mb-3 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              2. Protagonismo Feminino e Autodeclaração
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              O sistema é inclusivo e aberto a todos os gêneros, mas as ferramentas e destaques visuais (como o selo <strong>Mulher em STEM</strong>) são intencionalmente desenhados para dar visibilidade a mulheres (cis e trans). Respeite e honre a autodeclaração das participantes.
            </p>
          </section>

          <section className="p-6 rounded-2xl bg-card border border-border">
            <h2 className="font-heading font-bold text-xl text-foreground mb-3 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              3. Ética Acadêmica e Colaboração
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              As oportunidades de Iniciação Científica e conexões de mentoria devem ser baseadas em honestidade científica, incentivo mútuo e compromisso com o desenvolvimento de novas pesquisadoras.
            </p>
          </section>

          <section className="p-6 rounded-2xl bg-card border border-border">
            <h2 className="font-heading font-bold text-xl text-foreground mb-3 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              4. Privacidade e Dados Sensíveis (LGPD)
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Em total conformidade com a LGPD, o Ártemis armazena apenas a autodeclaração voluntária como dado pessoal sensível. Jamais compartilhe dados privados ou mensagens confidenciais de terceiros sem autorização.
            </p>
          </section>
        </div>

        <div className="mt-10 p-6 rounded-2xl bg-muted/40 border border-border text-center">
          <p className="text-sm text-muted-foreground">
            Ao se cadastrar no Ártemis, você confirma o cumprimento integral deste código. Juntas construímos uma ciência mais diversa e inclusiva.
          </p>
          <div className="mt-4">
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-sm transition-all"
            >
              Criar Conta e Aceitar Termos
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
