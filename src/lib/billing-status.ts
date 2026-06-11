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

  // Crédito só pode ser aplicado a partir da data definida manualmente
  // (plan_credit_start_date). Sem isso, este split divergia do painel
  // "Comissões Pendentes por Semana", que já respeita essa data.
  let startTs = 0;
  if (planCreditStartDate) {
    const [y, m, d] = planCreditStartDate.split('-').map(Number);
    startTs = new Date(y, (m || 1) - 1, d || 1).getTime();
  }

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
