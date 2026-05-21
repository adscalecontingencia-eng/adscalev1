import { addDays } from 'date-fns';

export interface WeeklyRow {
  weekStart: Date;
  spend: number;
  commission: number;
}

/**
 * Divide o saldo não pago entre:
 *  - overdue (atrasado): semanas cuja sexta-feira de cobrança já passou
 *  - currentPending (saldo pendente): semana corrente que ainda não venceu
 *
 * Aplica plan_credit e pagamentos no estilo FIFO, da semana mais antiga p/ a mais nova.
 *
 * Convenção de semana usada no projeto: week starts on Thursday (weekStartsOn: 4),
 * portanto weekStart é uma quinta-feira. Vencimento = sexta da semana seguinte
 * (= weekStart + 8 dias) — "fecha na quinta, paga na sexta".
 */
export function splitOverdueVsCurrent(
  weeks: WeeklyRow[],
  planCredit: number,
  totalPaid: number,
  now: Date = new Date(),
): {
  overdue: number;
  currentPending: number;
  weeksOverdue: WeeklyRow[];
  weeksCurrent: WeeklyRow[];
} {
  const sorted = [...weeks].sort((a, b) => a.weekStart.getTime() - b.weekStart.getTime());
  let credit = Math.max(0, planCredit);
  let paid = Math.max(0, totalPaid);
  let overdue = 0;
  let currentPending = 0;
  const weeksOverdue: WeeklyRow[] = [];
  const weeksCurrent: WeeklyRow[] = [];

  for (const w of sorted) {
    let owe = w.commission;
    if (owe <= 0) continue;
    const applyCredit = Math.min(credit, owe);
    credit -= applyCredit;
    owe -= applyCredit;
    const applyPaid = Math.min(paid, owe);
    paid -= applyPaid;
    owe -= applyPaid;
    if (owe <= 0.0001) continue;

    const dueDate = addDays(w.weekStart, 8); // sexta-feira após o fechamento
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
