## Objetivo

Adicionar uma seção SEO oculta no rodapé do marketplace (`MarketplaceFooter.tsx`) contendo as 100 principais palavras-chave de contingência/compra de BM, para reforçar o ranqueamento no Google sem poluir a interface do usuário.

## Onde vai

Arquivo: `src/components/marketplace/MarketplaceFooter.tsx` — logo antes do bloco Legal (`© AD SCALE`), dentro do `<footer>` que já aparece em todas as páginas do marketplace, `/inicio`, `/aluguel-de-contas` etc.

## Como fica oculto (mas indexável)

Usar a técnica padrão de "visually hidden" que o Google trata como conteúdo normal (não é cloaking, pois está no HTML servido):

```tsx
<section
  aria-hidden="true"
  className="sr-only"
>
  <h2>SEO</h2>
  <ul>
    <li>comprar bm verificada</li>
    ...
  </ul>
</section>
```

- `sr-only` (utilitário Tailwind já disponível no projeto) esconde visualmente mas mantém no DOM.
- Não usar `display:none` nem `visibility:hidden` (Google pode ignorar).
- Não usar `color: transparent` sobre fundo igual (é considerado spam/black-hat).
- `aria-hidden` evita ruído em leitores de tela; o conteúdo continua no HTML para crawlers.

## Lista de 100 palavras-chave

Consolidando os prints 1, 2 e 3 (Search Console) + expansões da mesma família semântica. Ordem: cauda curta → cauda longa.

1. comprar bm verificada
2. bm verificada
3. bm verificada comprar
4. comprar bm verificada facebook
5. bm verificada facebook
6. comprar bm
7. comprar bm facebook
8. comprar bm facebook ads
9. comprar bm ilimitada
10. bm ilimitada
11. bm com gastos
12. bm contingencia
13. bm contingência
14. contingência meta ads
15. contingencia meta ads
16. contingência facebook ads
17. contingencia facebook ads
18. contingência facebook ads comprar
19. contingência facebook
20. contingencia facebook
21. contingência meta
22. contingencia meta
23. fornecedor de bm
24. fornecedor bm verificada
25. fornecedor de contas de anúncio
26. qualidade da conta meta
27. qualidade da conta meta ads
28. qualidade da conta
29. qualidade conta facebook ads
30. meta account quality
31. account quality
32. account quality facebook
33. trust tier facebook
34. trust tier meta ads
35. trust tier meta
36. auditoria do facebook
37. auditoria conta facebook ads
38. auditoria meta ads
39. consultoria de facebook ads
40. consultoria facebook ads
41. consultoria meta ads
42. consultoria de tráfego pago
43. aluguel de bm
44. aluguel de conta de anúncio
45. aluguel bm verificada
46. alugar bm facebook
47. alugar conta de anúncio facebook
48. alugar conta meta ads
49. conta de anúncio facebook
50. conta de anúncio meta
51. conta de anúncio bloqueada
52. conta anúncio bloqueada facebook
53. desbloquear conta de anúncio facebook
54. recuperar conta de anúncio meta
55. reativar conta de anúncio facebook
56. bm bloqueada facebook
57. bm bloqueada meta
58. bm banida recuperar
59. business manager bloqueado
60. business manager verificado
61. business manager comprar
62. business manager ilimitado
63. business manager com limite alto
64. bm com limite alto
65. bm sem limite
66. bm gastos altos
67. bm alta qualidade
68. bm antiga
69. bm envelhecida
70. bm aquecida
71. conta antiga facebook ads
72. conta envelhecida facebook ads
73. conta aquecida meta ads
74. perfil facebook para bm
75. perfil aquecido facebook
76. perfil antigo facebook anúncios
77. página antiga facebook
78. página facebook para anúncios
79. página verificada facebook comprar
80. estrutura para tráfego pago
81. estrutura anti bloqueio meta ads
82. estrutura contingência facebook
83. escalar facebook ads
84. escalar meta ads
85. escalar tráfego pago
86. lateralização de contas facebook
87. reposição de bm
88. reposição de conta de anúncio
89. gestor de tráfego contingência
90. agência de tráfego pago
91. serviços meta ads
92. serviços facebook ads
93. proxy para facebook ads
94. multilogin para facebook ads
95. anti detect facebook ads
96. tráfego pago escala
97. tráfego pago black
98. tráfego pago contingência
99. marketplace de contas de anúncio
100. marketplace bm verificada

## Implementação (uma edição, um arquivo)

- Definir `const SEO_KEYWORDS: string[] = [...]` no topo do arquivo.
- Renderizar `<section className="sr-only" aria-hidden="true">` com `<h2>SEO</h2>` e uma `<ul>` iterando `SEO_KEYWORDS`.
- Posicionar logo antes do bloco Legal (linha ~114 no arquivo atual).

Sem mudanças em rotas, estilos globais, tracking ou lógica.
