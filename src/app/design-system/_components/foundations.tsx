import {
  Baby,
  BadgeDollarSign,
  Bell,
  BookOpen,
  CalendarHeart,
  FlaskConical,
  GraduationCap,
  HandHeart,
  HeartHandshake,
  HeartPulse,
  MessagesSquare,
  Newspaper,
  Orbit,
  Search,
  ShieldCheck,
  ShieldPlus,
  Star,
  Telescope,
  Trophy,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DsSection, DsSubheading } from "./ds";

const FAMILIES = [
  {
    token: "font-display",
    name: "Bricolage Grotesque",
    role: "Títulos, números, marca",
    why: "Grotesca expressiva com eixo óptico: firme nos títulos grandes, amigável nos pequenos.",
    className: "font-display font-semibold",
    sample: "Ciência é coisa delas",
  },
  {
    token: "font-sans",
    name: "Atkinson Hyperlegible Next",
    role: "Texto e interface (padrão do body)",
    why: "Desenhada pelo Braille Institute para baixa visão. Formas que não se confundem: Il1 O0 rn m.",
    className: "font-sans",
    sample: "Pesquisadoras de Jacareí à Amazônia",
  },
  {
    token: "font-serif",
    name: "Newsreader",
    role: "Títulos de papers, resumos, editorial da newsletter",
    why: "Serifada editorial com eixo óptico — dá ao conteúdo científico o peso de uma publicação.",
    className: "font-serif",
    sample: "Mecanismos de resistência em biofilmes",
  },
  {
    token: "font-mono",
    name: "Atkinson Hyperlegible Mono",
    role: "DOIs, dados, código",
    why: "Mesma legibilidade da família principal, em largura fixa para identificadores.",
    className: "font-mono",
    sample: "doi:10.5555/demo.2026.0042",
  },
] as const;

const SCALE = [
  { token: "text-display", size: "40–72px", lh: "1,02", sample: "Artemis" },
  { token: "text-5xl", size: "48px", lh: "52px", sample: "Ranking da semana" },
  { token: "text-4xl", size: "36px", lh: "42px", sample: "Encontre sua mentora" },
  { token: "text-3xl", size: "30px", lh: "36px", sample: "Fórum da comunidade" },
  { token: "text-2xl", size: "24px", lh: "32px", sample: "Papers em destaque" },
  { token: "text-xl", size: "20px", lh: "30px", sample: "Bolsas e editais abertos" },
  { token: "text-lg", size: "18px", lh: "28px", sample: "Descrição de página e chamadas" },
  { token: "text-base", size: "16px", lh: "26px", sample: "Texto corrido da interface e dos posts." },
  { token: "text-sm", size: "14px", lh: "22px", sample: "Metadados, rótulos, ajuda de campos." },
  { token: "text-xs", size: "12px", lh: "18px", sample: "Contadores e legendas curtas." },
] as const;

export function Typography() {
  return (
    <DsSection
      id="tipografia"
      number="04"
      group="Fundamentos"
      title="Tipografia"
      description="Quatro famílias com papéis bem definidos — todas variáveis e com latin-ext (acentos do português e nomes estrangeiros), servidas pelo next/font sem chamadas ao Google no navegador."
    >
      <div className="grid gap-4 md:grid-cols-2">
        {FAMILIES.map((f) => (
          <article key={f.token} className="grid content-start gap-3 rounded-card border border-border bg-surface p-5 shadow-card">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-display text-lg font-semibold text-fg">{f.name}</h3>
                <p className="text-sm text-fg-muted">{f.role}</p>
              </div>
              <code className="shrink-0 rounded-badge bg-surface-2 px-1.5 py-0.5 font-mono text-xs text-fg-muted">{f.token}</code>
            </div>
            <p className={cn("text-[2.75rem] leading-none text-fg", f.className)} aria-hidden="true">
              Aa Çç Ãã
            </p>
            <p className={cn("text-xl text-fg", f.className)}>{f.sample}</p>
            <p className="text-sm text-fg-subtle">{f.why}</p>
          </article>
        ))}
      </div>

      <DsSubheading description="Tamanhos com entrelinha embutida (text-xl já traz a altura de linha). Títulos usam text-wrap: balance; parágrafos, pretty.">
        Escala
      </DsSubheading>
      <div className="divide-y divide-border overflow-hidden rounded-card border border-border bg-surface">
        {SCALE.map((s) => (
          <div key={s.token} className="grid items-baseline gap-x-6 gap-y-1 px-5 py-4 sm:grid-cols-[9rem_7rem_1fr]">
            <code className="font-mono text-[0.8125rem] font-semibold text-primary">{s.token}</code>
            <span className="tabular font-mono text-xs text-fg-subtle">
              {s.size} / {s.lh}
            </span>
            <p
              className={cn(
                s.token,
                s.token.match(/display|5xl|4xl|3xl|2xl|xl$/) ? "font-display font-semibold tracking-[-0.02em]" : "",
                "min-w-0 truncate text-fg",
              )}
            >
              {s.sample}
            </p>
          </div>
        ))}
      </div>

      <DsSubheading description="Combinações recorrentes — copie e cole.">Receitas</DsSubheading>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-card border border-border bg-surface p-5">
          <p className="eyebrow text-primary">Eyebrow · .eyebrow</p>
          <p className="mt-2 font-display text-2xl font-semibold text-fg">Título de seção</p>
          <p className="mt-1 text-fg-muted">Descrição em text-fg-muted.</p>
        </div>
        <div className="rounded-card border border-border bg-surface p-5">
          <p className="font-serif text-xl leading-snug font-semibold text-fg">
            Biomarcadores salivares para diagnóstico precoce de diabetes gestacional
          </p>
          <p className="mt-2 text-sm text-fg-muted">Ana Souza, Beatriz Lima · Revista Demo, 2026</p>
          <p className="mt-1 font-mono text-xs text-fg-subtle">10.5555/demo.2026.0042</p>
        </div>
        <div className="rounded-card border border-border bg-surface p-5">
          <p className="tabular font-display text-5xl font-semibold tracking-[-0.03em] text-fg">1.284</p>
          <p className="mt-1 text-sm text-fg-muted">pesquisadoras na rede · .tabular</p>
        </div>
      </div>
    </DsSection>
  );
}

