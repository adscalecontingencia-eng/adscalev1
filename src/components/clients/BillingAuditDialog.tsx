import React from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { BillingAudit, AuditWeekStatus } from '@/lib/billing-status';
import { AlertTriangle, CheckCircle, CircleDot, Gift, Wallet, Info, ChevronDown } from 'lucide-react';

const fmt = (v: number) => v.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

const STATUS_META: Record<AuditWeekStatus, { label: string; cls: string; icon: React.ReactNode }> = {
  liquidada: { label: 'Liquidada', cls: 'bg-success/15 text-success border-success/30', icon: <CheckCircle size={11} /> },
  paga:      { label: 'Paga',      cls: 'bg-success/15 text-success border-success/30', icon: <CheckCircle size={11} /> },
  creditada: { label: 'Creditada', cls: 'bg-primary/15 text-primary border-primary/30', icon: <Gift size={11} /> },
  pendente:  { label: 'Pendente',  cls: 'bg-warning/15 text-warning border-warning/30', icon: <CircleDot size={11} /> },
  atrasada:  { label: 'Atrasada',  cls: 'bg-destructive/15 text-destructive border-destructive/30', icon: <AlertTriangle size={11} /> },
};

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  clientName: string;
  audit: BillingAudit | null;
}

const KpiCard: React.FC<{ label: string; value: string; tone?: 'default'|'success'|'warning'|'destructive'|'primary'; hint?: string }>
= ({ label, value, tone = 'default', hint }) => {
  const toneCls = {
    default: 'text-foreground border-border',
    success: 'text-success border-success/30 bg-success/5',
    warning: 'text-warning border-warning/30 bg-warning/5',
    destructive: 'text-destructive border-destructive/30 bg-destructive/5',
    primary: 'text-primary border-primary/30 bg-primary/5',
  }[tone];
  return (
    <div className={cn('rounded-lg border p-3', toneCls)}>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn('text-lg font-bold font-display mt-1')}>{value}</div>
      {hint && <div className="text-[10px] text-muted-foreground/80 mt-0.5">{hint}</div>}
    </div>
  );
};

