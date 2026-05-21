
# Plano — Otimizar Dashboard de Conexões Meta

## Diagnóstico atual (`src/pages/MetaConnections.tsx`, 557 linhas)

- **Header + sync** num único bloco, sem indicação de "última sync" nem agendamento.
- **Card de info** (System User / Request Access) fixo no topo, ocupa muito espaço — deveria ser collapsible.
- **5 StatCards planos** (BMs, Contas, Atribuídas, Bloqueadas, Score médio), sem hierarquia, sem delta, sem agrupamento por significado.
- **Filtros achatados** em linha única (busca + 3 selects), sem chips de filtros ativos, sem multi-select.
- **Tabela única e densa**: 8 colunas, sem ordenação, sem agrupamento por BM, score/status misturados, sem cor para idade ou saldo.
- **Sem visão por BM**: impossível ver quantas contas/score/bloqueios por BM sem filtrar manualmente.
- **Detalhe da conta** em Dialog padrão, sem aba de histórico/insights.
- **Empty/loading states** texto puro.

## Proposta — 5 fases

### Fase 1 — Header executivo + KPIs com hierarquia

Trocar grid 5 plano por 2 níveis:

```text
┌─ Primary (4 cards grandes) ──────────────────────────────┐
│ Contas Ativas │ Bloqueadas │ Atribuídas │ Score Médio    │
│ + spark/% do total + tag de tendência                    │
└──────────────────────────────────────────────────────────┘
┌─ Secondary (chips compactos) ────────────────────────────┐
│ BMs · Contas totais · Sem cliente · Sem pagamento · Última sync
└──────────────────────────────────────────────────────────┘
```

- **Mover "Contas Ativas" do Dashboard para cá** (card primary com destaque verde neon, mostrando ativas / total).
- **Remover** o KpiCard `Contas Ativas` em `src/pages/Dashboard.tsx` (linha 533) e o cálculo `activeAccounts` (linha 136). Ajustar grid para não deixar buraco.
- Chip "última sync · há Xmin" (igual ao usado em AdsDashboard).
- Card de "System User / Request Access" vira `Collapsible` fechado por padrão, com gatilho discreto "Por que minha conta não aparece?".

### Fase 2 — Visão por BM (novo bloco)

Acima da tabela de contas, adicionar uma seção **"Business Managers"** com cards horizontais (carousel/scroll-x em mobile):

```text
┌─ BM: AGÊNCIA ABC ────────────┐  ┌─ BM: XYZ ─────────────────┐
│ 18 contas · 2 bloqueadas     │  │ 9 contas · 0 bloqueadas   │
│ Score médio: 72 ✅           │  │ Score médio: 58 ⚠         │
│ Última sync: há 12min        │  │ Última sync: há 1h        │
│ [Filtrar contas →]           │  │ [Filtrar contas →]        │
└──────────────────────────────┘  └───────────────────────────┘
```

- Click no card aplica `filterBm`.
- Badge de verificação (`verification_status`) no header de cada BM.
- Esconder/expandir tudo via toggle "Ver todas as BMs (N)".

### Fase 3 — Filtros e tabela melhorados

**Filtros (`AdsFiltersBar`-style)**:
- Busca à esquerda, popovers BM (já tem) + **multi-select clientes** + status + **novo "Saúde"** (Crítico / Atenção / OK baseado em score_label).
- Chips de filtros ativos com X.
- Botão "Limpar filtros" quando houver algum ativo.

**Tabela**:
- **Ordenação por coluna** (score, gasto, criação, status).
- **Coluna "Idade"** (já há `age` na tabela) com badge colorido (verde >180d, amarelo 30-180d, vermelho <30d — contas novas costumam bloquear mais).
- **Coluna "Saldo"** (`balance`) com cor vermelha quando 0 e funding_source null.
- **Status** com tooltip do `disable_reason_label` e ícone.
- **Mini-progress** do gasto vs spend_cap quando houver cap.
- **Linhas zebra + sticky header** em scroll vertical, altura máxima da tabela com scroll interno.
- **Bulk actions**: checkbox na linha + barra superior "N selecionadas → Atribuir a cliente / Marcar como…".

### Fase 4 — Drawer de detalhe enriquecido

Trocar o `Dialog` por `Sheet` lateral mais largo com 3 tabs:

1. **Visão geral** — campos atuais (criação, país, billing cycle, balance, score breakdown).
2. **Performance** — últimos 30d de `meta_ad_insights` (mini line chart spend, bar chart purchases).
3. **Histórico** — eventos de `meta_blocked_accounts_log` + `meta_critical_events` daquela conta.

Botão "Abrir no Meta Business Manager" (link `https://business.facebook.com/adsmanager/manage/accounts?act={meta_account_id}`).

### Fase 5 — Polimento

- **Skeleton** dos cards/tabela durante load (substituir "Carregando...").
- **Empty state** com ilustração + CTA "Sincronizar agora".
- **Badge "stale data"** amarelo no header se última sync > 6h.
- **Tooltip "?"** ao lado do Score explicando a fórmula (idade + funding + pixels + páginas).
- **Animações** `framer-motion` stagger na entrada das BM cards e linhas da tabela.
- **Acessibilidade**: aria-labels nos botões de ícone (Eye, Link2, Unlink).

## Detalhes técnicos

**Novos componentes** em `src/components/meta/`:
- `MetaKpiHero.tsx` — primary + secondary KPIs.
- `BmOverviewStrip.tsx` — strip horizontal de cards por BM.
- `AccountsFiltersBar.tsx` — filtros unificados (reusa padrão do AdsFiltersBar).
- `AccountsTable.tsx` — tabela com sort/bulk/mini-progress.
- `AccountDetailSheet.tsx` — substitui `AccountDetailDialog` com tabs.
- `SystemUserHelpCollapsible.tsx` — info técnica colapsável.

**Mudanças em arquivos existentes**:
- `src/pages/MetaConnections.tsx` — vira composição leve dos componentes acima (~200 linhas).
- `src/pages/Dashboard.tsx` — remover `activeAccounts` (linha 136) e o KpiCard "Contas Ativas" (linha 533); ajustar grid de KPIs para 7 colunas ou redistribuir.

**Reaproveitamentos**:
- `bms`, `accounts`, `assignments`, `clients`, `currentClient`, `bmName`, `filtered`, `stats` continuam — extraídos em `useMemo`s passados via props.
- Estado de `job` (realtime) permanece no container.
- Score helpers (`scoreColor`, `scoreBadgeVariant`) movem para `src/lib/meta-score.ts`.

**Sem mudanças de backend**: nenhuma SQL, RLS, edge function. Tudo é frontend sobre tabelas já existentes (`meta_business_managers`, `meta_ad_accounts`, `meta_ad_account_assignments`, `meta_ad_insights`, `meta_blocked_accounts_log`, `meta_critical_events`, `clients`).

**Ordem sugerida de entrega**:
1. **Fase 1** (KPIs + mover métrica do Dashboard) — entrega visual imediata.
2. **Fase 2** (strip de BMs).
3. **Fase 3** (filtros + tabela com sort e novas colunas).
4. **Fase 4** (Sheet com tabs).
5. **Fase 5** (polimento).

Aprova para implementar?
