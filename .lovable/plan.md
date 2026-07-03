## Objetivo
Corrigir definitivamente o cálculo do **Saldo Atrasado** da semana **26/06 → 02/07**, garantindo que o gasto venha diretamente dos insights sincronizados das contas de anúncio Meta e que, a partir de **03/07 00:00**, o valor fique em **Saldo Atrasado**, não em **Saldo Acumulado**.

## Diagnóstico atual
- Para o cliente **emerson**, o gasto direto registrado por conta de anúncio no período **26/06→02/07** soma **$35,066.66** em **23 contas com gasto**.
- Pela regra de tiers cadastrada, esse gasto cai no tier de **4%**, gerando comissão de **$1,402.67** para essa semana.
- O problema persistente está em haver múltiplos caminhos de cálculo/visualização: card admin, dashboard do cliente, aba de contas e dashboard Ads. Alguns ainda podem mostrar semana aberta, valor bruto ou período errado como acumulado.

## Plano de correção
1. **Centralizar o cálculo oficial da semana de cobrança**
   - Criar/usar uma única função para definir semana de cobrança: sexta→quinta.
   - Para o período fechado exibido em cobrança, usar sempre **última semana fechada**.
   - Para vencimento, usar sempre **sexta seguinte às 00:00**.

2. **Recalcular saldo direto dos insights Meta por conta de anúncio**
   - No cálculo de cobrança, somar `meta_ad_insights.spend` por `ad_account_id` no período **26/06→02/07** respeitando `effective_from/effective_to` da atribuição da conta ao cliente.
   - Não usar valores antigos/manuais de `commissions` como fonte do gasto da semana quando existir insight Meta.
   - Aplicar o tier correto sobre o gasto total semanal do cliente, não por conta isolada.

3. **Separar corretamente acumulado vs atrasado**
   - Semana cujo vencimento já chegou: entrar apenas em **Saldo Atrasado**.
   - Semana ainda não vencida: entrar em **Saldo Acumulado/pendente**.
   - Pagamentos e crédito continuam abatendo FIFO da dívida mais antiga primeiro.

4. **Atualizar todas as telas que mostram esse valor**
   - Carteira de Clientes/admin.
   - Card individual do cliente.
   - Auditoria de cálculo.
   - Dashboard do cliente, aba Cobranças.
   - Aba Estrutura/contas de anúncio e dashboard Ads quando selecionarem semana de cobrança.

5. **Adicionar auditoria por conta de anúncio para conferência**
   - No botão **Auditar cálculo**, incluir breakdown da semana **26/06→02/07** por conta de anúncio: nome/ID da conta, gasto, período considerado e total.
   - Mostrar no topo o total Meta do período e a comissão aplicada.
   - Isso facilita comparar com o Meta Ads sem depender só do total agregado.

6. **Validação antes de finalizar**
   - Conferir via banco o total do período 26/06→02/07.
   - Conferir no código que não restou nenhum cálculo manual divergente de vencimento (`setDate(+7)`, comparação `>` em vez de `>=`, semana atual aberta como cobrança fechada).
   - Validar que emerson e Vasconcelos aparecem com a semana vencida em **Saldo Atrasado** quando há saldo aberto.

## Resultado esperado
- O período **26/06→02/07** não aparece mais como acumulado após 03/07.
- O valor do gasto semanal passa a bater com a soma direta das contas de anúncio sincronizadas da Meta.
- A auditoria mostra exatamente quais contas compõem o total, tornando o erro monitorável e fácil de conferir.