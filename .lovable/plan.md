## Plano

1. **Corrigir a origem do Saldo Acumulado no admin**
   - Manter “Saldo Atrasado” calculado pela separação de vencimento.
   - Ajustar “Saldo Acumulado” para representar todo o saldo em aberto: atrasado + semana corrente ainda não vencida.
   - Isso corrige o caso do Emerson, onde zerar o atrasado deixou o acumulado subcontabilizado.

2. **Separar claramente os conceitos no cálculo**
   - “Saldo Atrasado” = apenas semanas vencidas após a sexta de cobrança.
   - “Saldo Acumulado” = total pendente em aberto, incluindo atrasado e saldo corrente.
   - O status do cliente continuará usando atrasado primeiro, depois pendente.

3. **Preservar o ajuste anterior de pagamentos**
   - Não desfazer a regra FIFO nem voltar a marcar saldo quitado como atrasado.
   - Não zerar comissões atuais/correntes do Emerson.

4. **Verificar com dados reais**
   - Conferir Emerson no banco antes/depois do cálculo.
   - Validar que o atrasado fica correto sem sumir com o saldo acumulado.
   - Rodar checagem de tipos/teste relevante depois da alteração.