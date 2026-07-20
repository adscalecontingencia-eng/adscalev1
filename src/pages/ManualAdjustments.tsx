import React, { useEffect, useMemo, useState } from 'react';
import { PageHero } from '@/components/ui-kit';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { History, RefreshCw, Search, Filter } from 'lucide-react';
import { ADJUSTMENT_TYPE_LABELS } from '@/lib/manual-adjustments';

interface Row {
  id: string;
  created_at: string;
  performed_by_email: string | null;
  client_id: string | null;
  client_name: string | null;
  adjustment_type: string;
  ad_account_ids: string[] | null;
  ad_account_names: string[] | null;
  period_start: string | null;
  period_end: string | null;
  previous_value: number | null;
  new_value: number | null;
  delta: number | null;
  reason: string | null;
  metadata: any;
}

const fmtMoney = (v: number | null | undefined) =>
  v === null || v === undefined
    ? '—'
    : v.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

export default function ManualAdjustments() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [type, setType] = useState<string>('all');

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('manual_adjustments')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);
    if (!error) setRows((data as any) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows.filter(r => {
      if (type !== 'all' && r.adjustment_type !== type) return false;
      if (!term) return true;
      const hay = [
        r.client_name, r.performed_by_email, r.reason,
        r.adjustment_type,
        ...(r.ad_account_names || []),
        ...(r.ad_account_ids || []),
      ].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(term);
    });
  }, [rows, q, type]);

  const types = useMemo(() => {
    const s = new Set<string>();
    rows.forEach(r => s.add(r.adjustment_type));
    return Array.from(s);
  }, [rows]);

  return (
    <div className="space-y-6">
      <PageHero
        title="Ajustes Manuais"
        description="Histórico de todas as correções feitas manualmente pela equipe (gastos, comissões, saldos)."
      />


      <Card className="p-4">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por cliente, conta, usuário ou motivo..."
              value={q}
              onChange={e => setQ(e.target.value)}
              className="pl-8"
            />
          </div>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="w-56">
              <Filter className="h-4 w-4 mr-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              {types.map(t => (
                <SelectItem key={t} value={t}>{ADJUSTMENT_TYPE_LABELS[t] || t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={load} disabled={loading} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar
          </Button>
          <div className="text-sm text-muted-foreground ml-auto">
            {filtered.length} de {rows.length} registros
          </div>
        </div>
      </Card>

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr className="text-left">
                <th className="p-3">Data</th>
                <th className="p-3">Usuário</th>
                <th className="p-3">Cliente</th>
                <th className="p-3">Tipo</th>
                <th className="p-3">Contas</th>
                <th className="p-3">Período</th>
                <th className="p-3 text-right">Anterior</th>
                <th className="p-3 text-right">Novo</th>
                <th className="p-3 text-right">Δ</th>
                <th className="p-3">Motivo</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={10} className="p-8 text-center text-muted-foreground">Carregando…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={10} className="p-8 text-center text-muted-foreground">Nenhum ajuste encontrado.</td></tr>
              ) : filtered.map(r => (
                <tr key={r.id} className="border-t border-border/50 hover:bg-muted/20 align-top">
                  <td className="p-3 whitespace-nowrap font-mono text-xs">
                    {format(new Date(r.created_at), 'dd/MM/yy HH:mm')}
                  </td>
                  <td className="p-3 text-xs">{r.performed_by_email || '—'}</td>
                  <td className="p-3 font-medium">{r.client_name || '—'}</td>
                  <td className="p-3">
                    <Badge variant="outline">
                      {ADJUSTMENT_TYPE_LABELS[r.adjustment_type] || r.adjustment_type}
                    </Badge>
                  </td>
                  <td className="p-3 text-xs">
                    {(r.ad_account_names || []).length > 0
                      ? (r.ad_account_names || []).join(', ')
                      : (r.ad_account_ids || []).join(', ') || '—'}
                  </td>
                  <td className="p-3 text-xs whitespace-nowrap">
                    {r.period_start && r.period_end
                      ? `${format(new Date(r.period_start), 'dd/MM')} → ${format(new Date(r.period_end), 'dd/MM/yy')}`
                      : '—'}
                  </td>
                  <td className="p-3 text-right font-mono">{fmtMoney(r.previous_value)}</td>
                  <td className="p-3 text-right font-mono">{fmtMoney(r.new_value)}</td>
                  <td className={`p-3 text-right font-mono font-semibold ${
                    (r.delta || 0) > 0 ? 'text-primary' : (r.delta || 0) < 0 ? 'text-destructive' : ''
                  }`}>
                    {r.delta === null ? '—' : (r.delta > 0 ? '+' : '') + fmtMoney(r.delta)}
                  </td>
                  <td className="p-3 text-xs max-w-[280px]">{r.reason || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