const SPACING = [1, 2, 3, 4, 6, 8, 12, 16] as const;

const RADII = [
  { token: "rounded-badge", px: "6px", use: "Badges, kbd, código inline", className: "rounded-badge" },
  { token: "rounded-control", px: "10px", use: "Botões, campos, itens de menu", className: "rounded-control" },
  { token: "rounded-card", px: "16px", use: "Cartões, alertas, painéis", className: "rounded-card" },
  { token: "rounded-dialog", px: "20px", use: "Diálogos, gavetas, hero", className: "rounded-dialog" },
  { token: "rounded-pill", px: "999px", use: "Chips, tags, contadores", className: "rounded-pill" },
  { token: "rounded-full", px: "50%", use: "Avatares, nós da constelação", className: "rounded-full" },
] as const;

const SHADOWS = [
  { token: "shadow-card", use: "Cartões em repouso — quase imperceptível; a borda faz o trabalho." },
  { token: "shadow-raised", use: "Hover de cartões interativos, elementos arrastados." },
  { token: "shadow-overlay", use: "Menus, diálogos e gavetas (camada acima da página)." },
] as const;

export function Foundations() {
  return (
    <DsSection
      id="fundamentos"
      number="05"
      group="Fundamentos"
      title="Espaço, forma e movimento"
      description="Raio e sombra comunicam papel: o que é controle, o que é conteúdo, o que flutua. Não arredonde tudo igual."
    >
      <DsSubheading description="Base de 4px (escala padrão do Tailwind). Respiros comuns: gap-2 dentro de controles, gap-4 entre campos, gap-6/8 entre blocos, py-10–14 entre seções.">
        Espaçamento
      </DsSubheading>
      <div className="grid gap-2 rounded-card border border-border bg-surface p-5">
        {SPACING.map((n) => (
          <div key={n} className="flex items-center gap-4">
            <code className="w-12 shrink-0 font-mono text-xs text-fg-muted">{n}</code>
            <span className="h-3 rounded-[2px] bg-primary" style={{ width: `${n * 4}px` }} />
            <span className="tabular font-mono text-xs text-fg-subtle">{n * 4}px</span>
          </div>
        ))}
      </div>

      <DsSubheading>Raios por papel</DsSubheading>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {RADII.map((r) => (
          <div key={r.token} className="grid gap-2">
            <div className={cn("h-20 border-2 border-primary bg-primary-soft", r.className)} />
            <code className="font-mono text-xs font-semibold text-fg">{r.token}</code>
            <p className="text-xs text-fg-muted">
              {r.px} · {r.use}
            </p>
          </div>
        ))}
      </div>

      <DsSubheading description="No escuro, as sombras ficam mais densas e as superfícies se separam também por luminosidade.">
        Sombras por camada
      </DsSubheading>
      <div className="grid gap-6 rounded-card bg-surface-2 p-6 sm:grid-cols-3">
        {SHADOWS.map((s) => (
          <div key={s.token} className={cn("grid gap-1 rounded-card border border-border bg-surface p-5", s.token)}>
            <code className="font-mono text-sm font-semibold text-fg">{s.token}</code>
            <p className="text-sm text-fg-muted">{s.use}</p>
          </div>
        ))}
      </div>

      <DsSubheading description="Movimento curto e funcional. Tudo é desligado com prefers-reduced-motion (regra global em globals.css).">
        Movimento
      </DsSubheading>
      <ul className="grid gap-3 text-[0.9375rem] text-fg-muted sm:grid-cols-2">
        <li className="rounded-card border border-border bg-surface p-4">
          <code className="font-mono text-sm font-semibold text-fg">duration-150 · ease-out-soft</code>
          <p className="mt-1">Cores e bordas de hover/foco.</p>
        </li>
        <li className="rounded-card border border-border bg-surface p-4">
          <code className="font-mono text-sm font-semibold text-fg">animate-pop-in · animate-fade-in</code>
          <p className="mt-1">Entrada de menus e diálogos (≤ 200ms).</p>
        </li>
        <li className="rounded-card border border-border bg-surface p-4">
          <code className="font-mono text-sm font-semibold text-fg">animate-slide-in-right</code>
          <p className="mt-1">Gaveta de navegação no celular.</p>
        </li>
        <li className="rounded-card border border-border bg-surface p-4">
          <code className="font-mono text-sm font-semibold text-fg">animate-twinkle</code>
          <p className="mt-1">Algumas estrelas do padrão de fundo — nunca em conteúdo.</p>
        </li>
      </ul>
    </DsSection>
  );
}

