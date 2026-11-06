// Regras do Financeiro: status, relatórios (só Pago/Recebido), estornos e saldos de contas.

export type TxType = 'receita' | 'gasto' | 'transferencia' | 'estorno' | 'reembolso';
export type TxStatus = 'pendente' | 'confirmado' | 'atrasado' | 'cancelado';

export interface LedgerTx {
  id: string;
  type: string;
  status?: string | null;
  amount: number | string;
  date: string;
  due_date?: string | null;
  account_id?: string | null;
  destination_account_id?: string | null;
  related_transaction_id?: string | null;
  [k: string]: any;
}

export const STATUS_LABEL: Record<TxStatus, string> = {
  pendente: 'Pendente',
  confirmado: 'Pago/Recebido',
  atrasado: 'Atrasado',
  cancelado: 'Cancelado',
};

export const TYPE_LABEL: Record<TxType, string> = {
  receita: 'Venda/Receita',
  gasto: 'Gasto',
  transferencia: 'Transferência',
  estorno: 'Estorno',
  reembolso: 'Reembolso',
};

export const PAYMENT_METHODS: Record<string, string> = {
  pix: 'Pix',
  cartao_credito: 'Cartão de crédito',
  cartao_debito: 'Cartão de débito',
  boleto: 'Boleto',
  transferencia: 'Transferência bancária',
  cripto: 'Cripto',
  mercado_pago: 'Mercado Pago',
  outro: 'Outro',
};

const todayStr = (now = new Date()) => {
  const y = now.getFullYear(), m = String(now.getMonth() + 1).padStart(2, '0'), d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

/** Status exibido: Pendente com vencimento passado vira Atrasado. */
export function effectiveStatus(t: Pick<LedgerTx, 'status' | 'due_date'>, now = new Date()): TxStatus {
  const s = (t.status || 'confirmado') as TxStatus;
  if (s === 'pendente' && t.due_date && t.due_date < todayStr(now)) return 'atrasado';
  return s;
}

/**
 * Linhas para dashboard/relatórios de resultado:
 * - só Pago/Recebido;
 * - transferências nunca entram;
 * - estorno/reembolso viram valor negativo no tipo (e categoria/cliente) do lançamento original.
 */
export function reportRows<T extends LedgerTx>(all: T[]): T[] {
  const byId = new Map(all.map(t => [t.id, t]));
  const out: T[] = [];
  for (const t of all) {
    if ((t.status || 'confirmado') !== 'confirmado') continue;
    if (t.type === 'receita' || t.type === 'gasto') { out.push(t); continue; }
    if (t.type === 'estorno' || t.type === 'reembolso') {
      const orig = t.related_transaction_id ? byId.get(t.related_transaction_id) : undefined;
      if (!orig || (orig.type !== 'receita' && orig.type !== 'gasto')) continue;
      out.push({
        ...t,
        type: orig.type,
        category: orig.category,
        client_id: orig.client_id,
        amount: -Math.abs(Number(t.amount)),
        custo_produto: 0,
        _adjustment: true,
      } as T);
    }
  }
  return out;
}

/** Saldo atual de cada conta: saldo inicial + entradas pagas − saídas pagas. */
export function accountBalances(
  accounts: { id: string; initial_balance: number | string }[],
  txs: LedgerTx[],
): Record<string, number> {
  const bal: Record<string, number> = {};
  for (const a of accounts) bal[a.id] = Number(a.initial_balance) || 0;
  const byId = new Map(txs.map(t => [t.id, t]));
  const add = (acc: string | null | undefined, v: number) => { if (acc && acc in bal) bal[acc] += v; };
  for (const t of txs) {
    if ((t.status || 'confirmado') !== 'confirmado') continue;
    const v = Math.abs(Number(t.amount)) || 0;
    if (t.type === 'receita') add(t.account_id, v);
    else if (t.type === 'gasto') add(t.account_id, -v);
    else if (t.type === 'transferencia') { add(t.account_id, -v); add(t.destination_account_id, v); }
    else if (t.type === 'estorno' || t.type === 'reembolso') {
      const orig = t.related_transaction_id ? byId.get(t.related_transaction_id) : undefined;
      // Estorno de receita = dinheiro sai; reembolso de gasto = dinheiro volta.
      add(t.account_id, orig?.type === 'gasto' ? v : -v);
    }
  }
  return bal;
}

/** Contas a pagar (gastos) / a receber (receitas) em aberto, com total e próximos 7 dias. */
export function openItems<T extends LedgerTx>(txs: T[], kind: 'pagar' | 'receber', now = new Date()) {
  const type = kind === 'pagar' ? 'gasto' : 'receita';
  const items = txs
    .filter(t => t.type === type && ['pendente', 'atrasado'].includes(effectiveStatus(t, now)))
    .sort((a, b) => (a.due_date || a.date).localeCompare(b.due_date || b.date));
  const today = todayStr(now);
  const limit = new Date(now); limit.setDate(limit.getDate() + 7);
  const in7 = todayStr(limit);
  const next7 = items.filter(t => { const d = t.due_date || t.date; return d >= today && d <= in7; });
  const sum = (l: T[]) => l.reduce((s, t) => s + Math.abs(Number(t.amount) || 0), 0);
  return { items, total: sum(items), next7, next7Total: sum(next7), overdue: items.filter(t => effectiveStatus(t, now) === 'atrasado') };
}
