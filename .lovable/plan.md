
# Plano v2 — Conexões Meta focado em uso, não em decoração

## O que está ruim hoje

- Atribuir cliente é via `<Select>` apertado dentro de célula da tabela — fácil errar conta.
- Não dá pra ver "qual BM" de relance: o nome da BM é só uma célula de texto pequena.
- Status (ativa/bloqueada) é um Badge fino misturado com 10 colunas.
- Detalhes da conta só num Dialog que precisa clicar no olho.
- Tabela horizontal scrolla, perde contexto.

## Solução — layout em 2 colunas, BM-first

```text
┌─────────────────────────────────────────────────────────────────────┐
│  KPIs compactos (Ativas / Bloqueadas / Atribuídas / Sem cliente)    │
├──────────────────────┬──────────────────────────────────────────────┤
│  COLUNA ESQUERDA     │  COLUNA DIREITA — Contas da BM selecionada   │
│  (sidebar BMs)       │                                              │
│                      │  🔍 buscar  · status ▾ · cliente ▾           │
│  ┌──────────────┐    │                                              │
│  │ ● BM ABC     │    │  ┌─ AccountCard ──────────────────────────┐ │
│  │ 18 contas    │    │  │ Conta XPTO    [● Ativa]  Score 78 ✅  │ │
│  │ 2 bloqueadas │    │  │ ID act_123... · USD 1.245,30 gasto    │ │
│  └──────────────┘    │  │ Idade 240d · Saldo $50 · Pgto vinculado│ │
│  ┌──────────────┐    │  │                                        │ │
│  │   BM XYZ     │    │  │ 👤 Atribuir cliente: [Combobox com    │ │
│  │ 9 · 0 bloq.  │    │  │     busca: digite "joao"...]   [Ver+] │ │
│  └──────────────┘    │  └────────────────────────────────────────┘ │
│  ┌──────────────┐    │  ┌─ AccountCard ──────────────────────────┐ │
│  │ Sem BM       │    │  │ Conta YYY     [⚠ Bloqueada]  Score 32 │ │
│  └──────────────┘    │  └────────────────────────────────────────┘ │
└──────────────────────┴──────────────────────────────────────────────┘
```

### Sidebar de BMs (esquerda, sticky)

- Lista vertical de BMs com:
  - Nome + bolinha verde/vermelha (sync status).
  - Contagem `N contas · X bloqueadas`.
  - BM ativa destacada (borda neon).
- Item "Todas as BMs" no topo (mostra todas as contas).
- Item "Sem BM" no final (contas órfãs).
- Clicar = troca o conteúdo da direita. **Resolve o "não sei de qual BM"**.

### Lista de contas (direita) — AccountCard, não tabela

Cada conta vira um **card horizontal**, fácil de ler e atribuir:

```text
┌────────────────────────────────────────────────────────────────────┐
│ Nome da Conta                          [● Ativa]   Score: 78 OK   │
│ act_123456789 · USD 1.245,30 gasto · BM ABC                       │
│                                                                    │
│ 🟢 Vinculado  · ⏱ 240d · 💰 Saldo $50 · 🌎 BR                     │
│                                                                    │
│ ┌─ Cliente atual: João Silva ─────────────────┐  [Trocar] [Ver+]  │
│ │ Não atribuída → [🔍 Buscar e atribuir... ▾] │                   │
│ └─────────────────────────────────────────────┘                   │
└────────────────────────────────────────────────────────────────────┘
```

- **Status sempre em destaque** no topo direito: pílula verde "Ativa" ou vermelha "Bloqueada — motivo" com tooltip do `disable_reason_label`.
- **Score colorido** ao lado do status.
- Linha de metadados com ícones (idade, saldo, país, pagamento).
- **Bloco de atribuição grande e óbvio**:
  - Se já tem cliente: mostra avatar/nome + botão "Trocar".
  - Se não tem: input de busca (Command/Combobox) com lista filtrada — digita 2 letras e atribui.
  - Confirmação inline ("Atribuído ✓") sem refresh agressivo.
- Botão "Ver+" abre o `Sheet` lateral com todos os detalhes técnicos (timezone, country, spend_cap, billing_cycle, balance, score breakdown, link "Abrir no Meta Business Manager").
- Borda esquerda colorida do card: verde (ativa+atribuída), amarela (ativa+sem cliente), vermelha (bloqueada).

### Filtros (topo da coluna direita)

- Busca por nome/ID.
- Status: Todas / Ativas / Bloqueadas.
- Cliente: Todos / Sem cliente / [nome].
- Score: Todos / OK / Atenção / Crítico.
- Chips de filtros ativos com X individuais.

### KPIs (topo, compactos)

4 cards pequenos numa linha — sem hero gigante:

- **Contas Ativas** (verde neon)
- **Bloqueadas** (vermelho se >0)
- **Atribuídas** (azul)
- **Sem cliente** (amarelo se >0)

Chip à direita: "Sync · há Xmin" + botão Sincronizar.

## Detalhes técnicos

**Componentes novos** em `src/components/meta/`:

- `BmSidebar.tsx` — lista vertical de BMs com seleção; emite `bmId | "all" | "none"`.
- `AccountCard.tsx` — o card horizontal com status, metadados, e ClientPicker integrado.
- `ClientPicker.tsx` — Combobox (`Command` + `Popover`) com busca por nome/email, atribuir/desatribuir, estado de loading inline.
- `AccountDetailSheet.tsx` — Sheet lateral com 2 tabs (Visão geral, Histórico de bloqueio), substitui o `Dialog` atual.
- `MetaKpiBar.tsx` — versão enxuta (4 cards pequenos) — substitui o `MetaKpiHero` que criamos antes.

**Mantém/reaproveita**:

- `load()`, realtime de `meta_sync_jobs`, `assign()`, `bmName`, `currentClient`, `stats`, `lastSyncAt` continuam no container `MetaConnections.tsx`.
- `scoreColor`, `scoreBadgeVariant` movem para `src/lib/meta-score.ts` para reuso.
- Help collapsível (`SystemUserHelp`) já criado — só repositionar para o final da página ou um botão "?" no header.

**Remove**:

- `MetaKpiHero.tsx` (hero gigante) — substituído por `MetaKpiBar` compacto.
- `BmOverviewStrip.tsx` (strip horizontal) — substituído pelo sidebar vertical mais útil.
- Tabela `<Table>` atual e `AccountDetailDialog` — substituídos por `AccountCard` + `Sheet`.

**Layout responsivo**:

- `lg:grid-cols-[260px_1fr]` — sidebar fixa esquerda, conteúdo flexível direita.
- `<lg`: sidebar vira `Sheet` aberto por botão "Selecionar BM (N)".

**Sem mudanças de backend**: tudo continua sobre `meta_business_managers`, `meta_ad_accounts`, `meta_ad_account_assignments`, `clients`.

**Ordem de entrega (uma única passada)**:

1. Criar `BmSidebar`, `AccountCard`, `ClientPicker`, `AccountDetailSheet`, `MetaKpiBar`.
2. Reescrever `MetaConnections.tsx` como composição (sidebar + lista de cards), descartando tabela e Dialog atual.
3. Deletar/desreferenciar `MetaKpiHero.tsx` e `BmOverviewStrip.tsx`.

Aprova essa direção?
