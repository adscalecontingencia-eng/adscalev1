## Problema identificado

`splitOverdueVsCurrent` (em `src/lib/billing-status.ts`) limita cada pagamento à semana exatamente anterior à sua data (`weekStart - 7d`). Quando você valida um pagamento que cobre dívidas antigas, o excedente NÃO sobra para liquidar semanas mais antigas — fica preso na semana-alvo daquele pagamento, e o restante aparece como **Saldo Atrasado** mesmo após a baixa total.

Conferi os dados do Roberto (`00e80ef4-89bc-4345-b48d-76acf06b3f25`):
- Pagamentos: `2026-06-20` (US$ 133,02 → liquida semana 06-12) e `2026-06-27` (US$ 283,90 → liquida semana 06-19).
- Gasto Meta por semana fiscal (sex→qui): 04-24, 05-01, **06-05**, 06-12, 06-19, 06-26.
- A semana **2026-06-05** ficou sem pagamento correspondente, mesmo o cliente tendo quitado o total. As linhas em `commissions` já estão todas `pago`, mas o admin recalcula via insights e não roleia o excedente → mostra atrasado.

## Correção

### 1. `src/lib/billing-status.ts` — pool FIFO de pagamentos
Substituir a aplicação por-semana por um pool acumulado:
- Construir lista `[{ targetWeek, amount }]` ordenada por `targetWeek`.
- Ao iterar as semanas (mais antiga → mais nova), acumular no pool todos os pagamentos cuja `targetWeek ≤ semana atual` (não permite pagamento de semana futura).
- Para cada semana: aplica crédito do plano FIFO, depois consome do pool FIFO. Excedente continua disponível para a próxima semana.
- Mantém regra de vencimento (sexta seguinte) e comportamento legado quando `paidRows` não é fornecido.

Isso elimina o "saldo atrasado fantasma" para qualquer cliente cujo total pago ≥ comissão devida, e não muda o cálculo para quem realmente está em atraso.

### 2. Zerar o saldo atrasado do Roberto
A correção acima já zera o atrasado dele automaticamente (pagamentos cobrem 100% da dívida com sobra para 06-05). Nenhum dado precisa ser editado: as `commissions` dele já estão `pago`/`valor_pendente=0`. Após o deploy, o painel admin vai refletir corretamente.

Se preferir uma "trava" no banco para garantir consistência mesmo se algum cálculo futuro divergir, posso (opcional, sob confirmação) inserir um pagamento de ajuste/observação — mas não recomendo, pois duplicaria histórico.

## Validação
- Rodar `tsgo` para garantir tipos.
- Verificar manualmente no `/clientes` que Roberto fica com **Saldo Atrasado = 0**.
- Confirmar que clientes que de fato têm dívida em aberto continuam exibindo atrasado (ex.: qualquer cliente sem pagamentos recentes).

## Escopo do que será alterado
- `src/lib/billing-status.ts` — única função afetada (`splitOverdueVsCurrent`).
- Nenhuma migration, nenhuma alteração em `ClientDashboard.tsx` / `Clients.tsx` (eles só consomem a função).