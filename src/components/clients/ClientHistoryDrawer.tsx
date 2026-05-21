import React, { useMemo, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Pencil, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { parseDateLocal, formatDateBR } from '@/lib/date-utils';

interface Commission {
  id: string;
  clientId: string;
  date: string;
  amount: number;
  adSpend: number;
  type: 'daily' | 'paid' | 'weekly_billing';
  note?: string;
  status?: string;
  valorPago?: number;
  valorPendente?: number;
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  clientName: string;
  commissions: Commission[];
  onEdit: (c: Commission) => void;
  onDelete: (id: string) => void;
}

const fmt = (v: number) => v.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

const Row: React.FC<{
  comm: Commission;
  onEdit: (c: Commission) => void;
  onDelete: (id: string) => void;
}> = ({ comm, onEdit, onDelete }) => {
  const dotColor =
    comm.type === 'daily' ? 'bg-primary' : comm.type === 'paid' ? 'bg-success' : 'bg-warning';
  const label =
    comm.type === 'daily' ? 'Gasto em Ads' : comm.type === 'paid' ? 'Pagamento' : 'Cobrança Semanal';
  const amountClass =
    comm.type === 'daily' ? 'text-primary' : comm.type === 'paid' ? 'text-success' : 'text-warning';

  return (
    <div className="flex items-center justify-between rounded-lg px-3 py-2.5 text-xs bg-card border border-border">
      <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
        <span className={cn('w-2 h-2 rounded-full shrink-0', dotColor)} />
        <span className="text-muted-foreground whitespace-nowrap">{formatDateBR(comm.date)}</span>
        <span className="text-foreground/90 whitespace-nowrap">{label}</span>
        {comm.type === 'daily' && comm.adSpend > 0 && (
          <span className="text-muted-foreground">(Ads {fmt(comm.adSpend)})</span>
        )}
        {(comm.type === 'daily' || comm.type === 'weekly_billing') && comm.status && (
          <span
            className={cn(
              'px-1.5 py-0.5 rounded text-[10px] font-medium',
              comm.status === 'pago'
                ? 'bg-success/10 text-success'
                : comm.status === 'parcial'
                ? 'bg-warning/10 text-warning'
                : 'bg-muted text-muted-foreground'
            )}
          >
            {comm.status === 'pago' ? 'Pago' : comm.status === 'parcial' ? 'Parcial' : 'Pendente'}
          </span>
        )}
        {comm.note && <span className="text-muted-foreground italic truncate">— {comm.note}</span>}
      </div>
      <div className="flex items-center gap-1 shrink-0 ml-2">
        <span className={cn('font-semibold mr-1', amountClass)}>
          {comm.type === 'paid' ? '-' : '+'}
          {fmt(comm.amount)}
        </span>
        <button
          onClick={() => onEdit(comm)}
          className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground"
          title="Editar"
        >
          <Pencil size={12} />
        </button>
        <button
          onClick={() => onDelete(comm.id)}
          className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
          title="Remover"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
};

const Empty: React.FC<{ label: string }> = ({ label }) => (
  <p className="text-xs text-muted-foreground text-center py-8">{label}</p>
);

export const ClientHistoryDrawer: React.FC<Props> = ({
  open,
  onOpenChange,
  clientName,
  commissions,
  onEdit,
  onDelete,
}) => {
  const [tab, setTab] = useState<'all' | 'daily' | 'weekly' | 'paid'>('all');

  const sorted = useMemo(
    () => [...commissions].sort((a, b) => parseDateLocal(b.date).getTime() - parseDateLocal(a.date).getTime()),
    [commissions]
  );

  const filtered = useMemo(() => {
    if (tab === 'all') return sorted;
    if (tab === 'daily') return sorted.filter((c) => c.type === 'daily');
    if (tab === 'weekly') return sorted.filter((c) => c.type === 'weekly_billing');
    return sorted.filter((c) => c.type === 'paid');
  }, [sorted, tab]);

  const totals = useMemo(() => {
    const adSpend = sorted.filter((c) => c.type === 'daily').reduce((s, c) => s + c.adSpend, 0);
    const commission = sorted
      .filter((c) => c.type === 'daily' || c.type === 'weekly_billing')
      .reduce((s, c) => s + c.amount, 0);
    const paid = sorted.filter((c) => c.type === 'paid').reduce((s, c) => s + c.amount, 0);
    return { adSpend, commission, paid, balance: commission - paid };
  }, [sorted]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl flex flex-col p-0">
        <SheetHeader className="p-5 border-b border-border">
          <SheetTitle className="font-display">{clientName}</SheetTitle>
          <SheetDescription className="text-xs">
            Histórico completo de lançamentos, cobranças e pagamentos.
          </SheetDescription>
        </SheetHeader>

        <div className="grid grid-cols-4 gap-2 p-4 border-b border-border bg-secondary/30">
          <div>
            <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Ads</p>
            <p className="text-xs font-bold">{fmt(totals.adSpend)}</p>
          </div>
          <div>
            <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Comissão</p>
            <p className="text-xs font-bold text-primary">{fmt(totals.commission)}</p>
          </div>
          <div>
            <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Paga</p>
            <p className="text-xs font-bold text-success">{fmt(totals.paid)}</p>
          </div>
          <div>
            <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Saldo</p>
            <p className={cn('text-xs font-bold', totals.balance > 0 ? 'text-warning' : 'text-success')}>
              {fmt(Math.max(0, totals.balance))}
            </p>
          </div>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="flex-1 flex flex-col min-h-0">
          <TabsList className="mx-4 mt-3">
            <TabsTrigger value="all">Todos ({sorted.length})</TabsTrigger>
            <TabsTrigger value="daily">Lançamentos</TabsTrigger>
            <TabsTrigger value="weekly">Cobranças</TabsTrigger>
            <TabsTrigger value="paid">Pagamentos</TabsTrigger>
          </TabsList>

          <TabsContent value={tab} className="flex-1 overflow-y-auto p-4 space-y-1.5 mt-0">
            {filtered.length === 0 ? (
              <Empty label="Nenhum lançamento encontrado." />
            ) : (
              filtered.map((c) => <Row key={c.id} comm={c} onEdit={onEdit} onDelete={onDelete} />)
            )}
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
};

export default ClientHistoryDrawer;
