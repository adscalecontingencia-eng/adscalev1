## Visão geral
Reorganizar a navegação do admin em dois grandes grupos (Aluguel × Venda), criar páginas novas no admin (Clientes do Marketplace, Cadastro de Ativos com Gastos), substituir "Minha Carteira" por "Meu Perfil" no marketplace com um painel completo, aprimorar os cards do marketplace e remover Proxies da listagem pública.

---

## 1. Sidebar admin com grupos colapsáveis (`src/components/DashboardLayout.tsx`)

Reestruturar `adminLinks` em 3 grupos:

- **Geral** (sempre aberto, sem header): Dashboard
- **Aluguel** (colapsável, aberto por padrão): Clientes, Parceiros, Financeiro, Pagamentos, Auditoria Pagamentos, Suporte, Conexões Meta, Aplicativos Meta, Páginas, Mapa de Ativos, Ads, Log de Bloqueios
- **Venda** (colapsável, aberto por padrão): Marketplace (admin), **Clientes Marketplace** (novo), **Ativos c/ Gastos** (novo), Pedidos PIX (admin)
- **Sistema** (colapsável, fechado por padrão): Acessos, Auditoria, Usuários

Cada grupo terá header clicável (chevron) com estado em `useState`. Item ativo expande seu grupo automaticamente. Visual mantém o tema dark + neon green atual.

## 2. Dashboard principal com métricas das duas modalidades (`src/pages/Dashboard.tsx`)

Adicionar no topo do Dashboard 3 abas: **Visão Geral · Aluguel · Venda**.
- **Visão Geral** (default): KPIs combinados — receita total (aluguel + marketplace), nº de clientes ativos (aluguel) + cadastros marketplace, gastos totais.
- **Aluguel**: KPIs e gráficos atuais (mantém o que existe hoje).
- **Venda**: GMV marketplace (`marketplace_orders.amount` aprovados), nº pedidos, ticket médio, top produtos, depósitos da carteira (`wallet_deposits`).

## 3. Nova página: Clientes do Marketplace (`src/pages/MarketplaceClients.tsx`)

Rota: `/marketplace-clients` (admin/support).

- Lista usuários que se cadastraram via marketplace (auth.users via edge function `manage-users` filtrando por metadata ou origem `marketplace`).
- Colunas: Nome, Email, Cadastro (data), Total Depositado (`wallet_deposits` aprovados), Total Gasto (`wallet_transactions` type=purchase), Saldo atual (`wallets`), Nível, Status.
- Filtros: busca por nome/email, filtro por nível, intervalo de cadastro.
- Ações admin (dropdown por linha): Ver perfil completo (drawer), Ajustar saldo (modal — credita/debita via nova edge function `admin-wallet-adjust`), Bloquear/Desbloquear (atualiza `auth.users.banned_until` via `manage-users`).

Edge function nova: `admin-wallet-adjust` (cria `wallet_transactions` tipo `adjustment` e atualiza `wallets.balance`, gravando autor em `metadata.admin_id`).

## 4. Aprimorar cards do marketplace (print 3) (`src/components/marketplace/ProductCard.tsx` + `src/pages/Marketplace.tsx`)

Reformular o card para refletir o layout dos prints:
- Header: nome (ex. "BM MaxScale MS360"), badges (Moeda BRL/USD, Verificada, Ano de Criação).
- Bloco de preço grande + botão "Comprar via chat" (WhatsApp) cheio.
- Grid 2×2 de KPIs do BM: **Gastos Totais**, **Maior Limite**, **Ciclo Total**, **Dívida Total** (ou **Saldo Total** quando aplicável — verde para saldo, vermelho para dívida).
- Lista expansível "N CONTAS DE ANÚNCIO" com cada conta: número, status (Ativa/Pré-Paga), Gastos / Limite Meta / Ciclo / Saldo ou Dívida.
- Seção "OBSERVAÇÕES" no rodapé.

Os dados virão dos novos campos cadastrados no admin (item 5). Cards de produtos antigos sem esses dados caem para o layout simples atual (fallback).

## 5. Painel admin de Ativos c/ Gastos (`src/pages/AdminMarketplaceAssets.tsx`)

Rota: `/admin/marketplace-assets` (admin/support). Form completo:

