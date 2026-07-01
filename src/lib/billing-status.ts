import { addDays } from 'date-fns';

export interface WeeklyRow {
  weekStart: Date;
  spend: number;
  commission: number;
}

export interface PaymentRow {
  date: string | Date;
  amount: number;
}

/**
 * Divide o saldo não pago entre:
 *  - overdue (atrasado): semanas cuja sexta-feira de cobrança já passou
 *  - currentPending (saldo pendente): semana corrente que ainda não venceu
 *
 * Aplica plan_credit e pagamentos no estilo FIFO, da semana mais antiga p/ a mais nova.
 *
 * Convenção de semana usada no projeto: week starts on Friday (weekStartsOn: 5),
 * portanto weekStart é uma sexta-feira. A semana vai de sexta a quinta (fecha quinta).
 * Vencimento = sexta da semana seguinte (= weekStart + 7 dias) — "fecha na quinta, paga na sexta".
 */
export function splitOverdueVsCurrent(
  weeks: WeeklyRow[],
  planCredit: number,
  totalPaid: number,
  now: Date = new Date(),
  planCreditStartDate?: string | null,
  paidRows?: PaymentRow[],
): {
  overdue: number;
  currentPending: number;
  weeksOverdue: WeeklyRow[];
  weeksCurrent: WeeklyRow[];
} {
  const sorted = [...weeks].sort((a, b) => a.weekStart.getTime() - b.weekStart.getTime());
  let credit = Math.max(0, planCredit);
  let paid = Math.max(0, totalPaid);
  // Pagamento validado sempre liquida a dívida mais antiga primeiro (FIFO).
  // Antes, o pagamento era preso à semana anterior à data de validação; ao
  // recarregar, valores pequenos voltavam para "atrasado" mesmo com pagamento
  // suficiente registrado. O saldo atrasado deve olhar o caixa total validado.
  if (paidRows?.length) {
    paid = paidRows.reduce((sum, payment) => sum + Math.max(0, Number(payment.amount || 0)), 0);
  }
  let overdue = 0;
  let currentPending = 0;
  const weeksOverdue: WeeklyRow[] = [];
  const weeksCurrent: WeeklyRow[] = [];

  // Regra do produto: se o cliente possui crédito disponível, ele deve abater
  // o saldo devido (inclusive semanas já vencidas) ANTES de marcar como
  // atrasado. Aplicamos crédito FIFO em todas as semanas, ignorando a data
  // de início do crédito — o objetivo é nunca exibir "atrasado" enquanto
  // houver saldo de crédito que cubra a dívida.
  const startTs = 0;
  void planCreditStartDate;

  for (const w of sorted) {
    let owe = w.commission;
    if (owe <= 0) continue;
    const creditEligible = w.weekStart.getTime() >= startTs;
    const applyCredit = creditEligible ? Math.min(credit, owe) : 0;
    credit -= applyCredit;
    owe -= applyCredit;
    const applyPaid = Math.min(paid, owe);
    paid -= applyPaid;
    owe -= applyPaid;
    if (owe <= 0.0001) continue;

    const dueDate = addDays(w.weekStart, 7); // sexta-feira seguinte (após o fechamento na quinta)
    if (now.getTime() > dueDate.getTime()) {
      overdue += owe;
      weeksOverdue.push({ ...w, commission: owe });
    } else {
      currentPending += owe;
      weeksCurrent.push({ ...w, commission: owe });
    }
  }

  return { overdue, currentPending, weeksOverdue, weeksCurrent };
}
