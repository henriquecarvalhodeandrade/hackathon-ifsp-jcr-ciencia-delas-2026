# Design system Artemis

> Tudo o que uma pessoa do time precisa para construir telas da Artemis com a cara da marca,
> acessíveis e corretas nos temas claro e escuro.

**Resumo:** cada cientista é uma estrela; mentoria, colaboração e votos desenham constelações.
A paleta parte das cores do movimento sufragista (violeta, branco e verde) — o verde também é o dos
Institutos Federais — com âmbar para as estrelas. O texto usa **Atkinson Hyperlegible**, criada para
baixa visão. Todos os pares de cor usados pelos componentes passam no **WCAG 2.2 AA nos dois temas**
(42 pares × 2 temas, conferidos ao vivo no guia).

- **Guia vivo:** [`/design-system`](http://localhost:3000/design-system) — todas as variantes, estados,
  tabela de contraste recalculada no navegador e exemplos de composição.
- **Tokens:** `src/app/globals.css` (fonte da verdade) · espelho para o guia em
  `src/app/design-system/_data/tokens.ts`.
- **Componentes:** `src/components/ui/*` (importe de `@/components/ui`) · layout em `src/components/layout/*`.
- **Utilitários:** `src/lib/utils.ts` (`cn`, datas e números em pt-BR, `slugify`, `pluralize`…).

---

## Sumário

1. [Princípios](#1-princípios)
2. [Marca](#2-marca)
3. [Como o tema claro/escuro funciona](#3-como-o-tema-claroescuro-funciona)
4. [Cores](#4-cores)
5. [Contraste (WCAG AA)](#5-contraste-wcag-aa)
6. [Tipografia](#6-tipografia)
7. [Espaço, raios, sombras e movimento](#7-espaço-raios-sombras-e-movimento)
8. [Iconografia](#8-iconografia)
9. [Utilitários (`src/lib/utils.ts`)](#9-utilitários-srclibutilsts)
10. [Componentes — referência da API](#10-componentes--referência-da-api)
11. [Layout do site](#11-layout-do-site)
12. [Padrões de tela](#12-padrões-de-tela)
13. [Acessibilidade](#13-acessibilidade)
14. [Voz e tom](#14-voz-e-tom)
15. [Como adicionar um componente](#15-como-adicionar-um-componente)
16. [Como manter o modo escuro correto](#16-como-manter-o-modo-escuro-correto)
17. [Armadilhas conhecidas](#17-armadilhas-conhecidas)

---

## 1. Princípios

| Princípio                         | Na prática                                                                                                        |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **Acolher antes de impressionar** | Interfaces calmas, linguagem gentil, um caminho claro por tela. Nada de efeitos por efeito.                       |
| **Legível para todas**            | Contraste AA nos dois temas, fonte para baixa visão, foco sempre visível, nada que dependa só de cor ou de mouse. |
| **Dar luz ao trabalho delas**     | Protagonismo das pesquisadoras e dos papers. O âmbar aparece pouco — só onde há algo para celebrar.               |
| **Conexões visíveis**             | Linhas finas, nós e órbitas (padrão `ConstellationPattern`, `ScoreMeter`) mostram relações.                       |
| **IA com transparência**          | Tudo que a IA gera é sinalizado ("sugestão da IA"), explicado e revisável. A pessoa decide.                       |

Anticlichês que evitamos de propósito: gradiente roxo→azul em hero, emoji como marcador, tudo
`rounded-lg` com a mesma sombra, barra colorida na lateral dos cartões, creme + terracota.

## 2. Marca

**Cores.** Em 1908 a _Women's Social and Political Union_ escolheu violeta (dignidade), branco
(pureza de propósito) e verde (esperança) para a luta pelo voto feminino. O nosso `verde-500` é o
`#32A041`, verde da marca da Rede Federal (IFs). O âmbar é a luz das estrelas.

**Nome.** A plataforma se chama **Artemis** (no feminino: "a Artemis", "na Artemis", "à Artemis").
Na mitologia grega, Ártemis é a deusa da caça e da Lua — e o nome também batiza o programa da NASA
de volta à Lua. **Ciência Delas** é o tema do hackathon e fica como nome secundário: no eyebrow do
hero, nos créditos do hackathon e em assinaturas como "Artemis — uma rede Ciência Delas"
(`SITE.theme` em `src/lib/constants.ts`). As funcionalidades **Vitrine Delas** e **Boletim Delas**
mantêm o nome.

**Símbolo.** Uma **lua crescente**, aberta para cima e para a direita, com uma **estrela âmbar** de
quatro pontas na curva: a lua que ilumina quem caminha à noite e a estrela que é cada pesquisadora
ganhando luz. A lua é um círculo menos outro círculo deslocado, com as pontas arredondadas (a mesma
linguagem de pontas redondas das linhas do sistema). Lê bem a 16 px (favicon), 32 px e 120 px ou
mais, nos dois temas e sobre o violeta do hero. O nome ao lado é "Artemis" em Bricolage Grotesque 700,
espaçamento −0,02em, numa cor só (a do texto).

**Fonte única da geometria:** `src/components/ui/logo-geometry.ts` (`LOGO_PATHS`, `LOGO_VIEWBOX`,
`BRAND_HEX`). Todos os arquivos abaixo saem dela; os SVGs estáticos são gerados com
`npm run brand:svgs`, e o teste `logo-geometry.test.ts` falha se algum ficar desatualizado.

| Arquivo                                                               | Uso                                                                               |
| --------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `<Logo />` / `<Logo variant="mark" />` (`src/components/ui/logo.tsx`) | Em telas. A lua usa `currentColor`; a estrela é sempre `ambar-400`.               |
| `src/app/icon.svg`                                                    | Favicon (fundo violeta, lua branca). Gerado.                                      |
| `src/app/apple-icon.tsx`                                              | Ícone iOS 180×180 gerado com `next/og`.                                           |
| `src/app/opengraph-image.tsx`                                         | Imagem 1200×630 em Bricolage Grotesque (`src/assets/fonts`, OFL); nada é baixado. |
| `public/brand/logo-mark.svg`, `logo-mark-white.svg`, `logo-icon.svg`  | Para README, slides, e-mails (use PNG em e-mail se precisar). Gerados.            |

Regras do logo: não mude a cor da estrela, não aplique sombra/contorno, não gire a lua, deixe respiro
de pelo menos metade da altura do símbolo, tamanho mínimo 16 px de altura. Sobre fundos
escuros/violeta use a lua em branco (`className="text-white"`).

**Padrão de constelação** (`<ConstellationPattern />`): estrelas, linhas e órbitas desenhadas de forma
determinística (igual no servidor e no cliente). Inclui o **Cruzeiro do Sul** (bandeira do Brasil) e
um "caminho de mentoria" que sobe até uma estrela-guia âmbar. Sempre decorativo (`aria-hidden`).
Use em hero, estados vazios, 404, cabeçalho da newsletter — nunca atrás de texto longo sem máscara.

## 3. Como o tema claro/escuro funciona

```
<html data-theme="light|dark" data-theme-preference="system|light|dark">
```

1. A preferência fica em `localStorage["cd-theme"]` (`"light"`, `"dark"`; ausente = automático).
2. O script `THEME_SCRIPT` (`src/components/layout/theme.ts`) roda no `<head>` **antes da pintura**,
   resolve o tema (preferência ou `prefers-color-scheme`) e grava `data-theme` no `<html>` — sem flash.
   Por isso o `<html>` tem `suppressHydrationWarning`.
3. `<ThemeToggle />` alterna **automático → claro → escuro** e dispara o evento `cd-themechange`.
   No modo automático o script acompanha a troca do sistema em tempo real.
4. No CSS, cada token semântico é `light-dark(claro, escuro)` e o lado vale conforme o `color-scheme`:
   `:root` = `light dark` (segue o sistema, inclusive **sem JavaScript**), `[data-theme="light"]` = claro,
   `[data-theme="dark"]` = escuro.
5. **Ilhas de tema:** qualquer elemento com `data-theme="dark"` (ou `"light"`) vira uma ilha com o
   outro tema — os tokens são redeclarados em `:root, [data-theme]`. O hero do guia e a seção "Claro e
   escuro" usam isso.
6. A variante `dark:` do Tailwind existe (`@custom-variant dark`) e funciona com `data-theme="dark"` e com
   o tema do sistema, mas é **válvula de escape**: prefira tokens semânticos, que já trocam sozinhos e
   respeitam as ilhas.

> Por que os tokens são redeclarados em cada `[data-theme]`? O Tailwind v4 compila `light-dark()` (via
> Lightning CSS) para variáveis que são resolvidas **no elemento onde o token é declarado**. Declarar só
> no `:root` faria as ilhas herdarem o tema do `<html>`. O guia vivo detecta isso (verificação de
> divergência).

## 4. Cores

A paleta padrão do Tailwind foi **removida** (`--color-*: initial`): `bg-gray-100`, `text-red-600` etc.
**não existem**. Só existem `white`, `black`, as escalas abaixo e os tokens semânticos.

### 4.1 Paleta (escalas 50–950, geradas em OKLCH)

| Escala    | 50        | 100       | 200       | 300       | 400       | 500       | 600       | 700       | 800       | 900       | 950       |
| --------- | --------- | --------- | --------- | --------- | --------- | --------- | --------- | --------- | --------- | --------- | --------- |
| `violeta` | `#f8f3ff` | `#efe6ff` | `#e0d0ff` | `#cbaeff` | `#ae83f5` | `#935be4` | `#7b40cc` | `#6530ac` | `#4f278a` | `#3a1c68` | `#251046` |
| `verde`   | `#edfbef` | `#d9f6dd` | `#b8eebf` | `#8ce098` | `#5bc96c` | `#32a041` | `#258632` | `#1e6b25` | `#1b541c` | `#164014` | `#0c270a` |
| `ambar`   | `#fff9f0` | `#fff0db` | `#ffe1b8` | `#ffcc88` | `#ffb24a` | `#f39a04` | `#cf7f00` | `#a46100` | `#844a00` | `#6a3a06` | `#432204` |
| `carmim`  | `#fff1f2` | `#ffe3e5` | `#ffc9cc` | `#ffa4aa` | `#f6707f` | `#e5405c` | `#ca2145` | `#aa1336` | `#87112a` | `#681020` | `#440711` |
| `azul`    | `#eff7ff` | `#deedff` | `#bfdcff` | `#95c5ff` | `#62a6f8` | `#3586e6` | `#206dc9` | `#1858a5` | `#164582` | `#133563` | `#0c2140` |

**Tinta** (neutros): `25` #fcfbfe · `50` #f6f5fa · `100` #eeebf3 · `200` #dfdce6 · `300` #c9c5d2 · `400` #8e8998 · `500` #75707e · `600` #625e6b · `700` #4c4855 · `800` #37333e · `900` #26232d · `950` #1a1820 · `975` #110f16

Utilitários: `bg-violeta-700`, `text-verde-800`, `border-ambar-300`… Use a paleta **só** para peças de
marca que não mudam com o tema (hero violeta-950, ilustrações). Em componentes, use os tokens semânticos.

### 4.2 Tokens semânticos

Cada token é uma variável CSS (`var(--color-primary)`) **e** um utilitário Tailwind (`bg-primary`,
`text-primary`, `border-primary`, `outline-primary`, `bg-primary/10` com opacidade…).

| Token (CSS)                 | Utilitários Tailwind                        | Claro                   | Escuro                  | Uso                                |
| --------------------------- | ------------------------------------------- | ----------------------- | ----------------------- | ---------------------------------- |
| `--color-bg`                | `bg-bg`                                     | `tinta-25` (#fcfbfe)    | `tinta-975` (#110f16)   | Fundo da página                    |
| `--color-surface`           | `bg-surface`                                | `white` (#ffffff)       | `tinta-950` (#1a1820)   | Cartões, menus, diálogos           |
| `--color-surface-2`         | `bg-surface-2`                              | `tinta-50` (#f6f5fa)    | `tinta-900` (#26232d)   | Áreas sutis, hover, código         |
| `--color-fg`                | `text-fg`                                   | `tinta-950` (#1a1820)   | `tinta-50` (#f6f5fa)    | Texto principal                    |
| `--color-fg-muted`          | `text-fg-muted`                             | `tinta-700` (#4c4855)   | `tinta-300` (#c9c5d2)   | Texto secundário                   |
| `--color-fg-subtle`         | `text-fg-subtle`                            | `tinta-600` (#625e6b)   | `tinta-400` (#8e8998)   | Metadados, placeholders            |
| `--color-border`            | `border-border`                             | `tinta-200` (#dfdce6)   | `tinta-800` (#37333e)   | Divisórias e contornos decorativos |
| `--color-border-strong`     | `border-border-strong`                      | `tinta-400` (#8e8998)   | `tinta-500` (#75707e)   | Bordas de campos (≥ 3:1)           |
| `--color-primary`           | `bg-primary · text-primary`                 | `violeta-700` (#6530ac) | `violeta-300` (#cbaeff) | Botão primário, links, ativo       |
| `--color-primary-hover`     | `bg-primary-hover · text-primary-hover`     | `violeta-800` (#4f278a) | `violeta-200` (#e0d0ff) | Hover do primário                  |
| `--color-primary-fg`        | `text-primary-fg`                           | `white` (#ffffff)       | `violeta-950` (#251046) | Texto sobre primário               |
| `--color-primary-soft`      | `bg-primary-soft`                           | `violeta-100` (#efe6ff) | `violeta-900` (#3a1c68) | Fundo suave violeta                |
| `--color-primary-soft-fg`   | `text-primary-soft-fg`                      | `violeta-800` (#4f278a) | `violeta-100` (#efe6ff) | Texto sobre fundo suave            |
| `--color-secondary`         | `bg-secondary · text-secondary`             | `verde-700` (#1e6b25)   | `verde-400` (#5bc96c)   | Botão secundário                   |
| `--color-secondary-hover`   | `bg-secondary-hover · text-secondary-hover` | `verde-800` (#1b541c)   | `verde-300` (#8ce098)   | Hover do secundário                |
| `--color-secondary-fg`      | `text-secondary-fg`                         | `white` (#ffffff)       | `verde-950` (#0c270a)   | Texto sobre secundário             |
| `--color-secondary-soft`    | `bg-secondary-soft`                         | `verde-100` (#d9f6dd)   | `verde-900` (#164014)   | Fundo suave verde                  |
| `--color-secondary-soft-fg` | `text-secondary-soft-fg`                    | `verde-800` (#1b541c)   | `verde-100` (#d9f6dd)   | Texto sobre verde suave            |
| `--color-accent`            | `bg-accent · text-accent`                   | `ambar-400` (#ffb24a)   | `ambar-400` (#ffb24a)   | Estrelas, botão de destaque        |
| `--color-accent-hover`      | `bg-accent-hover · text-accent-hover`       | `ambar-300` (#ffcc88)   | `ambar-300` (#ffcc88)   | Hover do destaque                  |
| `--color-accent-fg`         | `text-accent-fg`                            | `ambar-950` (#432204)   | `ambar-950` (#432204)   | Texto sobre âmbar                  |
| `--color-accent-soft`       | `bg-accent-soft`                            | `ambar-100` (#fff0db)   | `ambar-900` (#6a3a06)   | Fundo suave âmbar                  |
| `--color-accent-soft-fg`    | `text-accent-soft-fg`                       | `ambar-900` (#6a3a06)   | `ambar-100` (#fff0db)   | Texto sobre âmbar suave            |
| `--color-accent-strong`     | `bg-accent-strong · text-accent-strong`     | `ambar-700` (#a46100)   | `ambar-400` (#ffb24a)   | Ícone de estrela sobre superfícies |
| `--color-success`           | `bg-success · text-success`                 | `verde-700` (#1e6b25)   | `verde-400` (#5bc96c)   | Texto/ícone de sucesso             |
| `--color-success-fg`        | `text-success-fg`                           | `white` (#ffffff)       | `verde-950` (#0c270a)   | Texto sobre sucesso sólido         |
| `--color-success-soft`      | `bg-success-soft`                           | `verde-50` (#edfbef)    | `verde-950` (#0c270a)   | Fundo de alerta de sucesso         |
| `--color-success-soft-fg`   | `text-success-soft-fg`                      | `verde-800` (#1b541c)   | `verde-200` (#b8eebf)   | Texto do alerta de sucesso         |
| `--color-warning`           | `bg-warning · text-warning`                 | `ambar-800` (#844a00)   | `ambar-400` (#ffb24a)   | Texto/ícone de atenção             |
| `--color-warning-fg`        | `text-warning-fg`                           | `white` (#ffffff)       | `ambar-950` (#432204)   | Texto sobre atenção sólida         |
| `--color-warning-soft`      | `bg-warning-soft`                           | `ambar-50` (#fff9f0)    | `ambar-950` (#432204)   | Fundo de alerta de atenção         |
| `--color-warning-soft-fg`   | `text-warning-soft-fg`                      | `ambar-900` (#6a3a06)   | `ambar-200` (#ffe1b8)   | Texto do alerta de atenção         |
| `--color-danger`            | `bg-danger · text-danger`                   | `carmim-700` (#aa1336)  | `carmim-400` (#f6707f)  | Erros, ações destrutivas           |
| `--color-danger-hover`      | `bg-danger-hover · text-danger-hover`       | `carmim-800` (#87112a)  | `carmim-300` (#ffa4aa)  | Hover do perigo                    |
| `--color-danger-fg`         | `text-danger-fg`                            | `white` (#ffffff)       | `carmim-950` (#440711)  | Texto sobre perigo                 |
| `--color-danger-soft`       | `bg-danger-soft`                            | `carmim-50` (#fff1f2)   | `carmim-950` (#440711)  | Fundo de alerta de erro            |
| `--color-danger-soft-fg`    | `text-danger-soft-fg`                       | `carmim-800` (#87112a)  | `carmim-200` (#ffc9cc)  | Texto do alerta de erro            |
| `--color-info`              | `bg-info · text-info`                       | `azul-700` (#1858a5)    | `azul-300` (#95c5ff)    | Texto/ícone informativo            |
| `--color-info-fg`           | `text-info-fg`                              | `white` (#ffffff)       | `azul-950` (#0c2140)    | Texto sobre informação sólida      |
| `--color-info-soft`         | `bg-info-soft`                              | `azul-50` (#eff7ff)     | `azul-950` (#0c2140)    | Fundo de alerta informativo        |
| `--color-info-soft-fg`      | `text-info-soft-fg`                         | `azul-800` (#164582)    | `azul-200` (#bfdcff)    | Texto do alerta informativo        |
| `--color-focus`             | `outline-focus`                             | `violeta-600` (#7b40cc) | `violeta-300` (#cbaeff) | Anel de foco (outline)             |

Também: `--color-overlay` (fundo de diálogos). Convenção de nomes:

- `X` = cor "forte" (texto/ícone sobre superfícies **ou** fundo sólido de botão);
- `X-fg` = texto **sobre** `X` sólido; `X-hover` = hover do sólido;
- `X-soft` = fundo suave (badges, alertas) e `X-soft-fg` = texto sobre ele.

Combinações certas: `bg-primary text-primary-fg` · `bg-primary-soft text-primary-soft-fg` ·
`bg-danger-soft text-danger-soft-fg` · `text-fg-muted` sobre `bg`/`surface`/`surface-2`.

## 5. Contraste (WCAG AA)

Mínimos: **4,5:1** para texto (inclui placeholders e metadados), **3:1** para bordas de campos, ícones
informativos e anel de foco. Todos passam nos dois temas:

| Par (texto / fundo)                    | Uso                                | Mín.  | Claro | Escuro |
| -------------------------------------- | ---------------------------------- | ----- | ----- | ------ |
| `fg` / `bg`                            | Texto principal no fundo           | 4,5:1 | 17,04 | 17,54  |
| `fg` / `surface`                       | Texto principal em cartões         | 4,5:1 | 17,57 | 16,19  |
| `fg` / `surface-2`                     | Texto em áreas sutis               | 4,5:1 | 16,19 | 14,23  |
| `fg-muted` / `bg`                      | Texto secundário no fundo          | 4,5:1 | 8,61  | 11,24  |
| `fg-muted` / `surface`                 | Texto secundário em cartões        | 4,5:1 | 8,88  | 10,37  |
| `fg-muted` / `surface-2`               | Texto secundário em áreas sutis    | 4,5:1 | 8,18  | 9,11   |
| `fg-subtle` / `bg`                     | Metadados no fundo                 | 4,5:1 | 6,11  | 5,60   |
| `fg-subtle` / `surface`                | Metadados e placeholders           | 4,5:1 | 6,30  | 5,17   |
| `fg-subtle` / `surface-2`              | Metadados em áreas sutis           | 4,5:1 | 5,81  | 4,54   |
| `border-strong` / `surface`            | Borda de campos (componente de UI) | 3:1   | 3,40  | 3,66   |
| `border-strong` / `bg`                 | Borda de campos no fundo           | 3:1   | 3,30  | 3,96   |
| `primary` / `bg`                       | Links no fundo                     | 4,5:1 | 7,92  | 10,00  |
| `primary` / `surface`                  | Links em cartões                   | 4,5:1 | 8,17  | 9,23   |
| `primary` / `surface-2`                | Links em áreas sutis               | 4,5:1 | 7,53  | 8,11   |
| `primary-fg` / `primary`               | Botão primário                     | 4,5:1 | 8,17  | 8,89   |
| `primary-fg` / `primary-hover`         | Botão primário (hover)             | 4,5:1 | 10,55 | 11,79  |
| `primary-soft-fg` / `primary-soft`     | Badge e chip violeta               | 4,5:1 | 8,76  | 11,28  |
| `secondary` / `surface`                | Texto verde em cartões             | 4,5:1 | 6,59  | 8,38   |
| `secondary-fg` / `secondary`           | Botão secundário                   | 4,5:1 | 6,59  | 7,64   |
| `secondary-fg` / `secondary-hover`     | Botão secundário (hover)           | 4,5:1 | 9,01  | 10,10  |
| `secondary-soft-fg` / `secondary-soft` | Badge verde                        | 4,5:1 | 7,80  | 10,23  |
| `accent-fg` / `accent`                 | Botão de destaque (âmbar)          | 4,5:1 | 7,98  | 7,98   |
| `accent-fg` / `accent-hover`           | Botão de destaque (hover)          | 4,5:1 | 9,70  | 9,70   |
| `accent-soft-fg` / `accent-soft`       | Badge âmbar                        | 4,5:1 | 8,44  | 8,44   |
| `accent-strong` / `surface`            | Ícone de estrela em cartões        | 3:1   | 4,90  | 9,80   |
| `accent-strong` / `bg`                 | Ícone de estrela no fundo          | 3:1   | 4,75  | 10,62  |
| `success` / `surface`                  | Texto de sucesso                   | 4,5:1 | 6,59  | 8,38   |
| `success-fg` / `success`               | Sucesso sólido                     | 4,5:1 | 6,59  | 7,64   |
| `success-soft-fg` / `success-soft`     | Alerta de sucesso                  | 4,5:1 | 8,43  | 12,23  |
| `warning` / `surface`                  | Texto de atenção                   | 4,5:1 | 7,09  | 9,80   |
| `warning-fg` / `warning`               | Atenção sólida                     | 4,5:1 | 7,09  | 7,98   |
| `warning-soft-fg` / `warning-soft`     | Alerta de atenção                  | 4,5:1 | 9,03  | 11,38  |
| `danger` / `surface`                   | Mensagem de erro em cartões        | 4,5:1 | 7,35  | 6,31   |
| `danger` / `bg`                        | Mensagem de erro no fundo          | 4,5:1 | 7,13  | 6,83   |
| `danger-fg` / `danger`                 | Botão de perigo                    | 4,5:1 | 7,35  | 5,87   |
| `danger-fg` / `danger-hover`           | Botão de perigo (hover)            | 4,5:1 | 9,80  | 8,68   |
| `danger-soft-fg` / `danger-soft`       | Alerta de erro                     | 4,5:1 | 8,92  | 11,27  |
| `info` / `surface`                     | Texto informativo                  | 4,5:1 | 7,05  | 9,79   |
| `info-fg` / `info`                     | Informação sólida                  | 4,5:1 | 7,05  | 8,96   |
| `info-soft-fg` / `info-soft`           | Alerta informativo                 | 4,5:1 | 8,80  | 11,40  |
| `focus` / `bg`                         | Anel de foco no fundo              | 3:1   | 5,91  | 10,00  |
| `focus` / `surface`                    | Anel de foco em cartões            | 3:1   | 6,09  | 9,23   |

**Como verificar:** abra `/design-system#contraste`. O bloco "Verificado ao vivo" lê as cores que o
navegador realmente resolveu (nos dois temas, usando ilhas), confere com `_data/tokens.ts` e recalcula
o contraste. Se alguém mudar o CSS e esquecer o espelho (ou quebrar um par), aparece um alerta vermelho
com a lista. O elemento expõe `data-drift-count` e `data-contrast-failures` (úteis em testes E2E).

Novo par de cores num componente? Adicione-o em `CONTRAST_PAIRS` (`_data/tokens.ts`) — se não passar,
ajuste o token, não o mínimo.

## 6. Tipografia

Carregadas com `next/font/google` em `src/app/layout.tsx` (auto-hospedadas: o navegador não chama o
Google). Todas variáveis e com `latin-ext`.

| Família                               | Utilitário                     | Papel                                               | Por quê                                                                                                         |
| ------------------------------------- | ------------------------------ | --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| **Bricolage Grotesque** (eixo `opsz`) | `font-display`                 | Títulos, números, marca                             | Expressiva e firme em tamanhos grandes; amigável nos pequenos.                                                  |
| **Atkinson Hyperlegible Next**        | `font-sans` (padrão do `body`) | Texto e interface                                   | Criada pelo Braille Institute para baixa visão: `I l 1`, `O 0`, `rn m` nunca se confundem. Escolha de inclusão. |
| **Newsreader** (eixo `opsz`, itálico) | `font-serif`                   | Títulos de papers, resumos, editorial da newsletter | Peso de publicação científica.                                                                                  |
| **Atkinson Hyperlegible Mono**        | `font-mono`                    | DOIs, dados, código                                 | Mesma legibilidade, largura fixa.                                                                               |

`h1–h6` já usam `font-display`, peso 650, `letter-spacing: -0.015em` e `text-wrap: balance`;
parágrafos usam `text-wrap: pretty`. Newsreader e Mono não são pré-carregadas (aparecem menos).

### Escala (tamanho / entrelinha embutida)

| Utilitário     | Tamanho              | Entrelinha               | Uso típico                              |
| -------------- | -------------------- | ------------------------ | --------------------------------------- |
| `text-display` | `clamp(40px → 72px)` | 1,02 (tracking −0,035em) | Hero, números gigantes                  |
| `text-5xl`     | 48px                 | 52px                     | Títulos de landing                      |
| `text-4xl`     | 36px                 | 42px                     | `h1` em telas largas (PageHeader)       |
| `text-3xl`     | 30px                 | 36px                     | `h1` no celular, títulos de seção       |
| `text-2xl`     | 24px                 | 32px                     | `h2`                                    |
| `text-xl`      | 20px                 | 30px                     | `h3`, títulos de cartão grandes         |
| `text-lg`      | 18px                 | 28px                     | Descrições de página, títulos de cartão |
| `text-base`    | 16px                 | 26px                     | Texto corrido (padrão)                  |
| `text-sm`      | 14px                 | 22px                     | Metadados, rótulos, ajuda               |
| `text-xs`      | 12px                 | 18px                     | Contadores, legendas curtas             |

Extras: `.eyebrow` (texto pequeno em caixa-alta acima de títulos), `.tabular` (algarismos alinhados para
rankings e contadores), `.prose-delas` / `.prose-delas-editorial` (Markdown — use via `<Markdown>`).

Receitas:

```tsx
<p className="eyebrow text-primary">Fórum · Carreira</p>
<h2 className="font-display text-2xl font-semibold">Papers em destaque</h2>
<h3 className="font-serif text-xl font-semibold leading-snug">{paper.title}</h3>
<p className="font-mono text-xs text-fg-subtle">{paper.doi}</p>
<p className="tabular font-display text-4xl font-semibold">{formatNumber(total)}</p>
```

## 7. Espaço, raios, sombras e movimento

- **Espaço:** base de 4px (escala padrão do Tailwind). `gap-2` dentro de controles, `gap-4/5` entre
  campos, `gap-6/8` entre blocos, `py-10`–`py-14` entre seções (`<Section>`). Respiro lateral da página:
  16px no celular (`<Container>`).
- **Raios por papel** (não arredonde tudo igual):

| Utilitário        | Valor | Para                          |
| ----------------- | ----- | ----------------------------- |
| `rounded-badge`   | 6px   | Badges, `kbd`, código inline  |
| `rounded-control` | 10px  | Botões, campos, itens de menu |
| `rounded-card`    | 16px  | Cartões, alertas, painéis     |
| `rounded-dialog`  | 20px  | Diálogos, gavetas, heros      |
| `rounded-pill`    | 999px | Chips, tags, contadores       |
| `rounded-full`    | 50%   | Avatares, nós da constelação  |

- **Sombras por camada:** `shadow-card` (repouso — quase imperceptível, a borda faz o trabalho),
  `shadow-raised` (hover de cartões interativos), `shadow-overlay` (menus, diálogos, gavetas). Botões
  não têm sombra. No escuro as sombras ficam mais densas.
- **Movimento:** `duration-150 ease-out-soft` para hover/foco; `animate-pop-in`, `animate-fade-in`,
  `animate-slide-in-right` (≤ 220ms) para camadas; `animate-twinkle` só no padrão de fundo. A regra
  global `prefers-reduced-motion` zera animações e transições.

## 8. Iconografia

- Biblioteca: **lucide-react** (traço 2px). **Sem emoji na interface.**
- Tamanhos: 16px (`size-4`) com `text-sm` · 18px em botões `md` (automático) · 20px (`size-5`) na
  navegação · 24px (`size-6`) em estados vazios.
- Ícone decorativo ao lado de texto: `aria-hidden="true"`. Botão só com ícone: **`aria-label`
  obrigatório** (o `Tooltip` complementa, não substitui).
- Cor: herda `currentColor`. Estrela de voto ativa: `<Star className="fill-accent text-accent-strong" />`.
- Vocabulário: Fórum `MessagesSquare` · Mentoria `HeartHandshake` · Pesquisadoras `Users` · Papers
  `BookOpen` · Ranking `Trophy` · Newsletter `Newspaper` · Destaque `Star` · Compatibilidade `Orbit` ·
  Vazio `Telescope` · Notificações `Bell` · Moderação `ShieldCheck` · IA `Sparkles` (só para sinalizar
  conteúdo gerado).
- Categorias do fórum guardam o ícone em kebab-case (`graduation-cap`): renderize com `<CategoryIcon name={categoria.icon} />` (já troca `shield-heart`, que não existe no lucide 1.x, por `ShieldPlus`).
  **`shield-heart` não existe no lucide 1.x** — use `ShieldPlus` (ou `HeartHandshake`). O pacote também
  não tem mais ícones de marca (ex.: GitHub).

## 9. Utilitários (`src/lib/utils.ts`)

| Função                                           | Exemplo                                                    | Resultado                                                                                                         |
| ------------------------------------------------ | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `cn(...classes)`                                 | `cn("px-4 text-fg", cond && "text-fg-muted")`              | clsx + tailwind-merge configurado com os tokens (`text-display`, `rounded-card`, `shadow-raised`… mesclam certo). |
| `formatDate(date, opts?)`                        | `formatDate("2026-10-27T15:00:00Z")`                       | `27 de out. de 2026` (fuso America/Sao_Paulo). `opts` = `Intl.DateTimeFormatOptions`.                             |
| `formatDateTime(date)`                           |                                                            | `27/10/2026, 12:00`                                                                                               |
| `formatRelativeTime(date, now?)`                 | `formatRelativeTime(thread.created_at)`                    | `agora mesmo`, `há 5 minutos`, `há 3 horas`, `ontem`, `anteontem`, `semana passada`, `depois de amanhã`           |
| `toIsoString(date)`                              | `<time dateTime={toIsoString(d)}>`                         | ISO 8601                                                                                                          |
| `formatNumber(n, opts?)`                         | `formatNumber(12345)`                                      | `12.345`                                                                                                          |
| `formatCompactNumber(n)`                         | `formatCompactNumber(15320)`                               | `15,3 mil`                                                                                                        |
| `pluralize(n, singular, plural?, { withCount })` | `pluralize(1, "voto")` · `pluralize(0, "papel", "papéis")` | `1 voto` · `0 papéis`                                                                                             |
| `initials(name, max = 2)`                        | `initials("Ana Maria da Silva")`                           | `AS` (ignora da/de/dos…)                                                                                          |
| `slugify(text)`                                  | `slugify("Ciência & Inovação!")`                           | `ciencia-inovacao`                                                                                                |
| `removeAccents(text)`                            | `removeAccents("Ciência")`                                 | `Ciencia`                                                                                                         |
| `truncate(text, n)`                              | `truncate(resumo, 160)`                                    | corta sem quebrar palavra e põe `…`                                                                               |
| `hashString(text)`                               |                                                            | hash estável (cores de avatar)                                                                                    |
| `isExternalUrl(href)`                            |                                                            | `true` para `http(s)://…` e para `//host/…` (relativo ao protocolo)                                               |

## 10. Componentes — referência da API

Importe tudo de `@/components/ui`. Os marcados com **(cliente)** têm `"use client"`; todos podem ser
usados em Server Components desde que as props sejam serializáveis (strings, números, elementos JSX,
Server Actions — **não** funções comuns).

### Botões

```tsx
<Button>Pedir mentoria</Button>
<Button variant="secondary|accent|outline|ghost|danger|link" size="sm|md|lg|icon|icon-sm" fullWidth />
<Button loading loadingText="Salvando…">Salvar</Button>          // spinner + aria-busy + disabled
<Button size="icon" variant="ghost" aria-label="Fechar"><X aria-hidden /></Button>
<ButtonLink href="/papers" variant="outline">Explorar papers</ButtonLink>
<ButtonLink href="https://lattes.cnpq.br" external>Lattes</ButtonLink>  // nova aba + aviso p/ leitor de tela
<SubmitButton pendingText="Enviando…">Enviar</SubmitButton>      // (cliente) useFormStatus — dentro do <form>
```

`buttonVariants({ variant, size })` gera as classes para outros elementos. Use **um** botão primário por
área; `accent` é para a ação de destaque/voto.

### Formulários

```tsx
<Field
  label="Instituição"
  hint="Onde você estuda ou trabalha"
  error={state.fieldErrors?.institution}
  required
>
  <Input name="institution" />
</Field>
```

| Componente                   | Props principais                                                                                                                                                                                                                                                              |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Field`                      | `label`, `hint`, `error` (string ou `string[]` do zod), `required`, `optional`, `id`, `hideLabel`. Injeta `id`, `aria-describedby`, `aria-invalid` e `required` no filho.                                                                                                     |
| `Label`                      | `required` (asterisco), `optional` ("(opcional)").                                                                                                                                                                                                                            |
| `Input`                      | props de `<input>` + `size="sm\|md"`, `leadingIcon={<Search />}`.                                                                                                                                                                                                             |
| `Textarea` **(cliente)**     | props de `<textarea>` + `showCount` (requer `maxLength`) — contador `120/1.500` anunciado perto do limite. Não controlado, o contador lê o próprio campo: acompanha o reset do `<form>` (o React 19 limpa o formulário depois da action) e o texto restaurado pelo navegador. |
| `Select`                     | nativo; `options={[{ value, label }]}` ou `<option>` filhos; `placeholder="Selecione…"`; `size`.                                                                                                                                                                              |
| `Checkbox`                   | `label`, `description`, props de `<input>`.                                                                                                                                                                                                                                   |
| `Radio` / `RadioGroup`       | `RadioGroup name legend options defaultValue hint error required orientation="vertical\|horizontal" variant="default\|card"`.                                                                                                                                                 |
| `Switch`                     | `<input type="checkbox" role="switch">`; `label`, `description`, `labelPosition="start\|end"`. Envia `"on"`. Ligada, o botãozinho usa `primary-fg` (≥ 3:1 contra o trilho nos dois temas).                                                                                    |
| `ChipToggle`                 | checkbox com cara de chip: `name`, `value`, `label`, `defaultChecked`.                                                                                                                                                                                                        |
| `ChipGroup` **(cliente)**    | `name legend options defaultValue max hint error required value/onValueChange`. Um checkbox por opção → `formData.getAll(name)`. Desabilita as demais ao atingir `max`.                                                                                                       |
| `KeywordInput` **(cliente)** | `name defaultValue max=10 maxLength=40 lowercase=true placeholder`. Enter/vírgula adiciona, Backspace remove, colar "a, b" adiciona várias. Gera `<input type="hidden" name>` por palavra → `formData.getAll(name)`. Compatível com `<Field>`.                                |
| `FormMessage`                | `tone="error\|success\|info"`. Região `aria-live` sempre montada — só troque o conteúdo.                                                                                                                                                                                      |

### Conteúdo e superfícies

```tsx
<Card variant="default|interactive|outline|muted" padding="none|sm|md|lg" as="article">
  <CardHeader><CardTitle as="h3">Título</CardTitle><CardDescription>…</CardDescription></CardHeader>
  <CardContent>…</CardContent>
  <CardFooter>…</CardFooter>
</Card>

// cartão inteiro clicável, sem aninhar links:
<Card variant="interactive" as="article">
  <CardTitle><CardLink href={`/papers/${p.id}`}>{p.title}</CardLink></CardTitle>
  <VoteButton pressed={voted} count={p.vote_count} />   {/* outros controles: relative z-10 (o VoteButton já tem) */}
</Card>

// também em linhas de lista (o ancestral posicionado mais próximo vira a área clicável):
<li className="relative flex gap-4 p-4 hover:bg-surface-2">
  <h3><CardLink href={`/forum/t/${t.id}`} className="after:rounded-none">{t.title}</CardLink></h3>
</li>
```

| Componente                                                | Props                                                                                                                                                                                                                                                                                                                                                                                                                              |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CardLink`                                                | Link "esticado" (`::after` cobre o ancestral `relative`). O **anel de foco é desenhado na própria área esticada**, para dentro (não é cortado por `overflow-hidden`) — funciona em `Card` e em linhas de lista. Em linhas retas use `className="after:rounded-none"`.                                                                                                                                                              |
| `Badge`                                                   | `variant="neutral\|primary\|secondary\|accent\|success\|warning\|danger\|info\|outline"`, `size="sm\|md"`. Status — não clicável.                                                                                                                                                                                                                                                                                                  |
| `Chip`                                                    | `variant="neutral\|primary\|secondary\|accent\|outline"`, `size`, `icon`. Tag estática.                                                                                                                                                                                                                                                                                                                                            |
| `ChipLink`                                                | `href`, `active`, `count`, `icon`. Filtro por URL (searchParams).                                                                                                                                                                                                                                                                                                                                                                  |
| `Avatar`                                                  | `name`, `src`, `size="xs\|sm\|md\|lg\|xl\|2xl"`, `alt` (padrão decorativo), `seed` (use o id do perfil). Iniciais por baixo da foto: se a foto falhar, elas aparecem. As iniciais são conteúdo gerado por CSS (decorativas) — por isso um botão com avatar e `aria-label` não viola "rótulo no nome" (WCAG 2.5.3).                                                                                                                 |
| `AvatarGroup`                                             | `people=[{ id, name, src }]`, `max=4`, `size`, `label`.                                                                                                                                                                                                                                                                                                                                                                            |
| `Alert`                                                   | `variant="info\|success\|warning\|danger"`, `title`, `icon` (ou `null`), `actions`, `live` (só para mensagens que surgem após ação).                                                                                                                                                                                                                                                                                               |
| `EmptyState`                                              | `title`, `description`, `icon={<Inbox />}`, `action`, `variant="default\|compact"`, `headingLevel`.                                                                                                                                                                                                                                                                                                                                |
| `Skeleton`, `SkeletonText lines`, `SkeletonCard`          | blocos `aria-hidden`; envolva em algo com `role="status"`/texto "Carregando…".                                                                                                                                                                                                                                                                                                                                                     |
| `Spinner`                                                 | `size`, `label="Carregando"`, `decorative`.                                                                                                                                                                                                                                                                                                                                                                                        |
| `Separator`                                               | `orientation`, `decorative`, `label="ou"`.                                                                                                                                                                                                                                                                                                                                                                                         |
| `Stat` / `StatGroup`                                      | `label`, `value` (número formatado pt-BR), `trend={{ value, label }}`, `icon`, `compact`.                                                                                                                                                                                                                                                                                                                                          |
| `ProgressMeter`                                           | `value` 0–100, `label`, `valueLabel`, `tone="primary\|secondary\|accent"`, `size`. `role="meter"`. O tom `accent` pinta a barra com `accent-strong` (o âmbar 400 ficaria abaixo de 3:1 no tema claro).                                                                                                                                                                                                                             |
| `ScoreMeter`                                              | `value` 0–100, `label` (nome acessível, ex.: "Compatibilidade com Ana"), `size="sm\|md\|lg"`, `showLabel`, `caption`. Órbita com estrela no ponto alcançado; `scoreLabel(v)` dá o texto qualitativo.                                                                                                                                                                                                                               |
| `Markdown`                                                | `children` (string), `variant="default\|editorial"`, `headingOffset=1` (`#` vira `h2`), `allowImages=false`. Sem HTML cru; `javascript:` neutralizado; links externos (inclusive `//host`) com `target="_blank" rel="noopener noreferrer nofollow"`; tabelas e blocos de código roláveis e focáveis pelo teclado; checkboxes de lista de tarefas com nome ("Item concluído"/"Item pendente").                                      |
| `VoteButton`                                              | Destaque (voto) da Vitrine: `pressed`, `count`, `label="Destacar"` (nome **fixo**), `layout="vertical\|horizontal"`, `pending`, props de `<button>` (`type="submit"`, `name`, `value`, `formAction`, `disabled`). Toggle com `aria-pressed`; a contagem é ligada por `aria-describedby` ("128 destaques"). Servidor — use num `<form action>` ou controle com `useOptimistic`. Já tem `relative z-10` para cartões com `CardLink`. |
| `Table` + `TableHeader/Body/Footer/Row/Head/Cell/Caption` | Tabela semântica para o `/admin`. `Table label="Denúncias abertas"` torna a área rolável uma região focável (teclado rola no celular). `TableHead scope="col"` (padrão) e `sort="ascending\|descending\|none"` → `aria-sort`. `TableCaption srOnly`. Linha selecionada: `aria-selected`. `DropdownMenu` dentro de células não é cortado.                                                                                           |
| `CategoryIcon` / `getCategoryIcon` / `CATEGORY_ICONS`     | `<CategoryIcon name={categoria.icon} className="size-4" />` — mapeia o kebab-case de `forum_categories.icon` para o lucide (decorativo, `aria-hidden`). `"shield-heart"` (não existe no lucide 1.x) vira `ShieldPlus`; nome desconhecido vira `MessagesSquare`.                                                                                                                                                                    |
| `Kbd`, `VisuallyHidden`                                   | tecla de teclado; texto só para leitor de tela.                                                                                                                                                                                                                                                                                                                                                                                    |
| `Logo` / `LogoMark`                                       | `variant="full\|mark"`, `size` (altura px); `LogoMark title` quando sozinho.                                                                                                                                                                                                                                                                                                                                                       |
| `ConstellationPattern`                                    | `density="low\|medium\|high"`, `orbits`, `animated`, `accents`, `align="center\|end"`. Coloque em container `relative overflow-hidden` com `absolute inset-0 size-full text-primary/20`.                                                                                                                                                                                                                                           |

### Navegação e camadas

| Componente                    | Uso                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `TabNav`                      | Abas por URL (servidor): `label`, `items=[{ href, label, count?, active, icon? }]`. Calcule `active` com searchParams.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `Tabs` **(cliente)**          | Painéis na mesma página: `label`, `tabs=[{ id, label, content, icon?, disabled? }]`, `defaultTab`. Setas, Home e End.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `Steps`                       | Indicador de etapas (onboarding, novo paper): `steps=[{ label, description? }]`, `current` (0-based), `label="Etapas do cadastro"`. Lista ordenada com `aria-current="step"` e texto para leitor de tela ("Etapa 2 de 4: Pesquisa (etapa atual)"); no celular, só os números + "Etapa 2 de 4 · Pesquisa". Só apresentação — a navegação é da feature.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `Pagination`                  | `page`, `totalPages`, `basePath`, `searchParams` (preservados), `param="pagina"`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `PageHeader`                  | `eyebrow`, `title`, `description`, `actions`, `back={{ href, label }}`, `children` (abaixo, ex.: TabNav), `titleAs="h1"`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `Container`                   | `size="narrow\|default\|wide"` (3xl / 6xl / 7xl).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `Section`                     | `title`, `description`, `action`, `spacing="sm\|md\|lg"`, `titleId`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `Dialog` **(cliente)**        | `<dialog>` nativo: `title`, `description`, `children`, `footer`, `size="sm\|md\|lg"`, `dismissible`. Controlado (`open`, `onOpenChange`) ou com `trigger={<Button>Abrir</Button>}` — o gatilho **pode vir de um Server Component** (é renderizado como está dentro de um slot `<span class="contents">` que escuta o clique; gatilho desabilitado ou `aria-disabled` não abre; `aria-haspopup="dialog"` entra depois da hidratação). `formProps={{ action }}` envolve conteúdo **e** rodapé num único `<form>` (campos em `children` + `<SubmitButton>` no `footer`). Para fechar sem estado: `<form method="dialog"><Button type="submit">Cancelar</Button></form>`. Foco inicial: o primeiro elemento com `data-autofocus` (o `autoFocus` do React **não** funciona aqui, porque o conteúdo monta antes do `showModal()`); sem ele, o botão "Fechar".                                                                                            |
| `ConfirmDialog` **(cliente)** | `title`, `description`, `confirmLabel`, `pendingLabel`, `cancelLabel`, `tone="danger\|primary"`; gatilho: `trigger` (qualquer elemento, inclusive vindo de Server Component) **ou** o botão padrão `triggerLabel` + `triggerIcon` + `triggerVariant` + `triggerSize` + `triggerClassName`. Ação: `action` (Server Action `(formData) => …`), `stateAction` (Server Action no formato do `useActionState`, `(estadoAnterior, formData) => Promise<estado>` — o estado anterior é `null` a cada abertura) ou `onConfirm` (cliente). `hiddenFields` e os campos em `children` vão no formulário. Se a ação devolver `{ ok: false, error }`, o diálogo **continua aberto** e mostra o erro; se a chamada falhar (rede, erro inesperado), mostra "Não conseguimos falar com o servidor. Confira sua conexão e tente de novo."; `redirect()`/`notFound()` seguem com o Next; qualquer outro retorno fecha. Veja "Confirmações com Server Action" abaixo. |
| `DropdownMenu` **(cliente)**  | `trigger`, `triggerLabel`, `items` (link `{ href, label, icon, end }` · form `{ type: "form", action, method, label, tone }` · `{ type: "separator" }` · `{ type: "label", label }`), `header`, `align`. Padrão ARIA menu button (Enter/Espaço/↓ abre no primeiro item, ↑ no último; setas, Home/End, Esc volta ao botão, Tab fecha). Abre na camada superior (Popover API) com posição calculada — não é cortado por `overflow-hidden`/tabelas roláveis e vira para cima perto do fim da tela.                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `Tooltip`                     | `content`, `side="top\|bottom"`, `align="center\|start\|end"` (start: começa na borda esquerda do elemento e cresce para a direita; end: termina na borda direita e cresce para a esquerda — use perto das bordas da tela). Aparece no hover e no foco (CSS), some com **Esc** (WCAG 1.4.13) e liga `aria-describedby`. Escondida fica com `display: none` (não cria rolagem horizontal) e nunca passa de `100vw - 2rem`. Funciona em Server Components. Informação complementar apenas.                                                                                                                                                                                                                                                                                                                                                                                                                                                           |

#### Confirmações com Server Action

```tsx
<ConfirmDialog
  triggerLabel="Excluir tópico"
  triggerVariant="danger"
  title="Excluir este tópico?"
  description="As respostas também serão apagadas. Essa ação não pode ser desfeita."
  confirmLabel="Sim, excluir"
  pendingLabel="Excluindo…"
  action={deleteThread} // "use server" — recebe FormData
  hiddenFields={{ id: thread.id }}
/>
```

Action no formato do `useActionState` (a mesma usada num `<form>` com `useActionState`), botão com ícone
— funciona direto de um Server Component, sem componente cliente intermediário:

```tsx
<ConfirmDialog
  stateAction={cancelRequestAction} // (prev, formData) => Promise<{ ok: true, … } | { ok: false, error }>
  hiddenFields={{ request_id: request.id }}
  triggerLabel="Cancelar pedido"
  triggerIcon={<Ban aria-hidden="true" />}
  triggerSize="sm"
  title="Cancelar este pedido?"
  description="Avisaremos a mentora."
  confirmLabel="Sim, cancelar pedido"
  pendingLabel="Cancelando…"
  cancelLabel="Voltar"
/>
```

O que o `ConfirmDialog` faz por você: botão de confirmar em carregamento (`useFormStatus`), erro
`{ ok: false, error }` **dentro** do diálogo (que continua aberto), mensagem de conexão quando a chamada
falha, `redirect()`/`notFound()` repassados ao Next (`unstable_rethrow`), fecha sozinho no sucesso e
limpa o erro ao reabrir. Campos dentro de `children` (ex.: um motivo) são enviados junto — lembre que o
React 19 limpa campos não controlados depois da action; para texto longo, devolva `values` ou controle o campo.

**Clones de features (integração).** `MentorshipActionDialog` (`src/components/mentorship/action-dialog.tsx`)
e `ConfirmActionDialog` (`src/components/forum/confirm-action-dialog.tsx`) existiam porque o `ConfirmDialog`
não mostrava o erro da action. Hoje ele cobre os dois:

| Clone                         | Equivalente no design system                                                                                                                                                            | Diferenças que restam                                                                                                                                                  |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MentorshipActionDialog`      | `stateAction={action}` + `hiddenFields` + `triggerLabel`/`triggerIcon`/`triggerVariant`/`triggerSize="sm"` + `cancelLabel="Voltar"` (+ `children` dentro do formulário)                 | Visual: botões no rodapé do diálogo (com borda). O erro some ao reabrir (o clone mantinha o último erro). Falha de rede vira mensagem (o clone ia para o `error.tsx`). |
| `ConfirmActionDialog` (fórum) | `stateAction={action}` + `hiddenFields` + `triggerVariant="ghost"` `triggerSize="sm"` + `triggerIcon` + `triggerClassName`; a mensagem de conexão é o mesmo texto de `CONNECTION_ERROR` | Visual: botões no rodapé do diálogo (com borda) em vez de dentro do corpo.                                                                                             |

A troca fica a cargo dos donos de cada feature (mudança só de visual, sem mudança de comportamento útil).

## 11. Layout do site

`src/app/layout.tsx` monta: `SkipLink` → `SiteHeader` → `SupabaseSetupNotice` → `<main id="conteudo">` →
`SiteFooter`. **As páginas não renderizam `<main>`** — comecem com `<Container>`.

O índice `@/components/layout` é seguro em Client Components: ele **não** reexporta o `SiteHeader`
(async, importa `server-only` via `@/lib/auth`). Para ele, importe de `@/components/layout/site-header`;
a parte visual (`SiteHeaderView`) mora em `site-header-view.tsx` e sai pelo índice.

| Componente                     | Detalhes                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SiteHeader` (servidor, async) | Usa `getCurrentProfile()`. Visitante: Papers, Ranking, Newsletter, Sobre + "Entrar" e "Criar conta". Membra: Fórum, Mentoria, Pesquisadoras, Papers, Ranking, Newsletter + sino (`/notificacoes`, contagem de não lidas via `notifications.read_at is null`) + menu da conta. Fixo no topo (64px). A parte visual é `SiteHeaderView({ account, sticky, navLabel })` — pura, usada no guia para pré-visualizar visitante e membra logada. |
| `UserMenu`                     | Avatar → Meu perfil (`/perfil`), Notificações, Moderação (`/admin`, só `isModerator`), Sair (`POST /auth/sair`).                                                                                                                                                                                                                                                                                                                         |
| `MobileNav` (cliente)          | Abaixo de `lg`: gaveta em `<dialog>` com os mesmos links, conta, tema e Entrar/Criar conta.                                                                                                                                                                                                                                                                                                                                              |
| `NavLink` (cliente)            | `usePathname`: página exata → `aria-current="page"`; dentro da seção → `aria-current="true"`; `activeClassName`.                                                                                                                                                                                                                                                                                                                         |
| `ThemeToggle` (cliente)        | Automático → claro → escuro. `setThemePreference(p)` disponível para outras telas.                                                                                                                                                                                                                                                                                                                                                       |
| `SkipLink`                     | "Pular para o conteúdo" — primeiro foco da página.                                                                                                                                                                                                                                                                                                                                                                                       |
| `SupabaseSetupNotice`          | Aparece só quando `!isSupabaseConfigured()`, com link para `docs/07-setup-e-deploy.md`.                                                                                                                                                                                                                                                                                                                                                  |
| `SiteFooter`                   | Sobre, conduta, privacidade, design system, GitHub, "Feito no Hackathon IFSP Jacareí 2026".                                                                                                                                                                                                                                                                                                                                              |

Arquivos especiais: `not-found.tsx` (404 com a órbita no "0"), `error.tsx` (cliente; `retry()` + código
do erro), `global-error.tsx` (documento próprio com o tema), `loading.tsx` (skeleton genérico — rotas
podem ter o seu), `icon.svg`, `apple-icon.tsx`, `opengraph-image.tsx`. Metadata: título
`%s · Artemis` — **toda página exporta `metadata.title`** em pt-BR.

## 12. Padrões de tela

### Página padrão

```tsx
export const metadata: Metadata = { title: "Papers" };

export default async function PapersPage({
  searchParams,
}: {
  searchParams: Promise<{ pagina?: string }>;
}) {
  const { pagina } = await searchParams;
  return (
    <Container>
      <PageHeader
        eyebrow="Vitrine"
        title="Papers de pesquisadoras"
        description="Trabalhos indicados pela comunidade. Destaque os que você recomenda."
        actions={
          <ButtonLink href="/papers/novo">
            <Plus aria-hidden /> Indicar paper
          </ButtonLink>
        }
      >
        <TabNav label="Ordenação" items={[/* … */]} />
      </PageHeader>
      <Section spacing="sm">{/* lista */}</Section>
      <Pagination
        page={Number(pagina ?? 1)}
        totalPages={total}
        basePath="/papers"
        searchParams={{/* filtros */}}
      />
    </Container>
  );
}
```

### Formulário com Server Action + `useActionState`

O contrato das actions é `{ ok: true, ... } | { ok: false, error, fieldErrors? }`. **Devolva também os
valores enviados**: o React 19 reseta o `<form>` após cada action, então use-os como `defaultValue` para
nada se perder quando a validação falha. Exemplo completo e funcionando em
`src/app/design-system/_components/form-example.tsx` + `actions.ts`.

```ts
// actions.ts
"use server";
export async function saveProfile(_prev: State, formData: FormData): Promise<State> {
  const values = {
    full_name: String(formData.get("full_name") ?? ""),
    topics: formData.getAll("topics").map(String),
  };
  const parsed = schema.safeParse(values);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Alguns campos precisam de atenção.",
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
      values,
    };
  }
  // … grava com o cliente do servidor (RLS) …
  revalidatePath("/perfil");
  return { ok: true, message: "Perfil atualizado.", values };
}
```

```tsx
// form.tsx
"use client";
const [state, action] = useActionState(saveProfile, null);
const errors = state && !state.ok ? state.fieldErrors : undefined;
return (
  <form action={action} noValidate className="grid gap-6">
    <FormMessage tone={state?.ok ? "success" : "error"}>
      {state && (state.ok ? state.message : state.error)}
    </FormMessage>
    <Field label="Nome completo" required error={errors?.full_name}>
      <Input name="full_name" defaultValue={state?.values.full_name} />
    </Field>
    <ChipGroup
      key={state?.values.topics.join()}
      name="topics"
      legend="Temas"
      options={MENTORSHIP_TOPIC_OPTIONS}
      max={3}
      defaultValue={state?.values.topics}
      error={errors?.topics}
    />
    <SubmitButton pendingText="Salvando…">Salvar perfil</SubmitButton>
  </form>
);
```

Dicas: `key` muda quando os valores voltam (reinicia componentes com estado interno, como `ChipGroup`
e `KeywordInput`); `<Select>` também precisa de `key` para refletir um novo `defaultValue`; use
`noValidate` e valide no servidor (as mensagens do zod ficam em pt-BR e iguais para todas).

### Estados vazios

Diga o que falta **e** qual o próximo passo; nunca só "Nenhum resultado".

```tsx
<EmptyState
  icon={<Inbox />}
  title="Nenhum pedido de mentoria ainda"
  description="Quando uma pesquisadora pedir sua mentoria, o pedido aparece aqui."
  action={<ButtonLink href="/perfil">Revisar perfil</ButtonLink>}
/>
```

### Carregamento

Crie `loading.tsx` na rota com o formato da tela final (mesma grade, mesmos cartões):

```tsx
export default function Loading() {
  return (
    <Container className="py-10" aria-busy="true">
      <p role="status" className="sr-only">
        Carregando papers…
      </p>
      <div aria-hidden className="grid gap-4 sm:grid-cols-2">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </Container>
  );
}
```

Para botões, `SubmitButton`/`loading`; para listas que atualizam, mantenha o conteúdo anterior visível.

### Composições de referência (no guia, seção "Padrões")

- **Paper na vitrine:** `VoteButton` (nome fixo + `aria-pressed`, contagem `.tabular`); título em
  `font-serif`; autoras; resumo em linguagem simples; DOI em `font-mono`; `CardLink` no título.
- **Sugestão de mentoria:** `Avatar` + nome + `Badge` (Mentora, vagas) + `ScoreMeter` com `label`
  acessível; caixa "Por que ela? · sugestão da IA" (sinalização obrigatória); chips de temas; ação
  "Pedir mentoria".
- **Tópico do fórum:** autora ou "Anônima" (avatar "?" neutro), `formatRelativeTime`, `pluralize`,
  selos "Fixado"/"Resolvido", `CardLink` (com `after:rounded-none`) na linha e `CategoryIcon` ao lado do nome da categoria.
- **Painel /admin:** `Table label=…` com `TableCaption srOnly`, `Badge` de estado e `DropdownMenu` de ações
  por linha (`triggerLabel="Ações para: <título>"`); ações destrutivas passam por `ConfirmDialog`.
- **Cabeçalho da newsletter:** bloco `bg-violeta-950` com `ConstellationPattern align="end"` mascarado
  atrás do texto e título em `font-serif`.

## 13. Acessibilidade

Meta: **WCAG 2.2 AA**. Revise antes de cada PR:

- Um único `h1` por página (`PageHeader`); níveis de título em ordem.
- Todo campo tem rótulo visível (`Field`/`Label`); placeholder não é rótulo.
- Erros junto do campo (`aria-invalid` + `aria-describedby`, feito pelo `Field`) **e** resumo no topo (`FormMessage`).
- Foco visível em tudo (outline 2px `--color-focus`, regra global em `:focus-visible`). Não remova.
- Tudo funciona com teclado: Tab/Shift+Tab, Enter, Espaço, Esc, setas em menus e abas.
- Botão só com ícone tem `aria-label`; ícone decorativo tem `aria-hidden`.
- Contraste AA nos dois temas; nunca use só cor para informar (ícone + texto nos alertas e selos).
- Alvos de toque ≥ 24×24px (botões 32–48px; campos 44px).
- Imagens informativas com `alt`; avatar ao lado do nome é decorativo.
- `prefers-reduced-motion` respeitado globalmente; nada pisca mais de 3×/s.
- Links que abrem nova aba avisam "(abre em nova aba)" (já feito em `ButtonLink external`, `Markdown`, rodapé).
- `<html lang="pt-BR">`; trechos em outra língua com `lang="en"`.
- Diálogos e gaveta usam `<dialog>` nativo (foco preso, Esc, foco volta ao gatilho, fundo inerte).
- Botões de alternância (`VoteButton`, reações) usam `aria-pressed` com **nome fixo** — não troque o texto ao alternar.
- Dicas (`Tooltip`) somem com Esc; menus abrem na camada superior e não são cortados.
- Áreas roláveis (tabelas, código) recebem foco (`Table label`, `Markdown` já faz) para rolar pelo teclado.

## 14. Voz e tom

Voz **acolhedora, direta, precisa e inclusiva**. O tom muda conforme o momento: leve ao celebrar,
cuidadoso em erros, assédio, maternidade e saúde mental.

| Situação    | Faça                                                                                                  | Evite                                                           |
| ----------- | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Boas-vindas | "Bem-vinda à Artemis! Conte um pouco da sua pesquisa para encontrarmos mentoras para você."           | "Bem-vindo(a), usuário! Preencha todos os campos obrigatórios." |
| Erro        | "Não conseguimos salvar seu perfil. Verifique sua conexão e tente de novo — seu texto continua aqui." | "Erro 500: falha na operação."                                  |
| Vazio       | "Ainda não há papers nesta área. Que tal indicar o primeiro?"                                         | "Nenhum resultado encontrado."                                  |
| Botões      | "Pedir mentoria", "Destacar paper", "Salvar perfil" (verbo no infinitivo)                             | "OK", "Clique aqui", "Enviar dados"                             |
| IA          | "Sugestão feita com IA a partir das áreas do seu perfil. Revise antes de enviar."                     | "Nossa IA encontrou a mentora perfeita!"                        |
| Inclusiva   | "Pesquisadoras de todas as áreas", "quem pesquisa", "boas-vindas"                                     | "todxs", "tod@s" (leitores de tela não leem)                    |
| Moderação   | "Este comentário foi ocultado por violar o código de conduta."                                        | "Conteúdo removido por usuário banido."                         |

Formatos: datas `27 de out. de 2026` / `há 3 horas`; números `1.284`, `15,3 mil`; títulos só com a
primeira maiúscula ("Pedir mentoria"); votos se chamam **destaques** (verbo "destacar").

## 15. Como adicionar um componente

1. Veja se dá para compor com o que já existe (Card + Badge + Button resolvem muita coisa).
2. Crie `src/components/ui/<nome>.tsx` (kebab-case), um componente principal por arquivo, com props
   tipadas (estenda `React.ComponentProps<"elemento">` e repasse `className` via `cn`).
3. Server Component por padrão. Só use `"use client"` se precisar de estado/efeitos/eventos — e então
   aceite apenas props serializáveis (itens como dados, ícones como elementos JSX).
4. Variantes com `cva` (`class-variance-authority`); só tokens semânticos (`bg-surface`, `text-fg-muted`,
   `border-border-strong`…). Raio e sombra pelo papel (`rounded-control`, `shadow-card`…).
5. Acessibilidade: elemento nativo certo primeiro (`button`, `a`, `input`, `dialog`), rótulo, foco,
   teclado, `aria-*` só quando o nativo não basta.
6. Exporte em `src/components/ui/index.ts` (e atualize `COMPONENT_COUNT` em `src/app/design-system/page.tsx`).
7. Mostre todas as variantes e estados no guia (`src/app/design-system/_components/components-showcase.tsx`)
   e documente as props aqui.
8. Rode `npx tsc --noEmit`, `npx eslint src/components src/app/design-system` e confira `/design-system`
   nos dois temas, a 390px e a 1440px (sem rolagem horizontal).

## 16. Como manter o modo escuro correto

- **Nunca** escreva cor fixa em componente (`#hex`, `bg-white`, `text-black`, `bg-violeta-100`):
  use tokens semânticos. Exceção: peças de marca que são iguais nos dois temas (hero violeta-950).
- Precisa de uma cor nova? Crie um token com os **dois** valores em `globals.css`:
  1. registre o nome em `@theme` (seção 2, valor `currentColor` — é só para o Tailwind gerar o utilitário);
  2. declare o valor real `light-dark(claro, escuro)` no bloco `:root, [data-theme]` (seção 4 do arquivo);
  3. espelhe em `SEMANTIC` e, se for par de texto/fundo, em `CONTRAST_PAIRS` (`_data/tokens.ts`);
  4. abra `/design-system#contraste` e confira o "Verificado ao vivo".
- Sombras: use `shadow-card/raised/overlay` (já trocam de intensidade).
- Imagens/ilustrações: prefira SVG com `currentColor` e tokens (`var(--color-accent)`).
- Teste sempre nos dois temas (botão no cabeçalho) e numa ilha (`<div data-theme="dark">`).

## 17. Armadilhas conhecidas

- **Cores padrão do Tailwind não existem** (`gray-*`, `red-*`, `purple-*`…). Se uma classe "não pega",
  é isso — use o token semântico equivalente (`text-fg-muted`, `text-danger`, `bg-primary-soft`).
- `text-display`, `rounded-card` etc. só mesclam certo com `cn()` (o tailwind-merge foi configurado).
- `Field` injeta props no **único** filho: não envolva o controle em `div` dentro do `Field`.
- `FormMessage` precisa estar montado desde o início (região `aria-live`); só mude o texto.
- O React 19 limpa formulários após a action — devolva `values` no estado (veja §12). O contador do
  `Textarea` acompanha o reset sozinho.
- O gatilho do `Dialog`/`ConfirmDialog` fica dentro de um `<span class="contents">`: o layout não muda,
  mas seletores de filho direto no pai (`[&>button]:…`, `*:…`) não alcançam o botão — estilize o próprio gatilho.
  Não precisa mais de componente cliente só para criar o gatilho: JSX vindo de Server Component funciona.
- Imagens em Markdown viram links por padrão (privacidade de quem lê). `allowImages` só em conteúdo editorial confiável.
- O padrão `ConstellationPattern` usa `preserveAspectRatio="slice"`: em containers estreitos e altos,
  use `align="end"`, máscara (`[mask-image:…]`) ou limite a altura para não passar atrás do texto.
- **`outline-none` + `focus-visible:outline-2` não funciona no Tailwind v4**: `outline-none` zera a variável
  `--tw-outline-style`, e o anel some. Não use `outline-none` em elementos focáveis — a regra global
  `:focus-visible` já desenha o anel; para puxá-lo para dentro use `focus-visible:-outline-offset-2`.
- A variante `dark:` olha para o **ancestral** `[data-theme="dark"]` mais externo: dentro de uma ilha
  `data-theme="light"` numa página escura, `dark:` continua valendo. Mais um motivo para usar tokens.
- `<meta name="theme-color">` segue `prefers-color-scheme`, não a escolha manual do botão de tema
  (a barra do navegador no celular pode ficar clara com o site escuro). Cosmético.
- No `next dev` aparece "Failed to find font override values" para as Atkinson: resolvido com
  `adjustFontFallback: false` + `fallback` explícito em `layout.tsx` — não é erro.