- **BM**: nome, plataforma (Facebook/Google/TikTok), moeda (BRL/USD/EUR), ano de criação, preço, verificada (switch), observações (textarea).
- **Contas de anúncio** (lista dinâmica, add/remove): número da conta, status (Ativa/Pré-Paga/Inativa), gastos, limite meta, ciclo, dívida, saldo, extensão limite (opcional).
- KPIs (Gastos Totais, Maior Limite, Ciclo Total, Dívida Total) calculados automaticamente a partir das contas.
- Lista paginada de ativos cadastrados com editar/excluir/duplicar/ativar-desativar.

Schema novo (migration):
- `marketplace_assets`: name, platform, currency, year, price, verified, notes, status (active/sold/hidden).
- `marketplace_asset_accounts`: asset_id (FK), account_number, status, gastos, limite_meta, ciclo, divida, saldo, extensao_limite.

Ambas com RLS + GRANT (admins/support gerenciam; anon faz SELECT em `active`).

## 6. Substituir "Minha Carteira" por "Meu Perfil" (prints 3 e 4)

### Dropdown do header do marketplace (`src/pages/Marketplace.tsx`)
- Remover item "Minha carteira" e botão "Adicionar saldo" do header.
- Novo dropdown ao clicar no avatar (estilo print 3): Avatar+nome+email, **Perfil**, **Meus Pedidos**, **Programa de Afiliados**, separador, **Sair** (vermelho).
- (Sem "Minhas Proxies" — coerente com remoção de proxies.)

### Nova página `src/pages/MarketplaceProfile.tsx` (rota `/perfil`)
Layout idêntico ao print 4:
- Header card: avatar circular, nome, badge "Nível N", email, ID do usuário, "Membro desde", botões **Editar Perfil** e **Alterar Senha**.
- 4 KPIs: Total Gasto, Saldo Atual, Total Depositado, Nível Atual (com barra de progresso para o próximo nível).
- Card **Histórico de Depósitos** (lista `wallet_deposits` do usuário; empty state como no print).
- Botão flutuante para abrir o `WalletDepositModal` existente (mantém a função de depositar, agora dentro do perfil).

`/minha-carteira` continua existindo mas redireciona para `/perfil`.

## 7. Remover categoria Proxies do marketplace (`src/pages/Marketplace.tsx`)

- Remover "Proxies" das categorias/abas do marketplace público (print 8).
- Filtrar produtos cuja `category` seja Proxy do grid e dos filtros.
- Não excluir produtos do banco (admin continua vendo).

---

## Detalhes técnicos

**Rotas novas em `src/App.tsx`:**
- `/marketplace-clients` → MarketplaceClients (admin/support, dentro de DashboardLayout)
- `/admin/marketplace-assets` → AdminMarketplaceAssets (idem)
- `/perfil` → MarketplaceProfile (ProtectedRoute, sem DashboardLayout)
- `/minha-carteira` → `<Navigate to="/perfil" replace />`

**Migrations (1 migration):**
1. `CREATE TABLE public.marketplace_assets (...)` + GRANT + RLS + policies (admin/support full, anon SELECT WHERE status='active').
2. `CREATE TABLE public.marketplace_asset_accounts (...)` + GRANT + RLS + policies (mesmas regras, herdam do asset).
3. Trigger `update_updated_at_column` em ambas.

**Edge function nova:** `supabase/functions/admin-wallet-adjust/index.ts` — valida role admin, ajusta saldo, registra `wallet_transactions`.

**Arquivos a criar:**
- `src/pages/MarketplaceClients.tsx`
- `src/pages/MarketplaceProfile.tsx`
- `src/pages/AdminMarketplaceAssets.tsx`
- `src/components/marketplace/AssetCard.tsx` (novo card rico)
- `supabase/functions/admin-wallet-adjust/index.ts`

**Arquivos a alterar:**
- `src/components/DashboardLayout.tsx` (sidebar agrupada)
- `src/pages/Dashboard.tsx` (abas Aluguel/Venda)
- `src/pages/Marketplace.tsx` (dropdown perfil, remover proxies, usar AssetCard)
- `src/App.tsx` (rotas novas)

## Fora de escopo (não vou tocar agora)
- Sistema de programa de afiliados em si (só adiciono o link no menu apontando para `#` placeholder até confirmação).
- Editor de perfil avançado (foto upload) — botão "Editar Perfil" abre modal simples com nome e email.
