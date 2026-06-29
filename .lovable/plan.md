## Nova landing page de aluguel

**Rota:** `/aluguel-de-contas` (registrada em `src/App.tsx`, sem auth, sem `MarketplaceGate`).

**Arquivos:**
- Novo: `src/pages/AluguelDeContas.tsx`
- Editado: `src/App.tsx` (rota pública)
- Novos assets em `src/assets/landing/`: 4 screenshots reais do `/client-dashboard` capturados via Playwright (login com cliente de teste, viewport 1440×900, full-element screenshots de seções específicas: KPIs no topo, gráfico de spend, lista de contas/BMs, painel financeiro/comissões).

### Captura dos prints (Playwright)
1. Login com credenciais de cliente de teste salvas em memory `mem://reference/credentials`.
2. Navegar para `/client-dashboard`.
3. Capturar 4 screenshots de seções (não full-page) usando `get_by_role` / seletores estáveis.
4. Salvar em `src/assets/landing/dash-*.png` e importar como ES6 imports.

Se o login com cliente de teste não funcionar, fallback: gerar 4 mockups com `imagegen` em estilo dark/neon-green coerente com a marca.

### Estrutura da landing (one-page, dark + neon green, glassmorphism, mesma identidade do marketplace)

1. **Nav fina** — logo AD SCALE + CTA "Começar agora" → `/cadastro-agencia`.
2. **Hero**
   - H1: "Escale sua operação com estrutura própria de mídia paga"
   - Sub: aluguel de BMs, contas e perfis para gestores de tráfego e agências.
   - Badge destaque: **"Comece com US$ 240 em créditos de mídia"**.
   - 2 CTAs: primário "Criar conta" → `/cadastro-agencia`; secundário "Como funciona" (anchor).
   - Mini-trust: "Cobrança semanal · PIX, Cripto e Payoneer · Suporte humano".
3. **Como funciona o crédito de US$ 240** (seção central)
   - Card 1: Você paga US$ 240 no início.
   - Card 2: Vira **crédito de mídia** (1:1), usado conforme você anuncia.
   - Card 3: Acabou o crédito? Cobramos **5% do spend** semanal.
   - Card 4: Bate metas semanais → **comissão pode cair até 1%**.
4. **Print do Dashboard #1 (KPIs/Hero)** — texto: "Acompanhe spend, contas ativas e comissões em tempo real".
5. **O que está incluso** (grid 6 cards)
   - BMs verificadas, contas de anúncio, perfis, páginas, troca rápida em caso de bloqueio, suporte dedicado.
6. **Print do Dashboard #2 (gráfico de spend ao longo do tempo)** — texto: "Visualize a evolução do investimento por conta, BM e período".
7. **Modelo de cobrança** (tabela limpa)
   - Setup inicial: **US$ 240 (vira crédito)**
   - Após créditos: **5% sobre Ad Spend semanal**
   - Performance: até **1%** com metas batidas
   - Ciclo: **semanal, toda sexta-feira**
   - Moeda: USD
8. **Print do Dashboard #3 (lista de contas/BMs)** — texto: "Tenha todo o seu mapa de ativos sob controle".
9. **Formas de pagamento** (3 cards com ícones)
   - PIX (BRL convertido)
   - Cripto (USDT)
   - Transferência internacional (Payoneer)
10. **Print do Dashboard #4 (financeiro/comissões)** — texto: "Histórico completo de cobranças e fechamento semanal transparente".
11. **FAQ** (5–6 perguntas: o que acontece se bloquearem minha conta, posso trocar de BM, como funciona a meta semanal, etc.).
12. **CTA final** — bloco grande "Pronto para escalar?" → `/cadastro-agencia`.
13. **Footer simples** com links para `/terms.html` e `/advertising-policy.html`.

### Detalhes técnicos
- Componente único, Tailwind, mesmas tokens (`bg-background`, `text-primary`, `border-border/60`, `bg-card/60 backdrop-blur-xl`).
- Animações leves com `framer-motion` (fade-in on scroll nas seções).
- Responsivo: hero 1 coluna no mobile, grids 1→2→3 colunas conforme breakpoint.
- SEO: `<title>`, meta description e H1 únicos via `document.title` no `useEffect`.
- Sem dependências novas.
