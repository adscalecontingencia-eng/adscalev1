# Página de escolha para leads do Instagram

Hub enxuto em `/escolha-seu-modelo` que explica os dois modelos de negócio (Marketplace e Aluguel de Contas) e direciona o lead para o caminho certo.

## Objetivo

Quando alguém clicar no link do Instagram, cair numa página única que:
1. Apresenta a AD SCALE em uma frase.
2. Mostra lado a lado os dois modelos com diferenças claras.
3. Deixa o lead escolher com um clique para onde quer ir.

## Estrutura da página

**Hero curto**
- Eyebrow: "Bem-vindo · AD SCALE"
- Título: "Escolha o modelo ideal para a sua operação"
- Subtítulo de 1 linha: explica que existem dois caminhos — comprar ativos avulsos no Marketplace ou alugar estrutura completa.
- Sem CTA aqui (a escolha está logo abaixo).

**Dois cards comparativos (lado a lado, empilham no mobile)**

Card 1 — Marketplace
- Ícone: ShoppingBag
- Título: "Marketplace"
- Subtítulo: "Compre ativos avulsos quando precisar"
- Bullets:
  - Compra única, sem comissão recorrente
  - BMs, contas, perfis e páginas vendidas individualmente
  - Pagamento via PIX, entrega imediata
  - Ideal para quem já tem operação e quer repor ativos
- Indicador "Para quem é": gestor que precisa de reposição pontual
- Botão: "Ver Marketplace" → `/marketplace`

Card 2 — Aluguel de Contas (com destaque visual sutil)
- Ícone: Infinity
- Título: "Aluguel de Contas"
- Subtítulo: "Estrutura completa com créditos de US$ 240"
- Bullets:
  - US$ 240 viram crédito para pagar a AD SCALE
  - Reposição automática quando a Meta bloquear
  - Comissão semanal de 5% (pode cair até 1%)
  - Painel ao vivo, suporte humano dedicado
- Indicador "Para quem é": operação em escala que quer terceirizar a estrutura
- Botão: "Conhecer o Aluguel" → `/aluguel-de-contas`

**FAQ curto (3–4 perguntas)**
- Qual modelo é melhor para mim?
- Posso usar os dois ao mesmo tempo?
- Como funciona o pagamento?
- Tem fidelidade?

**Footer mínimo** (logo + links de termos/privacidade já existentes).

## Detalhes técnicos

- Novo arquivo: `src/pages/EscolhaSeuModelo.tsx`.
- Nova rota em `src/App.tsx`: `/escolha-seu-modelo` (pública, fora do `DashboardLayout`).
- Reaproveita o visual da `AluguelDeContas`: dark theme, glows ambientes em `bg-primary`, glassmorphism (`bg-card/60 backdrop-blur-xl`), `framer-motion` para fade-up, `lucide-react` para ícones, `AdScaleLogo` no header e no footer.
- SEO: `document.title` + `meta description` no `useEffect`, H1 único, alts nos ícones decorativos via `aria-hidden`.
- Sem mudanças no backend, sem formulário (o lead capture acontece dentro de `/aluguel-de-contas`).
- Garantir que a rota funcione com o fix de SPA já feito em `src/main.tsx` (já cobre paths arbitrários).

## Fora de escopo

- Não criar nova captura de lead nessa página.
- Não alterar `/marketplace` nem `/aluguel-de-contas`.
- Não mudar tema, fontes ou design tokens existentes.
