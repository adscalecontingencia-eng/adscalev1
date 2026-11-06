import { describe, it, expect } from 'vitest';
import { effectiveStatus, reportRows, accountBalances, openItems } from './finance-ledger';

const now = new Date(2026, 10, 6); // 06/11/2026

describe('finance-ledger', () => {
  it('pendente com vencimento passado vira atrasado', () => {
    expect(effectiveStatus({ status: 'pendente', due_date: '2026-11-05' }, now)).toBe('atrasado');
    expect(effectiveStatus({ status: 'pendente', due_date: '2026-11-06' }, now)).toBe('pendente');
    expect(effectiveStatus({ status: 'confirmado', due_date: '2026-11-01' }, now)).toBe('confirmado');
  });

  it('relatórios somam só Pago/Recebido e ignoram transferências', () => {
    const rows = reportRows([
      { id: 'a', type: 'receita', status: 'confirmado', amount: 100, date: '2026-11-01' },
      { id: 'b', type: 'receita', status: 'pendente', amount: 50, date: '2026-11-01' },
      { id: 'c', type: 'gasto', status: 'cancelado', amount: 30, date: '2026-11-01' },
      { id: 'd', type: 'transferencia', status: 'confirmado', amount: 999, date: '2026-11-01' },
    ]);
    expect(rows.map(r => r.id)).toEqual(['a']);
  });

  it('estorno abate a receita do lançamento original', () => {
    const rows = reportRows([
      { id: 'a', type: 'receita', status: 'confirmado', amount: 100, date: '2026-11-01', category: 'X' },
      { id: 'e', type: 'estorno', status: 'confirmado', amount: 40, date: '2026-11-02', related_transaction_id: 'a' },
    ]);
    const receita = rows.filter(r => r.type === 'receita').reduce((s, r) => s + Number(r.amount), 0);
    expect(receita).toBe(60);
  });

  it('saldo da conta = inicial + recebidos − pagos, transferência move entre contas', () => {
    const bal = accountBalances(
      [{ id: 'c1', initial_balance: 1000 }, { id: 'c2', initial_balance: 0 }],
      [
        { id: '1', type: 'receita', status: 'confirmado', amount: 500, date: '', account_id: 'c1' },
        { id: '2', type: 'gasto', status: 'confirmado', amount: 200, date: '', account_id: 'c1' },
        { id: '3', type: 'gasto', status: 'pendente', amount: 300, date: '', account_id: 'c1' },
        { id: '4', type: 'transferencia', status: 'confirmado', amount: 100, date: '', account_id: 'c1', destination_account_id: 'c2' },
        { id: '5', type: 'reembolso', status: 'confirmado', amount: 50, date: '', account_id: 'c1', related_transaction_id: '2' },
      ],
    );
    expect(bal).toEqual({ c1: 1250, c2: 100 });
  });

  it('contas a pagar lista gastos pendentes e próximos 7 dias', () => {
    const r = openItems([
      { id: '1', type: 'gasto', status: 'pendente', amount: 10, date: '2026-11-01', due_date: '2026-11-10' },
      { id: '2', type: 'gasto', status: 'pendente', amount: 20, date: '2026-11-01', due_date: '2026-11-30' },
      { id: '3', type: 'receita', status: 'pendente', amount: 99, date: '2026-11-01', due_date: '2026-11-08' },
      { id: '4', type: 'gasto', status: 'confirmado', amount: 5, date: '2026-11-01' },
    ], 'pagar', now);
    expect(r.total).toBe(30);
    expect(r.next7Total).toBe(10);
  });
});
