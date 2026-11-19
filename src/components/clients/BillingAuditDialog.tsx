import React from 'react';
import { tr } from '@/i18n';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { BillingAudit, AuditWeekStatus } from '@/lib/billing-status';
import { AlertTriangle, CheckCircle, CircleDot, Gift, Wallet, Info, ChevronDown } from 'lucide-react';

const fmt = (v: number) => v.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

const STATUS_META: Record<AuditWeekStatus, { label: string; cls: string; icon: React.ReactNode }> = {
  liquidada: { get label() { return tr('admin.audit.st.liquidada'); }, cls: 'bg-success/15 text-success border-success/30', icon: <CheckCircle size={11} /> },
  paga:      { get label() { return tr('admin.audit.st.paga'); }, cls: 'bg-success/15 text-success border-success/30', icon: <CheckCircle size={11} /> },
  creditada: { get label() { return tr('admin.audit.st.creditada'); }, cls: 'bg-primary/15 text-primary border-primary/30', icon: <Gift size={11} /> },
  pendente:  { get label() { return tr('admin.audit.st.pendente'); }, cls: 'bg-warning/15 text-warning border-warning/30', icon: <CircleDot size={11} /> },
  atrasada:  { get label() { return tr('admin.audit.st.atrasada'); }, cls: 'bg-destructive/15 text-destructive border-destructive/30', icon: <AlertTriangle size={11} /> },
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
            <Wallet size={18} className="text-primary" /> {tr('admin.audit.title', { name: clientName })}
          </DialogTitle>
          <DialogDescription>
            <span dangerouslySetInnerHTML={{ __html: tr('admin.audit.desc') }} />
          </DialogDescription>
        </DialogHeader>

        {!audit ? (
          <p className="text-sm text-muted-foreground py-8 text-center">{tr('admin.audit.noData')}</p>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <KpiCard label={tr('admin.audit.gross')} value={fmt(audit.grossTotal)} hint={tr('admin.audit.grossHint')} />
              <KpiCard label={tr('admin.audit.planCredit')} value={fmt(audit.planCredit)} tone="primary" hint={tr('admin.audit.creditHint', { used: fmt(audit.creditUsed), left: fmt(audit.creditRemaining) })} />
              <KpiCard label={tr('admin.audit.validated')} value={fmt(audit.totalPaid)} tone="success" hint={tr('admin.audit.paidHint', { used: fmt(audit.paidUsed), left: fmt(audit.paidRemaining) })} />
              <KpiCard
                label={tr('admin.audit.openTotal')}
                value={fmt(audit.currentPending + audit.overdue)}
                tone={audit.overdue > 0 ? 'destructive' : audit.currentPending > 0 ? 'warning' : 'success'}
                hint={tr('admin.audit.openHint', { p: fmt(audit.currentPending), o: fmt(audit.overdue) })}
              />
            </div>

            <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground flex gap-2">
              <Info size={14} className="text-primary shrink-0 mt-0.5" />
              <div>
                <span dangerouslySetInnerHTML={{ __html: tr('admin.audit.rule') }} />
              </div>
            </div>

            <div className="mt-4 rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-secondary/40">
                    <TableHead className="text-[10px] uppercase">{tr('admin.audit.th.week')}</TableHead>
                    <TableHead className="text-[10px] uppercase">{tr('admin.audit.th.due')}</TableHead>
                    <TableHead className="text-[10px] uppercase text-right">{tr('admin.audit.th.spend')}</TableHead>
                    <TableHead className="text-[10px] uppercase text-right">{tr('admin.audit.th.comm')}</TableHead>
                    <TableHead className="text-[10px] uppercase text-right">{tr('admin.audit.th.credit')}</TableHead>
                    <TableHead className="text-[10px] uppercase text-right">{tr('admin.audit.th.paid')}</TableHead>
                    <TableHead className="text-[10px] uppercase text-right">{tr('admin.audit.th.left')}</TableHead>
                    <TableHead className="text-[10px] uppercase">{tr('admin.audit.th.status')}</TableHead>
                    <TableHead className="text-[10px] uppercase text-right">{tr('admin.audit.th.accounts')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {audit.weeks.length === 0 && (
                    <TableRow>
                        <TableCell colSpan={9} className="text-center text-muted-foreground py-6 text-sm">
                        {tr('admin.audit.noWeeks')}
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
                                  <p className="text-[10px] uppercase tracking-wider text-primary font-semibold">{tr('admin.audit.direct')}</p>
                                  <p className="text-[11px] text-muted-foreground">{tr('admin.audit.directHint')}</p>
                                </div>
                                <div className="text-right text-[11px]">
                                  <span className="text-muted-foreground">{tr('admin.audit.totalMeta')}</span>
                                  <div className="font-bold text-foreground">{fmt(w.accounts.reduce((s, a) => s + a.spend, 0))}</div>
                                </div>
                              </div>
                              <div className="max-h-64 overflow-y-auto rounded-md border border-border">
                                <Table>
                                  <TableHeader>
                                    <TableRow className="bg-background/40">
                                      <TableHead className="text-[10px] uppercase">{tr('admin.audit.th.account')}</TableHead>
                                      <TableHead className="text-[10px] uppercase">{tr('admin.audit.th.metaId')}</TableHead>
                                      <TableHead className="text-[10px] uppercase text-right">{tr('admin.audit.th.spend')}</TableHead>
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
                <div className="text-[10px] uppercase tracking-wider text-warning mb-1">{tr('admin.audit.pendingBal')}</div>
                <div className="font-display text-lg font-bold text-warning">{fmt(audit.currentPending)}</div>
                <div className="text-muted-foreground mt-1">{tr('admin.audit.pendingHint')}</div>
              </div>
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
                <div className="text-[10px] uppercase tracking-wider text-primary mb-1">{tr('admin.card.accumulated')}</div>
                <div className="font-display text-lg font-bold text-primary">{fmt(audit.currentPending)}</div>
                <div className="text-muted-foreground mt-1">{tr('admin.audit.accHint')}</div>
              </div>
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                <div className="text-[10px] uppercase tracking-wider text-destructive mb-1">{tr('admin.card.overdue')}</div>
                <div className="font-display text-lg font-bold text-destructive">{fmt(audit.overdue)}</div>
                <div className="text-muted-foreground mt-1">{tr('admin.audit.overdueHint')}</div>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default BillingAuditDialog;
