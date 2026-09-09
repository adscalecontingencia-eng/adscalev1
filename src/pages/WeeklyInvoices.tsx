import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { RefreshCw, Play, CheckCircle2, XCircle, Search, Receipt } from 'lucide-react';

type Invoice = {
  id: string;
  client_id: string;
  week_start: string;
  week_end: string;
  amount_usd: number;
  amount_brl: number | null;
  fx_rate: number | null;
  status: string;
  due_date: string | null;
  paid_at: string | null;
  reminders_sent: number;
  ticket_url: string | null;
  clients?: { name: string | null; email: string | null } | null;
};

const fmtDate = (d?: string | null) => {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
};

export default function WeeklyInvoices() {
  const [rows, setRows] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('todas');

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('billing_invoices')
      .select('id, client_id, week_start, week_end, amount_usd, amount_brl, fx_rate, status, due_date, paid_at, reminders_sent, ticket_url, clients(name, email)')
      .order('week_start', { ascending: false })
      .limit(300);
    if (error) toast.error(error.message);
    setRows((data ?? []) as any);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const runGeneration = async (mode: 'generate' | 'reminders') => {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke('billing-generate-invoices', { body: { mode } });
      if (error) throw error;
      const r = data as any;
      toast.success(
        mode === 'generate'
          ? `Faturas geradas: ${r?.generated ?? 0} · ignoradas: ${r?.skipped ?? 0}`
          : `Lembretes enviados: ${r?.reminders ?? 0}`,
      );
      if (r?.errors?.length) toast.warning(`Com erros: ${r.errors.slice(0, 3).join(' | ')}`);
      await load();
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao executar');
    } finally {
      setRunning(false);
    }
  };

  const markPaid = async (inv: Invoice) => {
    if (!confirm(`Marcar a fatura de ${inv.clients?.name ?? ''} (US$ ${Number(inv.amount_usd).toFixed(2)}) como paga?`)) return;
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase
      .from('billing_invoices')
      .update({
        status: 'paga',
        paid_at: new Date().toISOString(),
        marked_paid_by: userData?.user?.id ?? null,
        note: 'Baixa manual pelo painel',
      })
      .eq('id', inv.id);
    if (error) return toast.error(error.message);
    toast.success('Fatura marcada como paga');
    load();
  };

  const cancelInvoice = async (inv: Invoice) => {
    if (!confirm('Cancelar esta fatura?')) return;
    const { error } = await supabase.from('billing_invoices').update({ status: 'cancelada' }).eq('id', inv.id);
    if (error) return toast.error(error.message);
    toast.success('Fatura cancelada');
    load();
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (status !== 'todas' && r.status !== status) return false;
      if (!q) return true;
      return `${r.clients?.name ?? ''} ${r.clients?.email ?? ''}`.toLowerCase().includes(q);
    });
  }, [rows, search, status]);

  const totals = useMemo(() => {
    const t = { charged: 0, paid: 0, overdue: 0 };
    for (const r of filtered) {
      const v = Number(r.amount_usd) || 0;
      if (r.status === 'paga') t.paid += v;
      else if (r.status === 'vencida') t.overdue += v;
      if (['aberta', 'vencida', 'paga'].includes(r.status)) t.charged += v;
    }
    return t;
  }, [filtered]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Receipt className="h-5 w-5 text-primary" /> Faturas semanais
          </h1>
          <p className="text-sm text-muted-foreground">
            Cobranças Pix geradas automaticamente toda sexta-feira com o total em aberto de cada cliente.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} /> Atualizar
          </Button>
          <Button variant="outline" size="sm" onClick={() => runGeneration('reminders')} disabled={running}>
            Enviar lembretes
          </Button>
          <Button size="sm" onClick={() => runGeneration('generate')} disabled={running}>
            <Play className="h-4 w-4 mr-1.5" /> Gerar faturas agora
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: 'Total cobrado', value: totals.charged },
          { label: 'Total recebido', value: totals.paid },
          { label: 'Total vencido', value: totals.overdue },
        ].map((c) => (
          <div key={c.label} className="rounded-2xl border border-border/60 bg-card p-4">
            <p className="text-xs text-muted-foreground">{c.label}</p>
            <p className="text-xl font-bold">${c.value.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar cliente" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            {['todas', 'aberta', 'paga', 'vencida', 'cancelada', 'substituida'].map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-2xl border border-border/60 bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs text-muted-foreground border-b border-border/60">
            <tr>
              <th className="text-left p-3">Cliente</th>
              <th className="text-left p-3">Semana</th>
              <th className="text-right p-3">USD</th>
              <th className="text-right p-3">BRL</th>
              <th className="text-left p-3">Vencimento</th>
              <th className="text-left p-3">Status</th>
              <th className="text-right p-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-b border-border/30">
                <td className="p-3">
                  <p className="font-medium">{r.clients?.name ?? '—'}</p>
                  <p className="text-xs text-muted-foreground">{r.clients?.email ?? ''}</p>
                </td>
                <td className="p-3 whitespace-nowrap">{fmtDate(r.week_start)} — {fmtDate(r.week_end)}</td>
                <td className="p-3 text-right">${Number(r.amount_usd).toFixed(2)}</td>
                <td className="p-3 text-right">{r.amount_brl != null ? `R$ ${Number(r.amount_brl).toFixed(2)}` : '—'}</td>
                <td className="p-3 whitespace-nowrap">{fmtDate(r.due_date)}</td>
                <td className="p-3">
                  <Badge variant={r.status === 'paga' ? 'default' : r.status === 'vencida' ? 'destructive' : 'outline'}>
                    {r.status}
                  </Badge>
                  {r.reminders_sent > 0 && (
                    <span className="ml-2 text-[10px] text-muted-foreground">{r.reminders_sent} lembrete(s)</span>
                  )}
                </td>
                <td className="p-3 text-right whitespace-nowrap">
                  {r.status !== 'paga' && r.status !== 'cancelada' && (
                    <>
                      <Button size="sm" variant="ghost" onClick={() => markPaid(r)}>
                        <CheckCircle2 className="h-4 w-4 mr-1" /> Baixa manual
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => cancelInvoice(r)}>
                        <XCircle className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && !loading && (
              <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Nenhuma fatura encontrada.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