const ICONS = [
  { icon: MessagesSquare, name: "MessagesSquare", use: "Fórum" },
  { icon: HeartHandshake, name: "HeartHandshake", use: "Mentoria" },
  { icon: Users, name: "Users", use: "Pesquisadoras" },
  { icon: BookOpen, name: "BookOpen", use: "Papers" },
  { icon: Trophy, name: "Trophy", use: "Ranking" },
  { icon: Newspaper, name: "Newspaper", use: "Newsletter" },
  { icon: Star, name: "Star", use: "Destaque (voto)" },
  { icon: Orbit, name: "Orbit", use: "Compatibilidade" },
  { icon: Telescope, name: "Telescope", use: "Descobrir / vazio" },
  { icon: Bell, name: "Bell", use: "Notificações" },
  { icon: ShieldCheck, name: "ShieldCheck", use: "Moderação" },
  { icon: Search, name: "Search", use: "Busca" },
  { icon: HandHeart, name: "HandHeart", use: "Apresente-se" },
  { icon: GraduationCap, name: "GraduationCap", use: "Carreira" },
  { icon: BadgeDollarSign, name: "BadgeDollarSign", use: "Bolsas e editais" },
  { icon: FlaskConical, name: "FlaskConical", use: "Dúvidas de pesquisa" },
  { icon: Baby, name: "Baby", use: "Maternidade" },
  { icon: ShieldPlus, name: "ShieldPlus", use: "Rede de apoio" },
  { icon: HeartPulse, name: "HeartPulse", use: "Saúde mental" },
  { icon: CalendarHeart, name: "CalendarHeart", use: "Eventos" },
] as const;

export function Iconography() {
  return (
    <DsSection
      id="icones"
      number="06"
      group="Fundamentos"
      title="Iconografia"
      description="lucide-react, traço 2px, cantos arredondados. Nada de emoji na interface: ícones são consistentes, escaláveis e funcionam com leitor de tela."
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_1.6fr]">
        <ul className="grid content-start gap-3 text-[0.9375rem] text-fg-muted">
          <li>
            <strong className="text-fg">Tamanhos:</strong> 16px (size-4) junto a text-sm · 18px em botões md · 20px
            (size-5) na navegação · 24px (size-6) em estados vazios.
          </li>
          <li>
            <strong className="text-fg">Decorativo?</strong> Sempre <code className="font-mono text-sm">aria-hidden=&quot;true&quot;</code>{" "}
            quando há texto ao lado.
          </li>
          <li>
            <strong className="text-fg">Só ícone?</strong> O botão precisa de{" "}
            <code className="font-mono text-sm">aria-label</code> (ex.: “Fechar”). Tooltip é complemento, não nome.
          </li>
          <li>
            <strong className="text-fg">Cor:</strong> herda o texto (currentColor). Estrela de voto ativa:{" "}
            <code className="font-mono text-sm">fill-accent text-accent-strong</code>.
          </li>
          <li>
            <strong className="text-fg">Categorias do fórum:</strong> o banco guarda o nome em kebab-case
            (“graduation-cap”); renderize com{" "}
            <code className="font-mono text-sm">&lt;CategoryIcon name=&#123;categoria.icon&#125; /&gt;</code> —
            ele já troca “shield-heart” (que não existe no lucide 1.x) por ShieldPlus.
          </li>
        </ul>
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 2xl:grid-cols-4">
          {ICONS.map(({ icon: Icon, name, use }) => (
            <li key={name} className="flex items-center gap-3 rounded-control border border-border bg-surface px-3 py-2.5">
              <Icon aria-hidden="true" className="size-5 text-primary" />
              <span className="grid min-w-0">
                <span className="truncate text-sm font-semibold text-fg">{use}</span>
                <span className="truncate font-mono text-[0.6875rem] text-fg-subtle">{name}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </DsSection>
  );
}
