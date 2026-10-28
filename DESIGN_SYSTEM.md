# Ártemis — Sistema de Design & Identidade Visual

Este documento é a especificação oficial de UI/UX do projeto **Ártemis** (Hackathon SNCT 2026 — *Ciência Delas*).
A direção adotada é **Editorial & Acadêmica**: combina o rigor e a credibilidade de periódicos científicos com o calor, acolhimento e destaque do protagonismo feminino em STEM.

---

## 1. Princípios de Design
1. **Autoridade Científica com Acolhimento:** Visual sóbrio, limpo e estruturado com toques vibrantes em Orquídea e Coral.
2. **Protagonismo Feminino Evidente:** O badge visual (`WomanBadge`) possui destaque estético exclusivo e elegante em ambos os temas.
3. **Alto Contraste e Acessibilidade (WCAG AA):** Textos nítidos em modo claro e escuro, sem cinzas ilegíveis ou contraste insuficiente.
4. **Micro-interações Suaves:** Transições sutis de hover, estados otimistas (like, interesse) e feedback imediato.

---

## 2. Tipografia

* **Títulos e Headings (`font-heading`):** `Plus Jakarta Sans`, sans-serif
  * Pesos: `600 (Semi-bold)`, `700 (Bold)`, `800 (Extra-bold)`
  * Usado em: Cabeçalhos, títulos de projetos de IC, nomes de perfil, títulos de cards.
* **Corpo e Interface (`font-sans`):** `Inter`, sans-serif
  * Pesos: `400 (Regular)`, `500 (Medium)`, `600 (Semi-bold)`
  * Usado em: Posts do feed, textos de bio, inputs, tabelas, chat e metadados.

---

## 3. Paleta de Cores e Tokens Semânticos

### Modo Claro (Light Theme)
Ideal para leitura prolongada, ambientes iluminados e aspecto de periódico/revista científica.

| Token | HEX | HSL | Aplicação |
|---|---|---|---|
| `--background` | `#F8FAFC` | `210 40% 98%` | Fundo principal da página (Slate 50) |
| `--foreground` | `#0B1120` | `222 47% 8%` | Texto principal (Navy Profundo) |
| `--card` | `#FFFFFF` | `0 0% 100%` | Cards, modais e menus suspensos |
| `--card-foreground` | `#0B1120` | `222 47% 8%` | Texto em cards |
| `--primary` | `#7C3AED` | `262 83% 58%` | Orquídea Vibrante (botões primários, links ativos) |
| `--primary-foreground`| `#FFFFFF` | `0 0% 100%` | Texto sobre botões primários |
| `--secondary` | `#F43F5E` | `349 89% 60%` | Coral Científico (destaques, tags de acolhimento) |
| `--secondary-foreground`| `#FFFFFF`| `0 0% 100%` | Texto sobre botões secundários |
| `--muted` | `#F1F5F9` | `210 40% 96%` | Fundos de tabs inativas, tags neutras |
| `--muted-foreground` | `#64748B` | `215 16% 47%` | Datas, handles (@username), descrições curtas |
| `--border` | `#E2E8F0` | `214 32% 91%` | Bordas de cards, divisórias e inputs |
| `--ring` | `#7C3AED` | `262 83% 58%` | Anel de foco em acessibilidade |

### Modo Escuro (Dark Theme)
Visual noturno sofisticado ("Deep Space & Academic Navy"), ideal para redução de fadiga visual e imersão.

| Token | HEX | HSL | Aplicação |
|---|---|---|---|
| `--background` | `#0B1120` | `222 47% 8%` | Fundo principal (Deep Academic Navy) |
| `--foreground` | `#F8FAFC` | `210 40% 98%` | Texto principal (Branco suave) |
| `--card` | `#131B2E` | `221 41% 13%` | Cards, modais e containers (Navy Meia-Noite) |
| `--card-foreground` | `#F8FAFC` | `210 40% 98%` | Texto dentro de cards |
| `--primary` | `#A855F7` | `271 91% 65%` | Orquídea Real luminosa |
| `--primary-foreground`| `#FFFFFF` | `0 0% 100%` | Texto sobre botões primários |
| `--secondary` | `#FB7185` | `350 89% 60%` | Coral Suave |
| `--secondary-foreground`| `#0B1120`| `222 47% 8%` | Texto sobre botões secundários |
| `--muted` | `#1E293B` | `217 33% 17%` | Fundos secundários, containers de código |
| `--muted-foreground` | `#94A3B8` | `215 20% 65%` | Metadados e textos de apoio |
| `--border` | `#1E293B` | `217 33% 17%` | Bordas sutis dos cards e formulários |
| `--ring` | `#A855F7` | `271 91% 65%` | Anel de foco luminoso |

---

## 4. O Emblema `<WomanBadge />`

O selo visual concedido a quem marcar o checkbox de autodeclaração feminina (`is_self_declared_woman = true`).

* **Anatomia:**
  - Ícone: Mini estrela radiante / constelação com micro-brilho
  - Rótulo (opcional em mobile, padrão em desktop): "Cientista" ou "Mulher em STEM"
* **Estilização:**
  - **Modo Claro:**
    `bg-fuchsia-50 text-fuchsia-700 border border-fuchsia-200/80 shadow-xs ring-1 ring-fuchsia-300/40`
  - **Modo Escuro:**
    `bg-fuchsia-950/40 text-fuchsia-200 border border-fuchsia-500/30 shadow-xs ring-1 ring-fuchsia-400/30`
* **Localização Obrigatória:**
  - Ao lado do nome no cabeçalho do perfil (`/profile/[username]`)
  - Ao lado do nome do autor no Feed (`PostCard`)
  - Na lista de participantes e criadores de projetos de IC (`ProjectCard`, `ParticipantsList`)
  - Nos balões e cabeçalho da DM (`ChatWindow`)

---

## 5. Implementação Técnica

1. **Biblioteca de Controle:** `next-themes` com `attribute="class"`, `defaultTheme="system"` e `enableSystem`.
2. **Comutador de Tema (`ThemeToggle.tsx`):**
   - Botão discreto na Navbar exibindo ícones `Sun` (Modo Claro) e `Moon` (Modo Escuro) com transição de rotação suave.
3. **CSS Variables (`globals.css`):**
   Todos os componentes shadcn/ui e Tailwind consomem tokens semânticos (`bg-background`, `text-foreground`, `border-border`, `bg-card`), garantindo que alternar o tema atualize instantaneamente 100% da interface sem estilos manuais fragmentados.
