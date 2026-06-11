import { addDays, format, startOfWeek } from 'date-fns';

export interface WeeklyRow {
  weekStart: Date;
  spend: number;
  commission: number;
}

export interface PaymentRow {
  date: string | Date;
  amount: number;
}

const parsePaymentDate = (date: string | Date) => {
  if (date instanceof Date) return date;
  const isoDate = date.slice(0, 10);
  const [y, m, d] = isoDate.split('-').map(Number);
  if (Number.isFinite(y) && Number.isFinite(m) && Number.isFinite(d)) {
    return new Date(y, (m || 1) - 1, d || 1);
  }
  return new Date(date);
};

const getPaidByTargetWeek = (payments: PaymentRow[]) => {
  const paidByWeek = new Map<string, number>();
  payments.forEach(payment => {
    const amount = Math.max(0, Number(payment.amount || 0));
    if (amount <= 0) return;
    // Pagamento validado em uma data liquida a última semana fechada
    // (sexta→quinta), não cria dívida nova nem é redistribuído para semanas futuras.
    const paymentDate = parsePaymentDate(payment.date);
    const currentWeekStart = startOfWeek(paymentDate, { weekStartsOn: 5 });
    const targetWeekStart = addDays(currentWeekStart, -7);
    const key = format(targetWeekStart, 'yyyy-MM-dd');
    paidByWeek.set(key, (paidByWeek.get(key) || 0) + amount);
  });
  return paidByWeek;
};

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
  const paidByWeek = paidRows?.length ? getPaidByTargetWeek(paidRows) : null;
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
    const weekKey = format(w.weekStart, 'yyyy-MM-dd');
    const weeklyPaid = paidByWeek?.get(weekKey) || 0;
    const applyPaid = paidByWeek ? Math.min(weeklyPaid, owe) : Math.min(paid, owe);
    if (!paidByWeek) paid -= applyPaid;
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
