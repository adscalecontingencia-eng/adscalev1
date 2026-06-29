## 1. Páginas legais (HTML estático em `/public`)

- **`public/terms.html`** — reescrever transferindo TODA responsabilidade ao CLIENTE:
  - Item 3 deixa explícito: a AGÊNCIA não tem qualquer responsabilidade sobre o uso da conta, conteúdo veiculado, produtos anunciados, bloqueios da Meta, prejuízos, fraudes ou crimes — responsabilidade exclusiva e integral do CLIENTE.
  - CLIENTE indeniza e isenta a AGÊNCIA em qualquer hipótese.
  - Manter cláusulas LGPD, pagamento, foro.
- **`public/advertising-policy.html`** (novo) — Política de Publicidade:
  - Conteúdo permitido / proibido (réplicas, infoprodutos enganosos, conteúdo adulto, jogos de azar não regulados, etc.).
  - Conformidade com políticas da Meta/Google.
  - Direito da AGÊNCIA suspender campanhas que violem políticas.
  - Responsabilidade integral do CLIENTE pelo conteúdo do anúncio.
- Atualizar `MarketplaceFooter.tsx` (coluna "Políticas"): links para `/terms.html` e `/advertising-policy.html`.

## 2. Aceite de termos no cadastro do marketplace

- **`src/pages/MarketplaceSignup.tsx`**: adicionar checkbox obrigatório "Li e aceito os Termos de Uso e a Política de Publicidade" com links que abrem em nova aba. Bloquear submit se não marcado.
- **Edge function `marketplace-signup`**: receber `terms_accepted: true` e registrar em `client_terms_acceptances` (tabela já existe) com `version = TERMS_VERSION`, `ip_address`, `user_agent`, `auth_user_id`.

## 3. Fix: clientes do marketplace não aparecem no admin

- Investigar `src/pages/MarketplaceClients.tsx` — provavelmente filtra por `role = 'marketplace_client'` em `user_roles` mas a edge function `marketplace-signup` insere com sucesso. Verificar:
  - Se a query realmente faz JOIN com `auth.users` (admin precisa de service role ou view).
  - Se há RLS impedindo admin de ler `user_roles`.
- Corrigir criando/ajustando uma edge function `list-marketplace-clients` (service role) que retorna lista paginada com email, nome, telefone, criado em, total depositado, total gasto — chamada pela página admin.

## 4. Sistema de Tracking (Meta Pixel + Google)

### Banco
Nova tabela `tracking_pixels`:
- `id`, `provider` (`meta` | `google_ads` | `google_analytics`), `pixel_id` (text), `extra` (jsonb — ex: `conversion_label` para Google Ads), `enabled` (bool), `created_at`, `updated_at`.
- RLS: leitura pública (anon + authenticated) — pixels precisam carregar no marketplace para visitantes. Escrita só admin/support via `has_role`.
- GRANTs apropriados.

### Painel admin
- Nova página `src/pages/AdminTracking.tsx` (rota `/admin-tracking`, protegida admin/support, dentro de `DashboardLayout`):
  - Lista pixels cadastrados.
  - Form para adicionar/editar: select provider, pixel_id, label de conversão (Google Ads), enabled.
  - Link no menu lateral do `DashboardLayout`.

### Loader de tracking no marketplace
- Novo `src/components/marketplace/TrackingLoader.tsx`:
  - Lê `tracking_pixels` (enabled).
  - Injeta Meta Pixel base code (`fbq('init', pixel_id); fbq('track', 'PageView')`).
  - Injeta Google Ads `gtag.js` + `gtag('config', 'AW-xxx')`.
  - Injeta GA4 `gtag('config', 'G-xxx')`.
  - Expõe helper global `window.__trackConversion({ value, currency, orderId })` que dispara:
    - Meta: `fbq('track', 'Purchase', { value, currency: 'BRL' })`.
    - Google Ads: `gtag('event', 'conversion', { send_to: 'AW-xxx/label', value, currency: 'BRL', transaction_id })`.
    - GA4: `gtag('event', 'purchase', { value, currency: 'BRL', transaction_id })`.
- Montar `<TrackingLoader />` nas 3 páginas marketplace (`Marketplace`, `MarketplaceAssets`, `MarketplaceProducts`).

### Conversão por depósito (quando PIX confirma)
- No fluxo que faz polling do status do depósito (provavelmente `WalletDepositModal.tsx` / `useWallet.ts` / `check-marketplace-order-status`):
  - Quando status muda para `approved`/`confirmado`, chamar `window.__trackConversion({ value: amount_brl, orderId: deposit_id })`.
  - Marcar localmente (localStorage `tracked_deposit_<id>`) para não duplicar evento em re-renders/polling.

## Arquivos afetados (resumo)

**Novos:**
- `public/advertising-policy.html`
- `src/pages/AdminTracking.tsx`
- `src/components/marketplace/TrackingLoader.tsx`
- `supabase/functions/list-marketplace-clients/index.ts` (se necessário após investigar)

**Editados:**
- `public/terms.html` (reescrita responsabilidades)
- `src/lib/terms.ts` (atualizar texto + bump `TERMS_VERSION`)
- `src/components/marketplace/MarketplaceFooter.tsx` (links)
- `src/pages/MarketplaceSignup.tsx` (checkbox)
- `supabase/functions/marketplace-signup/index.ts` (registrar aceite)
- `src/App.tsx` (rota `/admin-tracking`)
- `src/components/DashboardLayout.tsx` (item de menu)
- `src/pages/Marketplace.tsx`, `MarketplaceAssets.tsx`, `MarketplaceProducts.tsx` (montar TrackingLoader)
- `src/pages/MarketplaceClients.tsx` (ajuste de query/fonte de dados)
- `src/components/marketplace/WalletDepositModal.tsx` (dispatch de conversão)

**Migration:**
- Cria `tracking_pixels` com RLS + GRANTs.