export const BillingAuditDialog: React.FC<Props> = ({ open, onOpenChange, clientName, audit }) => {
  const [expandedWeek, setExpandedWeek] = React.useState<number | null>(null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet size={18} className="text-primary" /> Auditoria de Cobrança — {clientName}
          </DialogTitle>
          <DialogDescription>
            Rastreamento semana a semana de como o crédito do plano e os pagamentos validados
            (FIFO — mais antigo primeiro) formam os totais de <strong>Saldo Pendente</strong>,{' '}
            <strong>Saldo Acumulado</strong> e <strong>Saldo Atrasado</strong>.
          </DialogDescription>
        </DialogHeader>

        {!audit ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Sem dados de gasto para auditar.</p>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <KpiCard label="Comissão Bruta" value={fmt(audit.grossTotal)} hint="Soma de todas as semanas (gasto × %)" />
              <KpiCard label="Crédito do Plano" value={fmt(audit.planCredit)} tone="primary" hint={`Usado ${fmt(audit.creditUsed)} · Restante ${fmt(audit.creditRemaining)}`} />
              <KpiCard label="Pagamentos Validados" value={fmt(audit.totalPaid)} tone="success" hint={`Alocado ${fmt(audit.paidUsed)} · Sobra ${fmt(audit.paidRemaining)}`} />
              <KpiCard
                label="Aberto Total"
                value={fmt(audit.currentPending + audit.overdue)}
                tone={audit.overdue > 0 ? 'destructive' : audit.currentPending > 0 ? 'warning' : 'success'}
                hint={`Pendente ${fmt(audit.currentPending)} · Atrasado ${fmt(audit.overdue)}`}
              />
            </div>

            <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground flex gap-2">
              <Info size={14} className="text-primary shrink-0 mt-0.5" />
              <div>
                <strong className="text-foreground">Regra:</strong> semana <strong>sexta → quinta</strong>{' '}
                (fecha na quinta, vence na sexta seguinte). Aplicamos primeiro o <strong>crédito do plano</strong>,
                depois os <strong>pagamentos validados</strong>, da semana mais antiga para a mais nova. O que sobra
                por semana vira <span className="text-warning">Pendente</span> (semana corrente) ou{' '}
                <span className="text-destructive">Atrasado</span> (vencimento já passou).
              </div>
            </div>

            <div className="mt-4 rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-secondary/40">
                    <TableHead className="text-[10px] uppercase">Semana (sex→qui)</TableHead>
                    <TableHead className="text-[10px] uppercase">Vence</TableHead>
                    <TableHead className="text-[10px] uppercase text-right">Gasto</TableHead>
                    <TableHead className="text-[10px] uppercase text-right">Comissão</TableHead>
                    <TableHead className="text-[10px] uppercase text-right">Crédito</TableHead>
                    <TableHead className="text-[10px] uppercase text-right">Pago</TableHead>
                    <TableHead className="text-[10px] uppercase text-right">Restante</TableHead>
                    <TableHead className="text-[10px] uppercase">Status</TableHead>
                    <TableHead className="text-[10px] uppercase text-right">Contas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {audit.weeks.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-6 text-sm">
                        Nenhuma semana com comissão registrada.
                      </TableCell>
                    </TableRow>
                  )}
                  {audit.weeks.map((w, idx) => {
                    const meta = STATUS_META[w.status];
                    return (
                      <React.Fragment key={idx}>
                      <TableRow className="text-xs">
                        <TableCell className="whitespace-nowrap font-medium">
                          {format(w.weekStart, 'dd/MM', { locale: ptBR })} → {format(new Date(w.weekStart.getTime() + 6*86400000), 'dd/MM/yy', { locale: ptBR })}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-muted-foreground">
                          {format(w.dueDate, 'dd/MM/yy', { locale: ptBR })}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{fmt(w.spend)}</TableCell>
                        <TableCell className="text-right tabular-nums font-semibold">{fmt(w.grossCommission)}</TableCell>
                        <TableCell className={cn('text-right tabular-nums', w.creditApplied > 0 && 'text-primary')}>
                          {w.creditApplied > 0 ? `− ${fmt(w.creditApplied)}` : '—'}
                        </TableCell>
                        <TableCell className={cn('text-right tabular-nums', w.paidApplied > 0 && 'text-success')}>
                          {w.paidApplied > 0 ? `− ${fmt(w.paidApplied)}` : '—'}
                        </TableCell>
                        <TableCell className={cn(
                          'text-right tabular-nums font-bold',
                          w.remaining > 0 && w.status === 'atrasada' && 'text-destructive',
                          w.remaining > 0 && w.status === 'pendente' && 'text-warning',
                          w.remaining <= 0 && 'text-success',
                        )}>
                          {fmt(w.remaining)}
                        </TableCell>
                        <TableCell>
                          <span className={cn('inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-md border font-medium', meta.cls)}>
                            {meta.icon}{meta.label}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          {w.accounts?.length ? (
                            <button
                              onClick={() => setExpandedWeek(expandedWeek === idx ? null : idx)}
                              className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline"
                            >
                              {w.accounts.length} contas
                              <ChevronDown size={11} className={cn('transition-transform', expandedWeek === idx && 'rotate-180')} />
                            </button>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                      {expandedWeek === idx && w.accounts?.length ? (
                        <TableRow className="bg-secondary/20">
                          <TableCell colSpan={9} className="p-0">
                            <div className="p-3">
                              <div className="flex items-center justify-between gap-3 mb-2">
                                <div>
                                  <p className="text-[10px] uppercase tracking-wider text-primary font-semibold">Gasto direto por conta Meta</p>
                                  <p className="text-[11px] text-muted-foreground">Soma dos insights sincronizados no período da semana selecionada.</p>
                                </div>
                                <div className="text-right text-[11px]">
                                  <span className="text-muted-foreground">Total Meta</span>
                                  <div className="font-bold text-foreground">{fmt(w.accounts.reduce((s, a) => s + a.spend, 0))}</div>
                                </div>
                              </div>
                              <div className="max-h-64 overflow-y-auto rounded-md border border-border">
                                <Table>
                                  <TableHeader>
                                    <TableRow className="bg-background/40">
                                      <TableHead className="text-[10px] uppercase">Conta</TableHead>
                                      <TableHead className="text-[10px] uppercase">ID Meta</TableHead>
                                      <TableHead className="text-[10px] uppercase text-right">Gasto</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {w.accounts.map(account => (
                                      <TableRow key={account.id} className="text-xs">
                                        <TableCell className="font-medium">{account.name}</TableCell>
                                        <TableCell className="font-mono text-[11px] text-muted-foreground">{account.metaAccountId}</TableCell>
                                        <TableCell className="text-right tabular-nums font-semibold">{fmt(account.spend)}</TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : null}
                      </React.Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div className="rounded-lg border border-warning/30 bg-warning/5 p-3">
                <div className="text-[10px] uppercase tracking-wider text-warning mb-1">Saldo Pendente</div>
                <div className="font-display text-lg font-bold text-warning">{fmt(audit.currentPending)}</div>
                <div className="text-muted-foreground mt-1">Semana corrente ainda não vencida. Vence na próxima sexta.</div>
              </div>
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
                <div className="text-[10px] uppercase tracking-wider text-primary mb-1">Saldo Acumulado</div>
                <div className="font-display text-lg font-bold text-primary">{fmt(audit.currentPending)}</div>
                <div className="text-muted-foreground mt-1">Total ainda em aberto da semana corrente (após crédito e pagamentos FIFO).</div>
              </div>
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                <div className="text-[10px] uppercase tracking-wider text-destructive mb-1">Saldo Atrasado</div>
                <div className="font-display text-lg font-bold text-destructive">{fmt(audit.overdue)}</div>
                <div className="text-muted-foreground mt-1">Semanas cuja sexta-feira de cobrança já venceu e ainda têm saldo.</div>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default BillingAuditDialog;
