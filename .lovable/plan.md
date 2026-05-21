# Plano — Reestruturar Dashboard Ads

## Diagnóstico atual (`src/pages/AdsDashboard.tsx`)

- **12 cards de métrica achatados** em grid 6 col., sem hierarquia (Faturamento, Gasto, Lucro, ROAS misturados com CPM/CPC/CTR).
- **Filtros lotados** num único Card: chips de período + 3 popovers grandes (BM, clientes, contas) na mesma linha — quebra mal e ocupa espaço demais.
- **Sem visualização temporal**: só agregados. Não dá pra ver evolução diária de spend/revenue/ROAS.
- **Sem detalhamento**: não existe ranking de contas, clientes ou BMs. Impossível ver quem performa.
- **Sem estados visuais**: loading texto puro, empty state genérico, sem skeleton.
- **Sync silencioso**: botão "Sincronizar" não mostra última sincronização nem progresso.

## Proposta — 5 fases

### Fase 1 — Hero KPIs com hierarquia clara

Trocar o grid plano por 2 níveis:

```text
┌─ Primary row (4 cards grandes) ───────────────────────────┐
│  Faturamento  │  Gasto  │  Lucro  │  ROAS                  │
│  + delta vs período anterior  + sparkline 14d              │
└────────────────────────────────────────────────────────────┘
┌─ Secondary row (6 cards menores) ─────────────────────────┐
│  Margem │ Compras │ CPA │ CTR │ CPC │ CPM                  │
└────────────────────────────────────────────────────────────┘
```

- Primary: cards glass com gradient, sparkline (Recharts) dos últimos N dias filtrados, comparativo `Δ%` vs período anterior equivalente.
- Secondary: cards compactos sem sparkline.
- Cliques/Impressões viram footer discreto (não merecem card).

### Fase 2 — Barra de controles unificada

Separar em 3 zonas + colapso responsivo:

```text
[ Período: Hoje | Ontem | 7d | 30d | 90d | Custom ]   [ ⟳ Sync · há 4min ]
[ 🔍 buscar conta...]  [ BM ▾ ] [ Clientes ▾ ] [ Contas ▾ ] [ Status ▾ ]
```

- Chip de "última sincronização" + spinner inline (substitui botão grande).
- Adicionar **período custom** (date range), faltava.
- Adicionar filtro de **status da conta** (ativa/bloqueada) — já tem o dado em `meta_ad_accounts.status`.
- Em telas <md, filtros viram `Sheet` lateral com contagem de ativos.

### Fase 3 — Gráficos temporais

Adicionar uma seção com 2 charts (Recharts, glass cards):

1. **Spend × Revenue × Profit** — area chart empilhado por dia.
2. **ROAS diário** — line chart com linha de referência em 1.0x.

Tab para alternar granularidade (Diário / Semanal). Tooltip com valores formatados USD.

### Fase 4 — Breakdown table (ranking)

Tabela com tabs:

- **Por Cliente** — agrupa insights via `meta_ad_account_assignments`. Mostra: cliente, spend, revenue, ROAS, compras, % do total.
- **Por Conta** — conta, BM, cliente atribuído, spend, ROAS, status, última sync.
- **Por BM** — agregado.

Sort por coluna, busca embutida, mini progress bar do % do total. Click na linha aplica filtro correspondente.

### Fase 5 — Polimento

- Skeleton durante load (mesma estrutura dos KPIs/charts).
- Empty state com CTA "Sincronizar agora".
- Toast de sync com contagem de linhas upsertadas.
- Estado "stale data" (badge amarelo) se última sync > 6h.
- Animações suaves (`framer-motion` stagger) na entrada dos cards.

## Detalhes técnicos

**Novos componentes** em `src/components/ads/`:

- `AdsKpiHero.tsx` — primary + secondary KPI grid.
- `AdsFiltersBar.tsx` — toda a zona de filtros + sync chip.
- `AdsTimeCharts.tsx` — Spend/Revenue/Profit + ROAS.
- `AdsBreakdownTable.tsx` — tabs cliente/conta/BM com sort/busca.
- `MiniSparkline.tsx` — reutilizável (já há lógica parecida em `ClientCard`).

**Reaproveitamentos**:

- `filteredInsights`, `metrics`, `clientByAccount`, `rangeToDates` continuam — só extraídos para `useMemo`s consumidos pelos novos componentes.
- Cálculo de delta período-anterior: rodar `loadInsights` para janela espelho (ex.: se range = 7d atual, busca 7d anteriores) e calcular `Δ%`.
- Sparkline e gráficos usam Recharts (já no projeto).

**Sem mudanças de backend**: nenhuma SQL, RLS ou edge function. Tudo é frontend sobre `meta_ad_insights`, `meta_ad_accounts`, `meta_ad_account_assignments`, `meta_business_managers` e `clients`.

**Ordem sugerida de entrega**: Fases 1+2 juntas (visual imediato), depois 3, depois 4, depois 5.

Aprova para implementar?
