
# Plano — Aprimorar Dashboard Admin de Clientes

Foco: reorganização visual e de informação da página `src/pages/Clients.tsx`. Sem mudar regras de negócio (cálculo de comissões, RLS, pagamentos continuam idênticos).

## Diagnóstico atual

- Header simples só com "Total" de clientes — sem KPIs financeiros globais.
- Filtros (busca + período) e botão "Novo Cliente" disputam a mesma linha, ficam apertados.
- **Metas semanais de desconto (tiers)** moram dentro do modal "Novo Cliente", mesmo sendo configuração global — confuso e duplica o card a cada edição.
- Card do cliente concentra muita informação em pouco espaço: chips de tipo, e-mail, %, contas, crédito, 4 KPIs, ações de pagamento e histórico — sem hierarquia clara.
- "Histórico de Lançamentos" abre dentro do card empurrando layout; difícil escanear vários clientes.
- Sem estados de status agregados (cliente em dia / inadimplente / sem gasto na semana).
- Sem ordenação nem filtro por tipo (aluguel/venda) ou por status financeiro.
- Loading sem skeleton, empty state sem ilustração.

## Fase 1 — Topo da página (resumo executivo)

Substituir o header atual por uma faixa de **KPIs globais filtráveis pelo período já existente**:

- Total de clientes (com split aluguel / venda)
- Gasto em Ads agregado no período
- Comissão pendente total (soma de `saldoPendente` de todos)
- Comissão paga no período
- Nº de clientes com saldo > 0 (badge "em cobrança")

Visual: grid de 4-5 mini-cards glass, com ícone, label sutil e número em `font-display`, mesmo padrão usado em `Dashboard.tsx`.

## Fase 2 — Barra de controles reorganizada

Linha única, organizada em 3 zonas:

1. Esquerda: busca (ocupa flex-1) + chip "Mostrando X de Y".
2. Centro: chips de período (já existem) + **novo filtro de tipo** (Todos / Aluguel / Venda) + **novo filtro de status** (Todos / Em dia / Pendente / Sem gasto) + ordenação (Maior saldo, Mais recente, A–Z).
3. Direita: botão "Novo Cliente" + botão secundário "Metas de desconto" (abre modal dedicado, ver fase 3).

Em mobile, vira coluna com filtros colapsáveis em um `Sheet`.

## Fase 3 — Extrair "Metas semanais de desconto" do modal de cliente

Hoje o bloco de tiers aparece dentro do form de "Novo/Editar Cliente" mesmo sendo global. Mover para um **modal/dialog próprio** acionado pelo botão "Metas de desconto" na barra de controles. Reaproveita todo o estado (`tierDraft`, `saveTiers`, `addTier`, `removeTier`).

Ganhos: form de cliente fica ~40% menor e o admin entende que tiers são globais.

## Fase 4 — Redesign do card do cliente

Reorganizar cada card em **3 zonas verticais claras**, mantendo padrão glass / neon green:

1. **Cabeçalho (identidade):** número + nome + badge tipo (Aluguel/Venda) + badge de status financeiro (Em dia ✅ / Pendente ⚠ / Sem gasto ◌). Ações (Ver como cliente, Editar, Excluir) viram um menu `…` à direita para limpar a linha.

2. **Sub-header (metadados):** empresa, e-mail, % base / valor fixo, contas disponíveis, crédito do plano. Tipografia menor e cor `muted-foreground`, sem competir com KPIs.

3. **KPIs (4 stat cards):** mesmo conteúdo atual (Gasto, Pendente, Paga, Saldo) mas com:
   - ícone à esquerda
   - mini-sparkline de 7 dias do gasto no card "Gasto em Ads" (Recharts `<Line>` 60×24)
   - destaque visual no "Saldo Pendente" (borda neon quando > 0, success quando = 0)

4. **Footer de ações:** "Validar Pagamento" + "Histórico" (vira botão que abre **drawer lateral** em vez de expandir o card — escaneia melhor lista longa).

## Fase 5 — Histórico em drawer lateral

Substituir o expand inline por um `Sheet` (shadcn) deslizando da direita, com:

- Tabs: **Lançamentos** / **Cobranças semanais** / **Pagamentos**
- Filtro por intervalo de datas dentro do drawer
- Edição/exclusão inline já existentes
- Footer com totais do cliente

Mantém todas as funções atuais (`startEditCommission`, `handleDeleteCommission`) — só muda o container.

## Fase 6 — Polimento de estado

- **Skeleton** durante `loading` (3 cards fantasma) em vez de tela vazia.
- **Empty state** com ícone e CTA "Cadastrar primeiro cliente" quando `clients.length === 0`.
- **Empty state filtrado** ("Nenhum cliente bate com os filtros — limpar filtros") quando `filtered.length === 0`.
- Transições suaves (Motion) na entrada/saída de cada card e nas trocas de filtro.

## Detalhes técnicos

- Arquivo único impactado: `src/pages/Clients.tsx` (~1.166 linhas hoje). Para não inchar ainda mais, extrair:
  - `src/components/clients/ClientKPIBar.tsx` (Fase 1)
  - `src/components/clients/ClientFiltersBar.tsx` (Fase 2)
  - `src/components/clients/TiersDialog.tsx` (Fase 3)
  - `src/components/clients/ClientCard.tsx` (Fase 4)
  - `src/components/clients/ClientHistoryDrawer.tsx` (Fase 5)
- Reaproveitar `getAccumulated`, `calculateCommission`, `getWeeklyAccumSpend`, `insightsByClient` que já existem.
- Tokens semânticos do `index.css` apenas (`primary`, `success`, `warning`, `muted-foreground`, `card`, `border`) — sem cores hardcoded.
- Sparkline usa `meta_ad_insights` que já estamos buscando em `fetchInsightsByClient`.
- Sem migração SQL, sem mudança de RLS, sem mudança em edge functions.

## Entrega sugerida (ordem)

1. Fases 1 + 2 + 3 juntas → topo da página totalmente novo e modal de tiers separado.
2. Fase 4 → redesign do card (commit isolado para revisão visual).
3. Fase 5 → drawer de histórico.
4. Fase 6 → polimento (skeleton, empty states, transições).

Após a aprovação posso começar pela etapa 1 e seguir nessa ordem, validando o visual a cada bloco.
