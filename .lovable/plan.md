
# Marketplace de Ativos — Plano

## 1. Banco de dados (migration)

**`products`** (catálogo)
- `id`, `name`, `slug`, `category` (BM Facebook, Perfil, BC TikTok, Google Ads, Proxy, etc.), `subcategory`, `country` (BR/US/...), `description`, `warranty_terms`, `tags[]`, `cost_price`, `sale_price`, `discount_price` (opcional), `is_featured`, `is_new`, `active`, `image_url`, `created_at`, `updated_at`.

**`product_stock`** (unidades pré-cadastradas — entrega automática)
- `id`, `product_id`, `payload` (jsonb com email/senha/cookies/token/observações — campos livres por categoria), `status` ('disponivel' | 'reservado' | 'entregue' | 'inativo'), `reserved_until`, `order_id`, `delivered_at`, `created_at`.
- Função `reserve_stock(product_id, qty, order_id)` (SECURITY DEFINER) que faz `UPDATE ... WHERE status='disponivel' LIMIT qty` atomicamente.

**`orders`**
- `id`, `client_id`, `status` ('aguardando_pagamento' | 'pago' | 'entregue_auto' | 'pendente_suporte' | 'cancelado' | 'reembolsado'), `total`, `created_at`, `paid_at`, `delivered_at`, `delivery_mode` ('auto' | 'manual'), `notes`.

**`order_items`**
- `id`, `order_id`, `product_id`, `quantity`, `unit_price`, `cost_snapshot`.

**`order_deliveries`** (o que foi entregue ao cliente — copia de stock.payload)
- `id`, `order_id`, `order_item_id`, `product_id`, `stock_id` (nullable se manual), `payload` (jsonb), `delivered_at`.

**`payments`** (Woovi Pix)
- `id`, `order_id`, `provider` ('woovi'), `charge_id`, `correlation_id`, `qr_code`, `br_code`, `amount`, `status` ('ativo' | 'pago' | 'expirado' | 'cancelado'), `paid_at`, `raw_webhook` jsonb, `created_at`.

**`clients`** — adicionar `phone` (obrigatório nos novos cadastros) se ainda não houver equivalente confiável; manter `whatsapp_phone` para compatibilidade.

RLS: produtos públicos para leitura (anon + authenticated); `product_stock`, `orders`, `order_items`, `order_deliveries`, `payments` apenas admin/support; cliente lê apenas suas próprias orders/deliveries.

## 2. Edge Functions

- `woovi-create-charge` — cria pedido + cobrança Pix (chama API Woovi com `WOOVI_APP_ID`), devolve QR code/copia-cola.
- `woovi-webhook` (verify_jwt=false, valida HMAC do header da Woovi) — ao receber `OPENPIX:CHARGE_COMPLETED`:
  1. marca `payments.status='pago'`, `orders.status='pago'`;
  2. tenta `reserve_stock` para cada item:
     - todos atendidos → grava `order_deliveries`, marca stock 'entregue', `orders.status='entregue_auto'`;
     - parcial ou zero → cria `internal_tasks` (categoria 'Entrega Marketplace') para o suporte e marca `orders.status='pendente_suporte'`.
- `marketplace-checkout` — endpoint autenticado: valida itens/preços, cria order pendente, chama `woovi-create-charge`.

Secret necessário: `WOOVI_APP_ID` (será solicitado quando começarmos a implementar o pagamento).

## 3. Frontend — Marketplace público (rotas Hash)

- `/#/marketplace` — Hero, busca, filtros (categoria, país, preço), grid de produtos em destaque + novidades (tabs como no print).
- `/#/marketplace/categoria/:slug` — listagem por categoria.
- Card de produto: tags, badges país/ilimitado, preço, desconto, estoque disponível, "Comprar", "ⓘ" detalhes.
- Dialog detalhe (tabs Produto / Garantia) — exatamente como o concorrente.
- `/#/checkout/:orderId` — exibe QR Code Pix + copia-cola, polling do status do pagamento, redireciona para `/#/meus-pedidos/:id` quando pago.
- `/#/meus-pedidos` e `/#/meus-pedidos/:id` (logado) — lista de pedidos do cliente + payload entregue (ou aviso "Suporte processando").
- Link no header público "Marketplace"; botão "Comprar" exige login (redireciona para `/#/login?next=/marketplace`).

## 4. Admin

Nova página `/#/admin/marketplace` (admin only) com tabs:
- **Produtos**: tabela CRUD (nome, categoria, país, custo, venda, desconto, destaque, ativo). Form completo com upload de imagem (Supabase Storage bucket `product-images`).
- **Estoque**: por produto, lista de unidades (`product_stock`); adicionar uma a uma ou em lote (textarea com 1 linha = 1 unidade JSON/CSV). Mostra contagem disponível/reservada/entregue.
- **Pedidos**: lista com filtros (status, cliente, data); detalhe mostra itens, pagamento, deliveries, botão "Entregar manualmente" (preenche payload e marca entregue) para pedidos `pendente_suporte`.
- **Métricas**: receita marketplace, ticket médio, custo, margem por produto/categoria.

## 5. Cadastro com Google + telefone obrigatório

- Habilitar Google OAuth (Lovable Cloud managed) em `Signup.tsx` e `Login.tsx` via `lovable.auth.signInWithOAuth("google", { redirect_uri })`.
- Fluxo pós-OAuth: se `clients.phone` estiver vazio para o `auth_user_id` recém-criado, redireciona para `/#/completar-cadastro` exigindo `phone` (com máscara/validação E.164) antes de liberar o app.
- Cadastro por email/senha existente ganha campo "Telefone (WhatsApp)" obrigatório com Zod (mínimo 10 dígitos, regex BR + internacional).
- Persistir em `clients.whatsapp_phone` (já existe) — sem verificação SMS. Se houver `whatsapp_group_link` configurado globalmente, mostrar botão "Entrar no grupo" no final do cadastro.

## 6. Ordem de implementação

1. Migration (tabelas + RLS + função `reserve_stock`).
2. Admin CRUD produtos + estoque.
3. Página pública do marketplace + detalhe.
4. Google OAuth + telefone obrigatório no cadastro.
5. Edge functions Woovi + página de checkout Pix + webhook.
6. Página "Meus pedidos" + entrega manual no admin.
7. QA fim-a-fim (criar produto → comprar → simular webhook → entrega automática e manual).

## Detalhes técnicos

- Pix Woovi: API `https://api.woovi.com/api/v1/charge` (POST com header `Authorization: <APP_ID>`), webhook validado por header `x-webhook-signature` (HMAC SHA256 do body com app id).
- Storage: bucket público `product-images`.
- Tipos TS regenerados após a migration antes de escrever telas que dependam das novas tabelas.
- Manter dark + neon do design system; reaproveitar `Card`, `Badge`, `Dialog`, `Tabs` do shadcn.
